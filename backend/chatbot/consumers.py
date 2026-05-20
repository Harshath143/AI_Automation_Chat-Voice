import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone
from .chatbot_service import ChatbotService, SLOT_SCHEMAS
from .models import Conversation, Message
from core.groq_client import GroqClient
from tickets.models import Ticket

logger = logging.getLogger(__name__)

class ChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.session_id = self.scope['url_route']['kwargs']['session_id']
        self.room_group_name = f'chat_{self.session_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"WebSocket connected for session: {self.session_id}")

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info(f"WebSocket disconnected for session: {self.session_id}")

    async def receive_json(self, content):
        """
        Receives customer text, streams LLM response, and broadcasts metadata.
        """
        user_text = content.get('text', '').strip()
        if not user_text:
            return

        # 1. Emit typing indicator immediately
        await self.send_json({
            "type": "status",
            "status": "typing"
        })

        # 2. Setup services and state
        chatbot_service = ChatbotService()
        groq_client = GroqClient()

        # 3. Handle database inputs (customer message, intent, slot updates)
        state = await self._pre_process_chat_state(chatbot_service, self.session_id, user_text)
        intent = state["intent"]
        confidence = state["confidence"]
        faq_context = state["faq_context"]
        history_context = state["history_context"]
        slots_state = state["slots_state"]
        customer_name = state["customer_name"]
        ticket_number = state["ticket_number"]
        ticket_id = state["ticket_id"]
        ticket_created = state["ticket_created"]

        # 4. Generate system prompt
        system_prompt = f"""You are Sofia, a professional AI assistant for the Visa Support Centre. You assist customers with visa applications, document requirements, appointment scheduling, and complaint handling.

Rules:
- Always greet with name if known (known customer name: {customer_name})
- Ask one clarifying question at a time. Do not dump multiple questions at once.
- For document issues, list exactly what is missing or required.
- For escalation or ticket creation, acknowledge urgency and explicitly confirm their ticket number: {ticket_number or 'N/A'}
- Never make promises about visa approval or stamp timeframes.
- Respond in the same language the customer uses.
- Keep responses under 100 words unless explicitly listing missing documents.

FAQ Knowledge Guidelines:
{faq_context}

Customer Intent Detected: {intent} (confidence: {confidence})
Current Slots Progress: {json.dumps(slots_state.get('slots', {}))}
Ticket ID if exists: {ticket_id}
Ticket Number if exists: {ticket_number}
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is my latest message: {user_text}\nProvide a response based on the conversation rules."}
        ]

        # 5. Stream LLM tokens
        await self.send_json({
            "type": "status",
            "status": "streaming"
        })

        full_bot_response = ""
        try:
            for token in groq_client.chat_completion_stream(
                messages=messages,
                model="llama-3.1-8b-instant",
                temperature=0.3
            ):
                full_bot_response += token
                await self.send_json({
                    "type": "token",
                    "text": token
                })
        except Exception as e:
            logger.error(f"Error streaming response: {e}")
            full_bot_response = "I apologize, but I encountered a slight connection issue. How can I assist you further?"
            await self.send_json({
                "type": "token",
                "text": full_bot_response
            })

        # 6. Save bot response to DB and finalize state (increment attempt counts if needed)
        post_state = await self._post_process_chat_state(
            chatbot_service, self.session_id, full_bot_response, intent, slots_state, ticket_created
        )
        
        # If ticket was created on post processing (e.g. clarification attempts reached)
        if post_state["ticket_created"]:
            ticket_created = True
            ticket_id = post_state["ticket_id"]
            ticket_number = post_state["ticket_number"]

        # 7. Emit final response metadata
        await self.send_json({
            "type": "metadata",
            "intent": intent,
            "confidence": confidence,
            "slots_filled": slots_state.get("slots", {}),
            "ticket_created": ticket_created,
            "ticket_id": ticket_id,
            "ticket_number": ticket_number
        })

    # ==========================================
    # Database Helper Methods (Async Hooks)
    # ==========================================

    @database_sync_to_async
    def _pre_process_chat_state(self, service: ChatbotService, conversation_id: str, content: str):
        conversation, _ = Conversation.objects.get_or_create(id=conversation_id)

        # Save customer message
        customer_msg = Message.objects.create(
            conversation=conversation,
            sender_role="customer",
            content=content
        )

        # Intent
        intent, confidence = service.intent_service.classify(content)
        customer_msg.intent = intent
        customer_msg.intent_confidence = confidence
        customer_msg.save()

        # Slots State
        slots_state = conversation.slots_state or {}
        if intent in SLOT_SCHEMAS:
            if slots_state.get("active_intent") != intent:
                slots_state = {
                    "active_intent": intent,
                    "clarification_attempts": 0,
                    "slots": {slot: None for slot in SLOT_SCHEMAS[intent]}
                }
            slots_state = service._extract_slots(content, slots_state)
            conversation.slots_state = slots_state
            conversation.save()

        # Ticket triggers
        ticket_created = False
        ticket_id = None
        ticket_number = None

        should_create_ticket = False
        if intent in SLOT_SCHEMAS:
            active_slots = slots_state.get("slots", {})
            filled_slots = [k for k, v in active_slots.items() if v is not None]
            required_slots = SLOT_SCHEMAS[intent]
            if len(filled_slots) >= len(required_slots):
                should_create_ticket = True
            elif slots_state.get("clarification_attempts", 0) >= 2:
                should_create_ticket = True
        elif intent in ["complaint_escalation", "human_handoff_request"] and confidence >= 0.70:
            should_create_ticket = True

        if should_create_ticket and not Ticket.objects.filter(conversation_id=conversation.id).exists():
            ticket = service._auto_create_ticket(conversation, intent, slots_state)
            ticket_created = True
            ticket_id = str(ticket.id)
            ticket_number = ticket.ticket_number
            conversation.customer = ticket.customer
            conversation.save()

        # Retrieve FAQs
        faqs = service.faq_service.retrieve_top_faqs(content, top_n=3)
        faq_context = "\n".join([f"Q: {faq['question']}\nA: {faq['answer']}" for faq in faqs])

        # Message History
        history = Message.objects.filter(conversation=conversation).order_by('timestamp')[:10]
        history_context = ""
        for h in history:
            role_label = "Customer" if h.sender_role == "customer" else "Sofia"
            history_context += f"{role_label}: {h.content}\n"

        customer_name = conversation.customer.full_name if conversation.customer else "Customer"

        return {
            "intent": intent,
            "confidence": confidence,
            "faq_context": faq_context,
            "history_context": history_context,
            "slots_state": slots_state,
            "customer_name": customer_name,
            "ticket_number": ticket_number,
            "ticket_id": ticket_id,
            "ticket_created": ticket_created
        }

    @database_sync_to_async
    def _post_process_chat_state(self, service: ChatbotService, conversation_id: str, response: str, intent: str, slots_state: dict, ticket_created_before: bool):
        conversation = Conversation.objects.get(id=conversation_id)
        
        # Save Bot message
        Message.objects.create(
            conversation=conversation,
            sender_role="bot",
            content=response
        )

        ticket_created = ticket_created_before
        ticket_id = None
        ticket_number = None

        # If not yet ticket, increment attempts or evaluate triggers
        if intent in SLOT_SCHEMAS and not ticket_created:
            active_slots = slots_state.get("slots", {})
            filled_slots = [k for k, v in active_slots.items() if v is not None]
            if len(filled_slots) < len(SLOT_SCHEMAS[intent]):
                slots_state["clarification_attempts"] = slots_state.get("clarification_attempts", 0) + 1
                conversation.slots_state = slots_state
                conversation.save()

                # If reached limit, auto trigger ticket
                if slots_state["clarification_attempts"] >= 2 and not Ticket.objects.filter(conversation_id=conversation.id).exists():
                    ticket = service._auto_create_ticket(conversation, intent, slots_state)
                    ticket_created = True
                    ticket_id = str(ticket.id)
                    ticket_number = ticket.ticket_number
                    conversation.customer = ticket.customer
                    conversation.save()

        return {
            "ticket_created": ticket_created,
            "ticket_id": ticket_id,
            "ticket_number": ticket_number
        }

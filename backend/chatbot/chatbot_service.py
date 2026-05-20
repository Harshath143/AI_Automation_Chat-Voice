import json
import logging
from django.utils import timezone
from .models import Conversation, Message
from .intent_service import IntentService
from .faq_service import FAQService
from core.groq_client import GroqClient
from tickets.models import Customer, Ticket

logger = logging.getLogger(__name__)

SLOT_SCHEMAS = {
    "visa_status_enquiry": ["application_number", "full_name", "dob"],
    "appointment_reschedule": ["current_date", "preferred_date", "reason"],
    "complaint_escalation": ["issue_description", "urgency_level"]
}

class ChatbotService:
    def __init__(self):
        self.groq_client = GroqClient()
        self.intent_service = IntentService()
        self.faq_service = FAQService()

    def process_message(self, conversation_id: str, content: str, sender_role: str = "customer"):
        """
        Processes a new incoming message from the customer.
        Returns:
            dict: {
                "text": str (LLM response),
                "intent": str,
                "confidence": float,
                "ticket_created": bool,
                "ticket_id": str | None,
                "ticket_number": str | None
            }
        """
        # 1. Fetch or create conversation
        conversation, created = Conversation.objects.get_or_create(id=conversation_id)

        # 2. Record Customer Message
        customer_msg = Message.objects.create(
            conversation=conversation,
            sender_role=sender_role,
            content=content
        )

        # 3. Detect Intent & Confidence
        intent, confidence = self.intent_service.classify(content)
        customer_msg.intent = intent
        customer_msg.intent_confidence = confidence
        customer_msg.save()

        # 4. Manage Stateful Slot Filling
        slots_state = conversation.slots_state or {}
        active_intent = slots_state.get("active_intent")
        
        target_intent = None
        if intent in SLOT_SCHEMAS:
            target_intent = intent
            # Only reset slots if switching to a DIFFERENT intent
            if active_intent != intent:
                slots_state = {
                    "active_intent": intent,
                    "clarification_attempts": 0,
                    "slots": {slot: None for slot in SLOT_SCHEMAS[intent]}
                }
                active_intent = intent
            # Same intent: keep existing slots, just extract more
        elif active_intent in SLOT_SCHEMAS:
            target_intent = active_intent
            
        if target_intent:
            # Update slots using LLM extraction
            slots_state = self._extract_slots(content, slots_state)
            conversation.slots_state = slots_state
            conversation.save()
            # Retain active intent as the operational context intent
            intent = target_intent

        # 5. Check ticket requirements or trigger rules
        ticket_created = False
        ticket_id = None
        ticket_number = None

        # Auto-creation rule: All slots filled, or clarification fallback, or direct intent
        should_create_ticket = False
        check_intent = target_intent or intent
        if check_intent in SLOT_SCHEMAS:
            active_slots = slots_state.get("slots", {})
            filled_slots = [k for k, v in active_slots.items() if v is not None]
            required_slots = SLOT_SCHEMAS[check_intent]
            intent = check_intent
            
            # Fire if all required slots are filled
            if len(filled_slots) >= len(required_slots):
                should_create_ticket = True
            # Fire if customer has given 2+ attempts but slots still missing
            elif slots_state.get("clarification_attempts", 0) >= 2:
                should_create_ticket = True
        elif intent in ["complaint_escalation", "human_handoff_request"] and confidence >= 0.70:
            should_create_ticket = True

        if should_create_ticket and not Ticket.objects.filter(conversation_id=conversation.id).exists():
            ticket = self._auto_create_ticket(conversation, intent, slots_state)
            ticket_created = True
            ticket_id = str(ticket.id)
            ticket_number = ticket.ticket_number
            # Link customer to conversation
            conversation.customer = ticket.customer
            conversation.save()

        # 6. Retrieve relevant FAQ context
        faqs = self.faq_service.retrieve_top_faqs(content, top_n=3)
        faq_context = "\n".join([f"Q: {faq['question']}\nA: {faq['answer']}" for faq in faqs])

        # 7. Assemble conversation transcript history (last 10 turns)
        history = Message.objects.filter(conversation=conversation).order_by('timestamp')
        history_context = ""
        for h in history:
            role_label = "Customer" if h.sender_role == "customer" else "Sofia"
            history_context += f"{role_label}: {h.content}\n"

        # 8. Render professional response prompt
        customer_name = conversation.customer.full_name if conversation.customer else "Customer"
        
        system_prompt = f"""You are Sofia, a professional AI assistant for the Visa Support Centre. You assist customers with visa applications, document requirements, appointment scheduling, and complaint handling.

Rules:
- Always greet with name if known (known customer name: {customer_name})
- Ask one clarifying question at a time. Do not dump multiple questions at once.
- For document issues, list exactly what is missing or required.
- For escalation or ticket creation, acknowledge urgency and explicitly confirm their ticket number: {ticket_number}
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

        # Generate response
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Here is my latest message: {content}\nProvide a response based on the conversation rules."}
        ]

        # Use fast text engine
        bot_response = self.groq_client.chat_completion(
            messages=messages,
            model="llama-3.1-8b-instant",
            temperature=0.3
        )

        # Record bot response in database
        Message.objects.create(
            conversation=conversation,
            sender_role="bot",
            content=bot_response
        )

        # Increment clarification attempt if slot is still missing and not yet converted to ticket
        if intent in SLOT_SCHEMAS and not ticket_created:
            active_slots = slots_state.get("slots", {})
            filled_slots = [k for k, v in active_slots.items() if v is not None]
            if len(filled_slots) < len(SLOT_SCHEMAS[intent]):
                slots_state["clarification_attempts"] = slots_state.get("clarification_attempts", 0) + 1
                conversation.slots_state = slots_state
                conversation.save()

        return {
            "text": bot_response,
            "intent": intent,
            "confidence": confidence,
            "ticket_created": ticket_created,
            "ticket_id": ticket_id,
            "ticket_number": ticket_number
        }

    def _extract_slots(self, message: str, slots_state: dict) -> dict:
        """
        Uses Groq LLM to pull slot parameters from user message text.
        """
        active_slots = slots_state.get("slots", {})
        
        system_instruction = """You are a highly precise slot-extraction assistant for a Visa Support Centre. Your job is to analyze a customer message and extract slot field values from it, returning a clean JSON object.

Rules for Extraction:
1. "dob" (Date of Birth): Convert ANY date format (e.g. "07/12/2000", "July 7 2000", "12 July 2000", "12/07/2000") to standard ISO 'YYYY-MM-DD' format.
2. "full_name" (Full Name): Extract only a personal name. Do NOT put dates, numbers, or codes into this slot.
3. "application_number": Extract alphanumeric visa reference codes (e.g. "DXB-2026-99214A", "REF-202605-IMM").
4. "current_date" (Current Appointment Date): Extract the existing/current appointment date from phrases like "current date", "my appointment is on", "from", "existing date". Convert to ISO 'YYYY-MM-DD' if possible, or keep as provided.
5. "preferred_date" (Preferred New Date): Extract the desired new date from phrases like "preferred date", "new date", "reschedule to", "instead of", "change to". Convert to ISO 'YYYY-MM-DD' if possible, or keep as provided.
6. "reason" (Reason): Extract the reason/cause from phrases like "reason is", "because", "due to", "as", or any explanatory phrase.
7. "issue_description": Extract a full description of the customer's complaint or issue.
8. "urgency_level": Extract urgency indicators like "high", "critical", "extremely urgent", "standard", etc.
9. DO NOT overwrite an already-filled slot unless the customer explicitly changes it.
10. If a value is not found in the message, keep the existing value exactly as-is (do not set to null).

Respond with a valid JSON object ONLY. No explanations, no markdown. Just valid JSON."""

        prompt = f"""Existing Slot Variables: {json.dumps(active_slots)}
Customer Message: "{message}"

Extract any missing or updated slot values and return the complete JSON with all keys:"""
        
        try:
            response = self.groq_client.chat_completion(
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": prompt}
                ],
                model="llama-3.1-8b-instant",
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            extracted = json.loads(response)
            for k in active_slots:
                if extracted.get(k) is not None:
                    active_slots[k] = extracted[k]
            slots_state["slots"] = active_slots
        except Exception as e:
            logger.error(f"Error during slot extraction: {e}")
            
        return slots_state

    def _auto_create_ticket(self, conversation, intent: str, slots_state: dict) -> Ticket:
        """
        Creates an automatic ticket under Customer relations based on active slot fills.
        """
        if conversation.customer:
            customer = conversation.customer
            customer_name = customer.full_name
        else:
            slots = slots_state.get("slots", {})
            customer_name = slots.get("full_name") or "Anonymous Customer"
            customer_email = slots.get("email") or f"customer_{str(conversation.id)[:8]}@support.com"
            
            # Create or fetch Customer
            customer, created = Customer.objects.get_or_create(
                email=customer_email,
                defaults={"full_name": customer_name}
            )

        # 2. Determine department routing based on intent
        dept_mapping = {
            "visa_status_enquiry": "Visa Processing Team",
            "missing_document": "Document Verification Team",
            "appointment_reschedule": "Appointment Management Team",
            "complaint_escalation": "Customer Relations",
            "general_enquiry": "General Support"
        }
        department = dept_mapping.get(intent, "General Support")

        # 3. Determine priority (Default to medium, complaints to critical/high)
        priority = Ticket.PriorityChoice.MEDIUM
        if intent == "complaint_escalation":
            priority = Ticket.PriorityChoice.CRITICAL
        elif intent == "human_handoff_request":
            priority = Ticket.PriorityChoice.HIGH

        # 4. Generate Ticket
        ticket = Ticket.objects.create(
            customer=customer,
            channel=Ticket.ChannelChoice.CHAT,
            intent=intent,
            priority=priority,
            department=department,
            status=Ticket.StatusChoice.OPEN,
            summary=f"Automated ticket created for {intent} after customer chat engagement.",
            conversation_id=conversation.id
        )

        logger.info(f"Auto-created ticket {ticket.ticket_number} for customer {customer_name}")
        
        # 5. Trigger Async tasks
        try:
            from tickets.tasks import process_new_ticket_workflow
            process_new_ticket_workflow.delay(str(ticket.id))
        except Exception as e:
            logger.error(f"Failed to queue Celery ticket tasks: {e}. Executing inline for fallback.")
            # Fallback inline workflow if Celery is not active
            ticket.summary = f"Customer initiated {intent} support request. Current details parsed: {json.dumps(slots)}"
            ticket.save()

        return ticket

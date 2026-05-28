import json
import logging
from core.groq_client import GroqClient

logger = logging.getLogger(__name__)

class IntentService:
    def __init__(self):
        self.groq_client = GroqClient()
        self.intents = [
            "visa_status_enquiry",
            "missing_document",
            "appointment_reschedule",
            "complaint_escalation",
            "general_enquiry",
            "document_upload",
            "human_handoff_request",
            "apostille_services",
            "visa_travel_concierge",
            "pro_gro_services"
        ]

    def classify(self, message_text: str):
        """
        Classifies user message. Runs fast local heuristic checks, 
        and falls back to Groq for robust zero-shot classification.
        """
        text = message_text.lower().strip()

        # 1. Direct High-Confidence Heuristics (order matters — most specific first)
        if any(w in text for w in ["reschedule", "change appointment", "change my appointment", "booking date", "new date", "rebook", "move my appointment"]):
            return "appointment_reschedule", 0.95

        if any(w in text for w in ["escalate", "manager", "director", "complain", "complaint", "awful", "terrible"]):
            return "complaint_escalation", 0.95

        if any(w in text for w in ["speak to a human", "talk to an agent", "speak to an agent", "human agent", "real person", "speak to someone", "talk to someone", "connect me to"]):
            return "human_handoff_request", 1.0

        if any(w in text for w in ["upload", "submit passport", "send file", "attach", "attachment", "pdf"]):
            return "document_upload", 0.90

        if any(w in text for w in ["apostille", "hague convention", "hague stamp", "apostil"]):
            return "apostille_services", 0.95

        if any(w in text for w in ["concierge", "travel support", "tourist visa", "business visa", "relocate", "relocation support"]):
            return "visa_travel_concierge", 0.95

        if any(w in text for w in ["pro service", "gro service", "corporate setup", "company formation", "trade license", "incorporate", "incorporation", "freezone"]):
            return "pro_gro_services", 0.95

        if any(w in text for w in ["status", "where is my", "tracking", "track visa", "application number", "check my visa", "visa status"]):
            return "visa_status_enquiry", 0.95

        if any(w in text for w in ["missing", "incomplete", "need to provide", "additional document"]):
            return "missing_document", 0.90

        # 2. Fallback to Groq for Zero-Shot Classification
        try:
            prompt = f"""
            Classify the intent of the following customer message for a professional services and visa support centre.
            Choose exactly one intent from this list:
            - visa_status_enquiry: customer tracking status or asking about progress.
            - missing_document: customer asking about missing documents or requirements.
            - appointment_reschedule: customer wanting to change, cancel or book appointment dates.
            - complaint_escalation: customer expressing frustration, threat, or demanding management attention.
            - general_enquiry: standard greetings, hours, simple FAQ questions.
            - document_upload: customer explicitly wanting to upload a file (passport, Emirates ID, visa).
            - human_handoff_request: customer requesting to talk to a human agent.
            - apostille_services: customer asking about Hague Convention apostille stamps.
            - visa_travel_concierge: customer needing assistance with travel, business, tourist, or golden visas and concierge services.
            - pro_gro_services: customer asking about corporate company setups, trade license renewals, freezone operations, or corporate PRO services.

            Return a valid JSON object ONLY, with keys "intent" (string) and "confidence" (float between 0.0 and 1.0).
            Do not include any explanation.

            Customer Message: "{message_text}"
            """
            
            response = self.groq_client.chat_completion(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
                temperature=0.0,
                response_format={"type": "json_object"}
            )
            
            data = json.loads(response)
            intent = data.get("intent")
            confidence = data.get("confidence", 0.8)

            if intent in self.intents:
                logger.info(f"Groq Intent Classification: {intent} (conf: {confidence})")
                return intent, confidence

        except Exception as e:
            logger.error(f"Error during intent classification: {e}")

        # Default fallback
        return "general_enquiry", 0.50

import os
import json
import logging
import time
import base64
from django.conf import settings

logger = logging.getLogger(__name__)

class GroqClient:
    def __init__(self):
        self.api_key = getattr(settings, 'GROQ_API_KEY', '')
        self.client = None
        self.is_mocked = True

        if self.api_key and not self.api_key.startswith('your-groq-api-key'):
            try:
                from groq import Groq
                self.client = Groq(api_key=self.api_key)
                self.is_mocked = False
                logger.info("Groq client initialized successfully.")
            except ImportError:
                logger.warning("Groq SDK not installed. Falling back to Mock mode.")
            except Exception as e:
                logger.error(f"Failed to initialize Groq client: {e}. Falling back to Mock mode.")
        else:
            logger.warning("GROQ_API_KEY not configured or using default template. Running in Mock Mode.")

    def chat_completion(self, messages, model="llama-3.1-8b-instant", temperature=0.2, max_tokens=1000, response_format=None):
        """
        Standard non-streaming chat completion.
        """
        if self.is_mocked:
            return self._mock_chat_completion(messages, response_format)

        try:
            kwargs = {
                "model": model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens
            }
            if response_format:
                kwargs["response_format"] = response_format

            completion = self.client.chat.completions.create(**kwargs)
            return completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq API Error: {e}. Falling back to Mock.")
            return self._mock_chat_completion(messages, response_format)

    def chat_completion_stream(self, messages, model="llama-3.1-8b-instant", temperature=0.2, max_tokens=1000):
        """
        Streaming chat completion (generator yielding token strings).
        """
        if self.is_mocked:
            for token in self._mock_chat_completion_stream(messages):
                yield token
            return

        try:
            stream = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
                stream=True
            )
            for chunk in stream:
                content = chunk.choices[0].delta.content
                if content:
                    yield content
        except Exception as e:
            logger.error(f"Groq API Stream Error: {e}. Falling back to Mock Stream.")
            for token in self._mock_chat_completion_stream(messages):
                yield token

    def vision_ocr(self, image_base64, document_type, prompt):
        """
        Uses meta-llama/llama-4-scout-17b-16e-instruct to read image and output structured JSON.
        """
        if self.is_mocked:
            time.sleep(1.5)  # Simulate API latency
            return self._mock_vision_ocr(document_type)

        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ]

            completion = self.client.chat.completions.create(
                model="meta-llama/llama-4-scout-17b-16e-instruct",
                messages=messages,
                temperature=0.1,
                max_tokens=1024,
                response_format={"type": "json_object"}
            )
            return completion.choices[0].message.content
        except Exception as e:
            logger.error(f"Groq Vision API Error: {e}. Falling back to Mock OCR.")
            return self._mock_vision_ocr(document_type)

    # ==========================================
    # Mock Engines for Offline/Standalone Demo
    # ==========================================

    def _mock_chat_completion(self, messages, response_format=None):
        user_message = messages[-1]["content"].lower() if messages else ""
        
        # If standard JSON is requested (e.g. priority classification, slot filling)
        if response_format and response_format.get("type") == "json_object":
            if "priority" in user_message or "classify the priority" in user_message:
                priority = "medium"
                if any(x in user_message for x in ["urgent", "expires in 5 days", "detained", "critical"]):
                    priority = "critical"
                elif "reschedule" in user_message or "missing" in user_message:
                    priority = "high"
                return json.dumps({
                    "priority": priority,
                    "reason": "Determined via custom rule matches during high-availability offline processing."
                })
            
            # Default fallback for other JSON types (slots filling extractions)
            return json.dumps({
                "application_number": "AP-992384",
                "full_name": "Alexander Smith",
                "dob": "1990-05-15",
                "current_date": "2026-05-20",
                "preferred_date": "2026-06-10",
                "reason": "Business meeting escalation"
            })

        # Standard text conversations
        if "urgent" in user_message or "expires in 5 days" in user_message or "manager" in user_message:
            return "I completely understand the urgency regarding your expiring visa. I have automatically escalated this to critical priority and routed your ticket to the Customer Relations manager. A manager will contact you immediately at your registered email."
        
        if "status" in user_message or "track" in user_message:
            return "Certainly! To look up your application, could you please provide your 8-digit Visa Application Number, Full Name, and Date of Birth (YYYY-MM-DD)?"

        if "reschedule" in user_message or "appointment" in user_message:
            return "I would be happy to help you reschedule your visa biometric or interview appointment. Could you please specify your preferred new appointment date (YYYY-MM-DD) and your reason for rescheduling?"

        return "Hello! I am Sofia, your professional AI assistant for the Visa Support Centre. How can I assist you today with visa status tracking, document uploads, or appointment scheduling?"

    def _mock_chat_completion_stream(self, messages):
        response_text = self._mock_chat_completion(messages)
        # Yield response word by word with micro delays to simulate streaming
        words = response_text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            time.sleep(0.03)

    def _mock_vision_ocr(self, document_type):
        if document_type == 'passport':
            return json.dumps({
                "full_name": "ALEXANDER SMITH",
                "document_number": "PA8723948",
                "nationality": "British Citizen",
                "date_of_birth": "1988-04-12",
                "expiry_date": "2029-08-25",
                "issuing_authority": "UKPA",
                "mrz_line1": "P<GBRSMITH<<ALEXANDER<<<<<<<<<<<<<<<<<<<<<<",
                "mrz_line2": "PA87239483GBR8804128M2908256<<<<<<<<<<<<<<06",
                "ocr_confidence": 0.94
            })
        elif document_type == 'emirates_id':
            return json.dumps({
                "full_name": "Fatima Al-Mansoori",
                "document_number": "784-1992-1234567-3",
                "nationality": "United Arab Emirates",
                "date_of_birth": "1992-11-04",
                "expiry_date": "2028-11-03",
                "issuing_authority": "ICA",
                "ocr_confidence": 0.91
            })
        elif document_type == 'educational_degree':
            return json.dumps({
                "full_name": "Alexander Smith",
                "institution_name": "University of Oxford",
                "degree_title": "Master of Computer Science",
                "graduation_date": "2010-06-18",
                "has_notary_seal": "yes",
                "has_mofa_stamp": "yes",
                "has_embassy_sticker": "yes",
                "ocr_confidence": 0.94
            })
        elif document_type == 'birth_certificate':
            return json.dumps({
                "full_name": "Baby John Smith",
                "date_of_birth": "2021-02-15",
                "place_of_birth": "London, UK",
                "parent_names": "Alexander Smith, Mary Smith",
                "has_notary_seal": "yes",
                "has_mofa_stamp": "yes",
                "has_embassy_sticker": "no",
                "ocr_confidence": 0.88
            })
        elif document_type == 'commercial_certificate':
            return json.dumps({
                "company_name": "BVS TECH SOLUTIONS LLC",
                "registration_number": "CR-992384A",
                "license_type": "Limited Liability Company",
                "expiry_date": "2027-11-20",
                "has_notary_seal": "yes",
                "has_mofa_stamp": "yes",
                "has_embassy_sticker": "yes",
                "ocr_confidence": 0.95
            })
        else: # Visa copy
            return json.dumps({
                "full_name": "JOHN DOE",
                "document_number": "V-9938491",
                "visa_type": "Employment Residence",
                "date_of_birth": "1985-09-20",
                "expiry_date": "2027-02-15",
                "issuing_authority": "GDRFA Dubai",
                "ocr_confidence": 0.88
            })

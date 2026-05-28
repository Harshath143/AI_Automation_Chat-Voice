import base64
import json
import logging
import time
from io import BytesIO
from PIL import Image, ImageEnhance
from django.conf import settings
from core.groq_client import GroqClient
from .validators import run_comprehensive_validation

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        self.groq_client = GroqClient()

    def process_document(self, file_content: bytes, document_type: str) -> dict:
        """
        Preprocesses document image, uploads to Groq Vision, 
        extracts details and performs automated validations.
        """
        start_time = time.time()
        
        # 1. Image Pre-processing (PIL-based grayscale + contrast enhancement)
        try:
            image = Image.open(BytesIO(file_content))
            # Convert to grayscale if it is complex, enhance contrast
            image = image.convert('L')
            enhancer = ImageEnhance.Contrast(image)
            enhanced_image = enhancer.enhance(1.8)
            
            # Save back to base64 string
            buffered = BytesIO()
            enhanced_image.save(buffered, format="JPEG")
            img_bytes = buffered.getvalue()
            base64_str = base64.b64encode(img_bytes).decode('utf-8')
        except Exception as e:
            logger.error(f"Image preprocessing failed: {e}. Processing original bytes directly.")
            base64_str = base64.b64encode(file_content).decode('utf-8')

        # 2. Build Groq Vision JSON Prompts
        prompt = self._get_ocr_prompt(document_type)

        # 3. Call Groq Vision API
        try:
            logger.info(f"Submitting {document_type} to Groq Vision OCR engine...")
            raw_response = self.groq_client.vision_ocr(
                image_base64=base64_str,
                document_type=document_type,
                prompt=prompt
            )
            
            extracted_fields = json.loads(raw_response)
        except Exception as e:
            logger.error(f"Groq Vision execution failed: {e}. Emitting mock/empty fallback.")
            extracted_fields = {}

        # Ensure OCR confidence is set (default to 0.95 if model succeeds, or lower if empty)
        ocr_confidence = extracted_fields.get("ocr_confidence", 0.95 if extracted_fields else 0.50)
        extracted_fields["ocr_confidence"] = ocr_confidence

        # 4. Run Comprehensive Validations
        status, flags = run_comprehensive_validation(document_type, extracted_fields)

        processing_time = int((time.time() - start_time) * 1000)
        logger.info(f"Processed {document_type} in {processing_time}ms. Status: {status}")

        return {
            "document_type": document_type,
            "status": status,
            "extracted_fields": extracted_fields,
            "validation_flags": flags,
            "ocr_confidence": ocr_confidence,
            "processing_time_ms": processing_time
        }

    def _get_ocr_prompt(self, document_type: str) -> str:
        """
        Returns specialized structured extraction instructions.
        """
        if document_type == 'passport':
            return """
            You are an expert immigration officer and OCR engine.
            Analyze this uploaded image of a PASSPORT and extract fields with high precision.
            Return a valid JSON object ONLY, with these keys:
            - full_name: The applicant's full name (usually combining Surname and Given Names).
            - document_number: The passport number. Must be uppercase alphanumeric.
            - nationality: The nationality of the passport holder.
            - date_of_birth: The date of birth in YYYY-MM-DD format.
            - expiry_date: The passport expiry date in YYYY-MM-DD format.
            - issuing_authority: Country or authority code.
            - mrz_line1: Machine Readable Zone line 1 (the long text line at the very bottom, starting with 'P').
            - mrz_line2: Machine Readable Zone line 2 (the second long text line at the very bottom).
            - ocr_confidence: float between 0.0 and 1.0 representing your reading clarity confidence.

            If a field is unreadable, assign its value to null. 
            Do not include any chat commentary or wrap the JSON in markdown code blocks.
            """
        elif document_type == 'emirates_id':
            return """
            You are an expert UAE immigration officer and OCR engine.
            Analyze this uploaded image of an EMIRATES ID and extract fields with high precision.
            Return a valid JSON object ONLY, with these keys:
            - full_name: The holder's full name in English.
            - document_number: The 15-digit Emirates ID number in format '784-YYYY-XXXXXXX-Z'.
            - nationality: The holder's nationality.
            - date_of_birth: The date of birth in YYYY-MM-DD format.
            - expiry_date: The card expiry date in YYYY-MM-DD format.
            - issuing_authority: 'ICA' or 'Federal Authority for Identity and Citizenship'.
            - ocr_confidence: float between 0.0 and 1.0.

            If a field is unreadable, assign its value to null.
            Do not include any chat commentary.
            """
        elif document_type == 'educational_degree':
            return """
            You are a senior document legalization and verification officer at BVS Global.
            Analyze this image of an EDUCATIONAL DEGREE / DIPLOMA and extract key details with high precision.
            Check for the presence of physical notary seals, Ministry of Foreign Affairs (MOFA) stamps, and Embassy stickers.
            Return a valid JSON object ONLY, with these keys:
            - full_name: The certificate holder's full name.
            - institution_name: The university, college, or school name.
            - degree_title: The degree, diploma, or certificate title (e.g., Bachelor of Computer Science).
            - graduation_date: The graduation date or issue date in YYYY-MM-DD format.
            - has_notary_seal: "yes" or "no" depending on whether a Notary Public stamp/seal is present.
            - has_mofa_stamp: "yes" or "no" depending on whether a Ministry of Foreign Affairs stamp is present.
            - has_embassy_sticker: "yes" or "no" depending on whether an Embassy legalization sticker is present.
            - ocr_confidence: float between 0.0 and 1.0.

            If a field is unreadable, assign its value to null.
            Do not include any chat commentary.
            """
        elif document_type == 'birth_certificate':
            return """
            You are a senior document legalization and verification officer at BVS Global.
            Analyze this image of a BIRTH CERTIFICATE and extract key details with high precision.
            Check for physical notary seals, ministry stamps, and embassy stickers.
            Return a valid JSON object ONLY, with these keys:
            - full_name: The child's or individual's full name.
            - date_of_birth: The date of birth in YYYY-MM-DD format.
            - place_of_birth: The city, state, and country of birth.
            - parent_names: Father and mother full names (concatenated or comma separated).
            - has_notary_seal: "yes" or "no".
            - has_mofa_stamp: "yes" or "no".
            - has_embassy_sticker: "yes" or "no".
            - ocr_confidence: float between 0.0 and 1.0.

            If a field is unreadable, assign its value to null.
            Do not include any chat commentary.
            """
        elif document_type == 'commercial_certificate':
            return """
            You are a senior corporate services officer at BVS Global.
            Analyze this image of a COMMERCIAL REGISTER / TRADE LICENSE and extract details.
            Return a valid JSON object ONLY, with these keys:
            - company_name: The registered company name.
            - registration_number: The commercial register / license number.
            - license_type: The license type (e.g., LLC, Sole Establishment, Freezone).
            - expiry_date: The license expiry date in YYYY-MM-DD format.
            - has_notary_seal: "yes" or "no".
            - has_mofa_stamp: "yes" or "no".
            - has_embassy_sticker: "yes" or "no".
            - ocr_confidence: float between 0.0 and 1.0.

            If a field is unreadable, assign its value to null.
            Do not include any chat commentary.
            """
        else: # Visa Copy
            return """
            You are an expert immigration officer and OCR engine.
            Analyze this uploaded image of a VISA COPY and extract fields with high precision.
            Return a valid JSON object ONLY, with these keys:
            - full_name: The visa beneficiary's full name.
            - document_number: The visa number / permit number.
            - visa_type: The visa category (e.g. Tourist, Employment, Resident).
            - date_of_birth: The date of birth in YYYY-MM-DD format.
            - expiry_date: The visa expiry date in YYYY-MM-DD format.
            - issuing_authority: Government department (e.g. GDRFA, ICA).
            - ocr_confidence: float between 0.0 and 1.0.

            If a field is unreadable, assign its value to null.
            Do not include any chat commentary.
            """
screened_mrz = ""

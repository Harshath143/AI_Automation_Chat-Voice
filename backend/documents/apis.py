import os
import uuid
from typing import List, Optional
from ninja import Router, File, Form, Schema
from ninja.files import UploadedFile
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.http import Http404, HttpResponseBadRequest
from .models import Document
from .ocr_service import OCRService
from tickets.models import Ticket

router = Router()

class ExtractedFieldsSchema(Schema):
    full_name: Optional[str] = None
    document_number: Optional[str] = None
    nationality: Optional[str] = None
    date_of_birth: Optional[str] = None
    expiry_date: Optional[str] = None
    issuing_authority: Optional[str] = None
    mrz_line1: Optional[str] = None
    mrz_line2: Optional[str] = None
    visa_type: Optional[str] = None

class DocumentResponseSchema(Schema):
    document_id: str
    document_type: str
    status: str
    extracted_fields: ExtractedFieldsSchema
    validation_flags: List[str]
    ocr_confidence: float
    processing_time_ms: int
    file_url: str

@router.post("/upload", response=DocumentResponseSchema)
def upload_document(
    request,
    document_type: str = Form(...),
    ticket_id: Optional[str] = Form(None),
    file: UploadedFile = File(...)
):
    """
    Endpoint accepting Passport, Emirates ID, and Visa copy uploads (Max 10MB).
    Runs visual OCR via Groq Vision and returns parsed structured validations.
    """
    # 1. Enforce file size limit (10MB)
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    if file.size > MAX_SIZE:
        return HttpResponseBadRequest("File size exceeds the 10MB limit.")

    # 2. Enforce file type checks
    allowed_types = ["image/jpeg", "image/png", "application/pdf"]
    if file.content_type not in allowed_types:
        return HttpResponseBadRequest("Invalid file type. Only JPEG, PNG, and PDF are supported.")

    # 3. Store raw file to local storage (Simulates S3 MinIO storage upload)
    fs = FileSystemStorage(
        location=os.path.join(settings.MEDIA_ROOT, 'documents-raw'),
        base_url=settings.MEDIA_URL + 'documents-raw/'
    )
    
    # Generate unique filename to avoid overrides
    ext = os.path.splitext(file.name)[1]
    unique_filename = f"{uuid.uuid4()}{ext}"
    saved_name = fs.save(unique_filename, file)
    file_url = fs.url(saved_name)
    file_path = fs.path(saved_name)

    # 4. Trigger OCR Extraction Service
    ocr_service = OCRService()
    
    # Read file content for processing
    file.seek(0)
    file_content = file.read()
    
    ocr_result = ocr_service.process_document(file_content, document_type)

    # 5. Fetch Ticket reference if provided
    ticket_instance = None
    if ticket_id:
        try:
            ticket_instance = Ticket.objects.get(id=ticket_id)
        except Ticket.DoesNotExist:
            pass

    # 6. Create Document record in database
    doc_record = Document.objects.create(
        ticket=ticket_instance,
        document_type=document_type,
        file_path=file_url,
        status=ocr_result["status"],
        extracted_fields=ocr_result["extracted_fields"],
        validation_flags=ocr_result["validation_flags"],
        ocr_confidence=ocr_result["ocr_confidence"],
        processing_time_ms=ocr_result["processing_time_ms"]
    )

    return {
        "document_id": str(doc_record.id),
        "document_type": doc_record.document_type,
        "status": doc_record.status,
        "extracted_fields": doc_record.extracted_fields,
        "validation_flags": doc_record.validation_flags,
        "ocr_confidence": doc_record.ocr_confidence,
        "processing_time_ms": doc_record.processing_time_ms,
        "file_url": file_url
    }

@router.get("/{document_id}", response=DocumentResponseSchema)
def get_document(request, document_id: str):
    """
    Fetches the details of a single analyzed document.
    """
    try:
        doc = Document.objects.get(id=document_id)
    except Document.DoesNotExist:
        raise Http404("Document not found.")

    return {
        "document_id": str(doc.id),
        "document_type": doc.document_type,
        "status": doc.status,
        "extracted_fields": doc.extracted_fields,
        "validation_flags": doc.validation_flags,
        "ocr_confidence": doc.ocr_confidence,
        "processing_time_ms": doc.processing_time_ms,
        "file_url": doc.file_path
    }

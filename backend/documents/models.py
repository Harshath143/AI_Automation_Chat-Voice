import uuid
from django.db import models
from tickets.models import Ticket

class Document(models.Model):
    class DocumentTypeChoice(models.TextChoices):
        PASSPORT = 'passport', 'Passport'
        VISA = 'visa', 'Visa Copy'
        EMIRATES_ID = 'emirates_id', 'Emirates ID'

    class StatusChoice(models.TextChoices):
        VALID = 'valid', 'Valid'
        INVALID = 'invalid', 'Invalid'
        MANUAL_REVIEW = 'manual_review_required', 'Manual Review Required'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket = models.ForeignKey(Ticket, on_delete=models.SET_NULL, blank=True, null=True, related_name='documents')
    document_type = models.CharField(max_length=20, choices=DocumentTypeChoice.choices)
    file_path = models.CharField(max_length=500)  # MinIO object name or local media path
    status = models.CharField(max_length=30, choices=StatusChoice.choices, default=StatusChoice.MANUAL_REVIEW)
    extracted_fields = models.JSONField(default=dict, blank=True)
    validation_flags = models.JSONField(default=list, blank=True)
    ocr_confidence = models.FloatField(default=1.0)
    processing_time_ms = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.document_type.capitalize()} ({self.status}) - {str(self.id)[:8]}"

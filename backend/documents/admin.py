from django.contrib import admin
from .models import Document

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('id', 'ticket', 'document_type', 'status', 'ocr_confidence', 'processing_time_ms', 'created_at')
    search_fields = ('id', 'ticket__ticket_number', 'file_path', 'extracted_fields')
    list_filter = ('document_type', 'status', 'created_at')
    readonly_fields = ('ocr_confidence', 'processing_time_ms', 'extracted_fields', 'validation_flags')

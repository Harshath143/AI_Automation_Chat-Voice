from django.contrib import admin
from .models import Conversation, Message

class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ('sender_role', 'content', 'intent', 'intent_confidence', 'timestamp')
    can_delete = False

@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'created_at', 'updated_at')
    search_fields = ('id', 'customer__full_name', 'customer__email')
    list_filter = ('created_at',)
    inlines = [MessageInline]

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('conversation', 'sender_role', 'intent', 'intent_confidence', 'timestamp')
    search_fields = ('content', 'intent', 'conversation__id')
    list_filter = ('sender_role', 'timestamp')

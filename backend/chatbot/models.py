import uuid
from django.db import models
from tickets.models import Customer

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, blank=True, null=True, related_name='conversations')
    slots_state = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        customer_name = self.customer.full_name if self.customer else "Anonymous"
        return f"Chat Session {str(self.id)[:8]} - {customer_name}"

class Message(models.Model):
    class SenderRole(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        BOT = 'bot', 'Bot'
        AGENT = 'agent', 'Agent'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender_role = models.CharField(max_length=15, choices=SenderRole.choices)
    content = models.TextField()
    intent = models.CharField(max_length=50, blank=True, null=True)
    intent_confidence = models.FloatField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sender_role.capitalize()}: {self.content[:30]}..."

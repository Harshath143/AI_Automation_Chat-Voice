import uuid
from django.db import models
from django.utils import timezone

class Customer(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    dob = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.full_name

class Ticket(models.Model):
    class ChannelChoice(models.TextChoices):
        CHAT = 'chat', 'Chat'
        EMAIL = 'email', 'Email'

    class PriorityChoice(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    class StatusChoice(models.TextChoices):
        OPEN = 'open', 'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        ESCALATED = 'escalated', 'Escalated'
        RESOLVED = 'resolved', 'Resolved'
        CLOSED = 'closed', 'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ticket_number = models.CharField(max_length=50, unique=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='tickets')
    channel = models.CharField(max_length=10, choices=ChannelChoice.choices, default=ChannelChoice.CHAT)
    intent = models.CharField(max_length=50)
    priority = models.CharField(max_length=15, choices=PriorityChoice.choices, default=PriorityChoice.MEDIUM)
    department = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=StatusChoice.choices, default=StatusChoice.OPEN)
    summary = models.TextField(blank=True, null=True)
    conversation_id = models.UUIDField(blank=True, null=True)
    sla_deadline = models.DateTimeField()
    assigned_agent = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Auto-generate ticket number if not already present
        if not self.ticket_number:
            today_str = timezone.now().strftime('%Y%m%d')
            # Get latest count for today
            count = Ticket.objects.filter(ticket_number__startswith=f"TKT-{today_str}").count() + 1
            self.ticket_number = f"TKT-{today_str}-{count:05d}"
            
        # Calculate SLA deadline based on priority if not set
        if not self.sla_deadline:
            hours = 24
            if self.priority == self.PriorityChoice.CRITICAL:
                hours = 2
            elif self.priority == self.PriorityChoice.HIGH:
                hours = 8
            elif self.priority == self.PriorityChoice.MEDIUM:
                hours = 24
            elif self.priority == self.PriorityChoice.LOW:
                hours = 72
            self.sla_deadline = timezone.now() + timezone.timedelta(hours=hours)

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_number} - {self.customer.full_name} ({self.status})"

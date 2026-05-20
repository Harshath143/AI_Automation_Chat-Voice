import logging
from typing import List, Optional
from ninja import Router, Schema, Field
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Ticket, Customer
from documents.apis import DocumentResponseSchema

router = Router()
logger = logging.getLogger(__name__)

class CustomerSchema(Schema):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    dob: Optional[str] = None

class TicketSchema(Schema):
    id: str
    ticket_number: str
    customer: CustomerSchema
    channel: str
    intent: str
    priority: str
    department: str
    status: str
    summary: Optional[str] = None
    conversation_id: Optional[str] = None
    sla_deadline: str
    assigned_agent: Optional[str] = None
    created_at: str
    updated_at: str

class TicketUpdateSchema(Schema):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_agent: Optional[str] = None
    department: Optional[str] = None

class EscalateRequestSchema(Schema):
    reason: str

@router.get("", response=List[TicketSchema])
def list_tickets(
    request,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None
):
    """
    List support tickets with active filtering options (status, priority, department, search keyword).
    """
    qs = Ticket.objects.select_related('customer').all()

    if status:
        qs = qs.filter(status=status)
    if priority:
        qs = qs.filter(priority=priority)
    if department:
        qs = qs.filter(department=department)
    if search:
        qs = qs.filter(
            ticket_number__icontains=search
        ) | qs.filter(
            customer__full_name__icontains=search
        ) | qs.filter(
            customer__email__icontains=search
        ) | qs.filter(
            intent__icontains=search
        )

    # Convert to expected list format
    results = []
    for t in qs.order_by('-created_at'):
        results.append({
            "id": str(t.id),
            "ticket_number": t.ticket_number,
            "customer": {
                "id": str(t.customer.id),
                "full_name": t.customer.full_name,
                "email": t.customer.email,
                "phone": t.customer.phone,
                "dob": str(t.customer.dob) if t.customer.dob else None
            },
            "channel": t.channel,
            "intent": t.intent,
            "priority": t.priority,
            "department": t.department,
            "status": t.status,
            "summary": t.summary,
            "conversation_id": str(t.conversation_id) if t.conversation_id else None,
            "sla_deadline": t.sla_deadline.isoformat(),
            "assigned_agent": t.assigned_agent,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat()
        })
    return results

@router.get("/{ticket_id}", response=TicketSchema)
def get_ticket(request, ticket_id: str):
    """
    Fetch details of a single support ticket.
    """
    t = get_object_or_404(Ticket.objects.select_related('customer'), id=ticket_id)
    return {
        "id": str(t.id),
        "ticket_number": t.ticket_number,
        "customer": {
            "id": str(t.customer.id),
            "full_name": t.customer.full_name,
            "email": t.customer.email,
            "phone": t.customer.phone,
            "dob": str(t.customer.dob) if t.customer.dob else None
        },
        "channel": t.channel,
        "intent": t.intent,
        "priority": t.priority,
        "department": t.department,
        "status": t.status,
        "summary": t.summary,
        "conversation_id": str(t.conversation_id) if t.conversation_id else None,
        "sla_deadline": t.sla_deadline.isoformat(),
        "assigned_agent": t.assigned_agent,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat()
    }

@router.patch("/{ticket_id}", response=TicketSchema)
def update_ticket(request, ticket_id: str, data: TicketUpdateSchema):
    """
    Update ticket details (assign agent, transition status, adjust priority).
    """
    t = get_object_or_404(Ticket, id=ticket_id)
    
    if data.status:
        t.status = data.status
    if data.priority:
        t.priority = data.priority
        # Recalculate SLA on priority change
        t.sla_deadline = None
    if data.assigned_agent is not None:
        t.assigned_agent = data.assigned_agent
    if data.department:
        t.department = data.department
        
    t.save()
    
    # Reload with customer relation
    t = Ticket.objects.select_related('customer').get(id=t.id)
    
    # Broadcast status change to live dashboard if channels active
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "analytics_dashboard",
                {
                    "type": "broadcast_update",
                    "event": "ticket_updated",
                    "ticket_id": str(t.id),
                    "status": t.status
                }
            )
    except Exception:
        pass

    return {
        "id": str(t.id),
        "ticket_number": t.ticket_number,
        "customer": {
            "id": str(t.customer.id),
            "full_name": t.customer.full_name,
            "email": t.customer.email,
            "phone": t.customer.phone,
            "dob": str(t.customer.dob) if t.customer.dob else None
        },
        "channel": t.channel,
        "intent": t.intent,
        "priority": t.priority,
        "department": t.department,
        "status": t.status,
        "summary": t.summary,
        "conversation_id": str(t.conversation_id) if t.conversation_id else None,
        "sla_deadline": t.sla_deadline.isoformat(),
        "assigned_agent": t.assigned_agent,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat()
    }

@router.post("/{ticket_id}/escalate", response=TicketSchema)
def escalate_ticket(request, ticket_id: str, payload: EscalateRequestSchema):
    """
    Manually escalate a support ticket to critical priority and alert management.
    """
    t = get_object_or_404(Ticket.objects.select_related('customer'), id=ticket_id)
    
    t.status = Ticket.StatusChoice.ESCALATED
    t.priority = Ticket.PriorityChoice.CRITICAL
    t.sla_deadline = timezone.now() + timezone.timedelta(hours=2) # 2 hour deadline for critical manual escalations
    t.save()
    
    # Trigger alert logic
    logger.warning(f"MANUAL ESCALATION: Ticket #{t.ticket_number} manually escalated! Reason: {payload.reason}")
    
    # Broadcast to live dashboard
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                "analytics_dashboard",
                {
                    "type": "broadcast_update",
                    "event": "ticket_escalated",
                    "ticket_id": str(t.id),
                    "reason": payload.reason
                }
            )
    except Exception:
        pass

    return {
        "id": str(t.id),
        "ticket_number": t.ticket_number,
        "customer": {
            "id": str(t.customer.id),
            "full_name": t.customer.full_name,
            "email": t.customer.email,
            "phone": t.customer.phone,
            "dob": str(t.customer.dob) if t.customer.dob else None
        },
        "channel": t.channel,
        "intent": t.intent,
        "priority": t.priority,
        "department": t.department,
        "status": t.status,
        "summary": t.summary,
        "conversation_id": str(t.conversation_id) if t.conversation_id else None,
        "sla_deadline": t.sla_deadline.isoformat(),
        "assigned_agent": t.assigned_agent,
        "created_at": t.created_at.isoformat(),
        "updated_at": t.updated_at.isoformat()
    }

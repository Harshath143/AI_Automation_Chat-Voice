import json
import logging
from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.template import Template, Context
from django.conf import settings
from .models import Ticket, Customer
from chatbot.models import Message
from core.groq_client import GroqClient

logger = logging.getLogger(__name__)

@shared_task
def process_new_ticket_workflow(ticket_id: str):
    """
    Main background orchestrator. Triggered on ticket auto-creation.
    Runs summary generation, priority classification, and routes the ticket.
    """
    logger.info(f"Starting async workflow for ticket: {ticket_id}")
    
    # 1. Generate Summary
    generate_ticket_summary(ticket_id)
    
    # 2. Classify Priority
    classify_priority(ticket_id)
    
    # 3. Send Acknowledgment Email
    send_acknowledgment_email(ticket_id)

@shared_task
def generate_ticket_summary(ticket_id: str):
    """
    Reads active conversation logs, passes them to Groq, 
    and writes a clean 2-sentence summary to the ticket.
    """
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        if not ticket.conversation_id:
            logger.warning(f"No conversation associated with ticket {ticket_id}")
            return
            
        # Retrieve messages
        messages = Message.objects.filter(conversation_id=ticket.conversation_id).order_by('timestamp')
        if not messages.exists():
            return
            
        chat_log = ""
        for msg in messages:
            role = "Customer" if msg.sender_role == "customer" else "Sofia"
            chat_log += f"{role}: {msg.content}\n"
            
        # Groq Prompt for summary
        groq_client = GroqClient()
        prompt = f"""
        Analyze the following chat log between a customer and our AI visa support assistant.
        Generate a highly concise 2-sentence summary of the customer's core problem and current request status.
        Do not add any preamble. Just return the 2 sentences.

        Chat Log:
        {chat_log}
        """
        
        summary = groq_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.1-8b-instant",
            temperature=0.2
        )
        
        ticket.summary = summary.strip()
        ticket.save()
        logger.info(f"Successfully generated summary for {ticket.ticket_number}")
        
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found during summary task.")
    except Exception as e:
        logger.error(f"Error generating ticket summary: {e}")

@shared_task
def classify_priority(ticket_id: str):
    """
    Uses Llama 3.3 to classify support tickets based on summaries.
    Sets 'critical', 'high', 'medium', or 'low'.
    """
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        summary = ticket.summary or "Customer visa request details."
        
        groq_client = GroqClient()
        prompt = f"""
        Classify the priority of this customer support ticket.
        Ticket summary: {summary}
        
        Rules:
        - critical: legal threat, visa expiry within 7 days, detained traveller, urgent health emergencies.
        - high: appointment within 14 days, employer-sponsored visa issue, missing mandatory travel deadline.
        - medium: standard application delay, document query.
        - low: general information request, fee queries.
        
        Respond with valid JSON object ONLY containing keys "priority" (string) and "reason" (string).
        Ensure the priority string matches exactly one of: "low", "medium", "high", "critical".
        Do not include any explanation.
        """
        
        response = groq_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        
        data = json.loads(response)
        priority = data.get("priority", "medium").lower()
        reason = data.get("reason", "")
        
        # Enforce valid priority choices
        if priority in ['low', 'medium', 'high', 'critical']:
            ticket.priority = priority
            logger.info(f"Classified ticket {ticket.ticket_number} priority: {priority} (Reason: {reason})")
        else:
            ticket.priority = 'medium'
            
        # Re-save to automatically recalculate SLA deadline based on new priority!
        ticket.sla_deadline = None 
        ticket.save()
        
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found during priority classification.")
    except Exception as e:
        logger.error(f"Error classifying priority: {e}")

@shared_task
def send_acknowledgment_email(ticket_id: str):
    """
    Compiles acknowledgment email using Jinja2/Django templates and sends via SMTP.
    """
    try:
        ticket = Ticket.objects.get(id=ticket_id)
        customer = ticket.customer
        
        subject = f"Your support request has been received — Ticket #{ticket.ticket_number}"
        
        email_template = """
Dear {{ customer_name }},

Thank you for contacting the Visa & Immigration Support Centre. We have received your support request regarding "{{ intent }}" and a ticket has been created automatically.

Ticket Reference: {{ ticket_number }}
Priority Level: {{ priority }}
Assigned Department: {{ department }}
Expected Response Time: Within {{ sla_hours }} hours

Summary of Request:
{{ summary }}

You can track the status of your ticket online at: http://localhost:3000/tickets?ref={{ ticket_number }}

If you have additional documents to provide, please reply directly to this email or upload them through our document center.

Sincerely,
Sofia
AI Support Engine
Visa Support Operations Centre
        """
        
        # Determine SLA hours
        sla_hours = 24
        if ticket.priority == 'critical':
            sla_hours = 2
        elif ticket.priority == 'high':
            sla_hours = 8
        elif ticket.priority == 'medium':
            sla_hours = 24
        elif ticket.priority == 'low':
            sla_hours = 72

        t = Template(email_template)
        c = Context({
            "customer_name": customer.full_name,
            "intent": ticket.intent.replace("_", " ").title(),
            "ticket_number": ticket.ticket_number,
            "priority": ticket.priority.upper(),
            "department": ticket.department,
            "sla_hours": sla_hours,
            "summary": ticket.summary or "In process of categorization."
        })
        
        body = t.render(c)
        
        send_mail(
            subject=subject,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'support@yourdomain.com'),
            recipient_list=[customer.email],
            fail_silently=False
        )
        logger.info(f"Email acknowledgment successfully sent to {customer.email} for Ticket #{ticket.ticket_number}")
        
    except Ticket.DoesNotExist:
        logger.error(f"Ticket {ticket_id} not found during email job.")
    except Exception as e:
        logger.error(f"Error sending acknowledgment email: {e}")

@shared_task
def check_sla_breach():
    """
    Periodic task running via Celery Beat every 30 minutes.
    Flags active tickets exceeding deadlines, auto-escalates status, and notifies managers.
    """
    logger.info("Running SLA breach audit check...")
    now = timezone.now()
    
    # Fetch active uncompleted tickets past deadlines
    overdue_tickets = Ticket.objects.filter(
        status__in=['open', 'in_progress'],
        sla_deadline__lt=now
    )
    
    count = 0
    for ticket in overdue_tickets:
        ticket.status = Ticket.StatusChoice.ESCALATED
        ticket.save()
        count += 1
        
        # Log escalation event
        logger.warning(f"SLA BREACH DETECTED: Ticket #{ticket.ticket_number} has breached its deadline! Escalated to priority: {ticket.priority}")
        
        # Mocking slack alert or manager CC
        send_mail(
            subject=f"URGENT: SLA Breach Warning — Ticket #{ticket.ticket_number}",
            message=f"Ticket #{ticket.ticket_number} assigned to {ticket.department} has breached its target SLA. Urgent agent intervention required.\nCustomer: {ticket.customer.full_name}\nSummary: {ticket.summary}",
            from_email='system@yourdomain.com',
            recipient_list=['manager@yourdomain.com'],
            fail_silently=True
        )

    logger.info(f"SLA check completed. Escalated {count} overdue tickets.")
    return f"Escalated {count} tickets"

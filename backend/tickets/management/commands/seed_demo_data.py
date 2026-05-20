import os
import random
import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth.models import User
from tickets.models import Customer, Ticket
from chatbot.models import Conversation, Message
from documents.models import Document

class Command(BaseCommand):
    help = 'Idempotent seeder that populates 150+ tickets, conversations, documents, and configures an admin superuser.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting operational data seeder..."))

        # 1. Seed standard Admin User
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser(
                username="admin",
                email="admin@supportcentre.com",
                password="adminpassword123"
            )
            self.stdout.write(self.style.SUCCESS("Superuser created! (User: admin / Pass: adminpassword123)"))
        else:
            self.stdout.write(self.style.NOTICE("Superuser 'admin' already exists. Skipping."))

        # 2. Flush pre-existing demo records to guarantee idempotency
        self.stdout.write("Flushing existing customer, ticket, and document data...")
        Document.objects.all().delete()
        Ticket.objects.all().delete()
        Message.objects.all().delete()
        Conversation.objects.all().delete()
        Customer.objects.all().delete()

        # Create a dedicated Customer using the configured ADMIN_EMAIL for manual checking
        from django.conf import settings
        admin_test_email = getattr(settings, 'ADMIN_EMAIL', 'admin@yourdomain.com')
        admin_customer = Customer.objects.create(
            full_name="Test Admin Customer",
            email=admin_test_email,
            phone="+971-55-777-8888",
            dob=timezone.now().date() - timedelta(days=10000)
        )
        self.stdout.write(self.style.SUCCESS(f"Dedicated test customer created: {admin_customer.full_name} ({admin_customer.email})"))

        # Create a sample reschedule ticket specifically for this test customer
        t_sample = Ticket.objects.create(
            customer=admin_customer,
            channel="chat",
            intent="appointment_reschedule",
            priority="medium",
            department="Appointment Management Team",
            status="open",
            summary="Customer requested to reschedule their appointment from June 10th to June 15th due to urgent work commitments.",
            conversation_id=uuid.uuid4(),
            created_at=timezone.now() - timedelta(hours=2),
            updated_at=timezone.now() - timedelta(hours=2)
        )
        t_sample.sla_deadline = t_sample.created_at + timedelta(hours=24)
        t_sample.save()
        self.stdout.write(self.style.SUCCESS(f"Sample ticket {t_sample.ticket_number} pre-populated for the test customer."))

        # 3. Define Seed constants
        first_names = ["Alexander", "Fatima", "John", "Sarah", "Michael", "Amna", "Robert", "Elena", "David", "Yuki", "Zahra", "Carlos", "Emma", "Tariq", "Li"]
        last_names = ["Smith", "Al-Mansoori", "Doe", "Connor", "Johnson", "Al-Hashimi", "Williams", "Petrova", "Brown", "Tanaka", "Haddad", "Garcia", "Miller", "Malik", "Wang"]
        
        intents = [
            ("visa_status_enquiry", "Visa Processing Team"),
            ("missing_document", "Document Verification Team"),
            ("appointment_reschedule", "Appointment Management Team"),
            ("complaint_escalation", "Customer Relations"),
            ("general_enquiry", "General Support"),
            ("document_upload", "Document Verification Team"),
            ("human_handoff_request", "Customer Relations")
        ]
        
        priorities = ["low", "medium", "high", "critical"]
        statuses = ["open", "in_progress", "escalated", "resolved", "closed"]
        doc_types = ["passport", "emirates_id", "visa"]

        now = timezone.now()

        # 4. Generate 50 Customer Profiles
        self.stdout.write("Generating customer profiles...")
        customers = []
        for i in range(50):
            fn = random.choice(first_names)
            ln = random.choice(last_names)
            email = f"{fn.lower()}.{ln.lower()}{random.randint(10, 99)}@gmail.com"
            phone = f"+971-50-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
            
            # Avoid duplicate email errors
            if Customer.objects.filter(email=email).exists():
                email = f"{fn.lower()}.{ln.lower()}{str(uuid.uuid4())[:4]}@gmail.com"

            c = Customer.objects.create(
                full_name=f"{fn} {ln}",
                email=email,
                phone=phone,
                dob=now.date() - timedelta(days=random.randint(7000, 18000))
            )
            customers.append(c)

        # 5. Generate 150 Tickets distributed over the last 30 days
        self.stdout.write("Generating 150 support tickets...")
        tickets = []
        for i in range(150):
            customer = random.choice(customers)
            intent_tuple = random.choice(intents)
            intent = intent_tuple[0]
            dept = intent_tuple[1]
            
            priority = random.choice(priorities)
            # Escalated status matches complaint_escalation or critical priority frequently
            if intent == "complaint_escalation" or priority == "critical":
                status = random.choice(["escalated", "in_progress", "open"])
            else:
                status = random.choice(statuses)

            # Determine created dates back in time
            days_ago = random.randint(0, 30)
            hours_ago = random.randint(1, 23)
            created_time = now - timedelta(days=days_ago, hours=hours_ago)

            summary = f"Customer submitted enquiry regarding {intent.replace('_', ' ')}. They requested active assistance with visa support."
            
            t = Ticket.objects.create(
                customer=customer,
                channel="chat" if random.random() > 0.3 else "email",
                intent=intent,
                priority=priority,
                department=dept,
                status=status,
                summary=summary,
                conversation_id=uuid.uuid4(),
                created_at=created_time,
                updated_at=created_time
            )
            
            # Reset timeline constraints manually
            t.created_at = created_time
            t.updated_at = created_time
            # Overwrite automatically computed deadlines to be realistic
            t.sla_deadline = created_time + timedelta(hours=random.choice([2, 8, 24, 72]))
            t.save()
            tickets.append(t)

        # 6. Generate 60 Multi-Turn Conversation Logs
        self.stdout.write("Generating 60 conversation logs and message histories...")
        chat_dialogues = [
            ("Hi, I want to track my visa application.", "Certainly! Could you please provide your full name and application reference?"),
            ("Here are my passport scan details.", "Thank you. I am submitting this passport to our OCR system. It appears valid and expires in 2029."),
            ("My biometrics date is tomorrow but I am sick. Can I reschedule?", "I understand. I can reschedule your appointment. What is your preferred new date?"),
            ("This is urgent! My visa is expiring in 4 days and I have heard nothing!", "I apologize for the delay. I have raised this ticket to Critical priority and escalated it to the Customer Relations manager.")
        ]

        # Sample 60 unique tickets to prevent primary key duplicates
        chat_tickets = random.sample(tickets, 60)
        for i in range(60):
            ticket = chat_tickets[i]
            conv = Conversation.objects.create(
                id=ticket.conversation_id,
                customer=ticket.customer,
                slots_state={"active_intent": ticket.intent, "clarification_attempts": 0, "slots": {}}
            )
            
            # Seed 2-4 messages
            dialogue = random.choice(chat_dialogues)
            Message.objects.create(
                conversation=conv,
                sender_role="customer",
                content=dialogue[0],
                intent=ticket.intent,
                timestamp=ticket.created_at
            )
            Message.objects.create(
                conversation=conv,
                sender_role="bot",
                content=dialogue[1],
                timestamp=ticket.created_at + timedelta(seconds=15)
            )

        # 7. Generate 40 Document extractions
        self.stdout.write("Generating 40 analyzed document models...")
        for i in range(40):
            ticket = random.choice(tickets)
            doc_type = random.choice(doc_types)
            status = random.choice(["valid", "invalid", "manual_review_required"])
            
            # Formulate validation alerts based on status
            flags = []
            if status == "invalid":
                flags = random.choice([["document_expired"], ["invalid_emirates_id_checksum"], ["document_expired", "invalid_passport_format"]])
            elif status == "manual_review_required":
                flags = random.choice([["low_ocr_confidence"], ["full_name_missing"]])

            # Formulate extracted keys
            fields = {
                "full_name": ticket.customer.full_name.upper(),
                "document_number": f"PA{random.randint(1000000, 9999999)}",
                "nationality": "British Citizen",
                "date_of_birth": "1990-05-15",
                "expiry_date": "2029-08-25" if status == "valid" else "2024-02-12"
            }
            if doc_type == 'emirates_id':
                fields["document_number"] = f"784-{random.randint(1980, 2005)}-{random.randint(1000000, 9999999)}-{random.randint(0, 9)}"

            Document.objects.create(
                ticket=ticket,
                document_type=doc_type,
                file_path=f"/media/documents-raw/sample_{doc_type}_{i}.jpg",
                status=status,
                extracted_fields=fields,
                validation_flags=flags,
                ocr_confidence=0.98 if status == "valid" else 0.62,
                processing_time_ms=random.randint(800, 2200),
                created_at=ticket.created_at
            )

        self.stdout.write(self.style.SUCCESS("Database seeded with 150+ tickets, 60 chats, 40 documents, and 1 admin superuser successfully!"))

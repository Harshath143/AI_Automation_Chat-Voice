import json
import uuid
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from chatbot.models import Conversation, Message
from chatbot.chatbot_service import ChatbotService
from chatbot.faq_service import FAQService, tokenize
from tickets.models import Ticket, Customer

class ChatbotServiceMemoryTest(TestCase):
    def setUp(self):
        # Clear database records
        Message.objects.all().delete()
        Conversation.objects.all().delete()
        Ticket.objects.all().delete()
        Customer.objects.all().delete()
        
        # SUT (System Under Test)
        self.service = ChatbotService()

    @patch('chatbot.intent_service.IntentService.classify')
    @patch('core.groq_client.GroqClient.chat_completion')
    def test_process_message_stores_and_passes_history(self, mock_chat_completion, mock_classify):
        """
        Verifies that ChatbotService.process_message correctly queries the database
        for preceding messages and appends them to the Groq API payload to maintain memory context.
        """
        # Mock Intent classification
        mock_classify.return_value = ("certificate_attestation", 0.95)
        
        # Mock LLM response
        mock_chat_completion.return_value = "Yes, educational degree attestation for UAE is a 5-step process."
        
        # Generate valid UUID for test conversation
        conversation_id = str(uuid.uuid4())
        
        # Step 1: First customer interaction
        res1 = self.service.process_message(conversation_id, "I want to attest my educational documents for Dubai")
        self.assertEqual(res1["text"], "Yes, educational degree attestation for UAE is a 5-step process.")
        
        # Check that one customer message and one bot message exist
        self.assertEqual(Message.objects.filter(conversation_id=conversation_id).count(), 2)
        
        # Step 2: Second customer interaction (confirming copies)
        res2 = self.service.process_message(conversation_id, "yes i do have that")
        
        # Retrieve the arguments passed to chat_completion on the second call
        self.assertTrue(mock_chat_completion.called)
        last_call_args = mock_chat_completion.call_args_list[-1]
        kwargs = last_call_args[1]
        messages = kwargs.get('messages', [])
        
        # System prompt is index 0
        self.assertEqual(messages[0]["role"], "system")
        
        # Turn 1 Customer message is index 1
        self.assertEqual(messages[1]["role"], "user")
        self.assertIn("attest my educational documents", messages[1]["content"])
        
        # Turn 1 Bot response is index 2
        self.assertEqual(messages[2]["role"], "assistant")
        self.assertIn("degree attestation for UAE", messages[2]["content"])
        
        # Turn 2 User message is index 3 (latest message with prompt instruction)
        self.assertEqual(messages[3]["role"], "user")
        self.assertIn("yes i do have that", messages[3]["content"])

    @patch('chatbot.intent_service.IntentService.classify')
    @patch('chatbot.chatbot_service.ChatbotService._extract_slots')
    @patch('core.groq_client.GroqClient.chat_completion')
    def test_slot_filling_and_ticket_routing(self, mock_chat_completion, mock_extract_slots, mock_classify):
        """
        Verifies that filling slot fields triggers automatic ticket generation
        and routes to the correct specialized department.
        """
        mock_classify.return_value = ("pro_gro_services", 0.98)
        mock_chat_completion.return_value = "Thank you. Your corporate setup ticket has been created."
        
        # Mock slot extraction to simulate all slots being completed
        mock_extract_slots.return_value = {
            "active_intent": "pro_gro_services",
            "clarification_attempts": 0,
            "slots": {
                "company_name": "BVS Tech Ventures",
                "service_needed": "Trade License Registration",
                "jurisdiction": "Dubai Mainland",
                "contact_person": "Harshath"
            }
        }
        
        conversation_id = str(uuid.uuid4())
        res = self.service.process_message(conversation_id, "I want to set up BVS Tech Ventures in Dubai Mainland")
        
        # Verify slot state extraction was triggered
        mock_extract_slots.assert_called_once()
        
        # Check that a ticket was auto-created and mapped to the correct division
        ticket = Ticket.objects.filter(conversation_id=conversation_id).first()
        self.assertIsNotNone(ticket)
        self.assertEqual(ticket.intent, "pro_gro_services")
        self.assertEqual(ticket.department, "Corporate Services Team")
        self.assertEqual(ticket.priority, Ticket.PriorityChoice.HIGH)
        self.assertEqual(ticket.status, Ticket.StatusChoice.OPEN)


class FAQServiceRAGTest(TestCase):
    def setUp(self):
        # SUT (System Under Test)
        self.faq_service = FAQService()

    def test_tfidf_initialization(self):
        """
        Verifies that TF-IDF indices, vocabulary, and document matrices are compiled.
        """
        self.assertGreater(len(self.faq_service.vocab), 0)
        self.assertEqual(len(self.faq_service.idf), len(self.faq_service.vocab))
        
        # Check doc_matrix dimensions (num_docs, num_words)
        expected_shape = (len(self.faq_service.faqs), len(self.faq_service.vocab))
        self.assertEqual(self.faq_service.doc_matrix.shape, expected_shape)

    def test_semantic_retrieval_cosine_ranking(self):
        """
        Verifies that querying BVS service keywords returns the mathematically
        most semantically relevant FAQ using Cosine Similarity vectors.
        """
        # Query 1: Attestation and stamp chains
        res_attest = self.faq_service.retrieve_top_faqs("How does attestation and consular stamp work?")
        self.assertGreater(len(res_attest), 0)
        
        # The best matching FAQ should be Certificate Attestation or step-by-step attestation
        top_faq = res_attest[0]
        self.assertTrue(
            any(term in top_faq["question"].lower() or term in top_faq["answer"].lower() 
                for term in ["attestation", "legalization", "stamp"])
        )
        
        # Query 2: Golden Visa and long-term residency investment
        res_residency = self.faq_service.retrieve_top_faqs("UAE Golden Visa requirements")
        self.assertGreater(len(res_residency), 0)
        top_faq_residency = res_residency[0]
        
        self.assertTrue(
            any(term in top_faq_residency["question"].lower() or term in top_faq_residency["answer"].lower()
                for term in ["golden visa", "residency", "invest"])
        )
        
        # Query 3: Corporate setups and Mainland license setup
        res_pro = self.faq_service.retrieve_top_faqs("Dubai Mainland corporate setup trade license")
        self.assertGreater(len(res_pro), 0)
        top_faq_pro = res_pro[0]
        
        self.assertTrue(
            any(term in top_faq_pro["question"].lower() or term in top_faq_pro["answer"].lower()
                for term in ["pro", " mainland", "company setup", "trade license", "jurisdiction"])
        )

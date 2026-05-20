import logging
import numpy as np
from typing import List, Dict
from core.groq_client import GroqClient

logger = logging.getLogger(__name__)

FAQ_DATABASE = [
    # Visa Types
    {"question": "What is a Tourist Visa?", "answer": "A Tourist Visa allows individuals to enter the country for leisure, sightseeing, or visiting family. It is typically valid for 30 to 90 days and cannot be converted to employment status locally."},
    {"question": "What is an Employment Visa?", "answer": "An Employment Visa requires a licensed local employer sponsor. It permits foreign nationals to work legally and is usually granted for a duration of 2 to 3 years, subject to medical tests and work permit approvals."},
    {"question": "What are the rules for a Golden Visa?", "answer": "The Golden Visa is a long-term residency program for investors, entrepreneurs, exceptional talents, scientists, and outstanding graduates. It offers 5 to 10 year residency without requiring a local sponsor."},
    {"question": "How do I apply for a Student Visa?", "answer": "A Student Visa is issued to foreign nationals enrolled in registered educational institutions. It requires an official university admission offer letter, medical fitness clearance, and proof of financial sponsorship."},
    {"question": "Can I get a Business Visa?", "answer": "Yes, Business Visas are designed for business owners, corporate executives, and investors attending conferences, negotiations, or exploring local investment opportunities."},
    {"question": "What is a Mission Visa?", "answer": "A Mission Visa is a short-term work visa valid for up to 90 days, enabling temporary engineering, technical, or specialized project works for a specific employer."},
    {"question": "How does a Family Sponsorship Visa work?", "answer": "Expatriates earning above a certain threshold can sponsor their immediate family members (spouse, children). The sponsor must submit lease contracts, salary certificates, and marriage/birth certificates."},
    
    # Processing Times
    {"question": "What is the standard processing time for tourist visas?", "answer": "Standard tourist visa applications typically take between 3 to 5 business days for approval, depending on the applicant's nationality and volume of requests."},
    {"question": "How fast is express visa processing?", "answer": "Express visa processing accelerates review to 24 to 48 hours for an additional speed fee. You can select this option during online application checkout."},
    {"question": "How long does a Golden Visa approval take?", "answer": "Golden Visa nominations are reviewed within 7 to 10 working days. Upon nomination approval, the final visa issuance takes another 5 to 7 days."},
    {"question": "What is the processing time for employment visas?", "answer": "Employment visa entry permits take 3 to 7 business days. Completing the local medical test, Emirates ID biometrics, and final residency stamping takes an additional 7 to 10 days."},
    {"question": "Why is my visa application delayed?", "answer": "Delays are commonly caused by blurry document scans, spelling mismatches against passport MRZ data, security background checks, or peak application seasons."},
    {"question": "Can I check my visa processing status online?", "answer": "Yes, you can track your live processing progress via our smart customer portal using your Application Reference Number or Passport Details."},

    # Document Requirements
    {"question": "What are the passport requirements for a visa?", "answer": "Your passport must be valid for at least 6 months beyond your planned entry date, have at least two blank pages, and have no handwritten alterations."},
    {"question": "What photo specification is needed?", "answer": "Provide a recent passport-sized color photograph (4.5cm x 3.5cm) with a white background, neutral facial expression, no headwear (except religious), and clear resolution."},
    {"question": "Is travel insurance mandatory?", "answer": "Yes, standard travel medical insurance covering a minimum of $30,000 for emergency medical services and repatriation is mandatory for all tourist entries."},
    {"question": "Do I need to submit bank statements?", "answer": "Tourist applications from specific regions and long-term residency visas require certified bank statements showing stable balances for the last 3 to 6 months."},
    {"question": "What documents are required for an Emirates ID?", "answer": "Applying for or renewing an Emirates ID requires your original passport, visa entry permit or stamped residency page, and biometrics appointment slip."},
    {"question": "What is an attested degree certificate?", "answer": "For professional roles on an Employment Visa, your university degree must be attested by the Ministry of Foreign Affairs (MOFA) in both your home country and locally."},
    {"question": "What if my documents are in a foreign language?", "answer": "All certificates, bank statements, or legal letters not in English or Arabic must be translated by a certified legal translator approved by the Ministry of Justice."},

    # Fees
    {"question": "How much does a Tourist Visa cost?", "answer": "A 30-day single-entry tourist visa costs $90. A 90-day tourist visa is $220. Fees are non-refundable even if the visa is rejected."},
    {"question": "What are the fees for an Employment Visa?", "answer": "Sponsor application fees range between $350 and $800, depending on the company's category. Medical testing and Emirates ID processing cost an additional $180."},
    {"question": "What is the fee for a Golden Visa?", "answer": "The Golden Visa nomination fee is $150. Stamping the 10-year residency visa and issuing the long-term Emirates ID costs approximately $1,150."},
    {"question": "Is there a fine for visa overstaying?", "answer": "Yes, overstaying after visa expiry incurs a daily fine of $15 per day, plus processing fees at out-passes or airport immigration exit gates."},
    {"question": "Can I get a refund if my application is rejected?", "answer": "No. All visa, medical, and administrative application fees are non-refundable as they cover governmental processing costs."},

    # Centre Hours & Support
    {"question": "What are the Visa Support Centre operational hours?", "answer": "Our physical support centres are open Monday through Friday from 8:00 AM to 5:00 PM. We are closed on weekends and officially gazetted public holidays."},
    {"question": "Where is the main visa support centre located?", "answer": "The main Visa Support Centre is situated at Plot 12, Diplomatic Enclave, Sector G-5, City Center. Ample customer parking is available on-site."},
    {"question": "Is there a helpline contact number?", "answer": "Yes, you can reach our customer support helpline at +971-4-800-VISA (8472) during working hours (8:00 AM to 5:00 PM)."},
    {"question": "Do I need an appointment to visit the centre?", "answer": "While walk-ins are accepted for document collection, we highly recommend booking an appointment online to bypass queues for submissions or biometrics."},
    {"question": "How do I reschedule a biometrics appointment?", "answer": "You can reschedule your appointment up to 24 hours in advance via the 'Appointment' page in our portal, or by asking this chatbot to perform it for you."}
]

class FAQService:
    def __init__(self):
        self.groq_client = GroqClient()
        self.faqs = FAQ_DATABASE
        # We can cache precomputed simple word vectors for local heuristic fallback
        self._precompute_word_sets()

    def _precompute_word_sets(self):
        self.faq_word_sets = []
        for faq in self.faqs:
            words = set(faq["question"].lower().replace("?", "").replace(",", "").split(" "))
            self.faq_word_sets.append(words)

    def retrieve_top_faqs(self, query: str, top_n: int = 3) -> List[Dict]:
        """
        Retrieves top_n relevant FAQs using simple word overlap 
        or semantic dot-product comparison.
        """
        query_words = set(query.lower().replace("?", "").replace(",", "").split(" "))
        scores = []

        for idx, faq_set in enumerate(self.faq_word_sets):
            overlap = len(query_words.intersection(faq_set))
            scores.append((overlap, idx))

        # Sort by overlap score descending
        scores.sort(reverse=True, key=lambda x: x[0])
        
        # Get top matching FAQs
        results = []
        for score, idx in scores[:top_n]:
            results.append(self.faqs[idx])
            
        logger.info(f"FAQ Search retrieved {len(results)} matches for query: '{query[:30]}...'")
        return results

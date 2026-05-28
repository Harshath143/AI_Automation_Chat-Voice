import os
import json
import logging
import re
import numpy as np
from typing import List, Dict
from django.conf import settings
from core.groq_client import GroqClient

logger = logging.getLogger(__name__)

# Standard English stopwords to optimize vocabulary vector sizes and enhance semantic focus
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at", 
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can", "can't", "cannot", 
    "could", "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", 
    "for", "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", 
    "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", 
    "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", 
    "mustn't", "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", 
    "ours", "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't", 
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there", 
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too", 
    "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't", 
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's", 
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours", "yourself", "yourselves"
}

def tokenize(text: str) -> List[str]:
    """
    Lowercases, strips punctuation, splits, and filters out stopwords and single characters.
    """
    cleaned = re.sub(r'[^\w\s]', ' ', text.lower())
    words = cleaned.split()
    return [w for w in words if w not in STOPWORDS and len(w) > 1]

# Pre-seeded, highly accurate fallback database tailored to BVS Global's services
FAQ_DATABASE = [
    # Document Legalization & Attestation
    {"question": "What is Certificate Attestation by BVS Global?", "answer": "BVS Global offers end-to-end Certificate Attestation services for educational, personal, and commercial documents, validating them through the Ministry of External Affairs (MEA), Ministry of Foreign Affairs (MOFA), and relevant Embassies in over 100 countries."},
    {"question": "What is the procedure for Degree Attestation?", "answer": "Degree attestation requires a structured validation process: first, verification by the issuing University or Board; second, HRD/MEA validation in the origin country; and finally, stamping by the destination Embassy and target Ministry of Foreign Affairs (MOFA)."},
    {"question": "Which personal documents can BVS Global legalize?", "answer": "We manage attestation for personal documents including Birth Certificates, Marriage Certificates, Death Certificates, Police Clearance Certificates (PCC), Medical Reports, and Power of Attorney."},
    {"question": "What is an attested commercial document?", "answer": "For corporate business activities abroad, commercial documents like Articles of Association, Board Resolutions, Commercial Invoices, and Trade Licenses must be attested by Chamber of Commerce, MEA, and target Embassies."},

    # Apostille Services
    {"question": "What is an Apostille stamp?", "answer": "An Apostille is a standardized authentication sticker issued under the 1961 Hague Convention. It eliminates the need for double-embassy legalization, verifying document validity with a single certificate accepted in all member states."},
    {"question": "Which countries accept an Apostille stamp?", "answer": "Apostilles are accepted by all Hague Convention member states, including the USA, UK, India, Australia, Germany, France, South Africa, and Italy."},
    {"question": "What is the difference between Attestation and Apostille?", "answer": "An Apostille is a single, simplified stamp used between member countries of the Hague Convention. Attestation is a multi-step consular chain of legalization required for non-Hague countries (like the UAE and Saudi Arabia)."},

    # Background Verification
    {"question": "What Background Screening services do you offer?", "answer": "BVS Global conducts comprehensive background checks including Employment History verification, Academic Credential verification, Criminal Record auditing, and Professional Reference checks."},
    {"question": "Is candidate consent required for background verification?", "answer": "Yes, candidate consent is legally mandatory. BVS Global requires a signed written Candidate Consent Form and copy of passport before initiating any background verification checks."},
    {"question": "How long does a background verification check take?", "answer": "Standard background checks are completed within 5 to 10 business days, depending on the speed of responding universities and former employers."},

    # Visa & Travel Concierge
    {"question": "What is the BVS Global Visa Concierge?", "answer": "The Visa & Travel Concierge service manages the entire visa lifecycle: application drafting, slot bookings, biometric appointments, and passport dispatch for tourist, business, work, and Golden Visas."},
    {"question": "Can BVS Global assist with Golden Visas?", "answer": "Yes, BVS Global specializes in Golden Visa applications for investors, entrepreneurs, exceptional talents, and scientists, managing government approvals and family residency sponsorships."},

    # PRO & GRO Services
    {"question": "What are Corporate PRO and GRO Services?", "answer": "Corporate PRO and Government Relations Officer (GRO) services manage trade license renewals, company formation, ministry approvals, visa quotas, and employee work permit processing."},
    {"question": "Which jurisdictions do you cover for company setup?", "answer": "We manage setups across all major UAE jurisdictions, including Dubai Mainland (DED), Abu Dhabi, and premium Freezones like DMCC, DAFZA, ADGM, and DIFC."},

    # Center Info & Support
    {"question": "What are BVS Global support center hours?", "answer": "Our operations centres are open Monday through Friday from 8:00 AM to 5:00 PM. We are closed on weekends and officially gazetted public holidays."},
    {"question": "Is there a BVS Global customer helpline number?", "answer": "Yes, you can contact the central BVS Global operations helpline at +971-4-800-BVS (287) during business hours (8:00 AM to 5:00 PM)."}
]

class FAQService:
    def __init__(self):
        self.groq_client = GroqClient()
        self.faqs = list(FAQ_DATABASE)
        self.load_scraped_kb()
        
        # Initialize Vector Space math weights for RAG Pipeline
        self._initialize_tfidf()

    def load_scraped_kb(self):
        """
        Dynamically loads the scraped BVS Global knowledge base if present.
        """
        try:
            kb_path = os.path.join(settings.BASE_DIR, "chatbot", "bvs_knowledge_base.json")
            if os.path.exists(kb_path):
                with open(kb_path, 'r', encoding='utf-8') as f:
                    scraped_faqs = json.load(f)
                    if scraped_faqs:
                        # Prepend scraped FAQs to prioritize recent scraped facts
                        self.faqs = scraped_faqs + self.faqs
                        logger.info(f"Successfully loaded {len(scraped_faqs)} dynamic FAQs from BVS scraped knowledge base.")
        except Exception as e:
            logger.error(f"Error loading scraped BVS knowledge base: {e}")

    def _initialize_tfidf(self):
        """
        Builds Term Frequency (TF) and Inverse Document Frequency (IDF) weights across all FAQ documents.
        L2 normalizes document vectors so cosine similarity calculations compile as a simple dot product.
        """
        documents = []
        for faq in self.faqs:
            # Combine question and answer to maximize indexing context
            combined = f"{faq['question']} {faq['answer']}"
            documents.append(tokenize(combined))
            
        # 1. Build vocabulary index
        vocab_set = set()
        for doc in documents:
            vocab_set.update(doc)
        self.vocab = sorted(list(vocab_set))
        self.vocab_index = {word: idx for idx, word in enumerate(self.vocab)}
        
        num_docs = len(self.faqs)
        num_words = len(self.vocab)
        
        if num_words == 0:
            self.doc_matrix = np.zeros((num_docs, 0))
            self.idf = np.zeros(0)
            return
            
        # 2. Compute Document Frequency (DF) and Inverse Document Frequency (IDF)
        df = np.zeros(num_words)
        for doc in documents:
            unique_words = set(doc)
            for w in unique_words:
                if w in self.vocab_index:
                    df[self.vocab_index[w]] += 1
                    
        # IDF formula smoothed with logarithms to prevent divisions by zero
        self.idf = np.log(1.0 + (num_docs / (1.0 + df)))
        
        # 3. Compile document weight matrix
        self.doc_matrix = np.zeros((num_docs, num_words))
        for d_idx, doc in enumerate(documents):
            for w in doc:
                if w in self.vocab_index:
                    self.doc_matrix[d_idx, self.vocab_index[w]] += 1
            
            # Weight is Term Frequency multiplied by Term Importance
            self.doc_matrix[d_idx] = self.doc_matrix[d_idx] * self.idf
            
            # L2 Euclidean normalization: converts Cosine Similarity into a single dot product multiplication
            norm = np.linalg.norm(self.doc_matrix[d_idx])
            if norm > 0.0:
                self.doc_matrix[d_idx] = self.doc_matrix[d_idx] / norm
                
        logger.info(f"Initialized local TF-IDF RAG vector space retriever with {num_docs} FAQs. Vocab: {num_words} terms.")

    def retrieve_top_faqs(self, query: str, top_n: int = 3) -> List[Dict]:
        """
        Mathematically retrieves the top_n most semantically relevant FAQs using Cosine Similarity vectors in R^V.
        Leverages NumPy matrix algebra for high-speed, local CPU calculations (<0.5ms).
        """
        num_words = len(self.vocab)
        if num_words == 0 or len(self.faqs) == 0:
            return self.faqs[:top_n]
            
        # 1. Vectorize and weight query
        query_tokens = tokenize(query)
        query_vector = np.zeros(num_words)
        for w in query_tokens:
            if w in self.vocab_index:
                query_vector[self.vocab_index[w]] += 1
                
        query_vector = query_vector * self.idf
        
        # L2 Normalize query vector
        q_norm = np.linalg.norm(query_vector)
        if q_norm > 0.0:
            query_vector = query_vector / q_norm
        else:
            # Fallback if no matching vocabulary terms are present in query
            return self.faqs[:top_n]
            
        # 2. Compute Cosine Similarities via high-speed NumPy dot products
        scores = np.dot(self.doc_matrix, query_vector)
        
        # 3. Extract top matches sorted by score in descending order
        sorted_indices = np.argsort(scores)[::-1]
        
        results = []
        for idx in sorted_indices[:top_n]:
            # Safeguard index boundaries
            if idx < len(self.faqs):
                results.append(self.faqs[idx])
                
        logger.info(f"Local RAG Cosine Search completed. Best similarity score: {scores[sorted_indices[0]]:.4f} for query: '{query[:35]}...'")
        return results

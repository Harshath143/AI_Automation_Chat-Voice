import os
from django.core.management.base import BaseCommand
from django.conf import settings
from chatbot.scraper import BVSScraper

class Command(BaseCommand):
    help = "Crawls key pages of bvsglobal.com and compiles a structured FAQ/Knowledge Base JSON file for Sofia."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("============================================="))
        self.stdout.write(self.style.WARNING("Initiating BVS Global Web Scraping Pipeline"))
        self.stdout.write(self.style.WARNING("============================================="))

        scraper = BVSScraper()
        
        self.stdout.write("Running crawler over targeted pages...")
        results = scraper.run()
        
        # Save output JSON in the chatbot directory
        kb_path = os.path.join(settings.BASE_DIR, "chatbot", "bvs_knowledge_base.json")
        self.stdout.write(f"Scrape completed. Formatting and writing knowledge base to: {kb_path}")
        
        scraper.save_knowledge_base(results, kb_path)
        
        self.stdout.write(self.style.SUCCESS("\nScraping and Knowledge Ingestion Completed Successfully!"))
        self.stdout.write(self.style.SUCCESS(f"Sofia chatbot FAQ database will now dynamically utilize the freshly scraped data."))
        self.stdout.write(self.style.SUCCESS("============================================="))

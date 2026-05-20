from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from ninja import NinjaAPI
from tickets.apis import router as tickets_router
from documents.apis import router as documents_router
from analytics.apis import router as analytics_router
from chatbot.apis import router as voice_router

# Initialize central Django Ninja API
api = NinjaAPI(
    title="AI Visa Contact Centre Platform API",
    version="1.0.0",
    description="High-performance async REST API providing ticket management, Groq Vision OCR, and live analytics."
)

# Register routes
api.add_router("/tickets", tickets_router)
api.add_router("/documents", documents_router)
api.add_router("/analytics", analytics_router)
api.add_router("/voice", voice_router)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
]

# Expose uploaded media files for visual frontend preview
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

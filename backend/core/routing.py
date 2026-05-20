from django.urls import path
from chatbot.consumers import ChatConsumer
from analytics.consumers import AnalyticsConsumer

websocket_urlpatterns = [
    path('ws/chat/<str:session_id>/', ChatConsumer.as_asgi()),
    path('ws/analytics/', AnalyticsConsumer.as_asgi()),
]

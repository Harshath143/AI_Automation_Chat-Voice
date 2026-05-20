import json
import logging
from channels.generic.websocket import AsyncJsonWebsocketConsumer

logger = logging.getLogger(__name__)

class AnalyticsConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_group_name = 'analytics_dashboard'

        # Join analytics group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info("WebSocket connected to Analytics live feed.")

    async def disconnect(self, close_code):
        # Leave analytics group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        logger.info("WebSocket disconnected from Analytics live feed.")

    async def receive_json(self, content):
        """
        Receives events from the frontend if needed (not typically required for read-only charts).
        """
        pass

    async def broadcast_update(self, event):
        """
        Handles ticket updates broadcast from Django views or Celery tasks,
        and pushes fresh events directly to the browser.
        """
        logger.info(f"Broadcasting analytics update event: {event.get('event')}")
        await self.send_json({
            "type": "live_update",
            "event": event.get("event"),
            "ticket_id": event.get("ticket_id"),
            "status": event.get("status"),
            "reason": event.get("reason", "")
        })

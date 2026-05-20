import os
import logging
import urllib.parse
import httpx
from ninja import Router
from django.http import HttpResponse
from django.conf import settings
from .chatbot_service import ChatbotService

router = Router()
logger = logging.getLogger(__name__)

@router.get("/tts")
def text_to_speech(request, text: str):
    """
    Text-to-Speech API proxy. Uses ElevenLabs if ELEVENLABS_API_KEY is configured in settings/env,
    otherwise falls back to a free, public Google Translate TTS audio stream to ensure out-of-the-box
    functionality without requiring paid subscription keys.
    """
    if not text:
        return HttpResponse("No text provided", status=400)

    api_key = getattr(settings, "ELEVENLABS_API_KEY", "")
    voice_id = getattr(settings, "ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # Default voice: Rachel
    model_id = getattr(settings, "ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")

    if api_key:
        logger.info(f"Generating ElevenLabs premium TTS (model: {model_id}) for text: {text[:50]}...")
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "accept": "audio/mpeg"
        }
        data = {
            "text": text,
            "model_id": model_id,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        try:
            response = httpx.post(url, json=data, headers=headers, timeout=15.0)
            if response.status_code == 200:
                return HttpResponse(response.content, content_type="audio/mpeg")
            else:
                logger.error(f"ElevenLabs TTS failed ({response.status_code}): {response.text}")
                # Fallback to free Google TTS if ElevenLabs fails (e.g. quota limit)
        except Exception as e:
            logger.error(f"Error fetching ElevenLabs TTS: {e}")
            # Fallback to Google TTS on exception

    # Free, Zero-Configuration Google TTS Fallback Stream
    logger.info(f"Generating free Google TTS fallback for text: {text[:50]}...")
    encoded_text = urllib.parse.quote(text)
    fallback_url = f"https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q={encoded_text}"
    
    try:
        response = httpx.get(fallback_url, timeout=10.0)
        if response.status_code == 200:
            return HttpResponse(response.content, content_type="audio/mpeg")
        else:
            logger.error(f"Google TTS fallback failed ({response.status_code})")
            return HttpResponse("Failed to generate TTS audio stream", status=500)
    except Exception as e:
        logger.error(f"Error fetching Google TTS: {e}")
        return HttpResponse(f"Error: {str(e)}", status=500)


@router.post("/twilio/incoming")
def twilio_incoming(request):
    """
    Twilio voice call entrance webhook. Initiates the secure Sofia voice channel, plays
    the premium greeting via TTS, and configures standard microphone speech gathering.
    """
    welcome_text = "Hello! I am Sofia, your professional AI assistant for the Visa Support Centre. How can I assist you today with visa status tracking, document uploads, or appointment scheduling?"
    encoded_text = urllib.parse.quote(welcome_text)
    
    # Absolute URL for TTS playback
    base_url = f"http://{request.get_host()}"
    tts_url = f"{base_url}/api/voice/tts?text={encoded_text}"
    callback_url = f"{base_url}/api/voice/twilio/callback"
    
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{tts_url}</Play>
    <Gather input="speech" action="{callback_url}" method="POST" speechTimeout="auto">
    </Gather>
</Response>"""
    
    return HttpResponse(twiml, content_type="application/xml")


@router.post("/twilio/callback")
def twilio_callback(request):
    """
    Twilio voice call interaction webhook. Handles speech input from the user, dispatches
    it to our stateful AI slots processor (Sofia), streams back the response audio,
    and handles automatic call hangup if a ticket has been successfully registered.
    """
    speech_result = request.POST.get("SpeechResult", "").strip()
    call_sid = request.POST.get("CallSid", "").strip()
    base_url = f"http://{request.get_host()}"
    callback_url = f"{base_url}/api/voice/twilio/callback"

    logger.info(f"Twilio Call {call_sid} received speech: {speech_result}")

    if not speech_result:
        # Prompt user again if no speech detected
        prompt_text = "I'm sorry, I didn't hear anything. Could you please repeat that?"
        encoded_prompt = urllib.parse.quote(prompt_text)
        tts_url = f"{base_url}/api/voice/tts?text={encoded_prompt}"
        
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{tts_url}</Play>
    <Gather input="speech" action="{callback_url}" method="POST" speechTimeout="auto">
    </Gather>
</Response>"""
        return HttpResponse(twiml, content_type="application/xml")

    # Pass the text to our identical chatbot processor
    service = ChatbotService()
    try:
        result = service.process_message(conversation_id=call_sid, content=speech_result)
        bot_response = result["text"]
        ticket_created = result.get("ticket_created", False)
        ticket_number = result.get("ticket_number", "")
        
        encoded_response = urllib.parse.quote(bot_response)
        tts_url = f"{base_url}/api/voice/tts?text={encoded_response}"
        
        if ticket_created:
            logger.info(f"Auto-created ticket {ticket_number} during Twilio call {call_sid}. Terminating call.")
            # Play final response confirming ticket and hang up
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{tts_url}</Play>
    <Hangup/>
</Response>"""
        else:
            # Continue gathering speech in conversational loop
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{tts_url}</Play>
    <Gather input="speech" action="{callback_url}" method="POST" speechTimeout="auto">
    </Gather>
</Response>"""
    except Exception as e:
        logger.error(f"Error during Twilio processing: {e}")
        error_text = "I apologize, but I encountered a system issue. Please call again later."
        encoded_error = urllib.parse.quote(error_text)
        twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>{base_url}/api/voice/tts?text={encoded_error}</Play>
    <Hangup/>
</Response>"""

    return HttpResponse(twiml, content_type="application/xml")

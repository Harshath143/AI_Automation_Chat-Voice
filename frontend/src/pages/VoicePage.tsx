import React, { useState, useEffect, useRef } from 'react';
import { useStore, generateUUID } from '../store/useStore';
import { 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, KeyRound, 
  CheckCircle, HelpCircle, ArrowUpRight, Ticket, RefreshCw, Sparkles, User, Bot, AlertTriangle
} from 'lucide-react';

interface VoiceTurn {
  id: string;
  sender: 'customer' | 'bot';
  text: string;
  timestamp: string;
}

export default function VoicePage() {
  const { sessionId, resetSessionId, setActiveTab, refreshSessionTimer, userProfile } = useStore();
  const [callStatus, setCallStatus] = useState<'idle' | 'dialing' | 'connected' | 'sofia_speaking' | 'listening'>('idle');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [useElevenLabs, setUseElevenLabs] = useState(false); // Toggle between ElevenLabs Premium and Local Browser Voice
  
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  
  const [activeSlots, setActiveSlots] = useState<Record<string, string | null>>({});
  const [activeIntent, setActiveIntent] = useState<string>('');
  const [activeConfidence, setActiveConfidence] = useState<number>(0);
  const [currentTicket, setCurrentTicket] = useState<{ number: string; id: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  // Refs to avoid stale closures in SpeechRecognition callbacks
  const callStatusRef = useRef(callStatus);
  const isMutedRef = useRef(isMuted);
  const latestTranscriptRef = useRef('');
  const accumulatedBotResponseRef = useRef('');

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Auto scroll transcript feed
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, interimTranscript]);

  // Duration timer
  useEffect(() => {
    if (callStatus !== 'idle' && callStatus !== 'dialing') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
      setCallDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [callStatus]);

  // Format timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Connect backend WebSocket for voice conversation session
  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    const wsUrl = `ws://localhost:8000/ws/chat/${sessionId}/`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Voice WebSocket session connected.");
      if (userProfile) {
        ws.send(JSON.stringify({
          type: 'login',
          full_name: userProfile.full_name,
          email: userProfile.email,
          phone: userProfile.phone
        }));
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'history') {
        const formatted = data.messages.map((m: any) => ({
          id: m.id || generateUUID(),
          sender: m.sender === 'customer' ? 'customer' : 'bot',
          text: m.text,
          timestamp: m.timestamp || new Date().toISOString()
        }));
        setTurns(formatted);
        if (data.slots_filled) setActiveSlots(data.slots_filled);
        if (data.intent) setActiveIntent(data.intent);
        if (data.ticket_data) {
          setCurrentTicket({ number: data.ticket_data.ticket_number, id: data.ticket_data.ticket_id });
        }
      }
      else if (data.type === 'status') {
        if (data.status === 'typing' || data.status === 'streaming') {
          setCallStatus('sofia_speaking');
        }
      }
      else if (data.type === 'token') {
        setCallStatus('sofia_speaking');
        
        // Synchronously accumulate response text to bypass React state scheduling latency
        accumulatedBotResponseRef.current += data.text;

        setTurns((prev) => {
          const lastTurn = prev[prev.length - 1];
          if (lastTurn && lastTurn.sender === 'bot' && lastTurn.id === 'stream-voice') {
            return [
              ...prev.slice(0, -1),
              { ...lastTurn, text: lastTurn.text + data.text }
            ];
          } else {
            return [
              ...prev,
              { id: 'stream-voice', sender: 'bot', text: data.text, timestamp: new Date().toISOString() }
            ];
          }
        });
      }
      else if (data.type === 'metadata') {
        setCallStatus('connected');
        
        // Read fully accumulated response from mutable reference immediately
        const finalResponseText = accumulatedBotResponseRef.current;
        accumulatedBotResponseRef.current = ''; // Reset for the next turn
        
        // Finalize Sofia's spoken turn
        setTurns((prev) => {
          const lastTurn = prev[prev.length - 1];
          if (lastTurn && lastTurn.id === 'stream-voice') {
            return [
              ...prev.slice(0, -1),
              { ...lastTurn, id: generateUUID(), text: finalResponseText }
            ];
          }
          return prev;
        });

        if (data.intent) setActiveIntent(data.intent);
        if (data.confidence) setActiveConfidence(data.confidence);
        if (data.slots_filled) setActiveSlots(data.slots_filled);
        if (data.ticket_created && data.ticket_number) {
          setCurrentTicket({ number: data.ticket_number, id: data.ticket_id });
        }

        // Trigger text-to-speech for Sofia's finalized statement
        if (finalResponseText) {
          speakSofiaResponse(finalResponseText);
        } else {
          // If no response text (rare), return to listening
          startListening();
        }
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket error in voice channel. Triggering mock fallback.");
    };

    ws.onclose = () => {
      console.log("Voice WebSocket session closed.");
    };

    socketRef.current = ws;
  };

  // Text-To-Speech core (Sofia voice feedback)
  const speakSofiaResponse = (text: string) => {
    if (isSpeakerMuted) {
      // If speaker is muted, skip speaking and immediately restart microphone listening
      startListening();
      return;
    }

    setCallStatus('sofia_speaking');

    if (useElevenLabs) {
      // Premium voice: request MP3 audio from ElevenLabs/Google fallback proxy
      const playUrl = `http://localhost:8000/api/voice/tts?text=${encodeURIComponent(text)}`;
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(playUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setCallStatus('listening');
        startListening();
      };
      
      audio.onerror = (err) => {
        console.warn("ElevenLabs audio streaming failed, falling back to local synthesis.");
        speakViaLocalSynthesis(text);
      };
      
      audio.play().catch((err) => {
        console.warn("Audio play blocked by browser, falling back to local synthesis.");
        speakViaLocalSynthesis(text);
      });
    } else {
      // Open-source / local speech synthesis
      speakViaLocalSynthesis(text);
    }
  };

  // Local offline browser speech synthesis
  const speakViaLocalSynthesis = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setCallStatus('listening');
      startListening();
      return;
    }

    // Cancel current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    // Attempt to pick a clean English voice if available
    const preferredVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-US')) || voices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    utterance.rate = 1.05; // Slightly faster for responsiveness
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      setCallStatus('listening');
      startListening();
    };

    utterance.onerror = (e) => {
      console.error("Local SpeechSynthesis error:", e);
      setCallStatus('listening');
      startListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  // Speech-To-Text core (Customer microphone processing)
  const startListening = () => {
    if (isMutedRef.current || callStatusRef.current === 'dialing' || callStatusRef.current === 'idle') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web SpeechRecognition is not supported in this browser.");
      return;
    }

    // Stop current instance if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setCallStatus('listening');
      setInterimTranscript('');
      latestTranscriptRef.current = '';
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      const text = interim || final;
      setInterimTranscript(text);
      latestTranscriptRef.current = text;
    };

    recognition.onend = () => {
      const speechText = latestTranscriptRef.current.trim();
      latestTranscriptRef.current = ''; // Clear immediately

      // If we captured input, dispatch to Sofia
      if (speechText) {
        sendTranscriptToSofia(speechText);
        setInterimTranscript('');
      } else {
        // If silence, and call is still active, restart listening shortly
        if (callStatusRef.current === 'listening') {
          setTimeout(() => {
            if (callStatusRef.current === 'listening') {
              startListening();
            }
          }, 300);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.error("Speech Recognition error:", event.error);
      }
    };

    recognitionRef.current = recognition;
    
    try {
      recognition.start();
    } catch (e) {
      console.warn("Could not start Speech Recognition:", e);
    }
  };

  // Dispatches customer speech string to Sofia
  const sendTranscriptToSofia = (text: string) => {
    refreshSessionTimer();

    // Add turn locally
    const newTurn: VoiceTurn = {
      id: generateUUID(),
      sender: 'customer',
      text,
      timestamp: new Date().toISOString()
    };
    setTurns((prev) => [...prev, newTurn]);
    
    setCallStatus('sofia_speaking');

    // Ensure we start with a clean slate for the incoming streamed response
    accumulatedBotResponseRef.current = '';

    // Send through WebSocket if active, else trigger mock conversational stream
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text }));
    } else {
      triggerOfflineVoiceMock(text);
    }
  };

  // Offline mock generator for standalone voice demos
  const triggerOfflineVoiceMock = (text: string) => {
    setCallStatus('sofia_speaking');
    
    setTimeout(() => {
      let botText = "I have noted your request. Let me look that up.";
      let intent = "general_enquiry";
      let confidence = 0.88;
      let ticketCreated = false;
      let ticketNum = "";

      const query = text.toLowerCase();
      if (query.includes("status") || query.includes("application")) {
        intent = "visa_status_enquiry";
        botText = "Certainly! To track your visa application status, please provide your Application Reference Number, Full Name, and Date of Birth.";
        setActiveSlots({ "application_number": null, "full_name": null, "dob": null });
      } else if (query.includes("reschedule") || query.includes("appointment")) {
        intent = "appointment_reschedule";
        botText = "I can help you reschedule your biometric appointment. Could you please specify your preferred new appointment date and your reason for rescheduling?";
        setActiveSlots({ "current_date": "2026-05-20", "preferred_date": "2026-06-10", "reason": "Medical emergency postponement" });
      } else if (query.includes("urgent") || query.includes("expires in 5 days") || query.includes("manager")) {
        intent = "complaint_escalation";
        confidence = 0.96;
        ticketCreated = true;
        ticketNum = "TKT-20260519-00042";
        botText = `I understand the high urgency of your case. An urgent ticket has been escalated under number ${ticketNum}. Our customer supervisor has been notified.`;
        setCurrentTicket({ number: ticketNum, id: "mock-id-voice" });
      }

      setActiveIntent(intent);
      setActiveConfidence(confidence);

      // Add mock Sofia response locally
      const mockSofiaTurn: VoiceTurn = {
        id: generateUUID(),
        sender: 'bot',
        text: botText,
        timestamp: new Date().toISOString()
      };
      setTurns((prev) => [...prev, mockSofiaTurn]);

      speakSofiaResponse(botText);
    }, 1200);
  };

  // Place Call
  const handleStartCall = () => {
    setCallStatus('dialing');
    connectWebSocket();

    // Simulate connection delay
    setTimeout(() => {
      setCallStatus('connected');
      
      // Let Sofia say her welcome line
      const welcomeLine = turns.length > 0 
        ? "Hello, welcome back to the Visa Support Centre. I am connected on voice. How can I assist you further?"
        : "Hello! I am Sofia, your professional AI assistant for the Visa Support Centre. How can I assist you today with visa status tracking, document uploads, or appointment scheduling?";
      
      if (turns.length === 0) {
        setTurns([{
          id: 'init-voice',
          sender: 'bot',
          text: welcomeLine,
          timestamp: new Date().toISOString()
        }]);
      }
      
      speakSofiaResponse(welcomeLine);
    }, 1500);
  };

  // Hang up Call
  const handleEndCall = () => {
    setCallStatus('idle');
    
    // Stop local SpeechSynthesis and Recognition
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Close WebSocket
    if (socketRef.current) {
      socketRef.current.close();
    }
    
    setInterimTranscript('');
  };

  // Toggle Mute mic
  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (nextMute) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    } else {
      if (callStatus === 'listening' || callStatus === 'connected') {
        startListening();
      }
    }
  };

  // Toggle Speaker mute
  const handleToggleSpeaker = () => {
    const nextSpeakerMute = !isSpeakerMuted;
    setIsSpeakerMuted(nextSpeakerMute);
    if (nextSpeakerMute) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (callStatus === 'sofia_speaking') {
        setCallStatus('connected');
        startListening();
      }
    }
  };

  // Reset Session
  const handleResetSession = () => {
    handleEndCall();
    resetSessionId();
    setTurns([]);
    setActiveIntent('');
    setActiveConfidence(0);
    setActiveSlots({});
    setCurrentTicket(null);
  };

  // Get active wave amplitude lines
  const renderWaveform = () => {
    if (callStatus === 'idle') {
      return (
        <div className="flex items-center gap-1 h-12 justify-center">
          <div className="w-1.5 h-1 bg-gray-700/60 rounded-full transition-all duration-300"></div>
          <div className="w-1.5 h-1 bg-gray-700/60 rounded-full transition-all duration-300"></div>
          <div className="w-1.5 h-1 bg-gray-700/60 rounded-full transition-all duration-300"></div>
        </div>
      );
    }

    if (callStatus === 'dialing') {
      return (
        <div className="flex items-center gap-1.5 h-12 justify-center">
          {[...Array(6)].map((_, i) => (
            <div 
              key={i} 
              className="w-1.5 h-2 bg-primary/40 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            ></div>
          ))}
        </div>
      );
    }

    if (callStatus === 'sofia_speaking') {
      return (
        <div className="flex items-center gap-1 h-12 justify-center">
          {[...Array(12)].map((_, i) => {
            const delay = i * 80;
            return (
              <div 
                key={i} 
                className="w-1.5 bg-gradient-to-t from-accent to-[#fb7185] rounded-full animate-pulse voice-wave-bar"
                style={{ 
                  animationDelay: `${delay}ms`,
                  animationDuration: `${600 + (i % 3) * 150}ms`,
                  height: `${20 + Math.sin(i * 0.5) * 20}px`
                }}
              ></div>
            );
          })}
        </div>
      );
    }

    if (callStatus === 'listening') {
      return (
        <div className="flex items-center gap-1.5 h-12 justify-center">
          {[...Array(8)].map((_, i) => {
            const delay = i * 100;
            return (
              <div 
                key={i} 
                className="w-1.5 bg-gradient-to-t from-primary to-primary-light rounded-full animate-pulse voice-wave-bar"
                style={{ 
                  animationDelay: `${delay}ms`,
                  animationDuration: '800ms',
                  height: `${10 + (i % 2) * 15}px`
                }}
              ></div>
            );
          })}
        </div>
      );
    }

    // Connected but quiet
    return (
      <div className="flex items-center gap-1 h-12 justify-center">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="w-1.5 h-2 bg-primary/20 rounded-full"></div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      
      {/* LEFT COLUMN - Telemetry & Slot checklist */}
      <div className="lg:col-span-1 glass-panel p-5 rounded-xl flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
              <KeyRound className="text-primary w-5 h-5 animate-pulse" />
              NLP Telemetry
            </h2>
            <p className="text-xs text-gray-400 mt-1">Live semantic analysis by Groq Llama.</p>
          </div>

          {/* Active Intent telemetry */}
          {activeIntent ? (
            <div className="space-y-3 bg-[#0f172a]/50 p-3.5 rounded-lg border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Detected Intent</span>
                <span className="bg-primary/20 text-primary-light border border-primary/30 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  {activeIntent.replace("_", " ")}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>Confidence Score</span>
                  <span>{activeConfidence ? `${(activeConfidence * 100).toFixed(0)}%` : 'N/A'}</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(activeConfidence || 0.85) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-gray-800 rounded-lg text-gray-600 text-xs">
              Waiting for voice input...
            </div>
          )}

          {/* Stateful slots checklist */}
          {Object.keys(activeSlots).length > 0 && (
            <div className="space-y-3">
              <span className="text-xs text-gray-400 block font-semibold">Stateful Slot Checklist</span>
              <div className="space-y-2">
                {Object.entries(activeSlots).map(([slotKey, value]) => (
                  <div key={slotKey} className="flex items-center justify-between text-xs p-2.5 bg-[#151c2c]/65 rounded border border-gray-800/40">
                    <span className="capitalize font-mono text-[11px] text-gray-300">
                      {slotKey.replace("_", " ")}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold">
                      {value ? (
                        <>
                          <CheckCircle className="text-success w-4 h-4" />
                          <span className="text-[11px] text-success truncate max-w-[80px]">{value}</span>
                        </>
                      ) : (
                        <>
                          <HelpCircle className="text-warning w-4 h-4 animate-spin-slow" />
                          <span className="text-[11px] text-warning">missing</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Premium Settings Panel */}
          <div className="space-y-3 pt-4 border-t border-gray-800/60">
            <span className="text-xs text-gray-400 block font-semibold">Voice Processing Platform</span>
            <div className="bg-[#151c2c]/30 border border-gray-800 p-3 rounded-lg space-y-3.5">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-[11px] text-gray-300 font-bold block">ElevenLabs Premium Voice</span>
                  <span className="text-[9px] text-gray-500 block">Uses hyper-realistic neural synthesis</span>
                </div>
                <input 
                  type="checkbox" 
                  checked={useElevenLabs}
                  onChange={(e) => setUseElevenLabs(e.target.checked)}
                  className="rounded border-gray-800 bg-[#0b0f19] text-primary focus:ring-primary w-4.5 h-4.5"
                />
              </label>
              <div className="flex items-center gap-2 text-[9px] text-gray-500 bg-[#0f172a]/80 p-2 rounded border border-gray-800/40">
                <Sparkles className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                <span>Zero-key automatic Google TTS fallback included!</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Center - Ticket generated & reset session */}
        <div className="space-y-3 pt-4 border-t border-gray-800">
          {currentTicket && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3.5 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-bold uppercase tracking-wider">
                <Ticket className="w-4.5 h-4.5" />
                Ticket Generated
              </div>
              <p className="text-[11px] text-gray-300 font-mono">ID: {currentTicket.number}</p>
              <button 
                onClick={() => setActiveTab('tickets')}
                className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs py-1.5 rounded transition font-medium flex items-center justify-center gap-1"
              >
                Go to Workspace
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button 
            onClick={handleResetSession}
            className="w-full bg-[#1e293b]/50 hover:bg-[#1e293b] border border-gray-800 text-xs text-gray-300 py-2.5 rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Voice Session
          </button>
        </div>
      </div>

      {/* MIDDLE & RIGHT - Call Interface Terminal */}
      <div className="lg:col-span-3 grid grid-rows-3 gap-6 h-full">
        
        {/* UPPER PANEL - Softphone Client Dialer */}
        <div className="row-span-1 glass-panel p-6 rounded-xl flex items-center justify-between border border-gray-800/30 relative overflow-hidden">
          {/* Futuristic background patterns */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full filter blur-3xl pointer-events-none"></div>
          
          <div className="flex items-center gap-6">
            {/* Pulsing Dialer Button */}
            <button
              onClick={callStatus === 'idle' ? handleStartCall : handleEndCall}
              className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all duration-300 shadow-2xl relative shrink-0 ${
                callStatus === 'idle' 
                  ? 'bg-gradient-to-br from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/20 hover:scale-105' 
                  : 'bg-gradient-to-br from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/20 hover:scale-105 animate-pulse'
              }`}
            >
              {callStatus === 'idle' ? (
                <Phone className="w-8 h-8" />
              ) : (
                <PhoneOff className="w-8 h-8" />
              )}
            </button>
            
            <div className="space-y-1.5">
              <span className="text-lg font-bold text-white block">
                {callStatus === 'idle' && 'AI Operator Offline'}
                {callStatus === 'dialing' && 'Initiating Secure Line...'}
                {callStatus === 'connected' && 'Call Active (Sofia Muted)'}
                {callStatus === 'sofia_speaking' && 'Sofia Speaking...'}
                {callStatus === 'listening' && 'Listening to Customer...'}
              </span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  callStatus === 'idle' ? 'bg-gray-500' :
                  callStatus === 'dialing' ? 'bg-yellow-500 animate-ping' :
                  callStatus === 'listening' ? 'bg-primary animate-pulse' : 'bg-green-500'
                }`}></span>
                <span className="text-xs text-gray-400 font-mono uppercase tracking-wider">
                  {callStatus === 'idle' ? 'Ready to Dial' : `Duration: ${formatTime(callDuration)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Core Wave Visualizer */}
          <div className="flex-1 max-w-sm px-6 hidden md:block">
            {renderWaveform()}
          </div>

          {/* VoIP Call Actions */}
          <div className="flex items-center gap-2.5 bg-[#0f172a]/60 border border-gray-800 p-2 rounded-xl shrink-0">
            <button
              onClick={handleToggleMute}
              disabled={callStatus === 'idle'}
              className={`p-3 rounded-lg transition ${
                isMuted 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40 disabled:opacity-30'
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            
            <button
              onClick={handleToggleSpeaker}
              disabled={callStatus === 'idle'}
              className={`p-3 rounded-lg transition ${
                isSpeakerMuted 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/40 disabled:opacity-30'
              }`}
              title={isSpeakerMuted ? "Unmute Speaker" : "Mute Speaker"}
            >
              {isSpeakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* LOWER PANEL - Scrolling Caption Transcript Log */}
        <div className="row-span-2 glass-panel rounded-xl flex flex-col overflow-hidden border border-gray-800/30 h-full">
          {/* Header */}
          <div className="p-4 bg-[#151c2c]/85 border-b border-gray-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="w-4.5 h-4.5 text-primary" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">Live Call Caption Log</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">Channels WebSocket Active</span>
          </div>

          {/* Turn bubbles list */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {turns.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3.5">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="space-y-1 max-w-xs">
                  <span className="text-sm font-bold text-white block">No Active Connection</span>
                  <p className="text-xs text-gray-500 leading-normal">
                    Click the green dialer button above to connect and speak to Sofia using voice.
                  </p>
                </div>
              </div>
            ) : (
              turns.map((turn) => (
                <div 
                  key={turn.id} 
                  className={`flex gap-3 max-w-[80%] ${turn.sender === 'customer' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    turn.sender === 'customer' 
                      ? 'bg-primary/20 text-primary-light' 
                      : 'bg-[#151c2c] border border-gray-800 text-accent'
                  }`}>
                    {turn.sender === 'customer' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`rounded-xl p-3 text-sm leading-relaxed ${
                    turn.sender === 'customer'
                      ? 'bg-primary text-white rounded-tr-none shadow-md shadow-primary/10'
                      : 'bg-[#151c2c] border border-gray-800/80 text-gray-200 rounded-tl-none'
                  }`}>
                    <p>{turn.text}</p>
                    <span className={`text-[8px] mt-1.5 block font-mono ${
                      turn.sender === 'customer' ? 'text-white/60' : 'text-gray-500'
                    }`}>
                      {new Date(turn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))
            )}

            {/* Interim Transcript for active speech recognition */}
            {interimTranscript && (
              <div className="flex gap-3 max-w-[80%] ml-auto flex-row-reverse">
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary-light flex items-center justify-center shrink-0 animate-pulse">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="rounded-xl p-3 text-sm bg-primary/70 text-white/90 rounded-tr-none border border-primary-light/20 shadow-md">
                  <p className="italic">{interimTranscript}</p>
                  <span className="text-[8px] mt-1.5 block font-mono text-white/40">
                    Capturing live speech...
                  </span>
                </div>
              </div>
            )}

            {/* Speaking/Typing animation */}
            {callStatus === 'sofia_speaking' && !turns.find(t => t.id === 'stream-voice') && (
              <div className="flex gap-3 max-w-[80%]">
                <div className="w-7 h-7 rounded-full bg-[#151c2c] border border-gray-800 text-accent flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 animate-bounce" />
                </div>
                <div className="bg-[#151c2c] border border-gray-800/80 p-3 rounded-xl rounded-tl-none flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}

            <div ref={transcriptEndRef} />
          </div>

          {/* Micro-diagnostic indicator bar */}
          <div className="p-3 bg-[#0b0f19]/70 border-t border-gray-800/60 flex justify-between items-center px-4 shrink-0">
            <span className="text-[10px] text-gray-500 flex items-center gap-1.5">
              <Mic className="w-3 h-3 text-primary animate-pulse" />
              Microphone status: <strong className="text-gray-300 uppercase">{callStatus === 'listening' ? 'active' : 'idle'}</strong>
            </span>
            <span className="text-[10px] text-gray-500">
              STT: Browser Native | TTS: {useElevenLabs ? 'ElevenLabs' : 'Browser Web Speech'}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
}

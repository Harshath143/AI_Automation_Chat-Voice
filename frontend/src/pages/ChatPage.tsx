import React, { useState, useEffect, useRef } from 'react';
import { useStore, generateUUID } from '../store/useStore';
import { 
  Send, Bot, User, RefreshCw, KeyRound, CheckCircle, 
  HelpCircle, ArrowUpRight, CheckSquare, Square, Ticket 
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'customer' | 'bot';
  text: string;
  intent?: string;
  confidence?: number;
  slots_filled?: Record<string, string | null>;
  ticket_created?: boolean;
  ticket_number?: string;
}

export default function ChatPage() {
  const { sessionId, resetSessionId, setActiveTab } = useStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState<'idle' | 'typing' | 'streaming'>('idle');
  const [activeSlots, setActiveSlots] = useState<Record<string, string | null>>({});
  const [activeIntent, setActiveIntent] = useState<string>('');
  const [activeConfidence, setActiveConfidence] = useState<number>(0);
  const [currentTicket, setCurrentTicket] = useState<{ number: string; id: string } | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Initialize WebSockets
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const connectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }

    // Connect to django channels ASGI websocket server
    const wsUrl = `ws://localhost:8000/ws/chat/${sessionId}/`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket Connection established.");
      // Send greeting trigger message if history is empty
      if (messages.length === 0) {
        setMessages([
          {
            id: 'init',
            sender: 'bot',
            text: "Hello! I am Sofia, your professional AI assistant for the Visa Support Centre. How can I assist you today with visa status tracking, document uploads, or appointment scheduling?"
          }
        ]);
      }
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'status') {
        setStatus(data.status);
      } 
      else if (data.type === 'token') {
        setStatus('streaming');
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.sender === 'bot' && lastMsg.id === 'stream-bot') {
            // Append token to streaming bot response
            return [
              ...prev.slice(0, -1),
              { ...lastMsg, text: lastMsg.text + data.text }
            ];
          } else {
            // Create new streaming bot bubble
            return [
              ...prev,
              { id: 'stream-bot', sender: 'bot', text: data.text }
            ];
          }
        });
      } 
      else if (data.type === 'metadata') {
        setStatus('idle');
        
        // Finalize streaming bubble in state
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.id === 'stream-bot') {
            return [
              ...prev.slice(0, -1),
              { 
                id: generateUUID(), 
                sender: 'bot', 
                text: lastMsg.text,
                intent: data.intent,
                confidence: data.confidence,
                ticket_created: data.ticket_created,
                ticket_number: data.ticket_number
              }
            ];
          }
          return prev;
        });

        // Set sidebar tracking states
        if (data.intent) setActiveIntent(data.intent);
        if (data.confidence) setActiveConfidence(data.confidence);
        if (data.slots_filled) setActiveSlots(data.slots_filled);
        
        if (data.ticket_created && data.ticket_number) {
          setCurrentTicket({ number: data.ticket_number, id: data.ticket_id });
        }
      }
    };

    ws.onerror = (err) => {
      console.warn("WebSocket error. Running in Local Standalone Mock mode.");
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected.");
    };

    socketRef.current = ws;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsgText = inputText;
    setInputText('');

    // Append customer message locally
    const newMsg: ChatMessage = {
      id: generateUUID(),
      sender: 'customer',
      text: userMsgText
    };
    setMessages((prev) => [...prev, newMsg]);

    // Send through WebSocket if open, else trigger local mock generator
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ text: userMsgText }));
    } else {
      triggerMockBotResponse(userMsgText);
    }
  };

  // Local fallback mock chatbot generator for offline demo stability
  const triggerMockBotResponse = (userText: string) => {
    setStatus('typing');
    setTimeout(() => {
      let botText = "I have noted your request. Let me look that up.";
      let intent = "general_enquiry";
      let confidence = 0.85;
      let ticketCreated = false;
      let ticketNum = "";

      const text = userText.toLowerCase();
      if (text.includes("status") || text.includes("application")) {
        intent = "visa_status_enquiry";
        botText = "Certainly! To track your visa application status, please provide your Application Reference Number, Full Name, and Date of Birth (YYYY-MM-DD).";
        setActiveSlots({ "application_number": null, "full_name": null, "dob": null });
      } else if (text.includes("reschedule") || text.includes("appointment")) {
        intent = "appointment_reschedule";
        botText = "I would be happy to help you reschedule your visa biometric or interview appointment. Could you please specify your preferred new appointment date (YYYY-MM-DD) and your reason for rescheduling?";
        setActiveSlots({ "current_date": "2026-05-20", "preferred_date": "2026-06-10", "reason": "Business meeting escalation" });
      } else if (text.includes("urgent") || text.includes("manager") || text.includes("expires in 5 days")) {
        intent = "complaint_escalation";
        confidence = 0.98;
        ticketCreated = true;
        ticketNum = "TKT-20260519-00042";
        botText = `I acknowledge the extreme urgency regarding your visa. A critical escalation ticket has been created under ID ${ticketNum}. The Customer Relations manager has been notified and will contact you shortly.`;
        setCurrentTicket({ number: ticketNum, id: "mock-id-1" });
      }

      setActiveIntent(intent);
      setActiveConfidence(confidence);

      setStatus('streaming');
      
      // Simulate word-by-word streaming locally
      const words = botText.split(" ");
      let currentIdx = 0;
      let currentText = "";

      const interval = setInterval(() => {
        if (currentIdx < words.length) {
          currentText += (currentIdx === 0 ? "" : " ") + words[currentIdx];
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === 'mock-stream') {
              return [...prev.slice(0, -1), { ...last, text: currentText }];
            } else {
              return [...prev, { id: 'mock-stream', sender: 'bot', text: currentText }];
            }
          });
          currentIdx++;
        } else {
          clearInterval(interval);
          setStatus('idle');
          // Finalize mock bubble in array
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.id === 'mock-stream') {
              return [
                ...prev.slice(0, -1),
                {
                  id: generateUUID(),
                  sender: 'bot',
                  text: last.text,
                  intent,
                  confidence,
                  ticket_created: ticketCreated,
                  ticket_number: ticketNum
                }
              ];
            }
            return prev;
          });
        }
      }, 80);
    }, 800);
  };

  const handleResetSession = () => {
    resetSessionId();
    setMessages([]);
    setActiveIntent('');
    setActiveConfidence(0);
    setActiveSlots({});
    setCurrentTicket(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
      {/* Sidebar - Slot Filling & NLP telemetry */}
      <div className="lg:col-span-1 glass-panel p-5 rounded-xl flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-1.5">
              <KeyRound className="text-primary w-5 h-5" />
              NLP Telemetry
            </h2>
            <p className="text-xs text-gray-400 mt-1">Live semantic analysis by Groq Llama.</p>
          </div>

          {/* Active Intent */}
          {activeIntent ? (
            <div className="space-y-3 bg-[#0f172a]/50 p-3 rounded-lg border border-gray-800">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Detected Intent</span>
                <span className="bg-primary/20 text-primary-light border border-primary/30 text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider">
                  {activeIntent.replace("_", " ")}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                  <span>Confidence Score</span>
                  <span>{(activeConfidence * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${activeConfidence * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-gray-800 rounded-lg text-gray-600 text-xs">
              Waiting for customer messages...
            </div>
          )}

          {/* Slot checklist state */}
          {Object.keys(activeSlots).length > 0 && (
            <div className="space-y-3">
              <span className="text-xs text-gray-400 block font-semibold">Stateful Slot Checklist</span>
              <div className="space-y-2">
                {Object.entries(activeSlots).map(([slotKey, value]) => (
                  <div key={slotKey} className="flex items-center justify-between text-xs p-2 bg-[#151c2c]/65 rounded border border-gray-800/40">
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
                          <HelpCircle className="text-warning w-4 h-4" />
                          <span className="text-[11px] text-warning">missing</span>
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action center */}
        <div className="space-y-3 pt-4 border-t border-gray-800">
          {currentTicket && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-bold uppercase tracking-wider">
                <Ticket className="w-4 h-4" />
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
            className="w-full bg-[#1e293b]/50 hover:bg-[#1e293b] border border-gray-800 text-xs text-gray-300 py-2 rounded-lg transition flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Chat Session
          </button>
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="lg:col-span-3 glass-panel rounded-xl flex flex-col h-full overflow-hidden border border-gray-800/30">
        {/* Chat Title bar */}
        <div className="p-4 bg-[#151c2c] border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary relative">
              <Bot className="w-5 h-5" />
              <span className="w-2 h-2 bg-green-500 rounded-full absolute bottom-0 right-0 border border-background-card"></span>
            </div>
            <div>
              <span className="text-sm font-bold text-white block">Sofia</span>
              <span className="text-[11px] text-gray-400">Visa Support Assistant</span>
            </div>
          </div>
          <span className="text-xs font-mono text-gray-500">Session ID: {sessionId.substring(0, 8)}</span>
        </div>

        {/* Chat Area bubble logs */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex gap-3 max-w-[80%] ${msg.sender === 'customer' ? 'ml-auto flex-row-reverse' : ''}`}
            >
              {/* Profile Icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
                msg.sender === 'customer' 
                  ? 'bg-primary/20 text-primary-light' 
                  : 'bg-[#151c2c] border border-gray-800 text-accent'
              }`}>
                {msg.sender === 'customer' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message box */}
              <div className={`rounded-xl p-3.5 space-y-2 text-sm leading-relaxed ${
                msg.sender === 'customer'
                  ? 'bg-primary text-white rounded-tr-none'
                  : 'bg-[#151c2c] border border-gray-800/80 text-gray-200 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap">{msg.text}</p>
                
                {/* Embedded dynamic tickets alert */}
                {msg.ticket_created && msg.ticket_number && (
                  <div className="mt-2 bg-[#0b0f19]/60 border border-gray-800 p-2.5 rounded-lg flex items-center justify-between gap-3 text-xs">
                    <span className="text-gray-400 font-mono">Reference: <strong className="text-white">{msg.ticket_number}</strong></span>
                    <button 
                      onClick={() => setActiveTab('tickets')}
                      className="text-primary hover:text-primary-light font-bold flex items-center gap-0.5 shrink-0"
                    >
                      Inspect
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading status states */}
          {status === 'typing' && (
            <div className="flex gap-3 max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-[#151c2c] border border-gray-800 text-accent flex items-center justify-center">
                <Bot className="w-4 h-4 animate-bounce" />
              </div>
              <div className="bg-[#151c2c] border border-gray-800/80 p-3.5 rounded-xl rounded-tl-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input box form */}
        <form onSubmit={handleSendMessage} className="p-4 bg-[#151c2c] border-t border-gray-800 flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={status !== 'idle'}
            placeholder={status !== 'idle' ? "Sofia is streaming her response..." : "Type your visa status or rescheduling question here..."}
            className="flex-1 bg-[#0b0f19] border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-primary/50 disabled:opacity-50 transition"
          />
          <button 
            type="submit"
            disabled={!inputText.trim() || status !== 'idle'}
            className="bg-primary hover:bg-primary-dark text-white rounded-xl px-4 py-3 transition duration-150 disabled:opacity-40 flex items-center gap-1 text-sm font-semibold shrink-0"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

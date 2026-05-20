import { create } from 'zustand';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Create central Axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export interface Ticket {
  id: string;
  ticket_number: string;
  customer: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
    dob?: string;
  };
  channel: string;
  intent: string;
  priority: string;
  department: string;
  status: string;
  summary?: string;
  conversation_id?: string;
  sla_deadline: string;
  assigned_agent?: string;
  created_at: string;
  updated_at: string;
}

export interface KPISummary {
  total_tickets_today: number;
  open_tickets: number;
  escalated_tickets: number;
  avg_response_time_min: number;
  doc_rejection_rate_pct: number;
  csat_score: number;
}

export interface EscalationItem {
  id: string;
  ticket_number: string;
  customer_name: string;
  priority: string;
  department: string;
  sla_deadline: string;
  minutes_overdue: number;
}

interface AppState {
  activeTab: 'dashboard' | 'chat' | 'tickets' | 'documents' | 'voice';
  sessionId: string;
  tickets: Ticket[];
  kpiSummary: KPISummary;
  escalations: EscalationItem[];
  loading: boolean;
  error: string | null;
  role: 'user' | 'admin';
  userProfile: { full_name: string; email: string; phone: string; } | null;
  
  // Setters
  setActiveTab: (tab: 'dashboard' | 'chat' | 'tickets' | 'documents' | 'voice') => void;
  resetSessionId: () => void;
  setRole: (role: 'user' | 'admin') => void;
  refreshSessionTimer: () => void;
  setUserProfile: (profile: { full_name: string; email: string; phone: string; } | null) => void;
  
  // API actions
  fetchTickets: (search?: string) => Promise<void>;
  updateTicket: (ticketId: string, payload: Partial<Ticket>) => Promise<void>;
  escalateTicket: (ticketId: string, reason: string) => Promise<void>;
  fetchAnalytics: () => Promise<void>;
}

export const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const isValidUUID = (id: string | null): boolean => {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const useStore = create<AppState>((set, get) => ({
  activeTab: (localStorage.getItem('role') || 'user') === 'user' ? 'chat' : 'dashboard',
  role: (localStorage.getItem('role') || 'user') as 'user' | 'admin',
  sessionId: (() => {
    const cachedId = localStorage.getItem('sessionId');
    const cachedTimestamp = localStorage.getItem('sessionTimestamp');
    const now = Date.now();
    
    if (isValidUUID(cachedId) && cachedTimestamp) {
      const timeDiff = now - parseInt(cachedTimestamp, 10);
      if (timeDiff < 3600000) { // 1 hour
        localStorage.setItem('sessionTimestamp', now.toString());
        return cachedId as string;
      }
    }
    
    const newId = generateUUID();
    localStorage.setItem('sessionId', newId);
    localStorage.setItem('sessionTimestamp', now.toString());
    return newId;
  })(),
  tickets: [],
  kpiSummary: {
    total_tickets_today: 18,
    open_tickets: 24,
    escalated_tickets: 5,
    avg_response_time_min: 12.5,
    doc_rejection_rate_pct: 14.8,
    csat_score: 4.3,
  },
  escalations: [],
  loading: false,
  error: null,

  userProfile: (() => {
    const cached = localStorage.getItem('userProfile');
    try {
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })(),

  setActiveTab: (tab) => set({ activeTab: tab }),
  
  resetSessionId: () => {
    const newId = generateUUID();
    localStorage.setItem('sessionId', newId);
    localStorage.setItem('sessionTimestamp', Date.now().toString());
    set({ sessionId: newId });
  },

  setUserProfile: (profile) => {
    if (profile) {
      localStorage.setItem('userProfile', JSON.stringify(profile));
    } else {
      localStorage.removeItem('userProfile');
    }
    set({ userProfile: profile });
  },

  setRole: (role) => {
    localStorage.setItem('role', role);
    set({ role });
  },

  refreshSessionTimer: () => {
    localStorage.setItem('sessionTimestamp', Date.now().toString());
  },

  fetchTickets: async (search) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/tickets', { params: { search } });
      set({ tickets: response.data, loading: false });
    } catch (err) {
      console.warn("Failed to fetch live tickets. Rendering realistic seeder mockups.");
      // Render beautiful standalone fallback tickets
      const mockTickets: Ticket[] = [
        {
          id: "t1",
          ticket_number: "TKT-20260519-00001",
          customer: { id: "c1", full_name: "Alexander Smith", email: "alex.smith@gmail.com", phone: "+971-50-123-4567" },
          channel: "chat",
          intent: "appointment_reschedule",
          priority: "high",
          department: "Appointment Management Team",
          status: "open",
          summary: "Customer requested a biometrics rescheduling due to sudden illness.",
          sla_deadline: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "t2",
          ticket_number: "TKT-20260519-00002",
          customer: { id: "c2", full_name: "Fatima Al-Mansoori", email: "fatima.mansoori@gmail.com" },
          channel: "chat",
          intent: "complaint_escalation",
          priority: "critical",
          department: "Customer Relations",
          status: "escalated",
          summary: "Urgent complaint: Applicant visa expires in 5 days and nomination remains stuck.",
          sla_deadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
          created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3600 * 1000).toISOString(),
        },
        {
          id: "t3",
          ticket_number: "TKT-20260518-00045",
          customer: { id: "c3", full_name: "Yuki Tanaka", email: "y.tanaka@yahoo.com" },
          channel: "email",
          intent: "visa_status_enquiry",
          priority: "medium",
          department: "Visa Processing Team",
          status: "in_progress",
          summary: "Standard tourist visa tracker query for family travel in June.",
          sla_deadline: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
          created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
        }
      ];
      set({ tickets: mockTickets, loading: false });
    }
  },

  updateTicket: async (ticketId, payload) => {
    try {
      const response = await api.patch(`/tickets/${ticketId}`, payload);
      const updated = response.data;
      set((state) => ({
        tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, ...updated } : t)),
      }));
    } catch (err) {
      console.warn("Failed to patch live ticket on server. Updating locally in state store.");
      set((state) => ({
        tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, ...payload } : t)),
      }));
    }
  },

  escalateTicket: async (ticketId, reason) => {
    try {
      const response = await api.post(`/tickets/${ticketId}/escalate`, { reason });
      const updated = response.data;
      set((state) => ({
        tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, ...updated } : t)),
      }));
    } catch (err) {
      console.warn("Failed to post escalation on server. Escalating locally in state store.");
      set((state) => ({
        tickets: state.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'escalated', priority: 'critical' } : t)),
      }));
    }
  },

  fetchAnalytics: async () => {
    try {
      const [summaryRes, escalationsRes] = await Promise.all([
        api.get('/analytics/summary'),
        api.get('/analytics/escalations'),
      ]);
      set({
        kpiSummary: summaryRes.data,
        escalations: escalationsRes.data,
      });
    } catch (err) {
      console.warn("Analytics fetch offline. Rendering mock visualization arrays.");
      const mockEscalations: EscalationItem[] = [
        {
          id: "t2",
          ticket_number: "TKT-20260519-00002",
          customer_name: "Fatima Al-Mansoori",
          priority: "critical",
          department: "Customer Relations",
          sla_deadline: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          minutes_overdue: 45
        }
      ];
      set({ escalations: mockEscalations });
    }
  }
}));

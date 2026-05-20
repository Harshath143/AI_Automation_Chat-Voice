import React, { useEffect, useState } from 'react';
import { useStore, Ticket } from '../store/useStore';
import { 
  Search, ShieldAlert, UserCheck, RefreshCcw, 
  MapPin, Calendar, Mail, Phone, AlertCircle, Clock 
} from 'lucide-react';

export default function TicketPage() {
  const { tickets, loading, fetchTickets, updateTicket, escalateTicket } = useStore();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [showEscalateBox, setShowEscalateBox] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  // Run search and list updates
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTickets(searchQuery);
  };

  // Sync selected ticket details if it gets updated in state list
  const activeTicket = selectedTicket 
    ? tickets.find(t => t.id === selectedTicket.id) || selectedTicket 
    : null;

  const handleStatusChange = (status: string) => {
    if (!activeTicket) return;
    updateTicket(activeTicket.id, { status });
  };

  const handleAgentChange = (assigned_agent: string) => {
    if (!activeTicket) return;
    updateTicket(activeTicket.id, { assigned_agent });
  };

  const handleEscalate = () => {
    if (!activeTicket || !escalationReason.trim()) return;
    escalateTicket(activeTicket.id, escalationReason).then(() => {
      setEscalationReason('');
      setShowEscalateBox(false);
    });
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500/10 text-red-400 border border-red-500/25';
      case 'high': return 'bg-amber-500/10 text-amber-400 border border-amber-500/25';
      case 'medium': return 'bg-blue-500/10 text-blue-400 border border-blue-500/25';
      default: return 'bg-green-500/10 text-green-400 border border-green-500/25';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'escalated': return 'bg-red-600 text-white font-semibold';
      case 'resolved': return 'bg-green-600/20 text-green-300 border border-green-500/30';
      case 'in_progress': return 'bg-blue-500/25 text-blue-300 border border-blue-500/30';
      case 'closed': return 'bg-gray-800 text-gray-400';
      default: return 'bg-gray-700/50 text-gray-200';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      
      {/* Sidebar List Column */}
      <div className="lg:col-span-1 glass-panel rounded-xl flex flex-col overflow-hidden border border-gray-800/30">
        
        {/* Search Header */}
        <form onSubmit={handleSearch} className="p-4 border-b border-gray-800 bg-[#151c2c] flex gap-2">
          <div className="relative flex-1">
            <input 
              type="text" 
              placeholder="Search reference, name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-primary/50"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
          </div>
          <button 
            type="submit" 
            className="bg-primary hover:bg-primary-dark text-white px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0"
          >
            Filter
          </button>
        </form>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-800/60 p-2 space-y-1.5">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <RefreshCcw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Loading tickets database...
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              No tickets matched query.
            </div>
          ) : (
            tickets.map((t) => (
              <div 
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={`p-3.5 rounded-lg cursor-pointer transition duration-150 flex flex-col justify-between space-y-3 border ${
                  activeTicket?.id === t.id 
                    ? 'bg-primary/10 border-primary/40' 
                    : 'bg-[#151c2c]/40 border-gray-800/60 hover:bg-[#151c2c]/80'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-mono text-primary-light font-bold">{t.ticket_number}</span>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold tracking-wider ${getPriorityBadgeClass(t.priority)}`}>
                    {t.priority}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white truncate">{t.customer.full_name}</h3>
                  <p className="text-[11px] text-gray-400 capitalize mt-1">{t.intent.replace("_", " ")}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-800/40">
                  <span className="text-[10px] text-gray-500 font-mono">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${getStatusBadgeClass(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Workspace Column */}
      <div className="lg:col-span-2 glass-panel rounded-xl flex flex-col overflow-hidden border border-gray-800/30">
        {activeTicket ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Header Title block */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between pb-5 border-b border-gray-800 space-y-3 md:space-y-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-mono font-black text-white">{activeTicket.ticket_number}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${getPriorityBadgeClass(activeTicket.priority)}`}>
                    {activeTicket.priority}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${getStatusBadgeClass(activeTicket.status)}`}>
                    {activeTicket.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-gray-400 text-xs mt-1 capitalize">Intent Type: {activeTicket.intent.replace("_", " ")}</p>
              </div>
              
              {/* Dynamic SLA Countdown clocks */}
              <div className="bg-[#1a2333] border border-gray-800/80 px-4 py-2 rounded-xl flex items-center gap-3">
                <Clock className="w-5 h-5 text-warning animate-pulse" />
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider block">SLA Target Limit</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {new Date(activeTicket.sla_deadline).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* AI summary block */}
            <div className="bg-[#3b82f6]/5 border border-primary/20 p-4.5 rounded-xl space-y-2">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <ShieldAlert className="w-4.5 h-4.5" />
                AI-Generated Ticket Summary
              </span>
              <p className="text-sm text-gray-200 leading-relaxed italic">
                "{activeTicket.summary || "Generating summary in background..."}"
              </p>
            </div>

            {/* Customer Dossier grid */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Customer Dossier</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#151c2c]/40 border border-gray-800/40 p-3.5 rounded-lg flex items-center gap-3 text-sm">
                  <UserCheck className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 block">Applicant Name</span>
                    <span className="font-semibold text-white">{activeTicket.customer.full_name}</span>
                  </div>
                </div>
                <div className="bg-[#151c2c]/40 border border-gray-800/40 p-3.5 rounded-lg flex items-center gap-3 text-sm">
                  <Mail className="w-5 h-5 text-accent shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 block">Email Address</span>
                    <span className="font-semibold text-white">{activeTicket.customer.email}</span>
                  </div>
                </div>
                <div className="bg-[#151c2c]/40 border border-gray-800/40 p-3.5 rounded-lg flex items-center gap-3 text-sm">
                  <Phone className="w-5 h-5 text-success shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 block">Phone Details</span>
                    <span className="font-semibold text-white">{activeTicket.customer.phone || 'N/A'}</span>
                  </div>
                </div>
                <div className="bg-[#151c2c]/40 border border-gray-800/40 p-3.5 rounded-lg flex items-center gap-3 text-sm">
                  <Calendar className="w-5 h-5 text-warning shrink-0" />
                  <div>
                    <span className="text-[10px] text-gray-500 block">Date of Birth</span>
                    <span className="font-semibold text-white">{activeTicket.customer.dob || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action control Deck */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Triage & routing Controls</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* State shift */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Transition Status</label>
                  <select 
                    value={activeTicket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                {/* Agent assign */}
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-400 uppercase tracking-wider block">Assign Agent</label>
                  <select 
                    value={activeTicket.assigned_agent || ''}
                    onChange={(e) => handleAgentChange(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg p-2.5 text-xs text-gray-200 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    <option value="Emma Watson">Emma Watson (Visa Specialist)</option>
                    <option value="Tariq Malik">Tariq Malik (Biometrics Team)</option>
                    <option value="Elena Rostova">Elena Rostova (Compliance Head)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Manual Escalation Box */}
            <div className="pt-4 border-t border-gray-800">
              {!showEscalateBox ? (
                <button 
                  onClick={() => setShowEscalateBox(true)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-4 py-2.5 rounded-lg font-semibold transition"
                >
                  Manually Escalate to Manager
                </button>
              ) : (
                <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-lg space-y-3">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    Manager Escalation Request
                  </h4>
                  <p className="text-[11px] text-gray-400">Provide details. This will automatically force critical severity and alert supervisor SMTP pipelines.</p>
                  <textarea 
                    placeholder="Provide escalation reason (e.g. Visa expiry imminent, client is aggressive)..."
                    value={escalationReason}
                    onChange={(e) => setEscalationReason(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-gray-800 rounded-lg p-3 text-xs text-gray-200 focus:outline-none h-20"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleEscalate}
                      disabled={!escalationReason.trim()}
                      className="bg-red-600 hover:bg-red-700 text-white text-xs px-3.5 py-1.5 rounded font-semibold transition disabled:opacity-40"
                    >
                      Confirm Escalation
                    </button>
                    <button 
                      onClick={() => { setShowEscalateBox(false); setEscalationReason(''); }}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3.5 py-1.5 rounded transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-3">
            <ShieldAlert className="w-12 h-12 text-gray-700 pulse-glow rounded-full" />
            <div className="text-center">
              <span className="text-sm font-bold text-white block">Triage Console Idle</span>
              <span className="text-xs text-gray-400">Select a ticket from the left panel to inspect application.</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

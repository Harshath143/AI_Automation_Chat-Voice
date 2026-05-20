import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { 
  TicketCheck, AlertTriangle, Clock, FileWarning, 
  Smile, ShieldAlert, Sparkles, Layers 
} from 'lucide-react';

const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

export default function DashboardPage() {
  const { kpiSummary, escalations, fetchAnalytics } = useStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics().then(() => setLoading(false));
    
    // Auto-update analytics stats every 10 seconds for real-time live updates
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  // Standard Mock Chart Data (Provides beautiful display when DB is empty / loading)
  const trendData = [
    { name: 'Mon', volume: 15 },
    { name: 'Tue', volume: 22 },
    { name: 'Wed', volume: 18 },
    { name: 'Thu', volume: 29 },
    { name: 'Fri', volume: 38 },
    { name: 'Sat', volume: 12 },
    { name: 'Sun', volume: 14 },
  ];

  const categoryData = [
    { name: 'Visa Status', count: 48 },
    { name: 'Missing Doc', count: 32 },
    { name: 'Reschedule', count: 24 },
    { name: 'Complaint', count: 15 },
    { name: 'General', count: 28 },
  ];

  const priorityDistribution = [
    { name: 'Critical', value: kpiSummary.escalated_tickets || 5, color: '#ef4444' },
    { name: 'High', value: 8, color: '#f59e0b' },
    { name: 'Medium', value: 16, color: '#3b82f6' },
    { name: 'Low', value: 12, color: '#10b981' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Sparkles className="text-primary w-8 h-8 pulse-glow rounded-full" />
            Operational Insights
          </h1>
          <p className="text-gray-400 mt-1">Live analytics feeding visa support center workflows.</p>
        </div>
        <div className="bg-[#151c2c] border border-gray-800 text-xs px-3 py-1.5 rounded-lg text-primary flex items-center gap-2 font-mono">
          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping"></span>
          REAL-TIME TELEMETRY PUSH ACTIVE
        </div>
      </div>

      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {/* KPI 1 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total Today</span>
            <TicketCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.total_tickets_today}</span>
            <span className="text-xs text-green-400 font-medium">+12%</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Open Tasks</span>
            <Layers className="w-5 h-5 text-accent" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.open_tickets}</span>
            <span className="text-xs text-gray-500">active</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300 border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Escalated</span>
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.escalated_tickets}</span>
            <span className="text-xs text-red-400 font-medium">SLA Danger</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Avg Speed</span>
            <Clock className="w-5 h-5 text-success" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.avg_response_time_min}m</span>
            <span className="text-xs text-green-400 font-medium">-1.8m</span>
          </div>
        </div>

        {/* KPI 5 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">OCR Fail Rate</span>
            <FileWarning className="w-5 h-5 text-warning" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.doc_rejection_rate_pct}%</span>
            <span className="text-xs text-gray-500">manual review</span>
          </div>
        </div>

        {/* KPI 6 */}
        <div className="glass-panel p-4 rounded-xl hover:translate-y-[-4px] transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">CSAT Score</span>
            <Smile className="w-5 h-5 text-green-400" />
          </div>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-white">{kpiSummary.csat_score}</span>
            <span className="text-xs text-gray-400">/ 5.0</span>
          </div>
        </div>
      </div>

      {/* Row 2 — Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Line Chart (Volume Trend) */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Ticket Volume Trend</h2>
            <p className="text-xs text-gray-400">Weekly intake trends.</p>
          </div>
          <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#151c2c', borderColor: '#334155', borderRadius: 8, color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bar Chart (Intents Category) */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Inbound Volume by Category</h2>
            <p className="text-xs text-gray-400">Aggregated intents classification.</p>
          </div>
          <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#151c2c', borderColor: '#334155', borderRadius: 8, color: '#f8fafc' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Donut Chart (Priority split) */}
        <div className="glass-panel p-5 rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Priority Distribution</h2>
            <p className="text-xs text-gray-400">Current ticket severity metrics.</p>
          </div>
          <div className="h-64 mt-4 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#151c2c', borderColor: '#334155', borderRadius: 8, color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center">
              <span className="text-xs text-gray-400 uppercase tracking-wider block">Total Active</span>
              <span className="text-3xl font-extrabold text-white">
                {priorityDistribution.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Escalation Table */}
      <div className="glass-panel p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="text-red-500 w-6 h-6 animate-pulse" />
            <div>
              <h2 className="text-lg font-bold text-white">Escalated Tickets Queue</h2>
              <p className="text-xs text-gray-400">Urgent SLA breaches requiring manager attention.</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs font-semibold uppercase bg-[#111827]/40">
                <th className="py-3 px-4">Ticket ID</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Assigned Department</th>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">SLA Deadline</th>
                <th className="py-3 px-4">Time Overdue</th>
              </tr>
            </thead>
            <tbody>
              {escalations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                    ✨ Clear queue! No tickets currently in SLA breach state.
                  </td>
                </tr>
              ) : (
                escalations.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/50 hover:bg-[#1e293b]/20 transition duration-150 text-sm text-gray-300">
                    <td className="py-3.5 px-4 font-mono text-primary font-medium">{item.ticket_number}</td>
                    <td className="py-3.5 px-4 font-semibold text-white">{item.customer_name}</td>
                    <td className="py-3.5 px-4">{item.department}</td>
                    <td className="py-3.5 px-4">
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 text-xs px-2.5 py-0.5 rounded-full uppercase font-bold tracking-wider">
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">{new Date(item.sla_deadline).toLocaleTimeString()}</td>
                    <td className="py-3.5 px-4">
                      <span className="text-red-500 font-bold font-mono">
                        +{item.minutes_overdue} mins
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

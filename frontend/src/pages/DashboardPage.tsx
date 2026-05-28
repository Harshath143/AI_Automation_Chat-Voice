import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell 
} from 'recharts';
import { 
  FileCheck, ShieldAlert, Clock, CheckSquare, 
  HelpCircle, Compass, Sparkles, Building, Briefcase, Award 
} from 'lucide-react';

const PRIORITY_COLORS = {
  critical: 'url(#criticalGrad)',
  high: 'url(#highGrad)',
  medium: 'url(#mediumGrad)',
  low: 'url(#lowGrad)',
};

const RAW_COLORS = {
  critical: '#f43f5e', // rose-500
  high: '#f59e0b',     // amber-500
  medium: '#3b82f6',   // blue-500
  low: '#10b981',      // emerald-500
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

  // Custom BVS Global Intake trends
  const trendData = [
    { name: 'Mon', volume: 24, attestation: 14, verification: 10 },
    { name: 'Tue', volume: 38, attestation: 22, verification: 16 },
    { name: 'Wed', volume: 29, attestation: 18, verification: 11 },
    { name: 'Thu', volume: 46, attestation: 28, verification: 18 },
    { name: 'Fri', volume: 55, attestation: 35, verification: 20 },
    { name: 'Sat', volume: 18, attestation: 10, verification: 8 },
    { name: 'Sun', volume: 22, attestation: 12, verification: 10 },
  ];

  // Cohesive category dataset reflecting BVS Global's actual business units
  const categoryData = [
    { name: 'Degree Attestation', count: 54, fill: 'url(#purpleGrad)' },
    { name: 'Personal Certs', count: 38, fill: 'url(#blueGrad)' },
    { name: 'Background Due Diligence', count: 45, fill: 'url(#emeraldGrad)' },
    { name: 'Visa & Relocation', count: 32, fill: 'url(#amberGrad)' },
    { name: 'PRO & Corporate Support', count: 28, fill: 'url(#roseGrad)' },
  ];

  const priorityDistribution = [
    { name: 'Critical', value: kpiSummary.escalated_tickets || 5, color: '#f43f5e' },
    { name: 'High', value: 8, color: '#fbbf24' },
    { name: 'Medium', value: 16, color: '#60a5fa' },
    { name: 'Low', value: 12, color: '#34d399' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* SVG Gradients for Recharts rendering */}
      <svg width={0} height={0} className="absolute">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#7e22ce" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </linearGradient>
          <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="100%" stopColor="#be123c" />
          </linearGradient>
          
          {/* Priority Gradients */}
          <linearGradient id="criticalGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#be123c" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
          <linearGradient id="highGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#fcd34d" />
          </linearGradient>
          <linearGradient id="mediumGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#93c5fd" />
          </linearGradient>
          <linearGradient id="lowGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#6ee7b7" />
          </linearGradient>
        </defs>
      </svg>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse-glow"></div>
            <span className="text-xs font-bold text-primary tracking-widest uppercase">Global Operations Cockpit</span>
          </div>
          <h1 className="text-4xl font-black text-slate-800 dark:text-white tracking-tight mt-1 flex items-center gap-3">
            <Award className="text-primary w-10 h-10 shrink-0" />
            BVS Global Services Terminal
          </h1>
          <p className="text-gray-400 text-sm mt-1">Real-time due diligence audits, certificate attestations, and corporate relocation trackers.</p>
        </div>
        <div className="bg-[#0f172a]/80 border border-gray-800/80 px-4 py-2.5 rounded-xl text-primary flex items-center gap-3 font-mono text-xs shadow-lg backdrop-blur-md shrink-0">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          SECURE GLOBAL LINK SECURED (100+ COs)
        </div>
      </div>

      {/* Row 1 — KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-5">
        {/* KPI 1: Attestation Intake */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-primary/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Legalizations</span>
            <FileCheck className="w-5 h-5 text-primary shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 dark:text-white block tracking-tight">{kpiSummary.total_tickets_today}</span>
            <span className="text-[10px] text-green-400 font-bold mt-1 inline-flex items-center gap-0.5">
              +15% <span className="text-gray-500 font-medium">vs yesterday</span>
            </span>
          </div>
        </div>

        {/* KPI 2: Active Case Files */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-accent/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-accent/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Active Files</span>
            <Building className="w-5 h-5 text-accent shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 dark:text-white block tracking-tight">{kpiSummary.open_tickets}</span>
            <span className="text-[10px] text-gray-500 font-bold mt-1 block">Inbound Queues</span>
          </div>
        </div>

        {/* KPI 3: SLA Escalations */}
        <div className="glass-panel p-5 rounded-2xl border-t-4 border-red-500 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-red-500/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">SLA Breaches</span>
            <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-red-400 block tracking-tight">{kpiSummary.escalated_tickets}</span>
            <span className="text-[10px] text-red-400 font-bold mt-1 block">Immediate Intervention</span>
          </div>
        </div>

        {/* KPI 4: Mean Processing Time */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-green-500/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Mean Close (AHT)</span>
            <Clock className="w-5 h-5 text-green-400 shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 dark:text-white block tracking-tight">{kpiSummary.avg_response_time_min}m</span>
            <span className="text-[10px] text-green-400 font-bold mt-1 inline-flex items-center gap-0.5">
              -12.8% <span className="text-gray-500 font-medium">optimization</span>
            </span>
          </div>
        </div>

        {/* KPI 5: OCR Rejection Risk */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-500/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-yellow-500/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">OCR Flag Rate</span>
            <CheckSquare className="w-5 h-5 text-yellow-500 shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 dark:text-white block tracking-tight">{kpiSummary.doc_rejection_rate_pct}%</span>
            <span className="text-[10px] text-gray-500 font-bold mt-1 block">Manual check routing</span>
          </div>
        </div>

        {/* KPI 6: Customer CSAT */}
        <div className="glass-panel p-5 rounded-2xl relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
          <div className="absolute top-0 right-0 w-16 h-16 bg-green-400/5 rounded-full filter blur-xl pointer-events-none group-hover:bg-green-400/10 transition"></div>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CSAT Rating</span>
            <Sparkles className="w-5 h-5 text-green-400 shrink-0" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-black text-slate-800 dark:text-white block tracking-tight">{kpiSummary.csat_score}</span>
            <span className="text-[10px] text-gray-400 font-medium block mt-1">/ 5.0 High Fidelity</span>
          </div>
        </div>
      </div>

      {/* Row 2 — Analytical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Area Chart (Legalization vs Background Audit Volume Trend) */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Legalization & Verification Flow</h2>
            <p className="text-xs text-gray-400 mt-0.5">Weekly volume split between attestation and audits.</p>
          </div>
          <div className="h-64 mt-6 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="attestGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="verifyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="attestation" name="Attestation Files" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#attestGrad)" />
                <Area type="monotone" dataKey="verification" name="Verification Checks" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#verifyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Bar Chart (Intents Category splits) */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Business Divisions Inbound</h2>
            <p className="text-xs text-gray-400 mt-0.5">Aggregated task distribution across BVS core segments.</p>
          </div>
          <div className="h-64 mt-6 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} hide />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="count" name="Case Count" radius={[6, 6, 0, 0]}>
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Donut Chart (Priority split) */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">Severity Priority Ledger</h2>
            <p className="text-xs text-gray-400 mt-0.5">Active cases structured by target SLA requirements.</p>
          </div>
          <div className="h-64 mt-6 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {priorityDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 12, color: '#f8fafc', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                  labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute text-center mt-[-4px]">
              <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block">Total Cases</span>
              <span className="text-4xl font-black text-slate-800 dark:text-white block mt-0.5">
                {priorityDistribution.reduce((acc, curr) => acc + curr.value, 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Escalation Queue Cockpit */}
      <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <ShieldAlert className="text-red-500 w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">Priority Relocation Escalations</h2>
              <p className="text-xs text-gray-400 mt-0.5">Critical SLA alert breaches demanding human supervisor authorization.</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-800/60">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-[#0f172a]/60 text-slate-600 dark:text-gray-400">
                <th className="py-4 px-5">Case Identifier</th>
                <th className="py-4 px-5">Client Profile</th>
                <th className="py-4 px-5">Service Branch</th>
                <th className="py-4 px-5">SLA Impact</th>
                <th className="py-4 px-5">SLA Deadline</th>
                <th className="py-4 px-5">Log Overdue</th>
              </tr>
            </thead>
            <tbody>
              {escalations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 text-sm font-medium">
                    ✨ Clear desk! All BVS Global SLA compliance deadlines are fully satisfied.
                  </td>
                </tr>
              ) : (
                escalations.map((item) => (
                  <tr key={item.id} className="border-b border-gray-800/40 hover:bg-[#1e293b]/15 transition duration-150 text-sm text-gray-300">
                    <td className="py-4 px-5 font-mono text-primary font-bold">{item.ticket_number}</td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-800 dark:text-white">{item.customer_name}</div>
                    </td>
                    <td className="py-4 px-5">
                      <span className="text-xs text-gray-400 font-medium">{item.department}</span>
                    </td>
                    <td className="py-4 px-5">
                      <span 
                        className="text-[10px] px-2.5 py-0.5 rounded-full uppercase font-black tracking-widest border"
                        style={{ 
                          backgroundColor: `${RAW_COLORS[item.priority as keyof typeof RAW_COLORS]}15`, 
                          borderColor: `${RAW_COLORS[item.priority as keyof typeof RAW_COLORS]}30`, 
                          color: RAW_COLORS[item.priority as keyof typeof RAW_COLORS]
                        }}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-4 px-5 font-mono text-xs text-gray-400">{new Date(item.sla_deadline).toLocaleTimeString()}</td>
                    <td className="py-4 px-5">
                      <span className="text-red-500 font-black font-mono text-xs animate-pulse bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                        +{item.minutes_overdue}m Breached
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

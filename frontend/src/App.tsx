import React from 'react';
import { useStore } from './store/useStore';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import TicketPage from './pages/TicketPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import { 
  Sparkles, Bot, ShieldAlert, FileSearch, 
  Settings, LogOut, Terminal, Users 
} from 'lucide-react';

export default function App() {
  const { activeTab, setActiveTab } = useStore();

  const navigationItems = [
    { id: 'dashboard', label: 'Operational Insights', icon: Sparkles },
    { id: 'chat', label: 'AI Chatbot Console', icon: Bot },
    { id: 'tickets', label: 'Agent Ticketing Desk', icon: ShieldAlert },
    { id: 'documents', label: 'Document Verification', icon: FileSearch },
  ] as const;

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardPage />;
      case 'chat': return <ChatPage />;
      case 'tickets': return <TicketPage />;
      case 'documents': return <DocumentUploadPage />;
      default: return <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0f19] overflow-hidden text-gray-200">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-gray-800/80 flex flex-col justify-between hidden md:flex shrink-0">
        
        {/* Brand/Title Block */}
        <div>
          <div className="p-6 border-b border-gray-800/60 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-lg border border-primary/30 pulse-glow">
              ⚡
            </div>
            <div>
              <span className="font-extrabold text-white text-sm block uppercase tracking-wider font-mono">Immigration OS</span>
              <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-semibold font-mono">Control Centre</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition duration-150 ${
                    activeTab === item.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-gray-400 hover:bg-[#151c2c]/80 hover:text-white'
                  }`}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer profile info */}
        <div className="p-4 border-t border-gray-800/80 space-y-3">
          <div className="flex items-center gap-3 bg-[#151c2c]/40 p-2.5 rounded-xl border border-gray-800/40">
            <div className="w-9 h-9 bg-accent/20 rounded-full flex items-center justify-center text-accent font-bold text-xs uppercase">
              ER
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">Elena Rostova</span>
              <span className="text-[9px] text-gray-500 uppercase tracking-wider block">Superintendent</span>
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              v1.0.0
            </span>
            <span>Local Node</span>
          </div>
        </div>
      </aside>

      {/* Main Content viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Control Bar */}
        <header className="h-16 bg-[#151c2c]/65 border-b border-gray-800/40 px-6 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase font-mono hidden md:inline">
            ⚡ Platform Operations Hub
          </span>
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase font-mono md:hidden">
            ⚡ Immigration OS
          </span>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-[#0b0f19] border border-gray-800 px-3 py-1 rounded-lg">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-gray-400 font-mono">Agent Node: <strong className="text-white">Active</strong></span>
            </div>
          </div>
        </header>

        {/* Dynamic viewport area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#0b0f19]">
          {renderActivePage()}
        </main>
      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import TicketPage from './pages/TicketPage';
import DocumentUploadPage from './pages/DocumentUploadPage';
import VoicePage from './pages/VoicePage';
import LoginPage from './pages/LoginPage';
import { 
  Sparkles, Bot, ShieldAlert, FileSearch, 
  Settings, LogOut, Terminal, Users, Phone,
  Globe, Sun, Moon
} from 'lucide-react';

export default function App() {
  const { activeTab, setActiveTab, role, setRole, userProfile, setUserProfile, resetSessionId } = useStore();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  // Apply theme class to HTML node dynamically
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  if (!userProfile) {
    return <LoginPage />;
  }

  const navigationItems = [
    { id: 'dashboard', label: 'Operational Insights', icon: Sparkles },
    { id: 'chat', label: 'AI Chatbot Console', icon: Bot },
    { id: 'voice', label: 'AI Voice Operator', icon: Phone },
    { id: 'tickets', label: 'Agent Ticketing Desk', icon: ShieldAlert },
    { id: 'documents', label: 'Document Verification', icon: FileSearch },
  ] as const;

  const filteredNavigationItems = navigationItems.filter((item) => {
    if (role === 'user') {
      return item.id === 'chat' || item.id === 'documents' || item.id === 'voice';
    }
    return true;
  });

  const renderActivePage = () => {
    const allowedTabs = role === 'user' 
      ? ['chat', 'documents', 'voice'] 
      : ['dashboard', 'chat', 'tickets', 'documents', 'voice'];
    const currentActiveTab = allowedTabs.includes(activeTab) ? activeTab : (role === 'user' ? 'chat' : 'dashboard');

    switch (currentActiveTab) {
      case 'dashboard': return <DashboardPage />;
      case 'chat': return <ChatPage />;
      case 'tickets': return <TicketPage />;
      case 'documents': return <DocumentUploadPage />;
      case 'voice': return <VoicePage />;
      default: return role === 'user' ? <ChatPage /> : <DashboardPage />;
    }
  };

  return (
    <div className="flex h-screen bg-background text-slate-800 dark:text-gray-200 transition-colors duration-300 overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-r border-background-border dark:border-gray-800/80 flex flex-col justify-between hidden md:flex shrink-0">
        
        {/* Brand/Title Block */}
        <div>
          <div className="p-6 border-b border-background-border dark:border-gray-800/60 flex items-center gap-3">
            {/* Nested Chevrons SVG */}
            <svg 
              className="w-9 h-9 text-secondary dark:text-primary-light shrink-0 animate-pulse" 
              viewBox="0 0 100 100" 
              fill="currentColor"
            >
              {/* Outer Chevron */}
              <polygon points="10,15 55,15 43,27 22,27 22,48 10,60" />
              {/* Inner Chevron */}
              <polygon points="26,31 71,31 59,43 38,43 38,64 26,76" />
            </svg>
            <div>
              <span className="font-extrabold text-secondary dark:text-white text-sm block uppercase tracking-wider font-mono">BVS Global</span>
              <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase tracking-widest block font-bold font-mono mt-0.5">Operations Desk</span>
            </div>
          </div>
 
          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {filteredNavigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition duration-150 ${
                    activeTab === item.id
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-background-hover dark:hover:bg-background-dark-hover hover:text-secondary dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer profile info */}
        <div className="p-4 border-t border-background-border dark:border-gray-800/80 space-y-3">
          <div className="flex items-center justify-between bg-background-hover dark:bg-[#1c1218]/40 p-2.5 rounded-xl border border-background-border dark:border-gray-800/40">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-xs uppercase shrink-0">
                {userProfile?.full_name.slice(0, 2) || 'US'}
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-slate-800 dark:text-white block truncate">{userProfile?.full_name}</span>
                <span className="text-[8px] text-gray-500 dark:text-gray-400 uppercase tracking-wider block capitalize">{role}</span>
              </div>
            </div>
            <button 
              onClick={() => {
                setUserProfile(null);
                resetSessionId();
              }}
              className="text-gray-500 hover:text-red-400 transition ml-2 p-1"
              title="Log Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 font-mono px-1">
            <span className="flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5" />
              v1.0.0
            </span>
            <span>BVS Node</span>
          </div>
        </div>
      </aside>

      {/* Main Content viewport */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Control Bar */}
        <header className="h-16 bg-white dark:bg-[#1c1218] text-slate-800 dark:text-white border-b border-slate-200 dark:border-gray-800/40 px-6 flex items-center justify-between shrink-0 transition-colors duration-300 shadow-sm">
          <div className="flex items-center gap-2">
            {/* Nested Chevrons SVG */}
            <svg 
              className="w-6 h-6 text-secondary dark:text-primary-light shrink-0" 
              viewBox="0 0 100 100" 
              fill="currentColor"
            >
              {/* Outer Chevron */}
              <polygon points="10,15 55,15 43,27 22,27 22,48 10,60" />
              {/* Inner Chevron */}
              <polygon points="26,31 71,31 59,43 38,43 38,64 26,76" />
            </svg>
            <span className="text-xs font-bold tracking-widest text-secondary dark:text-primary-light uppercase font-mono hidden md:inline">
              BVS Global Support Desk
            </span>
            <span className="text-xs font-bold tracking-widest text-secondary dark:text-primary-light uppercase font-mono md:hidden">
              BVS Global Desk
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={() => setTheme(prev => prev === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-xl bg-slate-100 dark:bg-[#0f090d] border border-slate-200 dark:border-gray-800 hover:bg-slate-200 dark:hover:bg-[#2a1b24] text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white transition duration-150"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-primary animate-pulse" />}
            </button>

            {/* Perspective Selector Toggle buttons - ONLY visible and active if logged in as Admin */}
            {role === 'admin' && (
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0f090d] border border-slate-200 dark:border-gray-800 p-0.5 rounded-xl transition-colors duration-300">
                <button
                  onClick={() => {
                    setActiveTab('chat');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition-all duration-200 ${
                    activeTab === 'chat' || activeTab === 'documents'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
                >
                  Customer POV
                </button>
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition-all duration-200 ${
                    activeTab === 'dashboard' || activeTab === 'tickets'
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-gray-200'
                  }`}
                >
                  Platform Admin
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#0f090d] border border-slate-200 dark:border-gray-800 px-3 py-1.5 rounded-xl transition-colors duration-300">
              <Users className="w-5 h-5 text-primary animate-pulse" />
              <span className="text-[10px] text-slate-600 dark:text-gray-300 font-mono">Role: <strong className="text-slate-800 dark:text-white uppercase">{role}</strong></span>
            </div>
          </div>
        </header>

        {/* Dynamic viewport area */}
        <main className="flex-1 overflow-y-auto p-6 bg-[#f4f5f6] dark:bg-[#0f090d] transition-colors duration-300">
          {renderActivePage()}
        </main>
      </div>

    </div>
  );
}

import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Sparkles, Users, Lock, Mail, Phone, UserCheck, Globe } from 'lucide-react';

export default function LoginPage() {
  const { setUserProfile, setRole, setActiveTab, resetSessionId } = useStore();
  
  const [loginMode, setLoginMode] = useState<'customer' | 'admin'>('customer');
  
  // Customer inputs
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Admin inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (loginMode === 'customer') {
      if (!fullName.trim() || !email.trim() || !phone.trim()) {
        setError('Please fill in all details to proceed.');
        return;
      }
      if (!email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }

      // Reset session ID to clear previous user's chat history
      resetSessionId();

      // Save customer profile and set role
      setUserProfile({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });
      setRole('user');
      setActiveTab('chat');
    } else {
      // Validate Admin login
      if (username === 'admin' && password === 'adminpassword123') {
        setUserProfile({
          full_name: 'Elena Rostova',
          email: 'admin@supportcentre.com',
          phone: '+971-50-999-8888'
        });
        setRole('admin');
        setActiveTab('dashboard');
      } else {
        setError('Invalid admin credentials. Hint: use admin / adminpassword123');
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-slate-800 dark:text-gray-200 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-secondary/10 blur-[120px] pointer-events-none animate-pulse" />

      {/* Main Glassmorphic Panel */}
      <div className="w-full max-w-lg glass-panel border border-background-border dark:border-gray-800/80 rounded-3xl p-8 relative z-10 shadow-2xl">
        
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-4 mb-2">
            {/* Nested Chevrons SVG */}
            <svg 
              className="w-14 h-14 text-secondary dark:text-primary-light shrink-0 animate-pulse" 
              viewBox="0 0 100 100" 
              fill="currentColor"
            >
              {/* Outer Chevron */}
              <polygon points="10,15 55,15 43,27 22,27 22,48 10,60" />
              {/* Inner Chevron */}
              <polygon points="26,31 71,31 59,43 38,43 38,64 26,76" />
            </svg>
            
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold text-secondary dark:text-white tracking-wider uppercase font-sans leading-none">
                BVS Global
              </span>
              <span className="text-[10px] text-slate-500 dark:text-gray-400 uppercase tracking-widest font-semibold font-mono mt-2.5">
                Visa & Chat Automation
              </span>
            </div>
          </div>
          
          <div className="w-full h-px bg-background-border dark:bg-gray-800/80 my-3" />
          
          <span className="text-[10px] text-primary font-bold uppercase tracking-widest block font-sans">
            Government Relations - Since 2010
          </span>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 dark:bg-[#1c1218]/50 border border-slate-200 dark:border-gray-800/50 p-1.5 rounded-2xl mb-8">
          <button
            type="button"
            onClick={() => {
              setLoginMode('customer');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
              loginMode === 'customer'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-slate-500 dark:text-gray-400 hover:text-secondary dark:hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            Customer Portal
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('admin');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
              loginMode === 'admin'
                ? 'bg-secondary dark:bg-[#8c3b68]/85 text-white shadow-md shadow-secondary/20'
                : 'text-slate-500 dark:text-gray-400 hover:text-secondary dark:hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin Operations
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-medium text-center">
              ⚠️ {error}
            </div>
          )}

          {loginMode === 'customer' ? (
            <>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-gray-400 font-mono">Full Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name (e.g. Harshath)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-background dark:bg-[#120c0f]/60 border border-background-border dark:border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-slate-400 dark:placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-gray-400 font-mono">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email (e.g. harshathdeveloper@gmail.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background dark:bg-[#120c0f]/60 border border-background-border dark:border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-slate-400 dark:placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-gray-400 font-mono">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="tel"
                    required
                    placeholder="Enter your phone number (e.g. +91 98765 43210)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-background dark:bg-[#120c0f]/60 border border-background-border dark:border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-slate-400 dark:placeholder-gray-600 transition"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Admin Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-gray-400 font-mono">Admin Username</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Username (Hint: admin)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-background dark:bg-[#120c0f]/60 border border-background-border dark:border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-secondary dark:focus:border-secondary-light focus:ring-1 focus:ring-secondary/20 placeholder-slate-400 dark:placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-gray-400 font-mono">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400 dark:text-gray-500" />
                  <input
                    type="password"
                    required
                    placeholder="Password (Hint: adminpassword123)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background dark:bg-[#120c0f]/60 border border-background-border dark:border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-secondary dark:focus:border-secondary-light focus:ring-1 focus:ring-secondary/20 placeholder-slate-400 dark:placeholder-gray-600 transition"
                  />
                </div>
              </div>
            </>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all duration-200 mt-4 flex items-center justify-center gap-2 ${
              loginMode === 'customer'
                ? 'bg-primary hover:bg-primary/90 shadow-primary/20'
                : 'bg-secondary hover:bg-secondary/90 dark:bg-[#8c3b68]/85 dark:hover:bg-[#8c3b68]/95 shadow-secondary/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Enter Platform
          </button>
        </form>

        {/* Footer tips */}
        <div className="mt-8 text-center text-[10px] text-slate-500 dark:text-gray-500 font-mono">
          {loginMode === 'customer' 
            ? "⚡ Submitting this form establishes your real CRM profile and links email alerts!"
            : "🔑 Demo credentials: Use 'admin' and 'adminpassword123' to sign in."}
        </div>

      </div>
    </div>
  );
}

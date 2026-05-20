import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { Shield, Sparkles, Users, Lock, Mail, Phone, UserCheck } from 'lucide-react';

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
    <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Panel */}
      <div className="w-full max-w-lg glass-panel border border-gray-800/80 rounded-3xl p-8 relative z-10 shadow-2xl shadow-[#04060d]">
        
        {/* Branding header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center text-primary text-2xl border border-primary/30 shadow-lg shadow-primary/10 pulse-glow mb-4">
            ⚡
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight uppercase font-mono">Immigration OS</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold font-mono mt-1">Visa & Chat Automation Platform</p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-[#151c2c]/40 border border-gray-800/50 p-1.5 rounded-2xl mb-8">
          <button
            type="button"
            onClick={() => {
              setLoginMode('customer');
              setError(null);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
              loginMode === 'customer'
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'text-gray-400 hover:text-white'
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
                ? 'bg-accent/80 text-white shadow-md shadow-accent/20'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            Admin Operations
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 text-red-400 rounded-xl text-xs font-medium text-center">
              ⚠️ {error}
            </div>
          )}

          {loginMode === 'customer' ? (
            <>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Full Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter your name (e.g. Harshath)"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-[#111724]/60 border border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    required
                    placeholder="Enter your email (e.g. harshathdeveloper@gmail.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#111724]/60 border border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="tel"
                    required
                    placeholder="Enter your phone number (e.g. +91 98765 43210)"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#111724]/60 border border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 placeholder-gray-600 transition"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Admin Username */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Admin Username</label>
                <div className="relative">
                  <UserCheck className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    placeholder="Username (Hint: admin)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#111724]/60 border border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 placeholder-gray-600 transition"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-gray-400 font-mono">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="password"
                    required
                    placeholder="Password (Hint: adminpassword123)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#111724]/60 border border-gray-800/80 rounded-xl py-3 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 placeholder-gray-600 transition"
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
                : 'bg-accent/80 hover:bg-accent/90 shadow-accent/20'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Enter Platform
          </button>
        </form>

        {/* Footer tips */}
        <div className="mt-8 text-center text-[10px] text-gray-600 font-mono">
          {loginMode === 'customer' 
            ? "⚡ Submitting this form establishes your real CRM profile and links email alerts!"
            : "🔑 Demo credentials: Use 'admin' and 'adminpassword123' to sign in."}
        </div>

      </div>
    </div>
  );
}

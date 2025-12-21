
import React, { useState, useEffect } from 'react';
import { Activity, Settings, Moon, Sun, Compass, Signal, Clock } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  nightMode: boolean;
  onOpenAdmin: () => void;
  onToggleNightMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, nightMode, onOpenAdmin, onToggleNightMode }) => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex flex-col gap-2 z-20 bg-gradient-to-b from-black/80 to-transparent">
      <div className="flex justify-between items-start">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded border transition-all duration-300 ${nightMode ? 'border-red-500/30 bg-red-500/10' : 'border-cyan-500/30 bg-cyan-500/10'} ${isConnected ? 'animate-pulse' : ''}`}>
            <Activity size={20} className={nightMode ? 'text-red-500' : 'text-cyan-400'} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-[0.15em] text-white uppercase font-mono">
              MARITIME <span className={nightMode ? 'text-red-500' : 'text-cyan-400'}>AI</span> COMMANDER
            </h1>
            <div className="flex items-center gap-2">
               <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${nightMode ? 'bg-red-500' : 'bg-cyan-400'}`} />
               <p className="text-[9px] text-slate-400 uppercase font-mono tracking-widest">
                 System: Ready // {nightMode ? 'MODE: NIGHT WATCH' : 'CORE: CONNECTED'}
               </p>
            </div>
          </div>
        </div>

        {/* Telemetry Display (Desktop Only) */}
        <div className={`hidden lg:flex items-center gap-8 px-8 py-2 border-x border-slate-700/50 backdrop-blur-md transition-all duration-300 ${nightMode ? 'bg-red-950/10' : 'bg-slate-900/40'}`}>
           <div className="flex flex-col items-center opacity-80">
             <span className="text-[9px] text-slate-500 font-mono uppercase">Position</span>
             <span className="text-xs font-mono text-cyan-100 uppercase">34.0522° N, 118.2437° W</span>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8 opacity-80">
             <span className="text-[9px] text-slate-500 font-mono uppercase">Heading</span>
             <div className="flex items-center gap-1">
               <Compass size={12} className={nightMode ? 'text-red-500' : 'text-cyan-400'} />
               <span className="text-xs font-mono text-cyan-100 uppercase">045° NE</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8 opacity-80">
             <span className="text-[9px] text-slate-500 font-mono uppercase">Latency</span>
             <div className="flex items-center gap-1">
               <Signal size={12} className={nightMode ? 'text-red-500' : 'text-emerald-400'} />
               <span className="text-xs font-mono text-cyan-100 uppercase">12ms</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8">
             <span className="text-[9px] text-slate-500 font-mono uppercase">Vessel Time</span>
             <div className="flex items-center gap-1">
               <Clock size={12} className="text-slate-400" />
               <span className="text-xs font-mono text-cyan-100">{time.toLocaleTimeString([], { hour12: false })}</span>
             </div>
           </div>
        </div>

        {/* System Controls */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleNightMode}
            className={`p-2.5 rounded border border-slate-700 backdrop-blur transition-all ${nightMode ? 'bg-red-950/40 border-red-500/50 text-red-500' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
            title="Night Ops (Red Mode)"
          >
            {nightMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={onOpenAdmin}
            className={`p-2.5 rounded border border-slate-700 backdrop-blur transition-all ${nightMode ? 'bg-red-950/20 text-red-700 hover:text-red-500' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
            title="Admin Console"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Dynamic Sub-header Progress */}
      <div className={`w-full h-[1px] relative overflow-hidden transition-colors ${nightMode ? 'bg-red-900/20' : 'bg-slate-800'}`}>
         <div className={`absolute inset-0 w-1/4 animate-[slide_4s_linear_infinite] ${nightMode ? 'bg-gradient-to-r from-transparent via-red-600 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'}`} 
              style={{ animationName: 'shimmer' }} />
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

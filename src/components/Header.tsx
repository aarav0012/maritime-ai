import React from 'react';
import { Activity, Settings } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  onOpenAdmin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, onOpenAdmin }) => {
  return (
    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-slate-950 to-transparent">
      <div className="flex items-center gap-3">
        <Activity className={`text-cyan-400 ${isConnected ? 'animate-pulse' : ''}`} />
        <div>
          <h1 className="text-xl font-bold tracking-widest text-white">
            NAVAL<span className="text-cyan-400">AI</span>
          </h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em]">
            Maritime Operations Assistant
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenAdmin}
          className="p-2 bg-slate-800/50 rounded-full hover:bg-slate-700 backdrop-blur border border-slate-700 transition"
          title="Admin Panel"
        >
          <Settings size={20} className="text-slate-300" />
        </button>
      </div>
    </div>
  );
};
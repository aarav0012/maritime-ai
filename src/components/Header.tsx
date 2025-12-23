
import React, { useState, useEffect } from 'react';
import { Activity, Settings, Moon, Sun, Compass, Signal, Clock } from 'lucide-react';

interface HeaderProps {
  isConnected: boolean;
  nightMode: boolean;
  onOpenAdmin: () => void;
  onToggleNightMode: () => void;
}

interface TelemetryData {
  lat: string;
  lng: string;
  heading: string;
  accuracy: string;
}

export const Header: React.FC<HeaderProps> = ({ isConnected, nightMode, onOpenAdmin, onToggleNightMode }) => {
  const [time, setTime] = useState(new Date());
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    lat: '00.0000° N',
    lng: '000.0000° E',
    heading: '---°',
    accuracy: 'LOW'
  });
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // Geolocation Tracking
    let watchId: number | null = null;

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, heading, accuracy } = position.coords;
          
          const latStr = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
          const lngStr = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
          
          let headingStr = 'STATIONARY';
          if (heading !== null && heading !== undefined) {
             headingStr = `${Math.round(heading).toString().padStart(3, '0')}°`;
             const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
             const dirIdx = Math.round(heading / 45) % 8;
             headingStr += ` ${directions[dirIdx]}`;
          }

          setTelemetry({
            lat: latStr,
            lng: lngStr,
            heading: headingStr,
            accuracy: accuracy < 20 ? 'HIGH' : accuracy < 100 ? 'MED' : 'LOW'
          });
        },
        (error) => {
          console.warn("Geolocation access denied or unavailable:", error.message);
        },
        { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
      );
    }

    return () => {
      clearInterval(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 p-5 flex flex-col gap-1.5 z-20 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
      <div className="flex justify-between items-start">
        {/* Brand & Identity */}
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded border transition-all duration-300 ${nightMode ? 'border-red-500/30 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_10px_rgba(34,211,238,0.2)]'} ${isConnected ? 'animate-pulse' : ''}`}>
            <Activity size={24} className={nightMode ? 'text-red-500' : 'text-cyan-400'} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[0.2em] text-white uppercase font-mono leading-none">
              Maritime <span className={nightMode ? 'text-red-500' : 'text-cyan-400'}>AI</span> Commander
            </h1>
            <div className="flex items-center gap-2 mt-1.5">
               <span className={`w-2 h-2 rounded-full animate-pulse ${nightMode ? 'bg-red-500' : 'bg-cyan-400'}`} />
               <p className="text-[10px] text-slate-400 uppercase font-mono tracking-[0.2em] font-bold">
                 System: Ready // {nightMode ? 'Mode: Night Watch' : 'Core: Connected'}
               </p>
            </div>
          </div>
        </div>

        {/* Telemetry Display (Desktop Only) */}
        <div className={`hidden lg:flex items-center gap-8 px-8 py-3 border-x border-slate-700/50 backdrop-blur-md transition-all duration-300 rounded ${nightMode ? 'bg-red-950/10' : 'bg-slate-900/50'}`}>
           <div className="flex flex-col items-center">
             <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1">Position</span>
             <span className="text-[13px] font-mono text-cyan-100 uppercase font-bold">{telemetry.lat}, {telemetry.lng}</span>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8">
             <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1">Heading</span>
             <div className="flex items-center gap-2">
               <Compass size={14} className={nightMode ? 'text-red-500' : 'text-cyan-400'} />
               <span className="text-[13px] font-mono text-cyan-100 uppercase font-bold">{telemetry.heading}</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8">
             <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1">Fix</span>
             <div className="flex items-center gap-2">
               <Signal size={14} className={nightMode ? 'text-red-500' : (telemetry.accuracy === 'HIGH' ? 'text-emerald-400' : 'text-yellow-500')} />
               <span className="text-[13px] font-mono text-cyan-100 uppercase font-bold">{telemetry.accuracy}</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-slate-700/50 pl-8">
             <span className="text-[10px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1">Vessel Time</span>
             <div className="flex items-center gap-2">
               <Clock size={14} className="text-slate-500" />
               <span className="text-[13px] font-mono text-white font-bold tracking-wider">{time.toLocaleTimeString([], { hour12: false })}</span>
             </div>
           </div>
        </div>

        {/* System Controls */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onToggleNightMode}
            className={`p-3 rounded border border-slate-700 backdrop-blur-md transition-all ${nightMode ? 'bg-red-950/40 border-red-500/50 text-red-500' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
          >
            {nightMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={onOpenAdmin}
            className={`p-3 rounded border border-slate-700 backdrop-blur-md transition-all ${nightMode ? 'bg-red-950/20 text-red-700 border-red-900/50' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Progress Line */}
      <div className={`w-full h-[2px] relative overflow-hidden transition-colors mt-1 ${nightMode ? 'bg-red-900/20' : 'bg-slate-800'}`}>
         <div className={`absolute inset-0 w-1/4 animate-[shimmer_4s_linear_infinite] ${nightMode ? 'bg-gradient-to-r from-transparent via-red-600 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400 to-transparent'}`} />
      </div>
    </div>
  );
};

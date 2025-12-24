
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
    lat: 'ACQUIRING...',
    lng: '---',
    heading: '000°',
    accuracy: 'WAIT'
  });
  
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    let watchId: number | null = null;
    let mockInterval: number | null = null;

    // A fallback "Simulated Position" (Singapore Port Area) for demos where GPS is unavailable
    const startSimulatedTelemetry = () => {
      console.log("Maritime System: Entering SIMULATED_VOYAGE mode.");
      let baseLat = 1.2645;
      let baseLng = 103.8322;
      let baseHdg = 145;

      mockInterval = window.setInterval(() => {
        // Add tiny drifts to make the numbers look "live"
        baseLat += (Math.random() - 0.5) * 0.0001;
        baseLng += (Math.random() - 0.5) * 0.0001;
        baseHdg = (baseHdg + (Math.random() - 0.5) * 2) % 360;

        const latStr = `${Math.abs(baseLat).toFixed(4)}° ${baseLat >= 0 ? 'N' : 'S'}`;
        const lngStr = `${Math.abs(baseLng).toFixed(4)}° ${baseLng >= 0 ? 'E' : 'W'}`;
        
        setTelemetry({
          lat: latStr,
          lng: lngStr,
          heading: `${Math.round(baseHdg).toString().padStart(3, '0')}° SE`,
          accuracy: 'SIM'
        });
      }, 3000);
    };

    const startWatching = (highAccuracy: boolean) => {
      if (!('geolocation' in navigator)) {
        startSimulatedTelemetry();
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Clear mock if we actually get a real signal
          if (mockInterval) {
            clearInterval(mockInterval);
            mockInterval = null;
          }

          const { latitude, longitude, heading } = position.coords;
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
            accuracy: highAccuracy ? 'GPS' : 'IP'
          });
        },
        (error) => {
          console.warn(`Telemetry Fallback Logic [${highAccuracy ? 'High' : 'Low'}]:`, error.message);
          
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);

          if (highAccuracy) {
             // Step 1: High Accuracy failed, try Low Accuracy (IP based)
             startWatching(false);
          } else {
             // Step 2: Everything failed, start Simulated Mode so the UI isn't broken
             startSimulatedTelemetry();
          }
        },
        { 
          enableHighAccuracy: highAccuracy, 
          maximumAge: 30000, 
          timeout: highAccuracy ? 8000 : 5000 // Give it 8s for GPS, 5s for IP
        }
      );
    };

    startWatching(true);

    return () => {
      clearInterval(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (mockInterval !== null) clearInterval(mockInterval);
    };
  }, []);

  const accentColor = nightMode ? 'text-red-500' : 'text-cyan-400';
  const statusBorder = nightMode ? 'border-red-500/30 bg-red-500/10' : 'border-cyan-500/30 bg-cyan-500/10';

  return (
    <div className="absolute top-0 left-0 right-0 p-5 flex flex-col gap-1.5 z-20 bg-gradient-to-b from-black/95 via-black/40 to-transparent">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded border transition-all duration-500 ${statusBorder} ${isConnected ? 'animate-pulse' : ''}`}>
            <Activity size={24} className={accentColor} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-[0.2em] text-white uppercase font-mono leading-none">
              Maritime <span className={accentColor}>AI</span> Commander
            </h1>
            <div className="flex items-center gap-2 mt-2">
               <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
               <p className="text-[10px] text-slate-400 uppercase font-mono tracking-[0.25em] font-bold">
                 Fleet_ID: V-102 // {nightMode ? 'Tactical Night View' : 'Standard Bridge Ops'}
               </p>
            </div>
          </div>
        </div>

        <div className={`hidden lg:flex items-center gap-8 px-8 py-3.5 border border-white/5 backdrop-blur-xl transition-all duration-500 rounded-lg ${nightMode ? 'bg-red-950/10 border-red-500/10' : 'bg-slate-900/50'}`}>
           <div className="flex flex-col items-center">
             <span className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1.5 opacity-60">Global_Coords</span>
             <span className="text-[13px] font-mono text-white uppercase font-bold tabular-nums">{telemetry.lat}, {telemetry.lng}</span>
           </div>
           <div className="flex flex-col items-center border-l border-white/5 pl-8">
             <span className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1.5 opacity-60">Relative_Hdg</span>
             <div className="flex items-center gap-2">
               <Compass size={14} className={accentColor} />
               <span className="text-[13px] font-mono text-white uppercase font-bold">{telemetry.heading}</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-white/5 pl-8">
             <span className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1.5 opacity-60">Signal_Fix</span>
             <div className="flex items-center gap-2">
               <Signal size={14} className={telemetry.accuracy === 'GPS' ? 'text-emerald-400' : telemetry.accuracy === 'SIM' ? 'text-blue-400' : 'text-yellow-500'} />
               <span className="text-[13px] font-mono text-white uppercase font-bold">{telemetry.accuracy}</span>
             </div>
           </div>
           <div className="flex flex-col items-center border-l border-white/5 pl-8">
             <span className="text-[9px] text-slate-500 font-mono uppercase font-bold tracking-widest mb-1.5 opacity-60">Zulu_Time</span>
             <div className="flex items-center gap-2">
               <Clock size={14} className="text-slate-500" />
               <span className="text-[13px] font-mono text-white font-bold tracking-wider tabular-nums">{time.toLocaleTimeString([], { hour12: false })}</span>
             </div>
           </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onToggleNightMode}
            className={`p-3.5 rounded-lg border border-slate-700/50 backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${nightMode ? 'bg-red-950/40 border-red-500/50 text-red-500' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'}`}
            title="Toggle Tactical Mode"
          >
            {nightMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button 
            onClick={onOpenAdmin}
            className={`p-3.5 rounded-lg border border-slate-700/50 backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${nightMode ? 'bg-red-950/20 text-red-700 border-red-900/50' : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white'}`}
            title="System Configuration"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      <div className={`w-full h-[1px] relative overflow-hidden mt-1 ${nightMode ? 'bg-red-900/10' : 'bg-slate-800/40'}`}>
         <div className={`absolute inset-0 w-1/3 animate-[shimmer_3s_linear_infinite] ${nightMode ? 'bg-gradient-to-r from-transparent via-red-600/50 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent'}`} />
      </div>
    </div>
  );
};

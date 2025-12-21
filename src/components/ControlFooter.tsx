
import React from 'react';
import { Power, Mic } from 'lucide-react';
import { ConnectionState } from '../services/client';

interface ControlFooterProps {
  connectionState: ConnectionState;
  isConnected: boolean;
  userIsSpeaking: boolean;
  isSpeaking: boolean; // Model speaking state
  nightMode: boolean;
  onToggleConnection: () => void;
}

export const ControlFooter: React.FC<ControlFooterProps> = ({
  connectionState,
  isConnected,
  userIsSpeaking,
  isSpeaking,
  nightMode,
  onToggleConnection
}) => {
  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
      <div className={`pointer-events-auto flex items-center gap-6 backdrop-blur px-8 py-4 rounded-full border shadow-2xl transition-colors duration-300 ${
        nightMode ? 'bg-red-950/80 border-red-500/30' : 'bg-slate-900/80 border-slate-700'
      }`}>
         <button 
           onClick={onToggleConnection}
           className={`p-4 rounded-full transition-all shadow-lg flex items-center gap-2 ${
             isConnected
               ? (nightMode ? 'bg-white text-red-600' : 'bg-red-500 hover:bg-red-600 text-white') 
               : connectionState === ConnectionState.CONNECTING
               ? 'bg-yellow-600 text-white cursor-wait'
               : (nightMode ? 'bg-white text-red-600' : 'bg-cyan-600 hover:bg-cyan-500 text-white')
           }`}
           disabled={connectionState === ConnectionState.CONNECTING}
         >
           {isConnected ? <Power size={24} /> : <Mic size={24} />}
         </button>
         <div className="flex flex-col">
           <span className={`text-[10px] font-mono tracking-widest uppercase ${nightMode ? 'text-red-400' : 'text-slate-400'}`}>STATUS</span>
           <span className={`text-sm font-semibold w-32 tracking-wider ${nightMode ? 'text-red-100' : 'text-white'}`}>
             {connectionState === ConnectionState.CONNECTING ? 'CONNECTING...' : 
              !isConnected ? 'OFFLINE' :
              userIsSpeaking ? 'LISTENING' : 
              isSpeaking ? 'SPEAKING' : 'ACTIVE'}
           </span>
         </div>
      </div>
    </div>
  );
};

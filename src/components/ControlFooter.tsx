import React from 'react';
import { Power, Mic } from 'lucide-react';
import { ConnectionState } from '../services/client';

interface ControlFooterProps {
  connectionState: ConnectionState;
  isConnected: boolean;
  userIsSpeaking: boolean;
  isSpeaking: boolean; // Model speaking state
  onToggleConnection: () => void;
}

export const ControlFooter: React.FC<ControlFooterProps> = ({
  connectionState,
  isConnected,
  userIsSpeaking,
  isSpeaking,
  onToggleConnection
}) => {
  return (
    <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
      <div className="pointer-events-auto flex items-center gap-6 bg-slate-900/80 backdrop-blur px-8 py-4 rounded-full border border-slate-700 shadow-2xl">
         <button 
           onClick={onToggleConnection}
           className={`p-4 rounded-full transition-all shadow-lg flex items-center gap-2 ${
             isConnected
               ? 'bg-red-500 hover:bg-red-600 text-white' 
               : connectionState === ConnectionState.CONNECTING
               ? 'bg-yellow-600 text-white cursor-wait'
               : 'bg-cyan-600 hover:bg-cyan-500 text-white'
           }`}
           disabled={connectionState === ConnectionState.CONNECTING}
         >
           {isConnected ? <Power size={24} /> : <Mic size={24} />}
         </button>
         <div className="flex flex-col">
           <span className="text-xs text-slate-400 font-mono tracking-wider">STATUS</span>
           <span className="text-sm font-semibold text-white w-32">
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
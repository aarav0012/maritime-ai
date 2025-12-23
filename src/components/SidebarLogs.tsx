
import React from 'react';
import { 
  MessageSquare, Database, Info, Loader2, AlertCircle, ShieldCheck, ChevronRight
} from 'lucide-react';
import { MessageRole } from '../types';
import type { ChatMessage } from '../types';

interface SidebarLogsProps {
  messages: ChatMessage[];
  ragMode: boolean;
  explanatoryMode: boolean;
  isProcessing: boolean;
  assetQueueLength: number;
  proposedAsset: { type: string, description: string, reason: 'user_request' | 'system_suggestion' | 'none' } | null;
  
  onToggleRag: () => void;
  onToggleExplanatory: () => void;
  onApproveAsset: () => void;
  onDismissAsset: () => void;
  
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const SidebarLogs: React.FC<SidebarLogsProps> = ({
  messages,
  ragMode,
  explanatoryMode,
  isProcessing,
  assetQueueLength,
  proposedAsset,
  onToggleRag,
  onToggleExplanatory,
  onApproveAsset,
  onDismissAsset,
  messagesEndRef
}) => {
  return (
    <div className="absolute left-4 top-32 bottom-28 w-80 bg-slate-900/70 backdrop-blur-xl rounded border border-slate-700/50 flex flex-col z-20 shadow-2xl overflow-hidden corner-bracket text-slate-100">
      
      {/* HUD Header */}
      <div className="p-4 bg-slate-800/40 border-b border-slate-700 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold text-cyan-400 tracking-[0.2em] flex items-center gap-2 uppercase font-mono">
              <MessageSquare size={16} /> INTERACTION_LOG
          </h2>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">LIVE_FEED</span>
          </div>
        </div>
      </div>

      {/* Quick Controls HUD */}
      <div className="p-2 grid grid-cols-2 gap-2 bg-black/20">
        <button
          onClick={onToggleRag}
          className={`px-3 py-2 rounded text-[11px] font-bold tracking-tight flex items-center justify-center gap-2 transition-all border ${
            ragMode 
             ? 'bg-cyan-600/20 border-cyan-400 text-cyan-300' 
             : 'bg-slate-800/40 border-slate-700 text-slate-500'
          }`}
        >
           <Database size={12} />
           RAG: {ragMode ? 'ON' : 'OFF'}
        </button>
        <button 
          onClick={onToggleExplanatory}
          className={`px-3 py-2 rounded text-[11px] font-bold tracking-tight flex items-center justify-center gap-2 transition-all border ${
            explanatoryMode 
              ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300' 
              : 'bg-slate-800/40 border-slate-700 text-slate-500'
          }`}
        >
          <Info size={12} />
          DETAIL: {explanatoryMode ? 'ON' : 'OFF'}
        </button>
      </div>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 font-mono scrollbar-hide">
        {messages.length === 0 && (
          <div className="text-center mt-20 opacity-30">
            <ShieldCheck size={40} className="mx-auto mb-3" />
            <p className="text-xs uppercase tracking-[0.3em] font-bold">Awaiting Input...</p>
          </div>
        )}
        
        {messages.map((msg) => {
           const isSystem = msg.role === MessageRole.SYSTEM;
           const isUser = msg.role === MessageRole.USER;
           return (
          <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fade-in-up`}>
            <div className="flex items-center gap-2 mb-1.5">
               <span className={`text-[10px] font-bold uppercase tracking-wider ${isUser ? 'text-cyan-400' : isSystem ? 'text-blue-500' : 'text-slate-400'}`}>
                 {isUser ? 'Commander' : isSystem ? 'Kernel' : 'Naval_AI'}
               </span>
               <span className="text-[9px] text-slate-600 font-bold font-sans">[{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', hour12: false, minute: '2-digit', second: '2-digit' })}]</span>
            </div>
            <div className={`max-w-[98%] rounded p-3 text-sm leading-relaxed border shadow-sm ${
              isUser 
                ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-50 text-right' 
                : isSystem
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-300 text-xs italic'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-100'
            }`}>
              {msg.content}
            </div>
          </div>
        )})}
        <div ref={messagesEndRef} />
      </div>

      {/* Asset Queue Status */}
      {(isProcessing || assetQueueLength > 0) && (
        <div className="p-3 bg-cyan-950/30 border-t border-cyan-500/30 flex items-center justify-between">
           <div className="flex items-center gap-2.5">
             <Loader2 size={14} className="text-cyan-400 animate-spin" />
             <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
               Processing_Assets
             </span>
           </div>
           {assetQueueLength > 0 && (
             <span className="px-2 py-0.5 rounded bg-cyan-500/30 text-[10px] font-bold font-mono text-cyan-300 border border-cyan-500/20">
               Q: {assetQueueLength}
             </span>
           )}
        </div>
      )}

      {/* HUD Proposal Card */}
      {proposedAsset && (
          <div className="m-3 p-4 bg-slate-900 border border-cyan-500/40 rounded relative overflow-hidden animate-fade-in-up shadow-xl">
            <div className="absolute top-0 right-0 p-1.5 opacity-50">
               <AlertCircle size={12} className="text-cyan-400" />
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <ChevronRight size={12} className="animate-pulse" /> {proposedAsset.type}_Proposal
              </span>
              <p className="text-xs text-slate-300 leading-normal italic">
                "{proposedAsset.description}"
              </p>
              <div className="flex gap-2 pt-1">
                <button 
                  onClick={onApproveAsset}
                  className="flex-1 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-100 text-[11px] font-bold py-2 border border-cyan-500/50 transition uppercase tracking-widest rounded-sm"
                >
                  Confirm
                </button>
                <button 
                  onClick={onDismissAsset}
                  className="px-3 bg-slate-800/50 hover:bg-slate-700 text-slate-400 hover:text-white text-[11px] py-2 border border-slate-700 transition uppercase tracking-widest rounded-sm"
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

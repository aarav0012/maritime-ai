
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
    <div className="absolute left-4 top-24 bottom-28 w-80 bg-slate-900/60 backdrop-blur-xl rounded border border-slate-700/50 flex flex-col z-20 shadow-2xl overflow-hidden corner-bracket text-slate-100">
      
      {/* HUD Header */}
      <div className="p-3 bg-slate-800/40 border-b border-slate-700 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h2 className="text-[10px] font-bold text-cyan-400 tracking-[0.3em] flex items-center gap-2">
              <MessageSquare size={12} /> INTERACTION_LOG
          </h2>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-mono text-slate-500 uppercase">Live_Feed</span>
          </div>
        </div>
      </div>

      {/* Quick Controls HUD */}
      <div className="p-2 grid grid-cols-2 gap-1 bg-black/20">
        <button
          onClick={onToggleRag}
          className={`px-2 py-1.5 rounded text-[9px] font-bold tracking-tighter flex items-center gap-2 transition-all border ${
            ragMode 
             ? 'bg-cyan-600/20 border-cyan-400 text-cyan-300' 
             : 'bg-slate-800/40 border-slate-700 text-slate-500'
          }`}
        >
           <Database size={10} />
           RAG: {ragMode ? 'ON' : 'OFF'}
        </button>
        <button 
          onClick={onToggleExplanatory}
          className={`px-2 py-1.5 rounded text-[9px] font-bold tracking-tighter flex items-center gap-2 transition-all border ${
            explanatoryMode 
              ? 'bg-indigo-600/20 border-indigo-400 text-indigo-300' 
              : 'bg-slate-800/40 border-slate-700 text-slate-500'
          }`}
        >
          <Info size={10} />
          DETAIL: {explanatoryMode ? 'ON' : 'OFF'}
        </button>
      </div>
      
      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">
        {messages.length === 0 && (
          <div className="text-center mt-20 opacity-30">
            <ShieldCheck size={32} className="mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-widest">Awaiting Command Input...</p>
          </div>
        )}
        
        {messages.map((msg) => {
           const isSystem = msg.role === MessageRole.SYSTEM;
           const isUser = msg.role === MessageRole.USER;
           return (
          <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 mb-1">
               <span className={`text-[8px] uppercase tracking-tighter ${isUser ? 'text-cyan-400' : isSystem ? 'text-blue-500' : 'text-slate-400'}`}>
                 {isUser ? 'Commander' : isSystem ? 'Sys_Kernel' : 'Naval_AI'}
               </span>
               <span className="text-[8px] text-slate-600">[{new Date(msg.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
            </div>
            <div className={`max-w-[95%] rounded-sm p-2 text-[11px] leading-relaxed border ${
              isUser 
                ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-100 text-right' 
                : isSystem
                ? 'bg-blue-500/5 border-blue-500/20 text-blue-300 text-[10px]'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-300'
            }`}>
              {msg.content}
            </div>
          </div>
        )})}
        <div ref={messagesEndRef} />
      </div>

      {/* Asset Queue Status */}
      {(isProcessing || assetQueueLength > 0) && (
        <div className="p-2 bg-cyan-950/20 border-t border-cyan-500/20 flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Loader2 size={12} className="text-cyan-400 animate-spin" />
             <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">
               Processing_Assets
             </span>
           </div>
           {assetQueueLength > 0 && (
             <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-[8px] font-mono text-cyan-300">
               QUEUE: {assetQueueLength}
             </span>
           )}
        </div>
      )}

      {/* HUD-Style Proposal Card */}
      {proposedAsset && (
          <div className="m-2 p-3 bg-slate-900 border border-cyan-500/40 rounded-sm relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 p-1">
               <AlertCircle size={10} className="text-cyan-400" />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                <ChevronRight size={10} /> {proposedAsset.type}_RECOMMENDED
              </span>
              <p className="text-[10px] text-slate-400 italic leading-tight">
                "{proposedAsset.description}"
              </p>
              <div className="flex gap-2 pt-1">
                <button 
                  onClick={onApproveAsset}
                  className="flex-1 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-100 text-[9px] font-bold py-1.5 border border-cyan-500/50 transition uppercase tracking-wider"
                >
                  Authorize
                </button>
                <button 
                  onClick={onDismissAsset}
                  className="px-3 bg-slate-800/50 hover:bg-slate-700 text-slate-500 hover:text-white text-[9px] py-1.5 border border-slate-700 transition uppercase tracking-wider"
                >
                  Abort
                </button>
              </div>
            </div>
          </div>
      )}
    </div>
  );
};

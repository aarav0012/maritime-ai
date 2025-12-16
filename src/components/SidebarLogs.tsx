import React from 'react';
import { 
  MessageSquare, Database, Info, Loader2, AlertCircle, AlertTriangle 
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
    <div className="absolute left-4 top-24 bottom-24 w-80 bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800 flex flex-col z-20 shadow-2xl">
      {/* Toolbar */}
      <div className="p-4 border-b border-slate-700 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <MessageSquare size={16} /> LOGS
          </h2>
        </div>
        <div className="space-y-2">
           <button
             onClick={onToggleRag}
             className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg border ${
               ragMode 
                ? 'bg-cyan-600 hover:bg-cyan-500 border-cyan-400 text-white shadow-cyan-900/40' 
                : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
             }`}
             title={ragMode ? "Disable Knowledge Base" : "Enable Knowledge Base"}
           >
              <Database size={14} />
              {ragMode ? "DISABLE RAG MODE" : "ENABLE RAG MODE"}
           </button>
           <button 
             onClick={onToggleExplanatory}
             className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg border ${
               explanatoryMode 
                 ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white shadow-indigo-900/40' 
                 : 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
             }`}
           >
             <Info size={14} />
             {explanatoryMode ? "DISABLE DETAIL MODE" : "ENABLE DETAIL MODE"}
           </button>
        </div>
      </div>
      
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-10 text-slate-500 text-sm">
            <Info size={32} className="mx-auto mb-2 opacity-50" />
            <p>Systems Online.</p>
            <p>Connect to Neural Core.</p>
          </div>
        )}
        {messages.map((msg) => {
           const isSystem = msg.role === MessageRole.SYSTEM;
           const isError = isSystem && msg.content.startsWith('Error:');
           const isWarning = isSystem && msg.content.startsWith('Warning:');
           return (
          <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
              msg.role === MessageRole.USER 
                ? 'bg-cyan-900/50 text-cyan-50 border border-cyan-800' 
                : isError
                ? 'bg-red-950/40 text-red-400 border border-red-900/50 text-xs font-mono flex items-center gap-2'
                : isWarning
                ? 'bg-orange-950/40 text-orange-400 border border-orange-900/50 text-xs font-mono flex items-center gap-2'
                : isSystem
                ? 'bg-blue-950/30 text-blue-400 border border-blue-900/30 text-xs font-mono'
                : 'bg-slate-800/80 text-slate-200 border border-slate-700'
            }`}>
              {isError && <AlertCircle size={14} className="shrink-0" />}
              {isWarning && <AlertTriangle size={14} className="shrink-0" />}
              {msg.content}
            </div>
            <span className="text-[10px] text-slate-500 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</span>
          </div>
        )})}
        <div ref={messagesEndRef} />
      </div>

      {/* Processing State */}
      {(isProcessing || assetQueueLength > 0) && (
        <div className="px-4 py-2 bg-slate-950/50 border-t border-slate-800 flex items-center gap-3">
           <Loader2 size={16} className="text-cyan-400 animate-spin" />
           <div className="flex flex-col">
             <span className="text-xs font-medium text-cyan-300 tracking-wide">
               {isProcessing ? 'GENERATING ASSETS...' : 'PROCESSING QUEUE...'}
             </span>
             {assetQueueLength > 0 && (
               <span className="text-[10px] text-slate-500">{assetQueueLength} pending</span>
             )}
           </div>
        </div>
      )}

      {/* Asset Proposal Card */}
      {proposedAsset && (
          <div className="p-3 m-3 bg-cyan-950/90 border border-cyan-500/50 rounded-lg animate-fade-in-up shadow-lg">
            <div className="flex items-start gap-2 mb-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                proposedAsset.reason === 'user_request' ? 'bg-green-500/20 text-green-300' : 'bg-cyan-500/20 text-cyan-300'
              }`}>
                {proposedAsset.reason === 'user_request' ? 'REQUESTED' : 'SUGGESTED'}
              </span>
              <span className="text-xs text-cyan-100 font-medium uppercase tracking-wide">
                 {proposedAsset.type} Generation
              </span>
            </div>
            
            <p className="text-xs text-slate-300 mb-3 leading-relaxed">
               {proposedAsset.reason === 'user_request' 
                 ? `You requested a ${proposedAsset.type}. Ready to generate?`
                 : `I can generate a ${proposedAsset.type} to visualize this. Proceed?`}
               <br/>
               <span className="text-[10px] opacity-60 italic">"{proposedAsset.description}"</span>
            </p>

            <div className="flex gap-2">
              <button 
                onClick={onApproveAsset}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs py-2 rounded font-medium transition flex justify-center items-center gap-1"
              >
                Confirm
              </button>
              <button 
                onClick={onDismissAsset}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded font-medium transition"
              >
                Dismiss
              </button>
            </div>
          </div>
      )}
    </div>
  );
};
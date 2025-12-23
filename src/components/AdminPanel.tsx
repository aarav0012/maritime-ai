
import React, { useState } from 'react';
import type { KnowledgeDocument, SystemAlert } from '../types';
import { AlertTriangle, FileText, Trash2, X, Terminal, Shield, FolderOpen, ChevronRight } from 'lucide-react';

interface AdminPanelProps {
  documents: KnowledgeDocument[];
  alerts: SystemAlert[];
  nightMode: boolean;
  onUpload: (name: string, content: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ documents, alerts, nightMode, onUpload, onDelete, onClose }) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'alerts'>('knowledge');
  const [uploadText, setUploadText] = useState('');
  const [uploadName, setUploadName] = useState('');

  const handleUpload = () => {
    if (uploadName && uploadText) {
      onUpload(uploadName, uploadText);
      setUploadName('');
      setUploadText('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setUploadName(file.name);
        setUploadText(text);
      };
      reader.readAsText(file);
    }
  };

  const accentColor = nightMode ? 'text-red-500' : 'text-cyan-400';
  const accentBorder = nightMode ? 'border-red-500/30' : 'border-cyan-500/30';
  const accentBg = nightMode ? 'bg-red-500/10' : 'bg-cyan-500/10';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-mono animate-fade-in overflow-hidden">
      <div className={`w-full max-w-5xl h-[85vh] rounded border flex flex-col overflow-hidden relative corner-bracket shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-colors duration-500 ${
        nightMode ? 'bg-red-950/90 border-red-500/30' : 'bg-slate-900/95 border-slate-700'
      }`}>
        
        {/* Decorative HUD Elements */}
        <div className={`absolute top-0 left-0 w-full h-[1px] ${nightMode ? 'bg-gradient-to-r from-transparent via-red-500/50 to-transparent' : 'bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent'}`} />
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/5 relative bg-black/20">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded border transition-colors ${accentBorder} ${accentBg}`}>
              <Shield size={24} className={accentColor} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-[0.2em] text-white uppercase leading-none">
                System <span className={accentColor}>Console</span>
              </h2>
              <p className={`text-[10px] uppercase tracking-widest mt-1.5 ${nightMode ? 'text-red-400/60' : 'text-slate-400'}`}>
                Neural Core Management // Operation: {nightMode ? 'Night_Watch' : 'Standard'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className={`p-2 rounded-full border border-white/10 hover:border-white/20 transition-all ${nightMode ? 'hover:bg-red-500/20 text-red-500' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tactical Tabs */}
        <div className="flex bg-black/40 border-b border-white/5">
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`px-8 py-4 text-xs font-bold tracking-[0.2em] uppercase transition-all relative flex items-center gap-2 ${
              activeTab === 'knowledge' 
                ? (nightMode ? 'text-red-400 bg-red-500/10' : 'text-cyan-400 bg-cyan-500/10') 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FolderOpen size={14} />
            Knowledge_Vault
            {activeTab === 'knowledge' && <div className={`absolute bottom-0 left-0 w-full h-0.5 ${nightMode ? 'bg-red-500' : 'bg-cyan-400'}`} />}
          </button>
          <button 
            onClick={() => setActiveTab('alerts')}
            className={`px-8 py-4 text-xs font-bold tracking-[0.2em] uppercase transition-all relative flex items-center gap-2 ${
              activeTab === 'alerts' 
                ? 'text-red-400 bg-red-500/10' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <AlertTriangle size={14} />
            Anomalies
            {activeTab === 'alerts' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500" />}
          </button>
        </div>

        {/* Main Interface Content */}
        <div className="flex-1 overflow-hidden flex">
          
          {activeTab === 'knowledge' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Column: Data Ingestion */}
              <div className="w-1/2 p-6 border-r border-white/5 overflow-y-auto space-y-6 scrollbar-hide">
                <h3 className={`text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-2 ${accentColor}`}>
                   <Terminal size={14} /> Ingestion_Module
                </h3>
                
                <div className={`p-5 rounded border bg-black/30 space-y-5 shadow-inner ${accentBorder}`}>
                  <div className="space-y-1.5">
                    <label className={`text-[10px] uppercase tracking-widest ${nightMode ? 'text-red-400/80' : 'text-slate-500'}`}>ID_TAG</label>
                    <input 
                      type="text" 
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className={`w-full bg-black/40 border rounded px-3 py-2 text-xs text-white focus:ring-1 outline-none transition-all ${
                        nightMode ? 'border-red-900/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20'
                      }`}
                      placeholder="MANIFEST_ENTRY_01..."
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className={`text-[10px] uppercase tracking-widest ${nightMode ? 'text-red-400/80' : 'text-slate-500'}`}>DATA_PAYLOAD</label>
                    <textarea 
                      value={uploadText}
                      onChange={(e) => setUploadText(e.target.value)}
                      className={`w-full bg-black/40 border rounded px-3 py-2 text-xs text-white h-40 focus:ring-1 outline-none transition-all resize-none font-mono ${
                        nightMode ? 'border-red-900/50 focus:border-red-500 focus:ring-red-500/20' : 'border-slate-700 focus:border-cyan-500 focus:ring-cyan-500/20'
                      }`}
                      placeholder="Waiting for neural injection..."
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative overflow-hidden">
                      <input 
                        type="file" 
                        id="file-upload"
                        accept=".txt,.md,.json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <label 
                        htmlFor="file-upload"
                        className={`block text-center py-2.5 text-[9px] font-bold uppercase tracking-widest rounded border border-dashed cursor-pointer transition-all ${
                          nightMode ? 'border-red-900/50 text-red-400 hover:bg-red-500/10' : 'border-slate-700 text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        Mount_Local_Source
                      </label>
                    </div>
                    <button 
                      onClick={handleUpload}
                      disabled={!uploadName || !uploadText}
                      className={`flex-1 py-2.5 rounded text-[9px] font-bold uppercase tracking-[0.2em] transition-all shadow-lg shadow-black/40 ${
                        !uploadName || !uploadText 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700' 
                          : (nightMode ? 'bg-red-600 hover:bg-red-500 text-white border border-red-400' : 'bg-cyan-600 hover:bg-cyan-500 text-white border border-cyan-400')
                      }`}
                    >
                      Process_Sync
                    </button>
                  </div>
                </div>

                <div className={`p-4 bg-black/40 rounded border ${nightMode ? 'border-red-900/20' : 'border-slate-800'}`}>
                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Shield size={12} /> System_Advisory
                    </h4>
                    <p className="text-[9px] text-slate-600 leading-relaxed uppercase tracking-tighter">
                        Ensure all documents are sanitized. Data ingested into the Knowledge Vault is used for real-time RAG operations. Limit single payload size to 25k characters for optimal neural processing.
                    </p>
                </div>
              </div>

              {/* Right Column: Active Documents List */}
              <div className="w-1/2 p-6 overflow-y-auto space-y-6 bg-black/10 scrollbar-hide">
                <h3 className={`text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-2 ${accentColor}`}>
                   <FolderOpen size={14} /> Knowledge_Inventory
                </h3>
                
                <div className="space-y-2">
                  {documents.length === 0 ? (
                    <div className="text-center py-24 border border-dashed border-white/5 rounded">
                      <p className="text-[10px] uppercase tracking-widest text-slate-600 italic">Inventory_Empty // No_Active_Payloads</p>
                    </div>
                  ) : (
                    documents.map(doc => (
                      <div key={doc.id} className={`p-4 rounded border group transition-all flex items-center justify-between ${
                        nightMode ? 'bg-red-950/20 border-red-900/30' : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600'
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className={`p-2.5 rounded border ${nightMode ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'}`}>
                            <FileText size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-white tracking-[0.1em]">{doc.name}</p>
                            <p className="text-[9px] text-slate-500 mt-1 uppercase">Logged: {new Date(doc.uploadedAt).toLocaleString([], { hour12: false })}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => onDelete(doc.id)} 
                          className="p-2 text-slate-600 hover:text-red-500 transition-colors"
                          title="Purge_Sector"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="flex-1 p-8 overflow-y-auto bg-black/10 space-y-6 scrollbar-hide">
              <h3 className="text-xs font-bold tracking-[0.3em] uppercase flex items-center gap-2 text-red-500">
                 <AlertTriangle size={16} /> Active_Anomalies
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {alerts.length === 0 ? (
                    <div className="col-span-2 text-center py-40 border border-dashed border-white/5 rounded">
                      <div className="flex flex-col items-center gap-4 opacity-20">
                          <Shield size={48} />
                          <p className="text-[10px] uppercase tracking-widest">Global_Status: Optimal // No_Anomalies</p>
                      </div>
                    </div>
                  ) : (
                    alerts.map(alert => (
                      <div key={alert.id} className="bg-red-950/20 border border-red-900/50 p-5 rounded relative overflow-hidden group animate-fade-in-up">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-100 transition-opacity">
                           <AlertTriangle className="text-red-500" size={18} />
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2">
                             <ChevronRight size={14} className="text-red-500" />
                             <span className="text-[9px] font-bold text-red-500/80 uppercase tracking-widest">Detection_Log:</span>
                          </div>
                          <p className="text-sm font-medium text-white italic leading-relaxed border-l-2 border-red-500/30 pl-3">
                              "{alert.query}"
                          </p>
                          <div className="flex justify-between items-end pt-3 border-t border-red-900/20">
                            <div>
                               <span className="text-[8px] font-bold text-red-500/60 uppercase tracking-widest block mb-1">Trigger_Code:</span>
                               <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded">{alert.reason}</span>
                            </div>
                            <span className="text-[9px] text-slate-500 font-mono">{new Date(alert.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          )}
          
        </div>

        {/* Console Footer */}
        <div className="p-3 bg-black/60 border-t border-white/5 flex justify-between items-center relative">
          <div className="flex gap-6">
             <div className="flex items-center gap-2">
               <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Node_Status:</span>
               <span className={`text-[9px] font-bold uppercase flex items-center gap-1.5 ${nightMode ? 'text-red-500' : 'text-emerald-400'}`}>
                 <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${nightMode ? 'bg-red-500' : 'bg-emerald-400'}`} /> Synchronized
               </span>
             </div>
             <div className="flex items-center gap-2">
               <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Auth_Level:</span>
               <span className="text-[9px] font-bold text-white uppercase tracking-tighter">ADM_OVERRIDE_ACTIVE</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-[8px] text-slate-700 uppercase tracking-[0.5em] font-bold">MARITIME_OS v2.9.1</p>
            <div className={`w-2 h-2 rounded-sm rotate-45 ${nightMode ? 'bg-red-900/50' : 'bg-cyan-900/50'}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

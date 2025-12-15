import React, { useState } from 'react';
import type { KnowledgeDocument, SystemAlert } from '../types';
import { Upload, AlertTriangle, FileText, Trash2 } from 'lucide-react';

interface AdminPanelProps {
  documents: KnowledgeDocument[];
  alerts: SystemAlert[];
  onUpload: (name: string, content: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ documents, alerts, onUpload, onDelete, onClose }) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl h-[80vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-800 bg-slate-900">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">System Administration</h2>
            <p className="text-slate-400 text-sm">Maritime Domain Knowledge & Monitoring</p>
          </div>
          <button 
            onClick={onClose} 
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm text-white transition"
          >
            Close Panel
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button 
            onClick={() => setActiveTab('knowledge')}
            className={`px-6 py-3 text-sm font-medium ${activeTab === 'knowledge' ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-400 hover:text-white'}`}
          >
            Knowledge Base
          </button>
          <button 
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-3 text-sm font-medium ${activeTab === 'alerts' ? 'bg-slate-800 text-red-400 border-b-2 border-red-400' : 'text-slate-400 hover:text-white'}`}
          >
            Missed Query Alerts
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-slate-900">
          
          {activeTab === 'knowledge' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Upload Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Upload size={20} className="text-cyan-400" /> Ingest Data
                </h3>
                <div className="bg-slate-800 p-4 rounded-lg space-y-4 border border-slate-700">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Document Name</label>
                    <input 
                      type="text" 
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:border-cyan-400 outline-none"
                      placeholder="e.g., CargoManifest_v1.txt"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Content / File</label>
                    <textarea 
                      value={uploadText}
                      onChange={(e) => setUploadText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white h-32 focus:border-cyan-400 outline-none text-sm font-mono"
                      placeholder="Paste text content here..."
                    />
                    <div className="mt-2">
                      <input 
                        type="file" 
                        accept=".txt,.md,.json,.csv"
                        onChange={handleFileUpload}
                        className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-cyan-900 file:text-cyan-300 hover:file:bg-cyan-800 cursor-pointer"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleUpload}
                    disabled={!uploadName || !uploadText}
                    className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium transition"
                  >
                    Add to Knowledge Base
                  </button>
                </div>
              </div>

              {/* List Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FileText size={20} className="text-cyan-400" /> Active Documents
                </h3>
                <div className="space-y-2">
                  {documents.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No documents uploaded.</p>
                  ) : (
                    documents.map(doc => (
                      <div key={doc.id} className="bg-slate-800 p-3 rounded flex justify-between items-center border border-slate-700">
                        <div>
                          <p className="text-sm font-medium text-white">{doc.name}</p>
                          <p className="text-xs text-slate-500">{new Date(doc.uploadedAt).toLocaleString()}</p>
                        </div>
                        <button onClick={() => onDelete(doc.id)} className="text-red-400 hover:text-red-300 p-2">
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
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-400" /> Unresolved Queries
              </h3>
              <div className="space-y-2">
                 {alerts.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No alerts found. System running optimally.</p>
                  ) : (
                    alerts.map(alert => (
                      <div key={alert.id} className="bg-slate-800/50 border border-red-900/50 p-4 rounded flex items-start gap-3">
                        <AlertTriangle className="text-red-500 shrink-0 mt-1" size={18} />
                        <div>
                          <p className="text-white font-medium">"{alert.query}"</p>
                          <p className="text-red-300 text-sm mt-1">Reason: {alert.reason}</p>
                          <p className="text-slate-500 text-xs mt-2">{new Date(alert.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))
                  )}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};
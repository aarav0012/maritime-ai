import React, { useEffect, useRef } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AssetType } from '../types';
import type { GeneratedAsset } from '../types';
import { X } from 'lucide-react';
import mermaid from 'mermaid';

interface AssetDisplayProps {
  asset: GeneratedAsset | null;
  onClose: () => void;
}

export const AssetDisplay: React.FC<AssetDisplayProps> = ({ asset, onClose }) => {
  const diagramRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize Mermaid whenever component mounts
    mermaid.initialize({ 
      startOnLoad: false, 
      theme: 'dark', 
      securityLevel: 'loose',
      fontFamily: 'Inter',
    });
  }, []);

  useEffect(() => {
    if (asset?.type === AssetType.DIAGRAM && asset.data && diagramRef.current) {
        // Unique ID for mermaid to render into
        const id = `mermaid-${asset.id}`;
        
        // Clear previous content
        diagramRef.current.innerHTML = '';
        
        // Render
        mermaid.render(id, asset.data).then(({ svg }) => {
            if (diagramRef.current) {
                diagramRef.current.innerHTML = svg;
            }
        }).catch(err => {
            console.error("Mermaid Render Error", err);
            if (diagramRef.current) {
                diagramRef.current.innerHTML = `<div class="text-red-500 text-xs p-4 text-center">Failed to render diagram<br/><span class="opacity-50">${err.message}</span></div>`;
            }
        });
    }
  }, [asset]);

  if (!asset) return null;

  return (
    <div className="absolute right-4 top-24 bottom-24 w-[calc(100vw-2rem)] sm:w-[28rem] md:w-[32rem] lg:w-[40rem] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl flex flex-col z-40 animate-slide-in-right overflow-hidden transition-all duration-300">
      
      {/* Header */}
      <div className="flex-none p-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm">
        <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
                asset.type === AssetType.CHART ? 'bg-cyan-400' :
                asset.type === AssetType.DIAGRAM ? 'bg-indigo-400' :
                asset.type === AssetType.VIDEO ? 'bg-purple-400' : 'bg-emerald-400'
            }`} />
            <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
            {asset.type} Visualization
            </h3>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-white transition">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-slate-950/30 flex flex-col items-center justify-center relative">
        {asset.type === AssetType.IMAGE && asset.url && (
          <img 
            src={asset.url} 
            alt={asset.description} 
            className="max-w-full max-h-full rounded-lg border border-slate-700 shadow-lg object-contain"
          />
        )}

        {asset.type === AssetType.VIDEO && asset.url && (
          <video 
            src={asset.url} 
            controls 
            autoPlay 
            className="max-w-full max-h-full rounded-lg border border-slate-700 shadow-lg"
          />
        )}

        {asset.type === AssetType.CHART && asset.data && (
          <div className="w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={asset.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" tick={{fontSize: 11}} />
                <YAxis stroke="#94a3b8" tick={{fontSize: 11}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '4px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  cursor={{fill: '#334155', opacity: 0.3}}
                />
                <Legend />
                <Bar dataKey="value" fill="#06b6d4" name={asset.description} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {asset.type === AssetType.DIAGRAM && asset.data && (
            <div className="w-full h-full min-h-[300px] overflow-auto bg-slate-900/50 rounded-lg p-4 border border-slate-800 flex items-center justify-center">
                <div ref={diagramRef} className="mermaid-container w-full flex justify-center" />
            </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-none p-3 bg-slate-900/80 text-xs text-slate-400 border-t border-slate-800/50">
        <span className="font-mono text-cyan-600 mr-2">CONTEXT:</span> {asset.description}
      </div>
    </div>
  );
};
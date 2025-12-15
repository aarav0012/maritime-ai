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
      securityLevel: 'loose' 
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
                diagramRef.current.innerHTML = `<div class="text-red-500 text-xs">Failed to render diagram</div>`;
            }
        });
    }
  }, [asset]);

  if (!asset) return null;

  return (
    <div className="absolute right-4 top-24 w-80 md:w-96 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-40 animate-slide-in-right">
      <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider">
          {asset.type} Visualization
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 min-h-[250px] flex items-center justify-center bg-slate-950/50">
        {asset.type === AssetType.IMAGE && asset.url && (
          <img 
            src={asset.url} 
            alt={asset.description} 
            className="w-full h-auto rounded-md border border-slate-600"
          />
        )}

        {asset.type === AssetType.VIDEO && asset.url && (
          <video 
            src={asset.url} 
            controls 
            autoPlay 
            className="w-full h-auto rounded-md border border-slate-600"
          />
        )}

        {asset.type === AssetType.CHART && asset.data && (
          <div className="w-full h-64 text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={asset.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="value" fill="#06b6d4" name={asset.description} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {asset.type === AssetType.DIAGRAM && asset.data && (
            <div className="w-full overflow-x-auto flex justify-center">
                <div ref={diagramRef} className="mermaid-container w-full" />
            </div>
        )}
      </div>
      <div className="p-3 bg-slate-950/50 text-xs text-slate-400 border-t border-slate-800">
        Generated for: {asset.description}
      </div>
    </div>
  );
};
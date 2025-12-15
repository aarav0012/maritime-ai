import { useState, useEffect } from 'react';
import { AssetType } from '../types';
import type { GeneratedAsset } from '../types';
import { generateImage, generateVideo, generateChartData, generateDiagram, getFriendlyErrorMessage } from '../services/gemini';

export function useAssetManager(addSystemMessage: (text: string) => void) {
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [proposedAsset, setProposedAsset] = useState<{type: string, description: string} | null>(null);
  const [assetQueue, setAssetQueue] = useState<{type: string, description: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Queue Processing Loop
  useEffect(() => {
    const processQueue = async () => {
      if (isProcessing || assetQueue.length === 0) return;

      const currentRequest = assetQueue[0];
      const { type, description } = currentRequest;

      setIsProcessing(true);
      setAssetQueue(prev => prev.slice(1));
      addSystemMessage(`Generating ${type}...`);

      try {
        let assetData: GeneratedAsset = {
          id: crypto.randomUUID(),
          type: type as AssetType,
          description: description,
          createdAt: Date.now()
        };

        if (type === 'image') {
          const url = await generateImage(description);
          assetData.url = url;
        } else if (type === 'video') {
          const url = await generateVideo(description);
          assetData.url = url;
        } else if (type === 'chart') {
          const data = await generateChartData(description);
          assetData.data = data;
        } else if (type === 'diagram') {
          const code = await generateDiagram(description);
          assetData.data = code;
        }

        if (assetData.url || assetData.data) {
          setAssets(prev => [...prev, assetData]);
          setActiveAssetId(assetData.id);
          
          // Generate a log representation for the chat
          let markdownLog = '';
          if (assetData.type === 'chart' && Array.isArray(assetData.data) && assetData.data.length > 0) {
             const keys = Object.keys(assetData.data[0]);
             const header = `| ${keys.join(' | ')} |`;
             const separator = `| ${keys.map(() => '---').join(' | ')} |`;
             const rows = assetData.data.map((row: any) => `| ${keys.map(k => row[k]).join(' | ')} |`).join('\n');
             markdownLog = `CHART DATA:\n${header}\n${separator}\n${rows}`;
          } 
          else if (assetData.type === 'diagram' && typeof assetData.data === 'string') {
             markdownLog = `DIAGRAM SOURCE:\n\`\`\`mermaid\n${assetData.data}\n\`\`\``;
          }

          if (markdownLog) {
             addSystemMessage(markdownLog);
          }

        } else {
           throw new Error("Generation returned empty result");
        }
      } catch (error: any) {
         console.error("Asset Generation Error:", error);
         // Display user-friendly error in chat
         const friendlyMsg = getFriendlyErrorMessage(error);
         addSystemMessage(`Error: Failed to generate ${type}. ${friendlyMsg}`);
      } finally {
        setIsProcessing(false);
      }
    };

    processQueue();
  }, [assetQueue, isProcessing]);

  const approveProposedAsset = () => {
    if (proposedAsset) {
      setAssetQueue(prev => [...prev, proposedAsset]);
      setProposedAsset(null);
    }
  };

  const dismissProposedAsset = () => {
    setProposedAsset(null);
  };

  return {
    assets,
    activeAssetId,
    setActiveAssetId,
    proposedAsset,
    setProposedAsset,
    assetQueue,
    isProcessing,
    approveProposedAsset,
    dismissProposedAsset,
    queueAsset: (type: string, description: string) => setAssetQueue(prev => [...prev, { type, description }])
  };
}
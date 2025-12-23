
import { useState, useEffect, useRef } from 'react';
import { Avatar3D } from './components/Avatar3D';
import { AssetDisplay } from './components/AssetDisplay';
import { AdminPanel } from './components/AdminPanel';
import { Header } from './components/Header';
import { SidebarLogs } from './components/SidebarLogs';
import { ControlFooter } from './components/ControlFooter';

import { analyzeInteraction } from './services/assets';
import { ConnectionState } from './services/client';

import type { 
  KnowledgeDocument, 
  SystemAlert, 
  AppState, 
  ChatMessage
} from './types';
import { MessageRole } from './types';

// Hooks
import { useAudioAnalysis } from './hooks/useAudioAnalysis';
import { useAssetManager } from './hooks/useAssetManager';
import { useMaritimeSession } from './hooks/useMaritimeSession';

export default function App() {
  // --- UI STATE ---
  const [appState, setAppState] = useState<AppState>({
    isListening: false, isSpeaking: false, isProcessing: false,
    explanatoryMode: false, ragMode: false, activeAssetId: null,
    nightMode: localStorage.getItem('maritime_night_mode') === 'true'
  });
  
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(() => localStorage.getItem('maritime_admin_open') === 'true');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- CUSTOM HOOKS ---
  const { audioContextRef, analyserRef, audioLevelRef, ensureAudioContext } = useAudioAnalysis();
  const { 
    messages, addMessage, connectionState, userIsSpeaking, isSpeaking, startSession, stopSession 
  } = useMaritimeSession({ audioContextRef, analyserRef, ensureAudioContext });
  
  const { 
    assets, activeAssetId, setActiveAssetId, proposedAsset, setProposedAsset, 
    assetQueue, isProcessing, approveProposedAsset, dismissProposedAsset, queueAsset
  } = useAssetManager((text) => addMessage(MessageRole.SYSTEM, text));

  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- EFFECTS ---
  useEffect(() => {
    localStorage.setItem('maritime_admin_open', String(isAdminOpen));
  }, [isAdminOpen]);

  useEffect(() => {
    localStorage.setItem('maritime_night_mode', String(appState.nightMode));
  }, [appState.nightMode]);

  useEffect(() => {
    setAppState(prev => ({
        ...prev,
        isListening: connectionState === ConnectionState.CONNECTED,
        isProcessing: connectionState === ConnectionState.CONNECTING || isProcessing,
        isSpeaking: isSpeaking,
        activeAssetId: activeAssetId
    }));
  }, [connectionState, isProcessing, isSpeaking, activeAssetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userIsSpeaking, isSpeaking, isProcessing]);

  useEffect(() => {
    if (localStorage.getItem('maritime_autoconnect') === 'true') {
        handleStartSession();
    }
  }, []);

  const handleStartSession = (overrideRag?: boolean) => {
    const mode = overrideRag ?? appState.ragMode;
    startSession(documents, mode, handleTurnComplete);
  };

  const handleTurnComplete = async () => {
    const msgs = messagesRef.current; 
    const lastUser = [...msgs].reverse().find(m => m.role === MessageRole.USER);
    const lastModel = [...msgs].reverse().find(m => m.role === MessageRole.ASSISTANT);

    if (lastUser && lastModel) {
        const result = await analyzeInteraction(lastUser.content, lastModel.content);
        
        if (!result.isMaritime) {
           setAlerts(prev => [...prev, {
             id: crypto.randomUUID(), query: lastUser.content, timestamp: Date.now(), reason: "Out of Domain"
           }]);
        } else if (result.missingKnowledge) {
           setAlerts(prev => [...prev, {
             id: crypto.randomUUID(), query: lastUser.content, timestamp: Date.now(), reason: "Missing Knowledge (RAG)"
           }]);
        }
        
        if (result.assetNeeded && result.assetType !== 'none') {
            if (result.reason === 'user_request') {
                queueAsset(result.assetType, result.assetDescription, result.reason);
            } else {
                setProposedAsset({ 
                  type: result.assetType, 
                  description: result.assetDescription,
                  reason: result.reason
                });
            }
        }
    }
  };

  const handleToggleRag = async () => {
    const newRag = !appState.ragMode;
    setAppState(prev => ({ ...prev, ragMode: newRag }));
    if (connectionState === ConnectionState.CONNECTED) {
        addMessage(MessageRole.SYSTEM, newRag ? "Kernel: Initializing RAG Context..." : "Kernel: Purging Local Knowledge Base...");
        await stopSession();
        setTimeout(() => handleStartSession(newRag), 500);
    }
  };

  const toggleNightMode = () => {
    setAppState(prev => ({ ...prev, nightMode: !prev.nightMode }));
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;

  return (
    <div className={`flex h-screen w-screen bg-black text-white overflow-hidden relative transition-colors duration-500 ${appState.nightMode ? 'night-ops' : ''}`}>
      {/* HUD OVERLAY - Scanline & Grain effect */}
      <div className="scanline" />
      <div className="grain-overlay" />
      
      {/* 3D SCENE */}
      <div className="absolute inset-0 z-0">
        <Avatar3D 
          state={
            appState.isSpeaking ? 'speaking' 
            : userIsSpeaking ? 'listening' 
            : (appState.isProcessing) ? 'processing' 
            : 'idle'
          } 
          audioLevelRef={audioLevelRef}
          nightMode={appState.nightMode}
        />
      </div>

      <Header 
        isConnected={isConnected} 
        nightMode={appState.nightMode}
        onOpenAdmin={() => setIsAdminOpen(true)} 
        onToggleNightMode={toggleNightMode}
      />

      <SidebarLogs 
        messages={messages}
        ragMode={appState.ragMode}
        explanatoryMode={appState.explanatoryMode}
        isProcessing={appState.isProcessing}
        assetQueueLength={assetQueue.length}
        proposedAsset={proposedAsset}
        onToggleRag={handleToggleRag}
        onToggleExplanatory={() => setAppState(p => ({...p, explanatoryMode: !p.explanatoryMode}))}
        onApproveAsset={approveProposedAsset}
        onDismissAsset={dismissProposedAsset}
        messagesEndRef={messagesEndRef}
      />

      <ControlFooter 
        isConnected={isConnected}
        connectionState={connectionState}
        userIsSpeaking={userIsSpeaking}
        isSpeaking={appState.isSpeaking}
        nightMode={appState.nightMode}
        onToggleConnection={() => isConnected ? stopSession() : handleStartSession()}
      />

      <AssetDisplay 
        asset={assets.find(a => a.id === activeAssetId) || null} 
        onClose={() => setActiveAssetId(null)}
      />

      {isAdminOpen && (
        <AdminPanel 
          documents={documents} alerts={alerts}
          nightMode={appState.nightMode}
          onUpload={(n, c) => setDocuments(p => [...p, {id: crypto.randomUUID(), name: n, content: c, uploadedAt: Date.now()}])}
          onDelete={(id) => setDocuments(p => p.filter(d => d.id !== id))}
          onClose={() => setIsAdminOpen(false)}
        />
      )}
    </div>
  );
}

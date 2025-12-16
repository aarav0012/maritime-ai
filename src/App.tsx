import React, { useState, useEffect, useRef } from 'react';
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
    explanatoryMode: false, ragMode: false, activeAssetId: null
  });
  
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [isAdminOpen, setIsAdminOpen] = useState(() => localStorage.getItem('maritime_admin_open') === 'true');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- CUSTOM HOOKS ---
  const { audioContextRef, analyserRef, audioLevelRef, ensureAudioContext } = useAudioAnalysis();
  const { 
    messages, setMessages, addMessage, connectionState, userIsSpeaking, isSpeaking, startSession, stopSession 
  } = useMaritimeSession({ audioContextRef, analyserRef, ensureAudioContext });
  
  const { 
    assets, activeAssetId, setActiveAssetId, proposedAsset, setProposedAsset, 
    assetQueue, isProcessing, approveProposedAsset, dismissProposedAsset, queueAsset
  } = useAssetManager((text) => addMessage(MessageRole.SYSTEM, text));

  // --- REFS FOR STALE CLOSURE FIX ---
  // We need a ref to access the latest messages inside the 'handleTurnComplete' callback
  // because that callback is defined once and passed to the long-lived session client.
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // --- EFFECTS & HANDLERS ---
  
  useEffect(() => {
    localStorage.setItem('maritime_admin_open', String(isAdminOpen));
  }, [isAdminOpen]);

  // Sync Hook State to App State for UI
  useEffect(() => {
    setAppState(prev => ({
        ...prev,
        isListening: connectionState === ConnectionState.CONNECTED,
        isProcessing: connectionState === ConnectionState.CONNECTING || isProcessing,
        isSpeaking: isSpeaking,
        activeAssetId: activeAssetId
    }));
  }, [connectionState, isProcessing, isSpeaking, activeAssetId]);

  // Auto-Scroll Logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, userIsSpeaking, isSpeaking, isProcessing, assetQueue.length]);

  // Auto-Connect on Mount
  useEffect(() => {
    if (localStorage.getItem('maritime_autoconnect') === 'true') {
        handleStartSession();
    }
  }, []);

  const handleStartSession = (overrideRag?: boolean) => {
    const mode = overrideRag ?? appState.ragMode;
    startSession(documents, mode, handleTurnComplete);
  };

  // Background Analysis Logic
  // This function is called by the session client when a turn completes.
  const handleTurnComplete = async () => {
    // CRITICAL FIX: Use the ref to get the LATEST messages. 
    // Using 'messages' state directly here would be stale (empty) due to closure capture.
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
           // Alert Admin to add this data
           setAlerts(prev => [...prev, {
             id: crypto.randomUUID(), query: lastUser.content, timestamp: Date.now(), reason: "Missing Knowledge (RAG)"
           }]);
        }
        
        if (result.assetNeeded && result.assetType !== 'none') {
            // Auto-generate if explicitly requested, otherwise propose
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
        addMessage(MessageRole.SYSTEM, newRag ? "Switching to RAG Mode..." : "Disabling RAG Mode...");
        await stopSession();
        setTimeout(() => handleStartSession(newRag), 500);
    }
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;

  // --- RENDER ---
  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden relative">
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
        />
      </div>

      <Header 
        isConnected={isConnected} 
        onOpenAdmin={() => setIsAdminOpen(true)} 
      />

      <SidebarLogs 
        messages={messages}
        ragMode={appState.ragMode}
        explanatoryMode={appState.explanatoryMode}
        isProcessing={isProcessing}
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
        onToggleConnection={() => isConnected ? stopSession() : handleStartSession()}
      />

      <AssetDisplay 
        asset={assets.find(a => a.id === activeAssetId) || null} 
        onClose={() => setActiveAssetId(null)}
      />

      {isAdminOpen && (
        <AdminPanel 
          documents={documents} alerts={alerts}
          onUpload={(n, c) => setDocuments(p => [...p, {id: crypto.randomUUID(), name: n, content: c, uploadedAt: Date.now()}])}
          onDelete={(id) => setDocuments(p => p.filter(d => d.id !== id))}
          onClose={() => setIsAdminOpen(false)}
        />
      )}
    </div>
  );
}

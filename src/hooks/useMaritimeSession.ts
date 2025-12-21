import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { MaritimeLiveClient, ConnectionState } from '../services/client';
import { convertPCMToAudioBuffer } from '../services/audio';
import { getFriendlyErrorMessage } from '../services/utils';
import type { ChatMessage, KnowledgeDocument } from '../types';
import { MessageRole } from '../types';

interface UseMaritimeSessionProps {
  audioContextRef: MutableRefObject<AudioContext | null>;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  ensureAudioContext: () => Promise<{ ctx: AudioContext, analyser: AnalyserNode }>;
}

export function useMaritimeSession({ audioContextRef, analyserRef, ensureAudioContext }: UseMaritimeSessionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 

  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const liveClientRef = useRef<MaritimeLiveClient | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number>(0); 
  
  const activeMessageIds = useRef<{ user: string | null, model: string | null }>({ user: null, model: null });
  const activeAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  const addMessage = (role: MessageRole, content: string) => {
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now()
    }]);
  };

  const stopAllAudio = () => {
    activeAudioSources.current.forEach(source => {
        try { source.stop(); } catch(e) {}
    });
    activeAudioSources.current.clear();
    setIsSpeaking(false);
    
    if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  const playAudioChunk = (pcmData: ArrayBuffer) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
    }
    
    const audioBuffer = convertPCMToAudioBuffer(ctx, pcmData);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    
    if (analyserRef.current) {
      source.connect(analyserRef.current);
    } else {
      source.connect(ctx.destination);
    }
    
    // SAFARI / IOS COMPATIBILITY:
    // We add a 25ms safety margin (0.025) to prevent the "buffer starvation" clicks common on Mac hardware
    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.025;
    }
    
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
    
    activeAudioSources.current.add(source);
    setIsSpeaking(true);
    
    source.onended = () => {
        activeAudioSources.current.delete(source);
        if (activeAudioSources.current.size === 0) {
             setIsSpeaking(false);
        }
    };
  };

  const startSession = async (documents: KnowledgeDocument[], ragMode: boolean, onTurnComplete?: () => void) => {
    const currentAttemptId = crypto.randomUUID();
    activeSessionIdRef.current = currentAttemptId;
    sessionStartTimeRef.current = Date.now();

    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }

    if (liveClientRef.current) {
        const oldClient = liveClientRef.current;
        liveClientRef.current = null;
        try { await oldClient.disconnect(); } catch (e) {}
    }
    
    stopAllAudio();

    try {
        await ensureAudioContext();
        if (audioContextRef.current) {
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }
    } catch (e) {
        addMessage(MessageRole.SYSTEM, "Error: Audio System Failed.");
        return;
    }

    if (activeSessionIdRef.current !== currentAttemptId) return;

    activeMessageIds.current = { user: null, model: null };

    const client = new MaritimeLiveClient({
      onStateChange: (state) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        setConnectionState(state);
        if (state === ConnectionState.CONNECTED) {
            localStorage.setItem('maritime_autoconnect', 'true');
            addMessage(MessageRole.SYSTEM, ragMode ? "✓ System Online [RAG MODE ACTIVE]." : "✓ System Online.");
        }
        if (state === ConnectionState.DISCONNECTED) {
            const shouldReconnect = localStorage.getItem('maritime_autoconnect') === 'true';
            if (shouldReconnect && (Date.now() - sessionStartTimeRef.current > 10000)) {
                addMessage(MessageRole.SYSTEM, "Connection lost. Reconnecting...");
                reconnectTimeoutRef.current = window.setTimeout(() => {
                    if (activeSessionIdRef.current === currentAttemptId) startSession(documents, ragMode, onTurnComplete);
                }, 3000);
            }
        }
      },
      onAudioData: (data) => {
          if (activeSessionIdRef.current === currentAttemptId) playAudioChunk(data);
      },
      onTranscript: (user, model) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        setMessages(prev => {
          const newHistory = [...prev];
          if (user) {
             const activeId = activeMessageIds.current.user;
             if (activeId) {
                const msg = newHistory.find(m => m.id === activeId);
                if (msg) msg.content = user;
             } else {
                const newId = crypto.randomUUID();
                activeMessageIds.current.user = newId;
                newHistory.push({ id: newId, role: MessageRole.USER, content: user, timestamp: Date.now() });
             }
          }
          if (model) {
             const activeId = activeMessageIds.current.model;
             if (activeId) {
                const msg = newHistory.find(m => m.id === activeId);
                if (msg) msg.content = model;
             } else {
                const newId = crypto.randomUUID();
                activeMessageIds.current.model = newId;
                newHistory.push({ id: newId, role: MessageRole.ASSISTANT, content: model, timestamp: Date.now() });
             }
          }
          return newHistory;
        });
      },
      onTurnComplete: async () => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        activeMessageIds.current.user = null;
        activeMessageIds.current.model = null;
        if (onTurnComplete) onTurnComplete();
      },
      onInterrupted: () => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        stopAllAudio();
        activeMessageIds.current.user = null;
        activeMessageIds.current.model = null;
      },
      onVolumeChange: (vol) => {
          if (activeSessionIdRef.current === currentAttemptId) setUserIsSpeaking(vol > 0.01);
      },
      onError: (err) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        const msg = getFriendlyErrorMessage(err);
        addMessage(MessageRole.SYSTEM, `Error: ${msg}`);
      }
    });

    const docContents = ragMode ? documents.map(d => `[SOURCE DOCUMENT: ${d.name}]\n${d.content}`) : [];
    try {
        await client.connect(docContents, ragMode);
    } catch (e) {
        if (activeSessionIdRef.current === currentAttemptId) {
            setConnectionState(ConnectionState.DISCONNECTED);
            localStorage.setItem('maritime_autoconnect', 'false');
        }
    }
    if (activeSessionIdRef.current === currentAttemptId) liveClientRef.current = client;
  };

  const stopSession = async () => {
    activeSessionIdRef.current = null;
    localStorage.setItem('maritime_autoconnect', 'false');
    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }
    if (liveClientRef.current) {
        const client = liveClientRef.current;
        liveClientRef.current = null;
        await client.disconnect();
    }
    stopAllAudio();
    activeMessageIds.current = { user: null, model: null };
    setConnectionState(ConnectionState.DISCONNECTED);
  };

  return {
    connectionState,
    messages,
    setMessages, 
    addMessage,
    userIsSpeaking,
    isSpeaking,
    isProcessing: false,
    startSession,
    stopSession
  };
}
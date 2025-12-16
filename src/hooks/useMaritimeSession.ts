import { useState, useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { MaritimeLiveClient, ConnectionState } from '../services/client';
import { generateBrainResponse } from '../services/assets';
import { convertPCMToAudioBuffer } from '../services/audio';
import { getFriendlyErrorMessage } from '../services/utils';
import type{ ChatMessage, KnowledgeDocument } from '../types';
import { MessageRole } from '../types';

interface UseMaritimeSessionProps {
  audioContextRef: MutableRefObject<AudioContext | null>;
  analyserRef: MutableRefObject<AnalyserNode | null>;
  ensureAudioContext: () => Promise<{ ctx: AudioContext, analyser: AnalyserNode }>;
}

type ProcessingStage = 'idle' | 'listening' | 'thinking' | 'replying';

export function useMaritimeSession({ audioContextRef, analyserRef, ensureAudioContext }: UseMaritimeSessionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userIsSpeaking, setUserIsSpeaking] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');

  // We need current messages for RAG context, accessible inside closures
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const liveClientRef = useRef<MaritimeLiveClient | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  const activeSessionIdRef = useRef<string | null>(null);
  const sessionStartTimeRef = useRef<number>(0); 
  
  // Track accumulated transcript for the current turn
  const accumulatedUserRef = useRef<string>('');
  
  const activeMessageIds = useRef<{ user: string | null, model: string | null }>({ user: null, model: null });
  const activeAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const reconnectTimeoutRef = useRef<number | null>(null);
  
  // Store documents for RAG calls
  const documentsRef = useRef<KnowledgeDocument[]>([]);

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
    
    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.01; 
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
    documentsRef.current = documents;

    // TRACK START TIME OF ATTEMPT
    sessionStartTimeRef.current = Date.now();

    if (ragMode && documents.length === 0) {
        addMessage(MessageRole.SYSTEM, 'Knowledge Base is empty. RAG mode is enabled but no documents are available.');
    }

    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }

    if (liveClientRef.current) {
        const oldClient = liveClientRef.current;
        liveClientRef.current = null;
        try {
            await oldClient.disconnect();
        } catch (e) {
            console.warn("Error disconnecting previous client:", e);
        }
    }
    
    stopAllAudio();

    try {
        await ensureAudioContext();
        if (audioContextRef.current) {
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }
    } catch (e) {
        console.error("Audio Context Failed", e);
        addMessage(MessageRole.SYSTEM, "Error: Audio System Failed.");
        return;
    }

    if (activeSessionIdRef.current !== currentAttemptId) return;

    activeMessageIds.current = { user: null, model: null };
    accumulatedUserRef.current = '';
    setProcessingStage('idle');

    const client = new MaritimeLiveClient({
      onStateChange: (state) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;

        setConnectionState(state);
        if (state === ConnectionState.CONNECTED) {
            setProcessingStage('listening');
            localStorage.setItem('maritime_autoconnect', 'true');
            addMessage(MessageRole.SYSTEM, ragMode 
                ? "✓ System Online [RAG MODE ACTIVE]." 
                : "✓ System Online.");
        }
        
        if (state === ConnectionState.DISCONNECTED) {
            setProcessingStage('idle');
            const sessionDuration = Date.now() - sessionStartTimeRef.current;
            const shouldReconnect = localStorage.getItem('maritime_autoconnect') === 'true';

            // LOOP PROTECTION
            if (shouldReconnect) {
                if (sessionDuration > 10000) {
                    addMessage(MessageRole.SYSTEM, "Connection lost. Reconnecting...");
                    reconnectTimeoutRef.current = window.setTimeout(() => {
                        if (activeSessionIdRef.current === currentAttemptId) {
                            startSession(documentsRef.current, ragMode, onTurnComplete);
                        }
                    }, 3000);
                } else {
                    addMessage(MessageRole.SYSTEM, "Connection unstable (Immediate Disconnect). Auto-reconnect paused.");
                    localStorage.setItem('maritime_autoconnect', 'false');
                }
            }
        }
      },
      onAudioData: (data) => {
          if (activeSessionIdRef.current === currentAttemptId) {
             // We play audio, but we could mute it during 'thinking' if we wanted to block the "Copy" response.
             // For feedback, hearing "Copy" is good.
             playAudioChunk(data);
          }
      },
      onTranscript: (user, model) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        
        if (user) accumulatedUserRef.current = user;

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
        
        // LOGIC FOR SPLIT ARCHITECTURE
        // 1. If we are 'listening', this turnComplete is likely the Relay saying "Copy".
        //    We must now trigger the Brain.
        // 2. If we are 'replying', this turnComplete is the Relay finishing reading the Brain's answer.
        //    We go back to listening.
        
        setProcessingStage(currentStage => {
            if (currentStage === 'listening') {
                // The user finished speaking, Relay said "Copy". Now we think.
                const userQuery = accumulatedUserRef.current;
                if (userQuery && userQuery.trim().length > 1) {
                    
                    // Trigger Background Brain
                    const docContents = documentsRef.current.map(d => `[DOC: ${d.name}]\n${d.content}`);
                    const history = messagesRef.current.map(m => ({role: m.role, content: m.content}));
                    
                    // We must execute this async but outside the state setter
                    setTimeout(async () => {
                         setProcessingStage('thinking');
                         // Generate Answer
                         const answer = await generateBrainResponse(userQuery, docContents, history);
                         
                         // Send to Relay
                         if (activeSessionIdRef.current === currentAttemptId) {
                             setProcessingStage('replying');
                             client.sendText("SYSTEM_RESPONSE: " + answer);
                             accumulatedUserRef.current = ''; // Clear for next turn
                             
                             // Also trigger analysis for visuals (Side Effect)
                             if (onTurnComplete) onTurnComplete();
                         }
                    }, 10);
                }
                return 'thinking';
            } else if (currentStage === 'replying') {
                // Relay finished speaking the system response.
                activeMessageIds.current.user = null;
                activeMessageIds.current.model = null;
                return 'listening';
            }
            return currentStage;
        });
      },
      onInterrupted: () => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        stopAllAudio();
        activeMessageIds.current.user = null;
        activeMessageIds.current.model = null;
        setProcessingStage('listening');
      },
      onVolumeChange: (vol) => {
          if (activeSessionIdRef.current === currentAttemptId) setUserIsSpeaking(vol > 0.01);
      },
      onError: (err) => {
        if (activeSessionIdRef.current !== currentAttemptId) return;
        const msg = getFriendlyErrorMessage(err);
        addMessage(MessageRole.SYSTEM, `Error: ${msg}`);
        
        if (msg.includes('Quota') || msg.includes('Billing')) {
            localStorage.setItem('maritime_autoconnect', 'false');
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        }
      }
    });

    // CONNECT WITHOUT DOCUMENTS (LIGHTWEIGHT)
    try {
        await client.connect();
    } catch (e) {
        if (activeSessionIdRef.current === currentAttemptId) {
            console.error("Connection failed", e);
            const msg = getFriendlyErrorMessage(e);
            addMessage(MessageRole.SYSTEM, `Error: ${msg}`);
            setConnectionState(ConnectionState.DISCONNECTED);
            localStorage.setItem('maritime_autoconnect', 'false');
        }
        return;
    }

    if (activeSessionIdRef.current !== currentAttemptId) {
        client.disconnect();
        return;
    }

    liveClientRef.current = client;
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
    setProcessingStage('idle');
  };

  return {
    connectionState,
    messages,
    setMessages, 
    addMessage,
    userIsSpeaking,
    isSpeaking,
    isProcessing: processingStage === 'thinking', // Expose processing state for UI loader
    startSession,
    stopSession
  };
}

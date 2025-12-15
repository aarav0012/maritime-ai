import { useState, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { MaritimeLiveClient, ConnectionState, convertPCMToAudioBuffer, getFriendlyErrorMessage } from '../services/gemini';
import { MessageRole } from '../types';
import type { KnowledgeDocument, ChatMessage } from '../types';

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

  const liveClientRef = useRef<MaritimeLiveClient | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  // SESSION LOCK: This tracks the specific ID of the current valid session attempt.
  // If this changes during an async operation, the operation aborts immediately.
  const activeSessionIdRef = useRef<string | null>(null);
  
  const activeMessageIds = useRef<{ user: string | null, model: string | null }>({ user: null, model: null });
  const activeAudioSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const reconnectTimeoutRef = useRef<number | null>(null);

  // --- HELPER FUNCTIONS ---

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
    
    // Ensure context is running (vital for low latency start)
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
    // LATENCY OPTIMIZATION:
    // Tighten the scheduling buffer. 
    // If the play cursor is behind current time (start of speech or underrun),
    // snap it to now + 10ms (minimal safety buffer) instead of 50ms.
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

  // --- CORE SESSION LOGIC ---

  const startSession = async (documents: KnowledgeDocument[], ragMode: boolean, onTurnComplete?: () => void) => {
    // 1. Generate a Unique ID for THIS specific connection attempt
    const currentAttemptId = crypto.randomUUID();
    activeSessionIdRef.current = currentAttemptId;

    // 2. Clear any pending reconnect timers
    if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
    }

    // 3. Forcefully clean up any previous client
    if (liveClientRef.current) {
        liveClientRef.current.disconnect().catch(() => {});
        liveClientRef.current = null;
    }
    
    stopAllAudio();

    // 4. Initialize Audio Context (Async Step 1)
    try {
        await ensureAudioContext();
        if (audioContextRef.current) {
            nextStartTimeRef.current = audioContextRef.current.currentTime;
        }
    } catch (e) {
        console.error("Audio Context Failed", e);
        addMessage(MessageRole.SYSTEM, "Error: Audio System Failed. Please refresh.");
        return;
    }

    // GUARD: Check if user cancelled/restarted while we were awaiting audio
    if (activeSessionIdRef.current !== currentAttemptId) {
        console.log("Session aborted during audio init");
        return; 
    }

    activeMessageIds.current = { user: null, model: null };

    // 5. Create Client Instance
    const client = new MaritimeLiveClient({
      onStateChange: (state) => {
        // GUARD: Only allow updates from the active session
        if (activeSessionIdRef.current !== currentAttemptId) return;

        setConnectionState(state);
        
        if (state === ConnectionState.CONNECTED) {
            localStorage.setItem('maritime_autoconnect', 'true');
            addMessage(MessageRole.SYSTEM, ragMode 
                ? "✓ System Connected [RAG MODE ACTIVE]. Restricted Protocols engaged." 
                : "✓ System Connected. Standard Protocols engaged.");
        }
        
        if (state === ConnectionState.DISCONNECTED) {
            if (localStorage.getItem('maritime_autoconnect') === 'true') {
                 addMessage(MessageRole.SYSTEM, "Connection lost. Reconnecting...");
                 reconnectTimeoutRef.current = window.setTimeout(() => {
                     // Check if we are still the "active" intent before triggering restart
                     if (activeSessionIdRef.current === currentAttemptId) {
                         startSession(documents, ragMode, onTurnComplete);
                     }
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
          // ... (User/Model transcript logic same as before) ...
          if (user) {
             const activeId = activeMessageIds.current.user;
             if (activeId) {
                const msg = newHistory.find(m => m.id === activeId);
                if (msg) msg.content = user;
                else {
                    const newId = crypto.randomUUID();
                    activeMessageIds.current.user = newId;
                    newHistory.push({ id: newId, role: MessageRole.USER, content: user, timestamp: Date.now() });
                }
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
                else {
                    const newId = crypto.randomUUID();
                    activeMessageIds.current.model = newId;
                    newHistory.push({ id: newId, role: MessageRole.ASSISTANT, content: model, timestamp: Date.now() });
                }
             } else {
                const newId = crypto.randomUUID();
                activeMessageIds.current.model = newId;
                newHistory.push({ id: newId, role: MessageRole.ASSISTANT, content: model, timestamp: Date.now() });
             }
          }
          return newHistory;
        });
      },
      onTurnComplete: () => {
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

    // 6. Connect to API (Async Step 2)
    const docs = ragMode ? documents.map(d => `[SOURCE DOCUMENT: ${d.name}]\n${d.content}`) : [];
    
    try {
        await client.connect(docs, ragMode);
    } catch (e) {
        if (activeSessionIdRef.current === currentAttemptId) {
            console.error("Connection failed", e);
            const msg = getFriendlyErrorMessage(e);
            addMessage(MessageRole.SYSTEM, `Error: ${msg}`);
            setConnectionState(ConnectionState.DISCONNECTED);
        }
        return;
    }

    // GUARD: Final check before setting the ref
    if (activeSessionIdRef.current !== currentAttemptId) {
        console.log("Session aborted after connection established");
        client.disconnect(); // Immediately kill the orphaned connection
        return;
    }

    // Success
    liveClientRef.current = client;
  };

  const stopSession = async () => {
    // 1. Invalidate any pending connection attempts immediately
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
    startSession,
    stopSession
  };
}
import { LiveServerMessage, Modality } from "@google/genai";
import { ai, checkApiKey } from './config';
import { createPcmBlob, base64ToPCM, downsampleTo16k } from './audio';
import { BASE_INSTRUCTION_RAG, BASE_INSTRUCTION_STANDARD, VISUAL_PROTOCOL } from './prompts';

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING'
}

export class MaritimeLiveClient {
  public state: ConnectionState = ConnectionState.DISCONNECTED;
  
  private sessionPromise: Promise<any> | null = null;
  private inputContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  
  private eventHandlers: {
    onAudioData: (data: ArrayBuffer) => void;
    onTranscript: (user: string, model: string) => void;
    onTurnComplete: () => void;
    onInterrupted: () => void;
    onVolumeChange: (vol: number) => void;
    onStateChange?: (state: ConnectionState) => void;
    onError?: (error: Error) => void;
  } | null;
  
  private currentInputTranscript = '';
  private currentOutputTranscript = '';

  constructor(handlers: {
    onAudioData: (data: ArrayBuffer) => void;
    onTranscript: (user: string, model: string) => void;
    onTurnComplete: () => void;
    onInterrupted: () => void;
    onVolumeChange: (vol: number) => void;
    onStateChange?: (state: ConnectionState) => void;
    onError?: (error: Error) => void;
  }) {
    this.eventHandlers = handlers;
  }

  private setState(newState: ConnectionState) {
    this.state = newState;
    this.eventHandlers?.onStateChange?.(newState);
    console.log(`[MaritimeLiveClient] State: ${newState}`);
  }

  async connect(contextDocs: string[], isRagMode: boolean) {
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
        return;
    }

    if (!checkApiKey()) {
        throw new Error("API Key is missing in environment variables.");
    }

    this.setState(ConnectionState.CONNECTING);

    let docsText = "NO DOCUMENTS LOADED. DATABASE IS EMPTY.";
    if (contextDocs.length > 0) {
        const fullText = contextDocs.join('\n\n');
        if (fullText.length > 25000) {
            docsText = fullText.substring(0, 25000) + "\n\n[...SYSTEM NOTE: REMAINING DATA TRUNCATED...]";
        } else {
            docsText = fullText;
        }
    }

    const baseInstruction = isRagMode 
      ? BASE_INSTRUCTION_RAG.replace('{{DOCUMENTS}}', docsText)
      : BASE_INSTRUCTION_STANDARD;
    
    const finalInstruction = baseInstruction + "\n\n" + VISUAL_PROTOCOL;

    try {
      this.sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          systemInstruction: { parts: [{ text: finalInstruction }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            this.startAudioInput().then(() => {
                if (this.state === ConnectionState.CONNECTING) {
                    this.setState(ConnectionState.CONNECTED);
                } else {
                    this.cleanupLocalResources();
                }
            }).catch(e => {
                console.error("Audio Input Failed", e);
                this.eventHandlers?.onError?.(new Error("Microphone initialization failed."));
                this.disconnect();
            });
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => {
            this.cleanupLocalResources();
            if (this.state !== ConnectionState.DISCONNECTED) {
               this.setState(ConnectionState.DISCONNECTED);
            }
          },
          onerror: (err) => {
            this.eventHandlers?.onError?.(new Error(err.message || "Connection disrupted"));
            this.disconnect(); 
          },
        }
      });
      
      const session = await this.sessionPromise;
      if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
          await session.close();
          this.sessionPromise = null;
          return;
      }
    } catch (error) {
      this.setState(ConnectionState.DISCONNECTED);
      this.eventHandlers?.onError?.(error instanceof Error ? error : new Error("Connection failed"));
      throw error; 
    }
  }

  private handleMessage(message: LiveServerMessage) {
    if (this.state !== ConnectionState.CONNECTED || !this.eventHandlers) return;

    try {
      if (message.serverContent?.interrupted) {
         this.eventHandlers.onInterrupted();
         this.currentInputTranscript = '';
         this.currentOutputTranscript = '';
      }

      const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const pcmData = base64ToPCM(base64Audio);
        this.eventHandlers.onAudioData(pcmData);
      }

      if (message.serverContent?.outputTranscription) {
        this.currentOutputTranscript += message.serverContent.outputTranscription.text;
        this.eventHandlers.onTranscript(this.currentInputTranscript, this.currentOutputTranscript);
      }
      if (message.serverContent?.inputTranscription) {
        this.currentInputTranscript += message.serverContent.inputTranscription.text;
        this.eventHandlers.onTranscript(this.currentInputTranscript, this.currentOutputTranscript);
      }

      if (message.serverContent?.turnComplete) {
        this.eventHandlers.onTurnComplete();
        this.currentInputTranscript = '';
        this.currentOutputTranscript = '';
      }
    } catch (e) {
      console.error("Error processing message:", e);
    }
  }

  private async startAudioInput() {
    // FIX: Do NOT force 16kHz here on Mac/iOS. Use the hardware-native rate.
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({
      latencyHint: 'interactive'
    });
    
    const nativeSampleRate = this.inputContext.sampleRate;
    console.log(`[MaritimeLiveClient] Hardware Native Rate: ${nativeSampleRate}Hz`);

    if (this.inputContext.state === 'suspended') {
      await this.inputContext.resume();
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    });
    
    if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
        this.stream.getTracks().forEach(t => t.stop());
        return; 
    }

    let activeSession: any = null;
    this.sessionPromise?.then(session => activeSession = session);

    this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(2048, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (this.state !== ConnectionState.CONNECTED || !activeSession || !this.eventHandlers) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      this.eventHandlers.onVolumeChange(rms);

      try {
          // FIX: Manual downsample from Hardware Native Rate to 16kHz API requirement
          const downsampled = downsampleTo16k(inputData, nativeSampleRate);
          const pcmBlob = createPcmBlob(downsampled, 16000);
          activeSession.sendRealtimeInput({ media: pcmBlob });
      } catch (err: any) {
          if (!(err.message && (err.message.includes('CLOSING') || err.message.includes('CLOSED')))) {
             console.warn("Real-time audio send failed", err);
          }
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  async disconnect() {
    if (this.state === ConnectionState.DISCONNECTED) return;
    this.setState(ConnectionState.DISCONNECTING);
    this.eventHandlers = null;
    await this.cleanupLocalResources();
    if (this.sessionPromise) {
        try {
            const session = await this.sessionPromise;
            await session.close();
        } catch (e) {}
        this.sessionPromise = null;
    }
    this.state = ConnectionState.DISCONNECTED;
  }

  private async cleanupLocalResources() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null; 
      this.processor = null;
    }
    if (this.inputSource) {
      this.inputSource.disconnect();
      this.inputSource = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.inputContext) {
      try { await this.inputContext.close(); } catch(e) {}
      this.inputContext = null;
    }
  }

  sendText(text: string) {
      if (this.state === ConnectionState.CONNECTED && this.sessionPromise) {
          this.sessionPromise.then(session => {
            try { session.sendRealtimeInput({ text }); } catch(e) {}
          });
      }
  }
}
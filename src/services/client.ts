import { LiveServerMessage, Modality } from "@google/genai";
import { ai, checkApiKey } from './config';
import { createPcmBlob, base64ToPCM } from './audio';
import { LIVE_RELAY_INSTRUCTION } from './prompts';

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING'
}

export class MaritimeLiveClient {
  public state: ConnectionState = ConnectionState.DISCONNECTED;
  
  private session: any = null;
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

  // UPDATED: No document passing here. This is a dumb relay.
  async connect() {
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
        return;
    }

    if (!checkApiKey()) {
        throw new Error("API Key is missing in environment variables.");
    }

    this.setState(ConnectionState.CONNECTING);

    try {
      // Use standard systemInstruction object format for maximum compatibility
      const session = await ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseModalities: [Modality.AUDIO], 
          systemInstruction: { parts: [{ text: LIVE_RELAY_INSTRUCTION }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Session Opened");
            this.startAudioInput().then(() => {
                if (this.state === ConnectionState.CONNECTING) {
                    this.setState(ConnectionState.CONNECTED);
                } else {
                    console.warn("Session closed during audio init. Aborting.");
                    this.cleanupLocalResources();
                }
            }).catch(e => {
                console.error("Audio Input Failed", e);
                this.eventHandlers?.onError?.(new Error("Microphone initialization failed."));
                this.disconnect();
            });
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: (e) => {
            console.log("Session Closed from Server", e);
            
            // FATAL ERROR DETECTION
            if (e.reason && (e.reason.toLowerCase().includes('quota') || e.reason.toLowerCase().includes('billing'))) {
                 this.eventHandlers?.onError?.(new Error(`Billing Quota Exceeded: ${e.reason}`));
            } else if (e.code === 1009) {
                 this.eventHandlers?.onError?.(new Error(`Data Payload Too Large.`));
            }

            this.cleanupLocalResources();
            if (this.state !== ConnectionState.DISCONNECTED) {
               this.setState(ConnectionState.DISCONNECTED);
            }
          },
          onerror: (err) => {
            console.error("Session Error", err);
            this.eventHandlers?.onError?.(new Error(err.message || "Connection disrupted"));
            this.disconnect(); 
          },
        }
      });
      
      if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
          console.warn("Session connected after disconnect requested. Closing.");
          await session.close();
          this.session = null;
          return;
      }
      
      this.session = session;

    } catch (error) {
      console.error("Failed to connect:", error);
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
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ 
        sampleRate: 16000 
    });
    
    if (this.inputContext.state === 'suspended') {
      await this.inputContext.resume();
    }

    const actualSampleRate = this.inputContext.sampleRate;
    console.log(`[Audio] Input Sample Rate: ${actualSampleRate}`);

    try {
        this.stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                channelCount: 1,
                sampleRate: 16000, 
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
    } catch (e) {
        console.error("Microphone access denied", e);
        throw e;
    }
    
    if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
        this.stream.getTracks().forEach(t => t.stop());
        return; 
    }

    this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      if (this.state !== ConnectionState.CONNECTED || !this.session || !this.eventHandlers) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      this.eventHandlers.onVolumeChange(rms);

      try {
          const pcmBlob = createPcmBlob(inputData, actualSampleRate);
          this.session.sendRealtimeInput({ media: pcmBlob });
      } catch (err: any) {
          if (err.message && (err.message.includes('CLOSING') || err.message.includes('CLOSED'))) {
          } else {
             console.warn("Send failed", err);
             this.disconnect();
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

    if (this.session) {
        try {
            await this.session.close();
        } catch (e) {
            console.error("Error closing session:", e);
        }
        this.session = null;
    }

    this.state = ConnectionState.DISCONNECTED;
    console.log("[MaritimeLiveClient] Disconnected fully.");
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
      if (this.state === ConnectionState.CONNECTED && this.session) {
          try {
            this.session.sendRealtimeInput({ text });
          } catch(e) {
             console.error("Failed to send text", e);
          }
      }
  }
}

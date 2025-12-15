import { GoogleGenAI, LiveServerMessage, Modality, Type, GenerateContentResponse } from "@google/genai";

// Initialize the client. 
const apiKey = import.meta.env.VITE_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export const checkApiKey = () => {
  if (!apiKey) {
    console.error("API_KEY is missing. Please set it in the environment.");
    return false;
  }
  return true;
};

// --- ERROR HANDLING UTILITIES ---

/**
 * Maps complex API/Network errors to user-friendly messages for the UI.
 */
export const getFriendlyErrorMessage = (error: any): string => {
  if (!error) return "Unknown system error.";
  
  const msg = (error.message || error.toString()).toLowerCase();
  const status = error.status || error.response?.status;

  // HTTP Status Codes
  if (status === 401 || msg.includes('api key')) return "Authentication Failed: Invalid API Key.";
  if (status === 403) return "Access Denied: Permissions restricted.";
  if (status === 429) return "System Busy: Rate limit exceeded. Please wait.";
  if (status >= 500) return "Neural Core Offline: Server temporary error.";

  // SDK/Network Specifics
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
    return "Connection Lost: Check network settings.";
  }
  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('finishreason')) {
    return "Safety Protocol: Content flagged and blocked.";
  }
  if (msg.includes('candidate') && msg.includes('empty')) {
    return "Model Error: Received empty response.";
  }
  if (msg.includes('parse')) {
    return "Data Error: Received malformed data.";
  }
  
  // Truncate long technical errors
  return `System Error: ${msg.substring(0, 60)}...`;
};

/**
 * Cleans model output to ensure valid JSON parsing.
 * Removes markdown code blocks usually added by LLMs.
 */
const cleanJson = (text: string): string => {
  return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

/**
 * Executes an async operation with exponential backoff retry logic.
 * Retries on network errors, 5xx server errors, and 429 rate limits.
 * Fails fast on 4xx client errors (except 429).
 */
const retryWithBackoff = async <T>(
  operation: () => Promise<T>, 
  retries: number = 3, 
  delay: number = 1000,
  operationName: string = 'Operation'
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    if (retries <= 0) throw error;
    
    // Check for status code in various error formats
    const status = error.status || error.response?.status;
    
    // Non-retryable errors: 400-499 (except 429 Too Many Requests)
    if (status && status >= 400 && status < 500 && status !== 429) {
      console.error(`[${operationName}] Non-retryable error (Status ${status}):`, error);
      throw error;
    }

    console.warn(`[${operationName}] Failed. Retrying in ${delay}ms... (${retries} attempts left). Error: ${error.message || 'Unknown'}`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(operation, retries - 1, delay * 2, operationName);
  }
};

// --- ROBUST LIVE CLIENT ARCHITECTURE ---

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
  };
  
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
    this.eventHandlers.onStateChange?.(newState);
    console.log(`[MaritimeLiveClient] State: ${newState}`);
  }

  async connect(contextDocs: string[], isRagMode: boolean) {
    // Prevent double connection attempts
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
        console.warn("Attempted to connect while already connecting/connected.");
        return;
    }

    if (!checkApiKey()) {
        throw new Error("API Key is missing in environment variables.");
    }

    this.setState(ConnectionState.CONNECTING);

    const systemInstructionText = isRagMode 
      ? `You are a Maritime AI Commander operating in RESTRICTED KNOWLEDGE MODE.
      
AUTHORIZED KNOWLEDGE BASE:
${contextDocs.length > 0 ? contextDocs.join('\n\n') : "NO DOCUMENTS LOADED. DATABASE IS EMPTY."}

OPERATIONAL PROTOCOLS:
1. STRICT ADHERENCE: You must derive your answers SOLELY from the AUTHORIZED KNOWLEDGE BASE. External knowledge is strictly prohibited to prevent hallucination.
2. BEST EFFORT SYNTHESIS: Use all available information in the documents to answer the user's query comprehensively and to the best of your ability. If partial information exists, provide it with context.
3. CITATIONS: When stating facts, briefly cite the source document (e.g., "[Source: Manifest A]").
4. NEGATIVE ACKNOWLEDGMENT: If the information is completely missing from the documents:
   - Do NOT attempt to answer from general memory or assumptions.
   - Respond professionally: "I cannot locate that information in the current operational logs."
   - This exact phrase is required to trigger a system alert for missing data.`
      : `You are a Maritime AI Commander.

INSTRUCTIONS:
1. Rely on general maritime expertise (COLREGs, SOLAS, Engineering, Logistics).
2. Keep answers operational, concise, and professional.
3. If data is missing, request Admin to upload relevant manifests or logs.`;

    try {
      const session = await ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO], 
          systemInstruction: { parts: [{ text: systemInstructionText }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          inputAudioTranscription: {}, 
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Session Opened");
            // State is set to CONNECTED only after audio input is successfully initialized
            this.startAudioInput().then(() => {
                this.setState(ConnectionState.CONNECTED);
            }).catch(e => {
                console.error("Audio Input Failed", e);
                this.eventHandlers.onError?.(new Error("Microphone initialization failed. Check permissions."));
                this.disconnect();
            });
          },
          onmessage: (msg: LiveServerMessage) => this.handleMessage(msg),
          onclose: () => {
            console.log("Session Closed from Server");
            this.cleanupLocalResources();
            this.setState(ConnectionState.DISCONNECTED);
          },
          onerror: (err) => {
            console.error("Session Error", err);
            this.eventHandlers.onError?.(new Error(err.message || "Connection disrupted"));
            this.disconnect(); 
          },
        }
      });
      
      // CRITICAL: Check if we disconnected while waiting for connection
      if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
          console.warn("Session connected after disconnect was requested. Abandoning session.");
          this.session = null;
          return;
      }
      
      this.session = session;

    } catch (error) {
      console.error("Failed to connect:", error);
      this.setState(ConnectionState.DISCONNECTED);
      this.eventHandlers.onError?.(error instanceof Error ? error : new Error("Connection failed"));
      throw error; 
    }
  }

  private handleMessage(message: LiveServerMessage) {
    if (this.state !== ConnectionState.CONNECTED) return;

    try {
      // 1. Handle Interruption
      if (message.serverContent?.interrupted) {
         this.eventHandlers.onInterrupted();
         this.currentInputTranscript = '';
         this.currentOutputTranscript = '';
         // NOTE: Do not return here, sometimes audio/text comes with interruption or immediately after
      }

      // 2. Handle Audio
      const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const pcmData = this.base64ToPCM(base64Audio);
        this.eventHandlers.onAudioData(pcmData);
      }

      // 3. Handle Transcripts
      if (message.serverContent?.outputTranscription) {
        this.currentOutputTranscript += message.serverContent.outputTranscription.text;
        this.eventHandlers.onTranscript(this.currentInputTranscript, this.currentOutputTranscript);
      }
      if (message.serverContent?.inputTranscription) {
        this.currentInputTranscript += message.serverContent.inputTranscription.text;
        this.eventHandlers.onTranscript(this.currentInputTranscript, this.currentOutputTranscript);
      }

      // 4. Handle Turn Complete
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
    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    
    // Ensure Context is Running (Browser often suspends it)
    if (this.inputContext.state === 'suspended') {
      await this.inputContext.resume();
    }

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
        console.error("Microphone access denied or unavailable", e);
        throw e;
    }
    
    // Race Condition Check: If we disconnected while waiting for mic
    if (this.state === ConnectionState.DISCONNECTING || this.state === ConnectionState.DISCONNECTED) {
        this.stream.getTracks().forEach(t => t.stop());
        return; 
    }

    this.inputSource = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      // CRITICAL: Stop processing if we are not in a connected state
      if (this.state !== ConnectionState.CONNECTED || !this.session) return;

      const inputData = e.inputBuffer.getChannelData(0);
      
      // 1. Calculate Volume (RMS)
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
      const rms = Math.sqrt(sum / inputData.length);
      this.eventHandlers.onVolumeChange(rms);

      // 2. Send Data
      try {
          const pcmBlob = this.createPcmBlob(inputData);
          this.session.sendRealtimeInput({ media: pcmBlob });
      } catch (err) {
          console.warn("Send failed. Terminating session to prevent crash.", err);
          this.disconnect();
      }
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputContext.destination);
  }

  // Safe Disconnect that cleans up everything properly
  async disconnect() {
    if (this.state === ConnectionState.DISCONNECTED) return;
    
    this.setState(ConnectionState.DISCONNECTING);
    await this.cleanupLocalResources();

    // Close API Session
    if (this.session) {
        // Just drop the reference, SDK handles cleanup on connection close from server side usually
        // or if we stop sending inputs.
        this.session = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
  }

  private async cleanupLocalResources() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null; // Remove handler
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
      try {
          await this.inputContext.close();
      } catch(e) { 
          // ignore already closed errors 
      }
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

  private createPcmBlob(data: Float32Array): any {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
      // Clamp to 32767 to avoid overflow wrapping which causes popping
      int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767; 
    }
    
    const uint8 = new Uint8Array(int16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8[i]);
    }
    const b64 = btoa(binary);

    return {
      data: b64,
      mimeType: 'audio/pcm;rate=16000',
    };
  }

  private base64ToPCM(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }
}


// --- BACKGROUND ANALYSIS & ASSETS ---

/**
 * BACKGROUND AGENT:
 * 1. Checks if the query was maritime related (for admin alerts).
 * 2. Checks if visual assets are needed.
 */
export const analyzeInteraction = async (
  query: string, 
  response: string
): Promise<{ 
  isMaritime: boolean;
  missingKnowledge: boolean;
  assetNeeded: boolean; 
  assetType: 'image' | 'video' | 'chart' | 'diagram' | 'none'; 
  assetDescription: string 
}> => {
  if (!checkApiKey()) return { isMaritime: true, missingKnowledge: false, assetNeeded: false, assetType: 'none', assetDescription: '' };

  const prompt = `
    Analyze this interaction log from a Maritime AI Assistant.
    
    User: "${query}"
    Assistant: "${response}"

    Task 1: Is this query related to maritime/shipping/naval domains?
    Task 2: Did the Assistant refuse to answer because the information was missing from the Knowledge Base? 
            (Look for specific phrases like "cannot locate that information in the current operational logs", "not found in active protocols", "database is empty").
    Task 3: Is a visual asset STRICTLY necessary to explain the concept better?
    
    Rules for Assets:
    - Priority: Diagram > Chart > Image > Video.
    - Diagram (Mermaid): Use for PROCEDURES, CHECKLISTS, FLOWCHARTS, HIERARCHIES, or STEP-BY-STEP tasks.
    - Chart: Use for numerical data or statistics.
    - Video: ONLY for complex dynamic processes (e.g., rough sea navigation).
    - Image: For object identification.
    - If text is sufficient, assetType = "none".

    Output JSON:
    {
      "isMaritime": boolean,
      "missingKnowledge": boolean,
      "assetNeeded": boolean,
      "assetType": "image" | "video" | "chart" | "diagram" | "none",
      "assetDescription": "description string"
    }
  `;

  try {
    const res = (await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMaritime: { type: Type.BOOLEAN },
            missingKnowledge: { type: Type.BOOLEAN },
            assetNeeded: { type: Type.BOOLEAN },
            assetType: { type: Type.STRING, enum: ['image', 'video', 'chart', 'diagram', 'none'] },
            assetDescription: { type: Type.STRING }
          }
        }
      }
    }), 3, 1000, 'AnalyzeInteraction')) as GenerateContentResponse;

    // Robust parsing using cleanJson
    const text = cleanJson(res.text || '{}');
    return JSON.parse(text);
  } catch (e) {
    console.error("Analysis Error after retries:", e);
    return { isMaritime: true, missingKnowledge: false, assetNeeded: false, assetType: 'none', assetDescription: '' };
  }
};

/**
 * HELPER: Convert Raw PCM 16-bit to AudioBuffer for Playback
 * Gemini Live returns raw PCM (16-bit signed, little-endian) at 24kHz.
 */
export const convertPCMToAudioBuffer = (ctx: AudioContext, pcmData: ArrayBuffer): AudioBuffer => {
  const inputData = new Int16Array(pcmData);
  const sampleRate = 24000; 
  const audioBuffer = ctx.createBuffer(1, inputData.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < inputData.length; i++) {
    channelData[i] = inputData[i] / 32768.0;
  }
  return audioBuffer;
};

// --- ASSET GENERATORS ---
// Note: Generators now Throw errors on failure so the UI can catch them and display specific reasons.

export const generateImage = async (prompt: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: prompt,
  }), 3, 1000, 'GenerateImage')) as GenerateContentResponse;

  for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
      }
  }
  throw new Error("Model generated no image data.");
};

export const generateVideo = async (prompt: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  
  // Retry the initial request
  let operation: any = await retryWithBackoff(() => ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Cinematic maritime footage: ${prompt}`,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
  }), 3, 2000, 'GenerateVideo-Init');

  // Poll with retry logic inside the loop
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await retryWithBackoff(
      () => ai.operations.getVideosOperation({ operation }), 
      3, 
      1000, 
      'GenerateVideo-Poll'
    );
  }
  
  const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("Video generation completed but returned no URI.");
  
  return `${uri}&key=${apiKey}`;
};

export const generateChartData = async (description: string): Promise<any[]> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  const prompt = `Generate Recharts JSON data for: "${description}". Format: [{"name": "A", "value": 10}]`;
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            value: { type: Type.NUMBER }
          }
        }
      } 
    }
  }), 3, 1000, 'GenerateChart')) as GenerateContentResponse;

  const text = cleanJson(response.text || "[]");
  return JSON.parse(text);
};

export const generateDiagram = async (description: string): Promise<string> => {
  if (!checkApiKey()) throw new Error("API Key missing");
  const prompt = `Generate Mermaid.js graph code for: "${description}". 
  Use 'graph TD' (Top-Down) or 'sequenceDiagram'.
  IMPORTANT: Return ONLY the raw code string. Do NOT use markdown code blocks like \`\`\`mermaid. 
  Just valid mermaid syntax.`;
  
  const response = (await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  }), 3, 1000, 'GenerateDiagram')) as GenerateContentResponse;

  let code = response.text || "";
  // Clean up if the model adds markdown blocks anyway
  code = code.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  
  // Remove "mermaid" if it appears at the start of the string (common model artifact)
  if (code.startsWith('mermaid')) {
      code = code.substring(7).trim();
  }
  
  if (!code) throw new Error("Model generated empty diagram code.");
  return code;
};
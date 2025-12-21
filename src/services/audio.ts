/**
 * HELPER: Convert Raw PCM 16-bit to AudioBuffer for Playback
 * Gemini Live returns raw PCM (16-bit signed, little-endian) at 24kHz.
 */
export const convertPCMToAudioBuffer = (ctx: AudioContext, pcmData: ArrayBuffer): AudioBuffer => {
  const byteLength = pcmData.byteLength;
  const alignedLength = byteLength - (byteLength % 2); 
  const inputData = new Int16Array(pcmData, 0, alignedLength / 2);
  
  const sampleRate = 24000; 
  const audioBuffer = ctx.createBuffer(1, inputData.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < inputData.length; i++) {
    channelData[i] = inputData[i] / 32768.0;
  }
  return audioBuffer;
};

export const base64ToPCM = (base64: string): ArrayBuffer => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Encodes bytes to base64 following the provided coding guidelines.
 */
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Creates an audio blob for Gemini API from Float32Array data.
 */
export const createPcmBlob = (data: Float32Array, sampleRate: number = 16000): any => {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Scale and clamp to avoid overflow wrapping noise
    int16[i] = Math.max(-1, Math.min(1, data[i])) * 32767; 
  }
  
  const uint8 = new Uint8Array(int16.buffer);
  const b64 = encode(uint8);

  return {
    data: b64,
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
};

/**
 * Downsamples audio buffer to 16kHz for Gemini API compatibility.
 * Optimized for Apple hardware native rates (44.1/48kHz).
 */
export const downsampleTo16k = (buffer: Float32Array, inputRate: number): Float32Array => {
  if (inputRate === 16000) return buffer;
  
  const outputRate = 16000;
  const ratio = inputRate / outputRate;
  const newLength = Math.ceil(buffer.length / ratio);
  const result = new Float32Array(newLength);
  
  // Linear Interpolation Resampling
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    
    if (index + 1 < buffer.length) {
      result[i] = buffer[index] + fraction * (buffer[index + 1] - buffer[index]);
    } else {
      result[i] = buffer[index];
    }
  }
  return result;
};
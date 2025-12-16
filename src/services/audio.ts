/**
 * HELPER: Convert Raw PCM 16-bit to AudioBuffer for Playback
 * Gemini Live returns raw PCM (16-bit signed, little-endian) at 24kHz.
 */
export const convertPCMToAudioBuffer = (ctx: AudioContext, pcmData: ArrayBuffer): AudioBuffer => {
  // CRITICAL FIX: Ensure byte length is multiple of 2 for Int16Array
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
 * Downsamples audio buffer to 16kHz for Gemini API compatibility.
 * Simple averaging is used to decimate the signal.
 */
export const downsampleTo16k = (buffer: Float32Array, inputRate: number): Float32Array => {
  if (inputRate === 16000) return buffer;
  
  const outputRate = 16000;
  const ratio = inputRate / outputRate;
  const newLength = Math.ceil(buffer.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.floor((i + 1) * ratio);
    let sum = 0;
    let count = 0;
    
    // Simple boxcar filter (averaging) to prevent aliasing
    for (let j = start; j < end && j < buffer.length; j++) {
      sum += buffer[j];
      count++;
    }
    
    result[i] = count > 0 ? sum / count : buffer[start]; 
  }
  return result;
};

export const createPcmBlob = (data: Float32Array, sampleRate: number = 16000): any => {
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
    mimeType: `audio/pcm;rate=${sampleRate}`,
  };
};
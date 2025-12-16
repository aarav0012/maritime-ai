import { useEffect, useRef } from 'react';

export function useAudioAnalysis() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioLevelRef = useRef<number>(0);

  useEffect(() => {
    let animationFrameId: number;
    
    const updateAudioLevel = () => {
      if (analyserRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteTimeDomainData(dataArray);
        
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128; // Normalize to -1..1
            sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        audioLevelRef.current = rms;
      }
      animationFrameId = requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const ensureAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    
    if (!analyserRef.current) {
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.1;
    }

    // CRITICAL FIX: Always ensure the analyser is connected to the speakers (destination).
    // We do this safely inside a try-catch because re-connecting might be redundant but necessary if connection dropped.
    try {
        analyserRef.current.connect(audioContextRef.current.destination);
    } catch (e) {
        // Ignore errors if already connected
    }

    if (audioContextRef.current.state === 'suspended') {
      try { await audioContextRef.current.resume(); } catch (e) { console.warn(e); }
    }
    
    return { ctx: audioContextRef.current, analyser: analyserRef.current };
  };

  return { audioContextRef, analyserRef, audioLevelRef, ensureAudioContext };
}
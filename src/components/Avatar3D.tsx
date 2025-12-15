import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Default Ready Player Me Avatar URL (Female Assistant)
const DEFAULT_AVATAR_URL = "https://models.readyplayer.me/693ce7a814ff705000efdf25.glb";

interface Avatar3DProps {
  state: 'idle' | 'listening' | 'speaking' | 'processing';
  audioLevelRef?: React.MutableRefObject<number>;
}

// Inner Model Component
const Model = ({ url, state, audioLevelRef }: { url: string, state: string, audioLevelRef?: React.MutableRefObject<number> }) => {
  const { scene } = useGLTF(url);
  const headRef = useRef<THREE.Object3D | null>(null);
  const neckRef = useRef<THREE.Object3D | null>(null);
  const morphTargetMeshRef = useRef<THREE.Mesh | null>(null);
  
  // Find Head bone and Mesh with morph targets on load
  useEffect(() => {
    scene.traverse((child) => {
      // Find Bones
      if (child.name === 'Head') headRef.current = child;
      if (child.name === 'Neck') neckRef.current = child;
      
      // Find Main Head Mesh for Morph Targets (usually Wolf3D_Head or similar)
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        // We prefer the head mesh which usually has 'mouthOpen' or 'viseme_aa'
        if (mesh.name.includes('Head') || mesh.name.includes('Avatar')) {
           morphTargetMeshRef.current = mesh;
        }
      }
    });
  }, [scene]);

  useFrame((stateCtx, delta) => {
    const t = stateCtx.clock.elapsedTime;
    const level = audioLevelRef?.current || 0;
    
    // 1. BASE MOVEMENT (IDLE/FLOATING)
    if (scene) {
        scene.position.y = THREE.MathUtils.lerp(scene.position.y, -2.7 + Math.sin(t * 0.5) * 0.02, 0.1);
    }

    // 2. HEAD & NECK ANIMATION
    if (headRef.current && neckRef.current) {
        let targetHeadRot = new THREE.Vector3(0, 0, 0);
        let targetNeckRot = new THREE.Vector3(0, 0, 0);

        if (state === 'idle') {
            // Slow, subtle look around
            targetNeckRot.y = Math.sin(t * 0.2) * 0.1;
            targetNeckRot.x = Math.sin(t * 0.3) * 0.05;
        } 
        else if (state === 'listening') {
            // Lean forward slightly, tilt head to indicate attention
            targetNeckRot.x = 0.15; // Lean forward
            targetHeadRot.z = Math.sin(t * 1.5) * 0.05; // Subtle tilt
            // Micro nods
            targetHeadRot.x = Math.sin(t * 2) * 0.02;
        } 
        else if (state === 'speaking') {
            // Amplified Intensity: Scale input RMS (usually 0.0-0.2) to usable animation range (0.0-1.5)
            // Increased multiplier for exaggerated responsiveness
            const rawIntensity = level * 10.0;
            const intensity = Math.min(rawIntensity, 1.5);
            
            // Base conversational rhythm (faster than idle)
            targetHeadRot.x = Math.sin(t * 3.5) * 0.05;
            targetHeadRot.y = Math.sin(t * 2.5) * 0.05;
            
            // EXAGGERATED RESPONSIVENESS
            // 1. Nods (Pitch): Strong down-beat on volume peaks
            targetHeadRot.x += intensity * 0.35; 
            
            // 2. Tilts (Roll): Head tilts side-to-side for expressiveness
            targetHeadRot.z = Math.cos(t * 6) * 0.15 * intensity;
            
            // 3. Turns (Yaw): Slight turning into the emphasis
            targetHeadRot.y += Math.sin(t * 4) * 0.1 * intensity;
            
            // 4. Neck Engagement: Shoulders/Neck stiffen/move up with intensity
            targetNeckRot.x = -0.05 + (intensity * 0.08); 
            targetNeckRot.z = -targetHeadRot.z * 0.2; // subtle counter-balance
        }
        else if (state === 'processing') {
             // Look up/side as if thinking
             targetHeadRot.y = 0.2;
             targetHeadRot.x = -0.1;
             targetHeadRot.z = 0.1;
        }

        // Apply smooth transitions
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targetHeadRot.x, 0.1);
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targetHeadRot.y, 0.1);
        headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, targetHeadRot.z, 0.1);
        
        neckRef.current.rotation.x = THREE.MathUtils.lerp(neckRef.current.rotation.x, targetNeckRot.x, 0.1);
        neckRef.current.rotation.y = THREE.MathUtils.lerp(neckRef.current.rotation.y, targetNeckRot.y, 0.1);
        neckRef.current.rotation.z = THREE.MathUtils.lerp(neckRef.current.rotation.z, targetNeckRot.z, 0.1);
    }

    // 3. REFINED LIP SYNC / JAW MOVEMENT
    if (morphTargetMeshRef.current && morphTargetMeshRef.current.morphTargetDictionary && morphTargetMeshRef.current.morphTargetInfluences) {
        const mouthOpenIndex = morphTargetMeshRef.current.morphTargetDictionary['mouthOpen'] ?? morphTargetMeshRef.current.morphTargetDictionary['jawOpen'];
        
        if (mouthOpenIndex !== undefined) {
             let targetOpen = 0;
             let smoothingSpeed = 0.1;

             if (state === 'speaking') {
                 // 1. Amplification & Thresholding
                 // Scale up the RMS level significantly as speech RMS is often low (0.05 - 0.2)
                 const amplified = Math.min(level * 8.0, 1.0);
                 const threshold = 0.05;
                 const cleanSignal = amplified > threshold ? amplified : 0;

                 // 2. Syllabic Modulation
                 // Add high-frequency noise modulated by the signal itself to simulate rapid lip movement
                 // This prevents the mouth from hanging open during long sustained vowels
                 const modulation = Math.sin(t * 30) * 0.15; 
                 
                 targetOpen = THREE.MathUtils.clamp(cleanSignal + (cleanSignal * modulation), 0, 1);
                 
                 // 3. Asymmetric Smoothing (Viseme Dynamics)
                 // Open Mouth: Fast Attack (0.4) - Lips move quickly to form sounds
                 // Close Mouth: Slow Decay (0.15) - Lips return to neutral slightly slower
                 const currentOpen = morphTargetMeshRef.current.morphTargetInfluences[mouthOpenIndex];
                 smoothingSpeed = targetOpen > currentOpen ? 0.4 : 0.15; 
             } else {
                 targetOpen = 0;
                 smoothingSpeed = 0.1;
             }
             
             morphTargetMeshRef.current.morphTargetInfluences[mouthOpenIndex] = THREE.MathUtils.lerp(
                 morphTargetMeshRef.current.morphTargetInfluences[mouthOpenIndex], 
                 targetOpen, 
                 smoothingSpeed
             );
        }
    }
  });

  return (
    <primitive 
      object={scene} 
      scale={2} 
      position={[0, -2.7, 0]} 
    />
  );
};

// Holographic Ring for tech feel
const HoloRing = ({ state }: { state: string }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((stateCtx, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = Math.PI / 2;
      meshRef.current.rotation.z += delta * 0.5;
      
      const s = 1 + Math.sin(stateCtx.clock.elapsedTime * 2) * 0.05;
      meshRef.current.scale.set(s, s, s);
    }
  });

  const color = state === 'listening' ? '#ef4444' : state === 'speaking' ? '#06b6d4' : '#3b82f6';

  return (
    <mesh ref={meshRef} position={[0, -2.1, 0]}>
      <ringGeometry args={[1.2, 1.4, 64]} />
      <meshStandardMaterial 
        color={color} 
        emissive={color}
        emissiveIntensity={2}
        transparent 
        opacity={0.3} 
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};

export const Avatar3D: React.FC<Avatar3DProps> = ({ state, audioLevelRef }) => {
  return (
    <div className="w-full h-full relative">
       {/* Background Grid Overlay */}
      <div className="absolute inset-0 z-0 bg-[linear-gradient(rgba(15,23,42,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.1)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      
      {/* 
         CRITICAL FIX: 
         We strictly define toneMapping and colorSpace to ensure identical rendering 
         across Chrome (sRGB default) and Firefox/Safari (Linear default).
      */}
      <Canvas 
        camera={{ position: [0, 0, 3.5], fov: 40 }} 
        gl={{ 
          preserveDrawingBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace 
        }}
      >
        <ambientLight intensity={0.8} />
        <spotLight position={[5, 5, 5]} angle={0.2} penumbra={1} intensity={1.2} castShadow />
        <pointLight position={[-5, -2, -5]} intensity={0.5} color="#3b82f6" />
        <pointLight position={[5, -2, -5]} intensity={0.5} color="#ef4444" />
        
        {/* Main Model */}
        <React.Suspense fallback={null}>
            <Model url={DEFAULT_AVATAR_URL} state={state} audioLevelRef={audioLevelRef} />
            <HoloRing state={state} />
        </React.Suspense>
        
        <Environment preset="night" />
        <ContactShadows position={[0, -3, 0]} opacity={0.5} scale={10} blur={2.5} far={4} color="#000000" />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          minPolarAngle={Math.PI/2.2} 
          maxPolarAngle={Math.PI/1.9}
          minAzimuthAngle={-Math.PI/6}
          maxAzimuthAngle={Math.PI/6}
        />
      </Canvas>
      
      {/* State Overlay Label */}
      <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-slate-900/50 backdrop-blur px-4 py-1 rounded-full border border-slate-700 text-[10px] tracking-widest uppercase text-cyan-400 z-10">
        SYSTEM: {state.toUpperCase()}
      </div>
    </div>
  );
};
import React, { useRef, useEffect} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

// Default Ready Player Me Avatar URL
const DEFAULT_AVATAR_URL = "https://models.readyplayer.me/693ce7a814ff705000efdf25.glb";

interface Avatar3DProps {
  state: 'idle' | 'listening' | 'speaking' | 'processing';
  audioLevelRef?: React.MutableRefObject<number>;
  nightMode?: boolean;
}

const Model = ({ url, state, audioLevelRef }: { url: string, state: string, audioLevelRef?: React.MutableRefObject<number> }) => {
  const { scene } = useGLTF(url);
  
  // Bone Refs
  const bones = useRef<{
    head: THREE.Object3D | null;
    neck: THREE.Object3D | null;
    rightArm: THREE.Object3D | null;
    leftArm: THREE.Object3D | null;
    rightForeArm: THREE.Object3D | null;
    leftForeArm: THREE.Object3D | null;
    rightHand: THREE.Object3D | null;
    leftHand: THREE.Object3D | null;
    spine: THREE.Object3D | null;
    shoulders: THREE.Object3D | null;
  }>({
    head: null, neck: null, rightArm: null, leftArm: null, 
    rightForeArm: null, leftForeArm: null, rightHand: null, leftHand: null, spine: null, shoulders: null
  });

  const morphTargetMeshRef = useRef<THREE.Mesh | null>(null);
  const initialRotations = useRef<Map<string, THREE.Euler>>(new Map());
  
  // State Refs for smoothing and micro-timing
  const blinkRef = useRef({ lastBlink: 0, nextBlink: 2, isBlinking: false });

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Bone) {
        if (child.name === 'Head') bones.current.head = child;
        if (child.name === 'Neck') bones.current.neck = child;
        if (child.name === 'RightArm') bones.current.rightArm = child;
        if (child.name === 'LeftArm') bones.current.leftArm = child;
        if (child.name === 'RightForeArm') bones.current.rightForeArm = child;
        if (child.name === 'LeftForeArm') bones.current.leftForeArm = child;
        if (child.name === 'RightHand') bones.current.rightHand = child;
        if (child.name === 'LeftHand') bones.current.leftHand = child;
        if (child.name === 'Spine') bones.current.spine = child;
        if (child.name.includes('Shoulder')) bones.current.shoulders = child;

        initialRotations.current.set(child.name, child.rotation.clone());
      }
      
      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
        if (mesh.name.includes('Head') || mesh.name.includes('Avatar')) {
           morphTargetMeshRef.current = mesh;
        }
      }
    });
  }, [scene]);

  useFrame((stateCtx) => {
    const t = stateCtx.clock.elapsedTime;
    const level = audioLevelRef?.current || 0;
    const lerpFactor = 0.08;

    // 1. BLINK LOGIC
    if (t - blinkRef.current.lastBlink > blinkRef.current.nextBlink) {
        blinkRef.current.isBlinking = true;
        if (t - blinkRef.current.lastBlink > blinkRef.current.nextBlink + 0.12) {
            blinkRef.current.isBlinking = false;
            blinkRef.current.lastBlink = t;
            blinkRef.current.nextBlink = 3 + Math.random() * 5;
        }
    }

    // 2. STABILIZED BODY & VERTICAL COMPOSITION
    scene.position.y = THREE.MathUtils.lerp(scene.position.y, -3.1 + Math.sin(t * 0.4) * 0.01, 0.05);

    if (bones.current.head && bones.current.neck) {
        let targetHead = new THREE.Vector3(0, 0, 0);
        const jitterX = Math.sin(t * 15) * 0.001;
        const jitterY = Math.cos(t * 12) * 0.001;

        if (state === 'idle') {
            targetHead.set(jitterX, jitterY, 0);
        } else if (state === 'listening') {
            targetHead.set(0.14 + (Math.sin(t * 1.8) * 0.02), jitterY, 0.03);
        } else if (state === 'speaking') {
            const intensity = Math.min(level * 10, 1);
            targetHead.y = Math.sin(t * 1.4) * 0.08;
            targetHead.x = (Math.cos(t * 2) * 0.04) + (intensity * 0.12);
            targetHead.z = Math.sin(t * 0.7) * 0.02;
        }

        bones.current.head.rotation.x = THREE.MathUtils.lerp(bones.current.head.rotation.x, targetHead.x, lerpFactor);
        bones.current.head.rotation.y = THREE.MathUtils.lerp(bones.current.head.rotation.y, targetHead.y, lerpFactor);
        bones.current.head.rotation.z = THREE.MathUtils.lerp(bones.current.head.rotation.z, targetHead.z, lerpFactor);
    }

    // 3. REFINED GESTURING
    const animateArm = (arm: THREE.Object3D | null, foreArm: THREE.Object3D | null, hand: THREE.Object3D | null, isRight: boolean) => {
        if (!arm || !foreArm) return;
        const side = isRight ? 1 : -1;
        const baseRot = initialRotations.current.get(arm.name) || new THREE.Euler();
        const baseForeRot = initialRotations.current.get(foreArm.name) || new THREE.Euler();
        const baseHandRot = initialRotations.current.get(hand?.name || '') || new THREE.Euler();

        let targetArmX = baseRot.x + 0.1; 
        let targetArmY = baseRot.y;
        let targetArmZ = baseRot.z + (side * 0.1); 

        let targetForeX = baseForeRot.x - 0.5; 
        let targetForeY = baseForeRot.y + (side * 0.4); 
        let targetHandY = baseHandRot.y;

        if (state === 'speaking') {
            const intensity = Math.min(level * 25, 1.4);
            const sweep = Math.sin(t * 2.5 + (isRight ? 0 : Math.PI)) * 0.3 * intensity;
            
            targetArmX = baseRot.x + 0.15 + (Math.sin(t * 0.8) * 0.05);
            targetArmZ = baseRot.z + (side * 0.15); 

            targetForeX = baseForeRot.x - (1.2 + sweep); 
            targetForeY = baseForeRot.y + (side * (0.8 + sweep * 0.5)); 
            targetHandY = baseHandRot.y + (side * (0.6 + sweep)); 
        } else if (state === 'listening') {
            targetArmX = baseRot.x + 0.2;
            targetForeX = baseForeRot.x - 0.8;
            targetForeY = baseForeRot.y + (side * 0.5);
        }

        arm.rotation.x = THREE.MathUtils.lerp(arm.rotation.x, targetArmX, 0.04);
        arm.rotation.y = THREE.MathUtils.lerp(arm.rotation.y, targetArmY, 0.04);
        arm.rotation.z = THREE.MathUtils.lerp(arm.rotation.z, targetArmZ, 0.04);
        
        foreArm.rotation.x = THREE.MathUtils.lerp(foreArm.rotation.x, targetForeX, 0.06);
        foreArm.rotation.y = THREE.MathUtils.lerp(foreArm.rotation.y, targetForeY, 0.06);
        
        if (hand) {
            hand.rotation.y = THREE.MathUtils.lerp(hand.rotation.y, targetHandY, 0.06);
        }
    };

    animateArm(bones.current.rightArm, bones.current.rightForeArm, bones.current.rightHand, true);
    animateArm(bones.current.leftArm, bones.current.leftForeArm, bones.current.leftHand, false);

    // 4. FACIAL MORPHS
    if (morphTargetMeshRef.current && morphTargetMeshRef.current.morphTargetDictionary && morphTargetMeshRef.current.morphTargetInfluences) {
        const dict = morphTargetMeshRef.current.morphTargetDictionary;
        const influences = morphTargetMeshRef.current.morphTargetInfluences;
        
        const mouthOpenIdx = dict['mouthOpen'] ?? dict['jawOpen'] ?? dict['viseme_aa'];
        const smileIdx = dict['mouthSmile'] ?? dict['mouthSmileLeft'];
        const blinkIdx = dict['eyeBlinkLeft'] ?? dict['eyesClosed'];

        if (mouthOpenIdx !== undefined) {
             let targetOpen = (state === 'speaking') ? Math.min(level * 11.0, 1.0) : 0;
             influences[mouthOpenIdx] = THREE.MathUtils.lerp(influences[mouthOpenIdx], targetOpen, 0.35);
        }

        if (blinkIdx !== undefined) {
            influences[blinkIdx] = THREE.MathUtils.lerp(influences[blinkIdx], blinkRef.current.isBlinking ? 1 : 0, 0.6);
            const blinkR = dict['eyeBlinkRight'];
            if (blinkR !== undefined) influences[blinkR] = influences[blinkIdx];
        }

        if (smileIdx !== undefined) {
            let targetSmile = (state === 'listening') ? 0.4 : (state === 'speaking') ? 0.25 : 0.05;
            influences[smileIdx] = THREE.MathUtils.lerp(influences[smileIdx], targetSmile, 0.05);
        }
    }
  });

  return <primitive object={scene} scale={2.2} position={[0, -3.1, 0]} />;
};

const ScanningRing = ({ state, nightMode }: { state: string, nightMode?: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  
  useFrame((stateCtx, delta) => {
    if (meshRef.current) meshRef.current.rotation.z -= delta * 0.3;
    if (ringRef.current) {
        ringRef.current.rotation.z += delta * 0.8;
        const scale = 1 + Math.sin(stateCtx.clock.elapsedTime * 2) * 0.05;
        ringRef.current.scale.set(scale, scale, scale);
    }
  });

  const baseColor = nightMode ? '#ff0000' : (state === 'listening' ? '#ef4444' : state === 'speaking' ? '#22d3ee' : '#3b82f6');

  return (
    <group position={[0, -3.0, 0]} rotation={[-Math.PI/2, 0, 0]}>
      <mesh ref={meshRef}>
        <ringGeometry args={[1.4, 1.5, 64]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={nightMode ? 1.0 : 1.5} transparent opacity={0.2} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[1.2, 1.25, 4, 1]} />
        <meshStandardMaterial color={baseColor} emissive={baseColor} emissiveIntensity={nightMode ? 3.0 : 5} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

export const Avatar3D: React.FC<Avatar3DProps> = ({ state, audioLevelRef, nightMode }) => {
  const primaryLightColor = nightMode ? '#ff0000' : '#3b82f6';
  const secondaryLightColor = nightMode ? '#ff3300' : '#06b6d4';
  const bgColor = nightMode ? '#050000' : '#020617';

  return (
    <div className={`w-full h-full relative overflow-hidden transition-colors duration-500 ${nightMode ? 'bg-[#050000]' : 'bg-slate-950'}`}>
      <div className={`absolute inset-0 z-10 pointer-events-none ${nightMode ? 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(20,0,0,0.8)_100%)]' : 'bg-[radial-gradient(circle_at_center,transparent_0%,rgba(2,6,23,0.8)_100%)]'}`}></div>
      
      <Canvas 
        camera={{ position: [0, 0.15, 3.4], fov: 35 }} 
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <color attach="background" args={[bgColor]} />
        
        <ambientLight intensity={nightMode ? 0.3 : 0.7} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={nightMode ? 0.8 : 1.5} color={nightMode ? '#ff0000' : '#ffffff'} />
        
        {/* NEW: Top Focus Light */}
        <spotLight 
          position={[0, 5, 0]} 
          angle={0.4} 
          penumbra={1} 
          intensity={nightMode ? 4 : 2} 
          color={nightMode ? '#ff5555' : '#ffffff'} 
          castShadow 
        />

        <pointLight position={[-5, 2, 2]} intensity={nightMode ? 2.5 : 1.8} color={primaryLightColor} /> 
        <pointLight position={[5, 1, -2]} intensity={nightMode ? 4 : 3} color={secondaryLightColor} /> 
        <pointLight position={[0, 4, 2]} intensity={nightMode ? 0.5 : 1} color="#ffffff" />
        
        <React.Suspense fallback={null}>
            <Model url={DEFAULT_AVATAR_URL} state={state} audioLevelRef={audioLevelRef} />
            <ScanningRing state={state} nightMode={nightMode} />
            <Environment preset={nightMode ? "night" : "city"} />
        </React.Suspense>
        
        <ContactShadows position={[0, -3.1, 0]} opacity={nightMode ? 0.2 : 0.5} scale={15} blur={3} far={4.5} />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          minPolarAngle={Math.PI/2.4} 
          maxPolarAngle={Math.PI/1.8}
        />
      </Canvas>
      
      <div className="absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20">
        <div className={`px-6 py-1.5 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl overflow-hidden relative transition-all duration-300 ${nightMode ? 'border-red-900/30' : ''}`}>
            <span className={`text-[10px] font-mono tracking-[0.4em] uppercase transition-colors duration-300 ${nightMode ? 'text-red-500 drop-shadow-[0_0_8px_rgba(255,0,0,0.6)]' : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'}`}>
                Neural Core: {state}
            </span>
        </div>
      </div>
    </div>
  );
};

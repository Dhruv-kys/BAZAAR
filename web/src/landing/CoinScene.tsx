import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export type CoinState = "idle" | "listening" | "thinking" | "speaking";

interface CoinSceneProps {
  state?: CoinState;
  level?: number;
  ceiling?: boolean;
}

function faceTexture(caption: string, mirrored = false): THREE.Texture {
  const s = 1024;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const R = s / 2;

  g.fillStyle = "#d7dde0";
  g.beginPath();
  g.arc(R, R, R, 0, Math.PI * 2);
  g.fill();

  const field = g.createRadialGradient(R * 0.8, R * 0.7, R * 0.1, R, R, R);
  field.addColorStop(0, "#f7fafb");
  field.addColorStop(0.62, "#b9c4c8");
  field.addColorStop(1, "#68777d");
  g.fillStyle = field;
  g.beginPath();
  g.arc(R, R, R * 0.9, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(38, 51, 57, 0.58)";
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.arc(R, R, R * 0.79, 0, Math.PI * 2);
  g.stroke();

  g.fillStyle = "rgba(255, 255, 255, 0.72)";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    g.beginPath();
    g.arc(R + Math.cos(a) * R * 0.855, R + Math.sin(a) * R * 0.855, s * 0.008, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "#26343a";
  g.font = `700 ${s * 0.42}px "Inter Tight", ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("₹", R, R * 0.98);

  g.fillStyle = "rgba(38, 52, 58, 0.88)";
  g.font = `600 ${s * 0.052}px "Inter Tight", ui-sans-serif, system-ui, sans-serif`;
  g.fillText(caption, R, R * 1.52);

  const tex = new THREE.CanvasTexture(c);
  if (mirrored) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1;
    tex.offset.x = 1;
  }
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function Coin({ state, level }: { state: CoinState; level: number }) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const smoothed = useRef(0);

  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({
      color: "#8b989d",
      metalness: 0.95,
      roughness: 0.28,
    });
    const face = (caption: string, mirrored = false) =>
      new THREE.MeshStandardMaterial({
        map: faceTexture(caption, mirrored),
        metalness: 0.85,
        roughness: 0.32,
      });
    return [edge, face("BOUNDED"), face("HUMAN CONFIRMED", true)];
  }, []);

  useFrame((frame, delta) => {
    if (!group.current) return;
    const g = group.current;
    smoothed.current += (level - smoothed.current) * 0.18;
    const amp = smoothed.current;
    const t = frame.clock.elapsedTime;

    if (state === "idle") {
      g.rotation.x += (-frame.pointer.y * 0.14 - g.rotation.x) * 0.06;
      g.rotation.y += (frame.pointer.x * 0.28 - g.rotation.y) * 0.06;
      g.rotation.z += (frame.pointer.x * 0.42 - g.rotation.z) * 0.06;
      g.scale.setScalar(g.scale.x + (1 - g.scale.x) * 0.08);
      spin.current = g.rotation.y;
      return;
    }

    if (state === "listening") {
      spin.current += delta * (0.55 + amp * 2.6);
      g.rotation.y = spin.current;
      g.rotation.x += (Math.sin(t * 1.1) * 0.06 - g.rotation.x) * 0.05;
      g.rotation.z += (0 - g.rotation.z) * 0.06;
      g.scale.setScalar(g.scale.x + (1 + amp * 0.16 - g.scale.x) * 0.16);
      return;
    }

    if (state === "thinking") {
      spin.current += delta * 1.15;
      g.rotation.y = spin.current;
      g.rotation.x += (0.1 - g.rotation.x) * 0.05;
      g.rotation.z += (0 - g.rotation.z) * 0.06;
      g.scale.setScalar(g.scale.x + (0.97 - g.scale.x) * 0.08);
      return;
    }

    spin.current += delta * 0.32;
    g.rotation.y = spin.current;
    g.rotation.x += (Math.sin(t * 2.4) * 0.1 - g.rotation.x) * 0.08;
    g.rotation.z += (Math.sin(t * 1.7) * 0.05 - g.rotation.z) * 0.08;
    const pulse = 1 + Math.abs(Math.sin(t * 3.1)) * 0.05;
    g.scale.setScalar(g.scale.x + (pulse - g.scale.x) * 0.1);
  });

  return (
    <group ref={group}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={materials} castShadow>
        <cylinderGeometry args={[1.28, 1.28, 0.19, 96, 1]} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.28, 0.035, 12, 96]} />
        <meshStandardMaterial color="#dfe6e8" metalness={0.95} roughness={0.22} />
      </mesh>
    </group>
  );
}

function Halo({ state, level }: { state: CoinState; level: number }) {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const smoothed = useRef(0);

  useFrame((frame) => {
    if (!ring.current || !mat.current) return;
    smoothed.current += (level - smoothed.current) * 0.16;
    const active = state === "listening" || state === "speaking";
    const breathe = state === "speaking" ? Math.abs(Math.sin(frame.clock.elapsedTime * 3.1)) * 0.18 : 0;
    const scale = 1.52 + (state === "listening" ? smoothed.current * 0.7 : 0) + breathe;
    ring.current.scale.setScalar(ring.current.scale.x + (scale - ring.current.scale.x) * 0.16);
    const target = active ? 0.16 + smoothed.current * 0.5 + breathe : 0;
    mat.current.opacity += (target - mat.current.opacity) * 0.14;
  });

  return (
    <mesh ref={ring}>
      <ringGeometry args={[0.92, 1, 96]} />
      <meshBasicMaterial ref={mat} color="#7a78f0" transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

const LINE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const LINE_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uPulse;
  void main() {
    float y = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
    float core = pow(y, 70.0);
    float glow = pow(y, 5.0) * 0.09;
    float fade = 1.0 - smoothstep(0.18, 0.5, abs(vUv.x - 0.5));
    gl_FragColor = vec4(vec3(0.45, 0.60, 0.78), (core + glow) * fade * uPulse);
  }
`;

function Ceiling() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uPulse: { value: 1 } }), []);

  useFrame((state) => {
    if (!mat.current) return;
    mat.current.uniforms.uPulse.value = 0.86 + Math.sin(state.clock.elapsedTime * 1.3) * 0.14;
  });

  return (
    <mesh position={[0, 1.72, 0.4]}>
      <planeGeometry args={[9.5, 0.5]} />
      <shaderMaterial
        ref={mat}
        vertexShader={LINE_VERT}
        fragmentShader={LINE_FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function Rig({ damping, children }: { damping: number; children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!g.current) return;
    const { x, y } = state.pointer;
    g.current.rotation.y += (x * damping - g.current.rotation.y) * 0.05;
    g.current.rotation.x += (-y * damping * 0.45 - g.current.rotation.x) * 0.05;
    g.current.position.y += (0 - g.current.position.y) * 0.06;
  });
  return <group ref={g}>{children}</group>;
}

export default function CoinScene({ state = "idle", level = 0, ceiling = true }: CoinSceneProps) {
  return (
    <Canvas
      dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      camera={{ position: [0, 0.1, 5.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.55} color="#edf3fb" />
      <directionalLight position={[3, 4, 5]} intensity={2.1} color="#f2f6fd" />
      <directionalLight position={[-4, 1.5, 2]} intensity={1.0} color="#8baed8" />
      <directionalLight position={[0, -3, 3]} intensity={0.55} color="#c9d6e6" />
      <pointLight position={[0, 0, 3]} intensity={12} distance={12} color="#ffffff" />
      <Rig damping={state === "idle" ? 0.22 : 0.06}>
        <Coin state={state} level={level} />
        <Halo state={state} level={level} />
        {ceiling && <Ceiling />}
      </Rig>
    </Canvas>
  );
}

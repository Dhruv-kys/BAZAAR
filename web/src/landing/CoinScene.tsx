import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function scrollProgress() {
  const h = window.innerHeight;
  return h > 0 ? Math.min(window.scrollY / h, 1) : 0;
}

/** Struck face: milled ring, rupee mark, and a caption around the rim. */
function faceTexture(caption: string): THREE.Texture {
  const s = 1024;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const R = s / 2;

  g.fillStyle = "#d9a441";
  g.beginPath();
  g.arc(R, R, R, 0, Math.PI * 2);
  g.fill();

  // Recessed field so the relief has somewhere to sit.
  const field = g.createRadialGradient(R * 0.8, R * 0.7, R * 0.1, R, R, R);
  field.addColorStop(0, "#f4d489");
  field.addColorStop(0.62, "#dfae52");
  field.addColorStop(1, "#b8862f");
  g.fillStyle = field;
  g.beginPath();
  g.arc(R, R, R * 0.9, 0, Math.PI * 2);
  g.fill();

  g.strokeStyle = "rgba(120, 82, 18, 0.55)";
  g.lineWidth = s * 0.012;
  g.beginPath();
  g.arc(R, R, R * 0.79, 0, Math.PI * 2);
  g.stroke();

  // Milled beads just inside the rim.
  g.fillStyle = "rgba(255, 240, 200, 0.55)";
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    g.beginPath();
    g.arc(R + Math.cos(a) * R * 0.855, R + Math.sin(a) * R * 0.855, s * 0.008, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = "#6b4a12";
  g.font = `700 ${s * 0.42}px "Inter Tight", ui-sans-serif, system-ui, sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("₹", R, R * 0.98);

  g.fillStyle = "rgba(107, 74, 18, 0.85)";
  g.font = `600 ${s * 0.052}px "Inter Tight", ui-sans-serif, system-ui, sans-serif`;
  g.fillText(caption, R, R * 1.52);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** The coin: revolves steadily, with a slow nod so the light moves across it. */
function Coin() {
  const group = useRef<THREE.Group>(null);

  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({
      color: "#c99a3d",
      metalness: 0.95,
      roughness: 0.28,
    });
    const face = (caption: string) =>
      new THREE.MeshStandardMaterial({
        map: faceTexture(caption),
        metalness: 0.85,
        roughness: 0.32,
      });
    // Cylinder material order is [side, top, bottom].
    return [edge, face("BOUNDED"), face("HUMAN CONFIRMED")];
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.rotation.y = t * 0.55;
    group.current.rotation.x = -0.28 + Math.sin(t * 0.7) * 0.09;
    group.current.rotation.z = Math.sin(t * 0.45) * 0.05;
    group.current.position.y = Math.sin(t * 0.9) * 0.08;
  });

  return (
    <group ref={group}>
      <mesh material={materials} castShadow>
        <cylinderGeometry args={[1.28, 1.28, 0.19, 96, 1]} />
      </mesh>
      {/* A milled band sitting proud of the edge. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.28, 0.035, 12, 96]} />
        <meshStandardMaterial color="#e6bb63" metalness={0.95} roughness={0.22} />
      </mesh>
    </group>
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
    gl_FragColor = vec4(vec3(0.77, 0.42, 0.22), (core + glow) * fade * uPulse);
  }
`;

/** The ceiling the coin never rises past. */
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

function Rig({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!g.current) return;
    const { x, y } = state.pointer;
    g.current.rotation.y += (x * 0.22 - g.current.rotation.y) * 0.05;
    g.current.rotation.x += (-y * 0.1 - g.current.rotation.x) * 0.05;
    g.current.position.y += (scrollProgress() * 1.2 - g.current.position.y) * 0.06;
  });
  return <group ref={g}>{children}</group>;
}

export default function CoinScene() {
  return (
    <Canvas
      dpr={[1, Math.min(window.devicePixelRatio, 2)]}
      camera={{ position: [0, 0.1, 5.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      {/* Three-point-ish rig: metal needs moving highlights to read as metal. */}
      <ambientLight intensity={0.55} color="#fff6e2" />
      <directionalLight position={[3, 4, 5]} intensity={2.1} color="#fff3d6" />
      <directionalLight position={[-4, 1.5, 2]} intensity={1.0} color="#76b6a4" />
      <directionalLight position={[0, -3, 3]} intensity={0.55} color="#ffd9a0" />
      <pointLight position={[0, 0, 3]} intensity={12} distance={12} color="#ffffff" />
      <Rig>
        <Coin />
        <Ceiling />
      </Rig>
    </Canvas>
  );
}

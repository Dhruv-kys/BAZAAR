import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { EDGES, type Stage, type StageState } from "./topologyModel";

type Palette = Record<StageState, string>;

/** An orthographic camera at zoom 1 makes one world unit equal one pixel, so
 *  these positions line up exactly with the DOM labels drawn over the canvas. */
function useProject() {
  const { width, height } = useThree((s) => s.size);
  return (at: [number, number]): [number, number, number] => [
    (at[0] - 0.5) * width,
    (0.5 - at[1]) * height,
    0,
  ];
}

function Node({ stage, palette, project }: { stage: Stage; palette: Palette; project: ReturnType<typeof useProject> }) {
  const halo = useRef<THREE.Mesh>(null);
  const lit = stage.state !== "idle" && stage.state !== "locked";
  const color = palette[stage.state];
  const r = stage.key === "gate" ? 8 : 6;

  useFrame((state) => {
    if (!halo.current || !lit) return;
    const t = state.clock.elapsedTime;
    halo.current.scale.setScalar(1 + Math.sin(t * 1.5 + stage.at[0] * 6) * 0.14);
  });

  return (
    <group position={project(stage.at)}>
      {lit && (
        <mesh ref={halo}>
          <circleGeometry args={[r * 2.6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      )}
      <mesh>
        <circleGeometry args={[r, 32]} />
        <meshBasicMaterial color={color} transparent opacity={lit ? 1 : 0.45} />
      </mesh>
    </group>
  );
}

function Edges({ stages, palette, project }: { stages: Stage[]; palette: Palette; project: ReturnType<typeof useProject> }) {
  const byKey = useMemo(() => Object.fromEntries(stages.map((s) => [s.key, s])), [stages]);

  const lines = useMemo(() => {
    return EDGES.flatMap(([a, b]) => {
      const from = byKey[a];
      const to = byKey[b];
      if (!from || !to) return [];
      const live = from.state !== "idle" && from.state !== "locked" && to.state !== "idle" && to.state !== "locked";
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...project(from.at)),
        new THREE.Vector3(...project(to.at)),
      ]);
      const material = new THREE.LineBasicMaterial({
        color: live ? palette[to.state] : palette.idle,
        transparent: true,
        opacity: live ? 0.5 : 0.18,
      });
      return [{ key: `${a}-${b}`, object: new THREE.Line(geometry, material) }];
    });
  }, [byKey, palette, project]);

  return (
    <>
      {lines.map((l) => (
        <primitive key={l.key} object={l.object} />
      ))}
    </>
  );
}

function Graph({ stages, palette }: { stages: Stage[]; palette: Palette }) {
  const project = useProject();
  return (
    <>
      <Edges stages={stages} palette={palette} project={project} />
      {stages.map((stage) => (
        <Node key={stage.key} stage={stage} palette={palette} project={project} />
      ))}
    </>
  );
}

export default function TopologyScene({ stages, palette }: { stages: Stage[]; palette: Palette }) {
  return (
    <Canvas
      orthographic
      dpr={[1, 2]}
      camera={{ position: [0, 0, 100], zoom: 1 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <Graph stages={stages} palette={palette} />
    </Canvas>
  );
}

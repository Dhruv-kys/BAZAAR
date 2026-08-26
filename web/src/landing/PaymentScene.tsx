import { useEffect, useRef } from "react";
import "./PaymentScene.css";

interface Node {
  x: number;
  y: number;
  r: number;
  label: string;
  phase: number;
}

interface Edge {
  a: number;
  b: number;
  stage: number;
}

const NODES: Node[] = [
  { x: 0.06, y: 0.14, r: 3.5, label: "intent", phase: 0 },
  { x: 0.22, y: 0.06, r: 3, label: "catalog", phase: 1.1 },
  { x: 0.4, y: 0.13, r: 4.5, label: "agent", phase: 0.4 },
  { x: 0.62, y: 0.05, r: 3, label: "policy", phase: 2.2 },
  { x: 0.82, y: 0.14, r: 3.5, label: "ledger", phase: 1.7 },
  { x: 0.95, y: 0.07, r: 3, label: "razorpay", phase: 2.6 },
  { x: 0.1, y: 0.9, r: 3, label: "retry", phase: 3.1 },
  { x: 0.3, y: 0.95, r: 3.5, label: "route", phase: 0.7 },
  { x: 0.52, y: 0.88, r: 5, label: "gate", phase: 0.9 },
  { x: 0.74, y: 0.96, r: 3, label: "settle", phase: 2.1 },
  { x: 0.92, y: 0.87, r: 3.5, label: "receipt", phase: 1.4 },
];

const EDGES: Edge[] = [
  { a: 0, b: 2, stage: 0 },
  { a: 1, b: 2, stage: 0 },
  { a: 2, b: 3, stage: 0.12 },
  { a: 3, b: 4, stage: 0.28 },
  { a: 4, b: 5, stage: 0.42 },
  { a: 6, b: 7, stage: 0.1 },
  { a: 7, b: 8, stage: 0.3 },
  { a: 8, b: 9, stage: 0.55 },
  { a: 9, b: 10, stage: 0.72 },
  { a: 2, b: 7, stage: 0.2 },
  { a: 4, b: 10, stage: 0.66 },
];

interface Particle {
  edge: number;
  t: number;
  speed: number;
  held: number;
}

export function PaymentScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const particles: Particle[] = EDGES.map((_, i) => ({
      edge: i,
      t: Math.random(),
      speed: 0.0022 + Math.random() * 0.0018,
      held: 0,
    }));

    let progress = 0;
    let targetProgress = 0;
    let pointerX = 0.5;
    let pointerY = 0.5;
    let targetPX = 0.5;
    let targetPY = 0.5;

    const onScroll = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      targetProgress = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    };
    const onPointer = (e: PointerEvent) => {
      targetPX = e.clientX / window.innerWidth;
      targetPY = e.clientY / window.innerHeight;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onPointer, { passive: true });

    const pos = (n: Node) => {
      const drift = reduced ? 0 : Math.sin(performance.now() / 2600 + n.phase) * 5;
      const parX = (pointerX - 0.5) * (10 + n.r * 2.2);
      const parY = (pointerY - 0.5) * (7 + n.r * 1.6);
      const spread = 0.86 + progress * 0.14;
      const cx = 0.5 + (n.x - 0.5) * spread;
      return { x: cx * width + parX, y: n.y * height + drift + parY };
    };

    let raf = 0;
    const frame = () => {
      progress += (targetProgress - progress) * 0.06;
      pointerX += (targetPX - pointerX) * 0.05;
      pointerY += (targetPY - pointerY) * 0.05;

      const line = read("--line-strong", "#d3cec3");
      const ink3 = read("--ink-3", "#747067");
      const ink = read("--ink", "#1c1b18");
      const signal = read("--signal", "#b4532a");
      const positive = read("--positive", "#2f7a55");

      ctx.clearRect(0, 0, width, height);

      EDGES.forEach((e, i) => {
        const active = progress >= e.stage - 0.08;
        const a = pos(NODES[e.a]);
        const b = pos(NODES[e.b]);
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2 - 34 - progress * 16;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.quadraticCurveTo(mx, my, b.x, b.y);
        ctx.strokeStyle = active ? line : line;
        ctx.globalAlpha = active ? 1 : 0.3;
        ctx.lineWidth = active ? 1.2 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;

        const p = particles[i];
        if (!reduced) {
          if (p.held > 0) {
            p.held -= 1;
          } else {
            p.t += p.speed * (0.6 + progress * 1.5);
            if (p.t >= 1) {
              p.t = 0;
              p.held = NODES[e.b].label === "gate" ? 52 : 0;
            }
          }
        }

        if (!active) return;
        const t = p.t;
        const it = 1 - t;
        const px = it * it * a.x + 2 * it * t * mx + t * t * b.x;
        const py = it * it * a.y + 2 * it * t * my + t * t * b.y;

        const gated = NODES[e.b].label === "gate" && p.held > 0;
        ctx.beginPath();
        ctx.arc(px, py, gated ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = gated ? signal : NODES[e.a].label === "gate" ? positive : ink3;
        ctx.fill();
      });

      NODES.forEach((n, i) => {
        const { x, y } = pos(n);
        const lit = progress * NODES.length >= i - 1;

        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = lit ? ink : line;
        ctx.fill();

        if (n.label === "gate") {
          const pulse = reduced ? 0 : (Math.sin(performance.now() / 900) + 1) / 2;
          ctx.beginPath();
          ctx.arc(x, y, n.r + 5 + pulse * 5, 0, Math.PI * 2);
          ctx.strokeStyle = signal;
          ctx.globalAlpha = 0.15 + pulse * 0.2;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return <canvas ref={canvasRef} className="scene" aria-hidden="true" />;
}

import { useEffect, useRef } from "react";
import "./WatercolorField.css";

/*
 * An ambient watercolour wash. The pigment is painted into a deliberately tiny
 * canvas and stretched across the viewport by CSS, so the browser's own scaling
 * does the diffusion for free — a full-size canvas plus a real blur costs far
 * more and looks harder at the edges.
 */

const BACKING_WIDTH = 420;
const BACKING_HEIGHT = 280;
const FRAME_MS = 1000 / 24;
const PIGMENTS = ["--flame", "--ember", "--gold", "--sage", "--ochre"] as const;

/* Offsets of the lobes that make one bloom, as fractions of its radius. Real
   washes spread in uneven fingers rather than a disc, and the overlaps are
   where the pigment pools darkest. */
const LOBES = [
  { dx: 0, dy: 0, scale: 1 },
  { dx: 0.42, dy: -0.24, scale: 0.72 },
  { dx: -0.34, dy: 0.3, scale: 0.66 },
  { dx: 0.18, dy: 0.44, scale: 0.58 },
  { dx: -0.44, dy: -0.28, scale: 0.5 },
];

interface Bloom {
  hx: number;
  hy: number;
  driftX: number;
  driftY: number;
  radius: number;
  phase: number;
  color: string;
  alpha: number;
}

function readPigments(): string[] {
  const style = getComputedStyle(document.documentElement);
  return PIGMENTS.map((token) => style.getPropertyValue(token).trim() || "#c98a2a");
}

function makeBlooms(colors: string[]): Bloom[] {
  // Fixed arrangement rather than random. Pigment is kept out of the centre
  // column and off the top band: measuring found the header slug and the
  // eyebrow labels falling to 3.3:1 when a bloom sat under them.
  const layout = [
    { hx: 0.07, hy: 0.38, radius: 0.44, alpha: 0.30 },
    { hx: 0.94, hy: 0.33, radius: 0.40, alpha: 0.26 },
    { hx: 0.82, hy: 0.88, radius: 0.48, alpha: 0.24 },
    { hx: 0.13, hy: 0.92, radius: 0.38, alpha: 0.22 },
    { hx: 0.60, hy: 0.70, radius: 0.28, alpha: 0.13 },
  ];
  return layout.map((spot, i) => ({
    ...spot,
    driftX: 0.030 + i * 0.007,
    driftY: 0.021 + i * 0.005,
    phase: i * 1.27,
    color: colors[i % colors.length],
  }));
}

function paint(ctx: CanvasRenderingContext2D, blooms: Bloom[], t: number, dark: boolean): void {
  ctx.clearRect(0, 0, BACKING_WIDTH, BACKING_HEIGHT);
  // Pigment on paper subtracts light, so overlapping washes deepen. On a dark
  // ground the same layering has to add instead, or every bloom turns to mud.
  ctx.globalCompositeOperation = dark ? "screen" : "multiply";

  for (const bloom of blooms) {
    // Two out-of-phase sines per axis, so the drift never settles into a
    // visible loop the way a single period would.
    const sway = Math.sin(t * bloom.driftX + bloom.phase) * 0.06
      + Math.sin(t * bloom.driftX * 0.41 + bloom.phase * 1.9) * 0.03;
    const rise = Math.cos(t * bloom.driftY + bloom.phase * 0.7) * 0.05
      + Math.cos(t * bloom.driftY * 0.53 + bloom.phase) * 0.025;
    const breath = 1 + Math.sin(t * bloom.driftY * 0.6 + bloom.phase) * 0.10;

    const x = (bloom.hx + sway) * BACKING_WIDTH;
    const y = (bloom.hy + rise) * BACKING_HEIGHT;
    const r = bloom.radius * breath * BACKING_HEIGHT;

    for (const lobe of LOBES) {
      const lx = x + lobe.dx * r * (0.85 + Math.sin(t * 0.09 + bloom.phase + lobe.dx * 4) * 0.15);
      const ly = y + lobe.dy * r * (0.85 + Math.cos(t * 0.07 + bloom.phase + lobe.dy * 4) * 0.15);
      const lr = r * lobe.scale;

      const wash = ctx.createRadialGradient(lx, ly, lr * 0.15, lx, ly, lr);
      wash.addColorStop(0, bloom.color);
      // Held near full strength most of the way out, then dropped fast: that
      // late edge is what makes it read as a pooled wash and not a glow.
      wash.addColorStop(0.72, bloom.color);
      wash.addColorStop(0.92, bloom.color);
      wash.addColorStop(1, "transparent");

      ctx.globalAlpha = bloom.alpha * lobe.scale;
      ctx.fillStyle = wash;
      ctx.beginPath();
      ctx.arc(lx, ly, lr, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

export function WatercolorField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    canvas.width = BACKING_WIDTH;
    canvas.height = BACKING_HEIGHT;

    let blooms = makeBlooms(readPigments());
    let dark = document.documentElement.classList.contains("dark");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let raf = 0;
    let last = 0;
    const start = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < FRAME_MS) return;
      last = now;
      paint(ctx, blooms, (now - start) / 1000, dark);
    };

    const run = () => {
      cancelAnimationFrame(raf);
      if (still.matches || document.hidden) {
        paint(ctx, blooms, 0, dark);
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    // The pigments are theme tokens, so a theme flip has to re-read them.
    const themes = new MutationObserver(() => {
      blooms = makeBlooms(readPigments());
      dark = document.documentElement.classList.contains("dark");
      if (still.matches || document.hidden) paint(ctx, blooms, 0, dark);
    });
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    document.addEventListener("visibilitychange", run);
    still.addEventListener("change", run);
    run();

    return () => {
      cancelAnimationFrame(raf);
      themes.disconnect();
      document.removeEventListener("visibilitychange", run);
      still.removeEventListener("change", run);
    };
  }, []);

  return <canvas ref={canvasRef} className="wash" aria-hidden="true" />;
}

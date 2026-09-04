import { useEffect, useRef } from "react";
import { growFlower, layAll, layNext, rand, type Flower } from "./flowers";
import "./AmbientFlowers.css";

/*
 * The page grows its own garden, slowly, in the margins. Same painter as the
 * landing's burst, sown far apart and left to fade — the background is a thing
 * being made rather than a texture sitting still behind the words.
 */

const SPAWN_MS = 4200;
const STROKES_PER_FRAME = 2;
const FADE_PER_FRAME = 0.00035;
const MAX_LIVE = 14;

/* Text runs down the middle of every page, so pigment is sown to either side
   of it. Measuring contrast over the old background is what put it there. */
const isNarrow = () => window.innerWidth < 820;

/*
 * A phone has no margin: the text column is the whole width, and the header is
 * the worst place a flower could land. There, blooms are pinned to the very
 * edges and kept below the chrome, so only their outer petals reach the page.
 */
function marginPoint(): { x: number; y: number } {
  const left = Math.random() < 0.5;
  const narrow = isNarrow();
  const inset = narrow ? 0.08 : 0.2;
  return {
    x: (left ? rand(-0.04, inset - 0.04) : rand(1.04 - inset, 1.04)) * window.innerWidth,
    y: rand(narrow ? 0.32 : 0.05, 0.95) * window.innerHeight,
  };
}

export function AmbientFlowers() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let live: Flower[] = [];
    let raf = 0;
    let lastSpawn = 0;

    const sow = (now: number) => {
      const at = marginPoint();
      const flower = growFlower(at.x, at.y, now);
      flower.scale *= isNarrow() ? 0.6 : 1.15;
      live.push(flower);
      if (live.length > MAX_LIVE) live.shift();
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (now - lastSpawn > SPAWN_MS) {
        lastSpawn = now;
        sow(now);
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${FADE_PER_FRAME})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Only the unfinished ones cost anything: a finished flower is already
      // on the canvas and is never painted twice.
      for (const flower of live) layNext(ctx, flower, STROKES_PER_FRAME);
    };

    const run = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (still.matches) {
        // A settled garden rather than none: painted once, then left alone.
        if (!live.length) {
          for (let i = 0; i < 7; i++) sow(0);
          live.forEach((flower) => layAll(ctx, flower));
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    // A page should never be arrived at bare. Two flowers are already open
    // before the first frame; the rest are sown at the slow cadence.
    if (!still.matches) {
      for (let i = 0; i < 2; i++) {
        const at = marginPoint();
        const seeded = growFlower(at.x, at.y, 0);
        seeded.scale *= isNarrow() ? 0.6 : 1.15;
        layAll(ctx, seeded);
        live.push(seeded);
      }
    }

    document.addEventListener("visibilitychange", run);
    still.addEventListener("change", run);
    window.addEventListener("resize", size);
    run();

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", run);
      still.removeEventListener("change", run);
      window.removeEventListener("resize", size);
    };
  }, []);

  return <canvas ref={canvasRef} className="garden" aria-hidden="true" />;
}

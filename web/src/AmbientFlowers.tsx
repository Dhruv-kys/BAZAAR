import { useEffect, useRef } from "react";
import { growFlower, layFlower, rand, type Flower } from "./flowers";
import "./AmbientFlowers.css";

/*
 * The page grows its own garden, slowly, in the margins. Same painter as the
 * landing's burst, sown far apart and left to fade — the background is a thing
 * being made rather than a texture sitting still behind the words.
 */

const SPAWN_MS = 4200;
const GROW_MS = 4200;
const FADE_PER_FRAME = 0.00035;
const MAX_LIVE = 14;

/* Text runs down the middle of every page, so pigment is sown to either side
   of it. Measuring contrast over the old background is what put it there. */
function marginPoint(): { x: number; y: number } {
  const left = Math.random() < 0.5;
  return {
    x: (left ? rand(0.01, 0.2) : rand(0.8, 0.99)) * window.innerWidth,
    y: rand(0.05, 0.95) * window.innerHeight,
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
      flower.scale *= 1.15;
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

      for (const flower of live) {
        const age = now - flower.born;
        if (age > GROW_MS) continue;
        layFlower(ctx, flower, 1 - Math.pow(1 - Math.min(1, age / GROW_MS), 3));
      }
    };

    const run = () => {
      cancelAnimationFrame(raf);
      if (document.hidden) return;
      if (still.matches) {
        // A settled garden rather than none: painted once, then left alone.
        if (!live.length) {
          for (let i = 0; i < 7; i++) sow(0);
          live.forEach((flower) => layFlower(ctx, flower, 1));
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };

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

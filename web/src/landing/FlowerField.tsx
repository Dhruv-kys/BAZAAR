import { useEffect, useRef } from "react";
import { growFlower, layAll, layNext, rand, type Flower } from "../flowers";
import "./FlowerField.css";

const FADE_PER_FRAME = 0.0006;

/*
 * A phone has roughly a third of a laptop's area, so the same cadence fills it
 * three times over in the same span and the painting reads as hurried. Both the
 * sowing and the brush slow down to match the smaller canvas.
 */
const narrow = () => window.innerWidth < 820;
const spawnMs = () => (narrow() ? 2900 : 1150);
const strokesPerFrame = () => (narrow() ? 2 : 4);

export function FlowerField({ painting }: { painting: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !painting) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const open: Flower[] = [];
    let raf = 0;
    let lastSpawn = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);

      if (now - lastSpawn > spawnMs()) {
        lastSpawn = now;
        const bloom = growFlower(
          rand(0.06, 0.94) * window.innerWidth,
          rand(0.10, 0.92) * window.innerHeight,
          now,
        );
        // Full-size blooms swamp a phone, which is half of why the painting
        // felt hurried there: fewer of them, but each one covering far more.
        if (narrow()) bloom.scale *= 0.72;
        open.push(bloom);
        if (open.length > 40) open.shift();
      }

      // Erase rather than paint over, so what is left stays transparent and the
      // wash underneath keeps showing through as the garden ghosts away.
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${FADE_PER_FRAME})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      for (const flower of open) {
        if (still) layAll(ctx, flower);
        else layNext(ctx, flower, strokesPerFrame());
      }
    };

    raf = requestAnimationFrame(tick);
    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [painting]);

  return <canvas ref={canvasRef} className={`bloom${painting ? " is-open" : ""}`} aria-hidden="true" />;
}

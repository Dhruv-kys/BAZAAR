import { useEffect, useRef } from "react";
import "./FlowerField.css";

/*
 * Watercolour flowers, written rather than drawn — the same idea as the work
 * this design follows, where the artefact is code and the image is what the
 * code renders. Every bloom is generated fresh: petal count, lean, palette and
 * the wobble of each edge, so no two runs paint the same garden.
 */

/*
 * Petals are layered with ordinary alpha here and the whole canvas is
 * multiplied onto the page by CSS. Compositing with multiply inside the canvas
 * instead blends each stroke against transparent black, which turns every
 * flower to mud no matter how pale the palette is.
 */
const PALETTES = [
  ["#fbc9b2", "#f09a76", "#dd6640"],
  ["#fbc4d2", "#ee92aa", "#d15d7c"],
  ["#fdd6a8", "#f5b169", "#e08128"],
  ["#f9bdbd", "#ec8d8d", "#cc5158"],
  ["#fde5b4", "#f2c877", "#d7a032"],
  ["#f9c2cb", "#ec98a5", "#c96a79"],
];
const LEAF = ["#a8c79a", "#7fa876", "#5c8a58"];

const SPAWN_MS = 620;
const FADE_PER_FRAME = 0.0009;
const GROW_MS = 1500;

interface Petal {
  angle: number;
  length: number;
  width: number;
  lean: number;
  tone: number;
}

interface Flower {
  x: number;
  y: number;
  scale: number;
  spin: number;
  petals: Petal[];
  palette: string[];
  stem: number;
  born: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function growFlower(x: number, y: number, now: number): Flower {
  const count = Math.round(rand(5, 8));
  const spread = (Math.PI * 2) / count;
  return {
    x,
    y,
    scale: rand(0.55, 1.35),
    spin: rand(0, Math.PI * 2),
    stem: Math.random() < 0.45 ? rand(60, 130) : 0,
    born: now,
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    petals: Array.from({ length: count }, (_, i) => ({
      angle: i * spread + rand(-0.14, 0.14),
      length: rand(38, 62),
      width: rand(22, 36),
      lean: rand(-0.35, 0.35),
      tone: Math.random(),
    })),
  };
}

/* One petal, laid down as a few offset translucent passes. A single fill reads
   as a vector shape; the overlap is what makes it read as pigment. */
function layPetal(ctx: CanvasRenderingContext2D, petal: Petal, palette: string[], open: number): void {
  const len = petal.length * open;
  const wid = petal.width * open;

  for (let pass = 0; pass < 3; pass++) {
    const jx = rand(-2.2, 2.2);
    const jy = rand(-2.2, 2.2);
    const shrink = 1 - pass * 0.17;

    ctx.save();
    ctx.rotate(petal.angle + petal.lean * pass * 0.06);
    ctx.beginPath();
    ctx.moveTo(jx, jy);
    ctx.bezierCurveTo(
      jx - wid * 0.62 * shrink, jy - len * 0.30 * shrink,
      jx - wid * 0.48 * shrink, jy - len * 0.86 * shrink,
      jx, jy - len * shrink,
    );
    ctx.bezierCurveTo(
      jx + wid * 0.48 * shrink, jy - len * 0.86 * shrink,
      jx + wid * 0.62 * shrink, jy - len * 0.30 * shrink,
      jx, jy,
    );

    // Pale at the throat, deepening toward the rim where real pigment pools.
    const wash = ctx.createLinearGradient(0, 0, 0, -len * shrink);
    wash.addColorStop(0, palette[0]);
    wash.addColorStop(0.45, palette[1]);
    wash.addColorStop(1, palette[2]);
    ctx.fillStyle = wash;
    ctx.globalAlpha = 0.30 - pass * 0.07;
    ctx.fill();
    ctx.restore();
  }
}

function layFlower(ctx: CanvasRenderingContext2D, flower: Flower, open: number): void {
  ctx.save();
  ctx.translate(flower.x, flower.y);
  ctx.scale(flower.scale, flower.scale);
  ctx.rotate(flower.spin);

  if (flower.stem) {
    ctx.save();
    ctx.globalAlpha = 0.30 * open;
    ctx.strokeStyle = LEAF[2];
    ctx.lineWidth = rand(3, 5.5);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(rand(-16, 16), flower.stem * 0.55 * open, rand(-10, 10), flower.stem * open);
    ctx.stroke();
    ctx.restore();
  }

  const petalsOut = Math.min(flower.petals.length, Math.ceil(open * flower.petals.length * 1.25));
  flower.petals.slice(0, petalsOut).forEach((petal, i) => {
    const each = Math.max(0, Math.min(1, open * flower.petals.length - i));
    if (each > 0) layPetal(ctx, petal, flower.palette, each);
  });

  // The dark eye and its stamens, once the petals are mostly open.
  if (open > 0.55) {
    const eye = (open - 0.55) / 0.45;
    ctx.globalAlpha = 0.30 * eye;
    ctx.fillStyle = flower.palette[2];
    ctx.beginPath();
    ctx.arc(0, 0, 5 * eye, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = flower.palette[2];
    ctx.globalAlpha = 0.24 * eye;
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + flower.spin;
      const r = rand(9, 21) * eye;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function FlowerField({ painting }: { painting: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !painting) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
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

      if (now - lastSpawn > SPAWN_MS) {
        lastSpawn = now;
        open.push(growFlower(rand(0.06, 0.94) * window.innerWidth, rand(0.10, 0.92) * window.innerHeight, now));
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
        const age = now - flower.born;
        if (age > GROW_MS) continue;
        const eased = still ? 1 : 1 - Math.pow(1 - Math.min(1, age / GROW_MS), 3);
        layFlower(ctx, flower, eased);
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

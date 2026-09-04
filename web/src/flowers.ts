/*
 * Watercolour flowers, written rather than drawn — the same idea as the work
 * this design follows, where the artefact is code and the image is what the
 * code renders.
 *
 * A petal is a bundle of bristle strokes, not a filled outline. A brush lays
 * pigment down in many thin passes that converge at the ends and bow apart in
 * the middle, and the shape is whatever those passes leave behind. Filling a
 * bezier gives you a smooth edge and a flat interior, which is exactly what a
 * brush never produces.
 *
 * Strokes are generated once, in paint order, and deposited a few per frame
 * onto a canvas that is never cleared — so the flower is painted rather than
 * re-rendered, and nothing shivers between frames.
 */

const PALETTES = [
  ["#fbc9b2", "#f09a76", "#dd6640"],
  ["#fbc4d2", "#ee92aa", "#d15d7c"],
  ["#fdd6a8", "#f5b169", "#e08128"],
  ["#f9bdbd", "#ec8d8d", "#cc5158"],
  ["#fde5b4", "#f2c877", "#d7a032"],
  ["#f9c2cb", "#ec98a5", "#c96a79"],
  // Autumn: torii vermillion, maple, and bronze, so the garden turns rather
  // than staying in permanent spring.
  ["#f7bfb0", "#e08a6b", "#b8452a"],
  ["#f5b9b6", "#dd8177", "#a8382f"],
  ["#f6c8a8", "#dfa060", "#a8641f"],
];
const LEAF = ["#a8c79a", "#7fa876", "#5c8a58"];

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

export interface Stroke {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  width: number;
  alpha: number;
  color: string;
}

export interface Flower {
  x: number;
  y: number;
  scale: number;
  strokes: Stroke[];
  laid: number;
  born: number;
}

function spin(x: number, y: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

/* One petal's worth of bristles, already rotated into the flower's frame. */
function bristles(angle: number, palette: string[]): Stroke[] {
  const length = rand(42, 68);
  const width = rand(34, 54);
  const tipLean = rand(-0.18, 0.18);
  const count = Math.round(rand(26, 40));
  const out: Stroke[] = [];

  for (let i = 0; i <= count; i++) {
    // Skip a few so the paper shows through, the way a loaded brush does.
    if (Math.random() < 0.09) continue;

    const across = (i / count) * 2 - 1;
    const edge = Math.abs(across);
    // A bristle that stops short reads as dry brush at the tip.
    const reach = length * (Math.random() < 0.18 ? rand(0.55, 0.82) : rand(0.9, 1.04));
    const bow = (width / 2) * (1 - edge * edge * 0.08);

    const p0 = spin(across * width * 0.1 + rand(-1, 1), rand(-2, 4), angle);
    const pc = spin(across * bow + rand(-2.2, 2.2), -reach * rand(0.42, 0.58), angle);
    const p1 = spin(across * width * 0.34 + tipLean * width + rand(-1.6, 1.6), -reach, angle);

    // Pigment crowds the rim as the wash dries, and thins toward the throat.
    const rim = 0.24 + edge * edge * 0.5;
    out.push({
      x0: p0[0], y0: p0[1],
      cx: pc[0], cy: pc[1],
      x1: p1[0], y1: p1[1],
      width: rand(1.1, 2.9),
      alpha: rim * rand(0.55, 1.15),
      color: palette[edge > 0.72 ? 2 : edge > 0.34 ? 1 : 0],
    });
  }
  return out;
}

export function growFlower(x: number, y: number, now: number): Flower {
  const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  const petals = Math.round(rand(5, 8));
  const spread = (Math.PI * 2) / petals;
  const turn = rand(0, Math.PI * 2);
  const strokes: Stroke[] = [];

  if (Math.random() < 0.4) {
    const drop = rand(70, 145);
    const bend = rand(-24, 24);
    for (let i = 0; i < 7; i++) {
      const off = rand(-1.6, 1.6);
      strokes.push({
        x0: off, y0: 8,
        cx: bend + off, cy: drop * 0.55,
        x1: rand(-12, 12) + off, y1: drop,
        width: rand(0.8, 1.9),
        alpha: rand(0.18, 0.4),
        color: LEAF[i % LEAF.length],
      });
    }
  }

  // Uneven spacing: perfectly spaced petals are what make a painted flower
  // look like a logo of one.
  for (let p = 0; p < petals; p++) {
    strokes.push(...bristles(turn + p * spread + rand(-0.22, 0.22), palette));
  }

  const stamens = Math.round(rand(10, 16));
  for (let i = 0; i < stamens; i++) {
    const a = (i / stamens) * Math.PI * 2 + rand(-0.22, 0.22);
    const reach = rand(9, 23);
    strokes.push({
      x0: 0, y0: 0,
      cx: Math.cos(a) * reach * 0.5, cy: Math.sin(a) * reach * 0.5,
      x1: Math.cos(a) * reach, y1: Math.sin(a) * reach,
      width: rand(0.7, 1.4),
      alpha: rand(0.28, 0.55),
      color: palette[2],
    });
  }

  return { x, y, scale: rand(0.55, 1.35), strokes, laid: 0, born: now };
}

/* Deposit the next few strokes. Returns true once the flower is finished. */
export function layNext(ctx: CanvasRenderingContext2D, flower: Flower, count: number): boolean {
  if (flower.laid >= flower.strokes.length) return true;

  ctx.save();
  ctx.translate(flower.x, flower.y);
  ctx.scale(flower.scale, flower.scale);
  ctx.lineCap = "round";

  const until = Math.min(flower.strokes.length, flower.laid + count);
  for (; flower.laid < until; flower.laid++) {
    const s = flower.strokes[flower.laid];
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1);
    ctx.stroke();
  }

  ctx.restore();
  return flower.laid >= flower.strokes.length;
}

export function layAll(ctx: CanvasRenderingContext2D, flower: Flower): void {
  layNext(ctx, flower, flower.strokes.length);
}

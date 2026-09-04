/*
 * Watercolour flowers, written rather than drawn — the same idea as the work
 * this design follows, where the artefact is code and the image is what the
 * code renders. Every bloom is generated fresh, so no two runs paint the same
 * garden.
 *
 * Every random value is drawn once, when the flower is made, and stored. Rolling
 * them inside the paint call instead re-rolls them on every frame, and the petal
 * shivers all the way through its opening.
 *
 * Shared by the ambient background and the landing's burst, which differ only
 * in how often they sow and how loudly they paint.
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

export const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface Mottle {
  x: number;
  y: number;
  r: number;
  a: number;
}

export interface Petal {
  angle: number;
  length: number;
  width: number;
  /* Control points for each side, drawn apart so no petal is its own mirror. */
  leftBow: number;
  leftRise: number;
  rightBow: number;
  rightRise: number;
  tipLean: number;
  mottles: Mottle[];
}

export interface Flower {
  x: number;
  y: number;
  scale: number;
  spin: number;
  petals: Petal[];
  palette: string[];
  stem: number;
  stemBend: number;
  stemDrift: number;
  stamens: { angle: number; reach: number }[];
  born: number;
}

function makePetal(angle: number): Petal {
  const length = rand(40, 64);
  const width = rand(24, 38);
  return {
    angle,
    length,
    width,
    leftBow: rand(0.52, 0.78),
    leftRise: rand(0.22, 0.42),
    rightBow: rand(0.52, 0.78),
    rightRise: rand(0.22, 0.42),
    tipLean: rand(-0.16, 0.16),
    mottles: Array.from({ length: Math.round(rand(2, 4)) }, () => ({
      x: rand(-0.3, 0.3),
      y: rand(-0.85, -0.3),
      r: rand(0.34, 0.66),
      a: rand(0.05, 0.12),
    })),
  };
}

export function growFlower(x: number, y: number, now: number): Flower {
  const count = Math.round(rand(5, 8));
  const spread = (Math.PI * 2) / count;
  const stamenCount = Math.round(rand(9, 15));
  return {
    x,
    y,
    scale: rand(0.55, 1.35),
    spin: rand(0, Math.PI * 2),
    stem: Math.random() < 0.4 ? rand(70, 140) : 0,
    stemBend: rand(-22, 22),
    stemDrift: rand(-12, 12),
    born: now,
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    stamens: Array.from({ length: stamenCount }, (_, i) => ({
      angle: (i / stamenCount) * Math.PI * 2 + rand(-0.2, 0.2),
      reach: rand(9, 22),
    })),
    // Petals are spaced unevenly. Perfect spacing is what makes a drawing of a
    // flower look like a logo of one.
    petals: Array.from({ length: count }, (_, i) => makePetal(i * spread + rand(-0.2, 0.2))),
  };
}

function tracePetal(ctx: CanvasRenderingContext2D, petal: Petal, open: number): void {
  const len = petal.length * open;
  const wid = petal.width * open;
  const tip = petal.tipLean * wid;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-wid * petal.leftBow, -len * petal.leftRise, -wid * 0.5, -len * 0.88, tip, -len);
  ctx.bezierCurveTo(wid * 0.5, -len * 0.88, wid * petal.rightBow, -len * petal.rightRise, 0, 0);
  ctx.closePath();
}

function layPetal(ctx: CanvasRenderingContext2D, petal: Petal, palette: string[], open: number): void {
  const len = petal.length * open;
  const wid = petal.width * open;

  ctx.save();
  ctx.rotate(petal.angle);
  tracePetal(ctx, petal, open);
  ctx.clip();

  const body = ctx.createLinearGradient(0, 0, 0, -len);
  body.addColorStop(0, palette[0]);
  body.addColorStop(0.5, palette[1]);
  body.addColorStop(1, palette[2]);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = body;
  ctx.fillRect(-wid * 1.5, -len * 1.2, wid * 3, len * 1.4);

  // Pigment carried to the rim as the wash dries. A stroke around the outline
  // would read as ink; this pools inside the shape the way paint does.
  const rim = ctx.createRadialGradient(0, -len * 0.34, len * 0.1, 0, -len * 0.34, len * 0.78);
  rim.addColorStop(0, "transparent");
  rim.addColorStop(0.68, "transparent");
  rim.addColorStop(1, palette[2]);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = rim;
  ctx.fillRect(-wid * 1.5, -len * 1.2, wid * 3, len * 1.4);

  // Granulation, so the fill is not one flat sheet of colour.
  ctx.fillStyle = palette[2];
  for (const spot of petal.mottles) {
    ctx.globalAlpha = spot.a;
    ctx.beginPath();
    ctx.arc(spot.x * wid, spot.y * len, spot.r * wid, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function layFlower(ctx: CanvasRenderingContext2D, flower: Flower, open: number): void {
  ctx.save();
  ctx.translate(flower.x, flower.y);
  ctx.scale(flower.scale, flower.scale);
  ctx.rotate(flower.spin);

  if (flower.stem) {
    ctx.save();
    ctx.globalAlpha = 0.5 * open;
    ctx.strokeStyle = LEAF[2];
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.quadraticCurveTo(flower.stemBend, flower.stem * 0.55 * open, flower.stemDrift, flower.stem * open);
    ctx.stroke();
    ctx.restore();
  }

  const petalsOut = Math.ceil(open * flower.petals.length * 1.2);
  flower.petals.slice(0, petalsOut).forEach((petal, i) => {
    const each = Math.max(0, Math.min(1, open * flower.petals.length - i));
    if (each > 0.02) layPetal(ctx, petal, flower.palette, each);
  });

  if (open > 0.6) {
    const eye = (open - 0.6) / 0.4;
    ctx.strokeStyle = flower.palette[2];
    ctx.globalAlpha = 0.4 * eye;
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    for (const stamen of flower.stamens) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(stamen.angle) * stamen.reach * eye, Math.sin(stamen.angle) * stamen.reach * eye);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.5 * eye;
    ctx.fillStyle = flower.palette[2];
    ctx.beginPath();
    ctx.arc(0, 0, 4.5 * eye, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

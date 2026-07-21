import { Container, Graphics } from "pixi.js";
import type { Season } from "@/lib/github/types";
import type { Rng } from "@/lib/world/rng";
import { SEASON_PALETTE } from "@/lib/world/seasons";

const PATH = {
  light: 0xecd9a4,
  mid: 0xd2b06a,
  dark: 0xa88448,
  edge: 0x6f8f3a,
};

const FENCE = { light: 0xb88850, mid: 0x7a4e28, dark: 0x3f2410 };
const STONE = { light: 0xd0c8b8, mid: 0x8e8894, dark: 0x565060 };

function px(n: number): number {
  return Math.round(n);
}

export function quadPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * x1 + t * t * x2,
    y: u * u * y0 + 2 * u * t * y1 + t * t * y2,
  };
}

export interface PathDef {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  halfW: number;
}

/** Shared path curves — used by dirt ribbons and fence props. */
export function forestPathDefs(worldWidth: number, worldHeight: number): PathDef[] {
  return [
    {
      x0: worldWidth * 0.0,
      y0: worldHeight * 0.58,
      x1: worldWidth * 0.32,
      y1: worldHeight * 0.4,
      x2: worldWidth * 0.55,
      y2: worldHeight * 0.62,
      halfW: 16,
    },
    {
      x0: worldWidth * 0.55,
      y0: worldHeight * 0.62,
      x1: worldWidth * 0.78,
      y1: worldHeight * 0.78,
      x2: worldWidth * 1.0,
      y2: worldHeight * 0.52,
      halfW: 14,
    },
    {
      x0: worldWidth * 0.42,
      y0: worldHeight * 0.5,
      x1: worldWidth * 0.5,
      y1: worldHeight * 0.3,
      x2: worldWidth * 0.7,
      y2: worldHeight * 0.2,
      halfW: 11,
    },
  ];
}

/**
 * Build a Zelda/Stardew-style forest floor as SEPARATE Graphics nodes.
 * (One giant Graphics with thousands of fills breaks Pixi v8 rendering.)
 */
export function buildForestFloor(
  worldWidth: number,
  worldHeight: number,
  season: Season,
  rng: Rng
): Container {
  const root = new Container();
  const palette = SEASON_PALETTE[season];
  const horizon = 0;

  root.addChild(drawSkyAndGrass(worldWidth, worldHeight, horizon, palette, rng));
  root.addChild(drawPaths(worldWidth, worldHeight, rng));
  root.addChild(drawProps(worldWidth, worldHeight, horizon, season, rng));

  return root;
}

/** No sky band — meadow fills the whole map */
export const WORLD_SKY_RATIO = 0;

function drawSkyAndGrass(
  worldWidth: number,
  worldHeight: number,
  horizon: number,
  palette: (typeof SEASON_PALETTE)[Season],
  rng: Rng
): Graphics {
  const g = new Graphics();

  // Full meadow — no sky strip
  g.rect(0, 0, worldWidth, worldHeight);
  g.fill(palette.grass);

  // Chunky tonal tiles (big + few = readable, Pixi-safe)
  const tile = 48;
  for (let y = horizon; y < worldHeight; y += tile) {
    for (let x = 0; x < worldWidth; x += tile) {
      const n = rng.next();
      if (n < 0.33) {
        g.rect(px(x), px(y), tile, tile);
        g.fill({ color: palette.grassLight, alpha: 0.45 });
      } else if (n > 0.72) {
        g.rect(px(x), px(y), tile, tile);
        g.fill({ color: palette.grassDark, alpha: 0.35 });
      }
    }
  }

  // Larger grass clumps
  for (let i = 0; i < 180; i++) {
    const x = rng.float(0, worldWidth);
    const y = rng.float(8, worldHeight);
    g.rect(px(x), px(y - 5), 2, 6);
    g.fill(palette.grassDark);
    g.rect(px(x + 3), px(y - 4), 2, 5);
    g.fill(palette.grassLight);
    g.rect(px(x + 6), px(y - 6), 2, 7);
    g.fill(palette.grassDark);
  }

  return g;
}

function drawPaths(worldWidth: number, worldHeight: number, rng: Rng): Graphics {
  const g = new Graphics();
  for (const path of forestPathDefs(worldWidth, worldHeight)) {
    drawDirtRibbon(g, path, rng);
  }
  return g;
}

/** Irregular dirt ribbon — polygon edges + speckled texture (no circle stamps). */
function drawDirtRibbon(g: Graphics, path: PathDef, rng: Rng): void {
  const steps = 40;
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const centers: { x: number; y: number; nx: number; ny: number; w: number }[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = quadPoint(t, path.x0, path.y0, path.x1, path.y1, path.x2, path.y2);
    const t0 = Math.max(0, t - 0.01);
    const t1 = Math.min(1, t + 0.01);
    const a = quadPoint(t0, path.x0, path.y0, path.x1, path.y1, path.x2, path.y2);
    const b = quadPoint(t1, path.x0, path.y0, path.x1, path.y1, path.x2, path.y2);
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;

    const w =
      path.halfW +
      Math.sin(t * Math.PI * 5 + path.halfW) * 3.5 +
      Math.sin(t * Math.PI * 13) * 1.8 +
      rng.float(-1.5, 1.5);

    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
    centers.push({ x: p.x, y: p.y, nx, ny, w });
  }

  const underL = left.map((p, i) => ({
    x: p.x + centers[i]!.nx * 3,
    y: p.y + centers[i]!.ny * 3,
  }));
  const underR = right.map((p, i) => ({
    x: p.x - centers[i]!.nx * 3,
    y: p.y - centers[i]!.ny * 3,
  }));
  fillRibbon(g, underL, underR, PATH.edge);
  fillRibbon(g, left, right, PATH.mid);

  const hiL = centers.map((c) => ({
    x: c.x + c.nx * (c.w * 0.35),
    y: c.y + c.ny * (c.w * 0.35),
  }));
  const hiR = centers.map((c) => ({
    x: c.x - c.nx * (c.w * 0.35),
    y: c.y - c.ny * (c.w * 0.35),
  }));
  fillRibbon(g, hiL, hiR, PATH.light);

  for (let i = 2; i < centers.length - 2; i += 1) {
    const c = centers[i]!;
    if (rng.chance(0.55)) {
      const ox = rng.float(-c.w * 0.55, c.w * 0.55);
      const oy = rng.float(-2, 2);
      g.rect(
        px(c.x + c.nx * ox + c.ny * oy),
        px(c.y + c.ny * ox - c.nx * oy),
        rng.int(1, 3),
        rng.int(1, 2)
      );
      g.fill(rng.chance(0.5) ? PATH.dark : PATH.light);
    }
    if (rng.chance(0.2)) {
      g.rect(px(c.x + rng.float(-c.w * 0.4, c.w * 0.4)), px(c.y + rng.float(-2, 2)), 2, 2);
      g.fill(0x8a7350);
    }
  }

  for (let i = 4; i < centers.length - 4; i += 5) {
    if (!rng.chance(0.45)) continue;
    const c = centers[i]!;
    g.ellipse(c.x + rng.float(-4, 4), c.y + rng.float(-2, 2), rng.float(4, 8), rng.float(2, 4));
    g.fill({ color: PATH.dark, alpha: 0.35 });
  }
}

function fillRibbon(
  g: Graphics,
  left: { x: number; y: number }[],
  right: { x: number; y: number }[],
  color: number
): void {
  if (left.length < 2) return;
  g.moveTo(px(left[0]!.x), px(left[0]!.y));
  for (let i = 1; i < left.length; i++) {
    g.lineTo(px(left[i]!.x), px(left[i]!.y));
  }
  for (let i = right.length - 1; i >= 0; i--) {
    g.lineTo(px(right[i]!.x), px(right[i]!.y));
  }
  g.closePath();
  g.fill(color);
}

function drawProps(
  worldWidth: number,
  worldHeight: number,
  horizon: number,
  season: Season,
  rng: Rng
): Graphics {
  const g = new Graphics();

  // Flowers — chunky daisies
  const petals =
    season === "autumn"
      ? [0xf0c040, 0xe07030]
      : season === "winter"
        ? [0xe8f0ff, 0xd0e0f0]
        : [0xfff8f0, 0xfff060, 0xffb0c8];

  for (let i = 0; i < 55; i++) {
    const x = rng.float(24, worldWidth - 24);
    const y = rng.float(horizon + 30, worldHeight - 24);
    const color = rng.pick(petals);
    g.circle(px(x), px(y), 2);
    g.fill(0xf8e060);
    for (let p = 0; p < 4; p++) {
      const a = (p / 4) * Math.PI * 2;
      g.circle(px(x + Math.cos(a) * 3.5), px(y + Math.sin(a) * 3.5), 2);
      g.fill(color);
    }
  }

  // Mushrooms now come from mush.png sprites — keep only a few drawn accents
  if (season !== "winter") {
    for (let i = 0; i < 6; i++) {
      const x = rng.float(40, worldWidth - 40);
      const y = rng.float(horizon + 50, worldHeight - 30);
      g.rect(px(x - 1), px(y - 3), 3, 6);
      g.fill(0xf0e8d8);
      g.ellipse(px(x), px(y - 5), 6, 4);
      g.fill(0xd44040);
    }
  }

  // Fence posts along path — simple posts, not crosses
  for (let i = 0; i < 10; i++) {
    const t = 0.12 + i * 0.08;
    const p = quadPoint(
      t,
      worldWidth * 0.0,
      worldHeight * 0.58,
      worldWidth * 0.32,
      worldHeight * 0.4,
      worldWidth * 0.55,
      worldHeight * 0.62
    );
    const side = i % 2 === 0 ? -1 : 1;
    const fx = p.x + side * 22;
    const fy = p.y + side * 5;
    g.rect(px(fx - 1), px(fy - 12), 3, 14);
    g.fill(FENCE.mid);
    g.rect(px(fx - 1), px(fy - 12), 1, 14);
    g.fill(FENCE.light);
    // short rail on the path-facing side only
    g.rect(px(fx - (side > 0 ? 6 : 0)), px(fy - 8), 6, 2);
    g.fill(FENCE.dark);
  }

  // Signposts
  drawSign(g, worldWidth * 0.2, worldHeight * 0.52);
  drawSign(g, worldWidth * 0.72, worldHeight * 0.72);

  // Stone ruin (top-right clearing)
  const rx = worldWidth * 0.76;
  const ry = worldHeight * 0.26;
  for (let i = 0; i < 6; i++) {
    g.rect(px(rx + i * 10), px(ry - 14 - (i < 2 ? 6 : 0)), 10, 14 + (i < 2 ? 6 : 0));
    g.fill(i % 2 === 0 ? STONE.mid : STONE.dark);
    g.rect(px(rx + i * 10), px(ry - 14 - (i < 2 ? 6 : 0)), 10, 3);
    g.fill(STONE.light);
  }
  for (let j = 0; j < 4; j++) {
    g.rect(px(rx), px(ry + j * 10), 10, 12);
    g.fill(j % 2 === 0 ? STONE.dark : STONE.mid);
  }
  for (let k = 0; k < 8; k++) {
    g.rect(px(rx + 14 + rng.float(0, 36)), px(ry + 6 + rng.float(0, 20)), rng.int(3, 6), rng.int(2, 4));
    g.fill(STONE.dark);
  }

  // Campfire
  const cx = worldWidth * 0.84;
  const cy = worldHeight * 0.34;
  for (const [ox, oy] of [
    [-6, 2],
    [6, 2],
    [-4, 5],
    [4, 5],
    [0, 0],
  ] as const) {
    g.rect(px(cx + ox), px(cy + oy), 4, 3);
    g.fill(STONE.mid);
  }
  g.moveTo(px(cx), px(cy - 14));
  g.lineTo(px(cx - 6), px(cy + 2));
  g.lineTo(px(cx + 6), px(cy + 2));
  g.closePath();
  g.fill(0xf08820);
  g.moveTo(px(cx), px(cy - 10));
  g.lineTo(px(cx - 3), px(cy));
  g.lineTo(px(cx + 3), px(cy));
  g.closePath();
  g.fill(0xfff060);

  // Sparkles
  for (let i = 0; i < 25; i++) {
    const x = rng.float(0, worldWidth);
    const y = rng.float(horizon + 20, worldHeight);
    g.rect(px(x), px(y), 2, 2);
    g.fill({ color: 0xffffff, alpha: 0.75 });
  }

  return g;
}

function drawSign(g: Graphics, x: number, y: number): void {
  g.rect(px(x), px(y - 18), 3, 20);
  g.fill(FENCE.dark);
  g.rect(px(x - 8), px(y - 24), 18, 10);
  g.fill(FENCE.mid);
  g.rect(px(x - 6), px(y - 22), 14, 2);
  g.fill(PATH.light);
  g.rect(px(x - 6), px(y - 18), 10, 2);
  g.fill(PATH.light);
}

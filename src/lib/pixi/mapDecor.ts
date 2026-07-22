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
const STONE = { mid: 0x8e8894 };

function px(n: number): number {
  return Math.round(n);
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
  root.addChild(drawHorizontalTrail(worldWidth, worldHeight, rng));
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

/** Single left→right trail only (no spur / fork). */
function drawHorizontalTrail(worldWidth: number, worldHeight: number, rng: Rng): Graphics {
  const g = new Graphics();
  const y = worldHeight * 0.58;
  // Gentle horizontal S — stays roughly mid-height edge to edge
  const points = [
    { x: 0, y: y + 8 },
    { x: worldWidth * 0.22, y: y - 18 },
    { x: worldWidth * 0.45, y: y + 10 },
    { x: worldWidth * 0.7, y: y - 8 },
    { x: worldWidth, y: y + 4 },
  ];

  const center = samplePolyline(points, 14);
  if (center.length < 2) return g;

  const halfW = 14;
  const strokePath = (width: number, color: number) => {
    g.moveTo(px(center[0]!.x), px(center[0]!.y));
    for (let i = 1; i < center.length; i++) {
      g.lineTo(px(center[i]!.x), px(center[i]!.y));
    }
    g.stroke({ width, color, join: "round", cap: "round" });
  };

  strokePath(halfW * 2 + 5, PATH.edge);
  strokePath(halfW * 2, PATH.mid);
  strokePath(Math.max(4, halfW * 0.65), PATH.light);

  for (let i = 2; i < center.length - 2; i++) {
    if (!rng.chance(0.4)) continue;
    const p = center[i]!;
    const a = center[i - 1]!;
    const b = center[i + 1]!;
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const ox = rng.float(-halfW * 0.45, halfW * 0.45);
    g.rect(px(p.x + nx * ox), px(p.y + ny * ox), rng.int(1, 2), rng.int(1, 2));
    g.fill(rng.chance(0.5) ? PATH.dark : PATH.light);
  }

  return g;
}

function samplePolyline(
  points: { x: number; y: number }[],
  samplesPerSeg: number
): { x: number; y: number }[] {
  if (points.length < 2) return points.slice();
  const out: { x: number; y: number }[] = [];
  for (let seg = 0; seg < points.length - 1; seg++) {
    const a = points[seg]!;
    const b = points[seg + 1]!;
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const bulge = Math.min(22, len * 0.14) * (seg % 2 === 0 ? 1 : -1);
    const cx = mx + (-dy / len) * bulge;
    const cy = my + (dx / len) * bulge;
    const last = seg === points.length - 2;
    const count = last ? samplesPerSeg : samplesPerSeg - 1;
    for (let i = 0; i <= count; i++) {
      const t = i / samplesPerSeg;
      const u = 1 - t;
      out.push({
        x: u * u * a.x + 2 * u * t * cx + t * t * b.x,
        y: u * u * a.y + 2 * u * t * cy + t * t * b.y,
      });
    }
  }
  return out;
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

  // Signposts
  drawSign(g, worldWidth * 0.2, worldHeight * 0.52);
  drawSign(g, worldWidth * 0.72, worldHeight * 0.72);

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

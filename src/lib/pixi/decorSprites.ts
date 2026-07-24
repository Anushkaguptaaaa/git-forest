import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import type { Rng } from "@/lib/world/rng";
import lampUrl from "@/assets/lamp.png";
import mushUrl from "@/assets/mush.png";
import starUrl from "@/assets/star.png";

function assetSrc(mod: string | { src: string }): string {
  return typeof mod === "string" ? mod : mod.src;
}

const LAMP_URL = assetSrc(lampUrl as string | { src: string });
const MUSH_URL = assetSrc(mushUrl as string | { src: string });
export const STAR_URL = assetSrc(starUrl as string | { src: string });

let loaded = false;

export async function loadForestSprites(): Promise<void> {
  if (loaded) return;
  await Assets.load([LAMP_URL, MUSH_URL, STAR_URL]);
  loaded = true;
}

function tex(url: string): Texture {
  return Assets.get(url) as Texture;
}

/** Clickable lamp post — toggle light; glow is brightest at night. */
export class ForestLamp {
  readonly root: Container;
  lit = false;
  /** World position of the lantern bulb (for screen-space bloom). */
  readonly bulbOffsetY: number;
  private readonly sprite: Sprite;
  private readonly localGlow: Graphics;
  private night = 0;

  constructor(texture: Texture, x: number, y: number, targetH: number) {
    this.root = new Container();
    this.root.x = x;
    this.root.y = y;
    this.root.zIndex = y;
    this.root.eventMode = "static";
    this.root.cursor = "pointer";

    this.sprite = new Sprite(texture);
    this.sprite.anchor.set(0.5, 1);
    const scale = targetH / texture.height;
    this.sprite.scale.set(scale);

    // Lantern sits near the top of the art
    this.bulbOffsetY = -targetH * 0.78;

    this.localGlow = new Graphics();
    this.localGlow.eventMode = "none";
    // Behind the post so the fixture stays crisp
    this.root.addChild(this.localGlow);
    this.root.addChild(this.sprite);

    // Generous hit area around the post
    this.root.hitArea = {
      contains: (lx: number, ly: number) => {
        const w = Math.abs(this.sprite.width) * 0.55;
        return lx > -w && lx < w && ly > -targetH && ly < 8;
      },
    };

    this.root.on("pointertap", (e) => {
      e.stopPropagation();
      this.toggle();
    });

    this.redraw();
  }

  get x(): number {
    return this.root.x;
  }

  get y(): number {
    return this.root.y;
  }

  get bulbX(): number {
    return this.root.x;
  }

  get bulbY(): number {
    return this.root.y + this.bulbOffsetY;
  }

  toggle(): void {
    this.lit = !this.lit;
    this.redraw();
  }

  /** 0 = day, 1 = night — scales how strong the glow feels */
  setNightFactor(night: number): void {
    this.night = night;
    this.redraw();
  }

  private redraw(): void {
    this.localGlow.clear();
    if (!this.lit) {
      this.sprite.tint = 0xffffff;
      return;
    }

    // Warm tint on the fixture when on
    this.sprite.tint = 0xfff2d0;

    // Soft local glow (world-space), stronger as night deepens
    const strength = 0.2 + this.night * 0.75;
    const r = 28 + this.night * 22;
    this.localGlow.circle(0, this.bulbOffsetY, r * 1.35);
    this.localGlow.fill({ color: 0xffc14a, alpha: 0.12 * strength });
    this.localGlow.circle(0, this.bulbOffsetY, r * 0.85);
    this.localGlow.fill({ color: 0xffd978, alpha: 0.2 * strength });
    this.localGlow.circle(0, this.bulbOffsetY, r * 0.4);
    this.localGlow.fill({ color: 0xfff3c0, alpha: 0.35 * strength });
  }
}

export interface ScatterResult {
  lamps: ForestLamp[];
}

/**
 * Scatter lamp posts & mushroom clusters into `layer`.
 * Sprites are anchored at the feet (bottom-center) for y-sorting with trees.
 */
export function scatterForestProps(
  layer: Container,
  worldWidth: number,
  worldHeight: number,
  horizon: number,
  rng: Rng,
  treePoints: { x: number; y: number }[]
): ScatterResult {
  const lampTex = tex(LAMP_URL);
  const mushTex = tex(MUSH_URL);
  const lamps: ForestLamp[] = [];

  const tooClose = (x: number, y: number, points: { x: number; y: number }[], minDist: number) =>
    points.some((t) => {
      const dx = t.x - x;
      const dy = t.y - y;
      return dx * dx + dy * dy < minDist * minDist;
    });

  const lampCount = Math.min(8, 3 + Math.floor(worldWidth / 400));
  const lampPositions: { x: number; y: number }[] = [];
  let placedLamps = 0;
  let attempts = 0;
  // Tall sprites need generous spacing so posts don’t look stacked
  const lampMinDist = 170;
  while (placedLamps < lampCount && attempts < 160) {
    attempts++;
    const x = rng.float(60, worldWidth - 60);
    const y = rng.float(horizon + 80, worldHeight - 40);
    if (tooClose(x, y, treePoints, 70)) continue;
    if (tooClose(x, y, lampPositions, lampMinDist)) continue;

    const lamp = new ForestLamp(lampTex, x, y, rng.float(56, 78));
    layer.addChild(lamp.root);
    treePoints.push({ x, y });
    lampPositions.push({ x, y });
    lamps.push(lamp);
    placedLamps++;
  }

  const mushCount = Math.min(28, 10 + Math.floor((worldWidth * worldHeight) / 90000));
  let placedMush = 0;
  attempts = 0;
  while (placedMush < mushCount && attempts < 200) {
    attempts++;
    const x = rng.float(40, worldWidth - 40);
    const y = rng.float(horizon + 50, worldHeight - 30);
    if (tooClose(x, y, treePoints, 36)) continue;
    if (tooClose(x, y, lampPositions, 50)) continue;

    const s = new Sprite(mushTex);
    s.anchor.set(0.5, 1);
    const targetH = rng.float(22, 38);
    const scale = targetH / mushTex.height;
    s.scale.set(scale * (rng.chance(0.3) ? -1 : 1), scale);
    s.x = x;
    s.y = y;
    s.zIndex = y;
    s.eventMode = "none";
    layer.addChild(s);
    treePoints.push({ x, y });
    placedMush++;
  }

  layer.sortableChildren = true;
  layer.sortChildren();
  return { lamps };
}

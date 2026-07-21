import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { Rng } from "@/lib/world/rng";
import lampUrl from "@/assets/lamp.png";
import mushUrl from "@/assets/mush.png";

function assetSrc(mod: string | { src: string }): string {
  return typeof mod === "string" ? mod : mod.src;
}

const LAMP_URL = assetSrc(lampUrl as string | { src: string });
const MUSH_URL = assetSrc(mushUrl as string | { src: string });

let loaded = false;

export async function loadForestSprites(): Promise<void> {
  if (loaded) return;
  await Assets.load([LAMP_URL, MUSH_URL]);
  loaded = true;
}

function tex(url: string): Texture {
  return Assets.get(url) as Texture;
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
): void {
  const lampTex = tex(LAMP_URL);
  const mushTex = tex(MUSH_URL);

  const tooClose = (x: number, y: number, minDist: number) =>
    treePoints.some((t) => {
      const dx = t.x - x;
      const dy = t.y - y;
      return dx * dx + dy * dy < minDist * minDist;
    });

  const lampCount = Math.min(8, 3 + Math.floor(worldWidth / 400));
  let placedLamps = 0;
  let attempts = 0;
  while (placedLamps < lampCount && attempts < 80) {
    attempts++;
    const x = rng.float(60, worldWidth - 60);
    const y = rng.float(horizon + 80, worldHeight - 40);
    if (tooClose(x, y, 70)) continue;

    const s = new Sprite(lampTex);
    s.anchor.set(0.5, 1);
    const targetH = rng.float(56, 78);
    s.scale.set(targetH / lampTex.height);
    s.x = x;
    s.y = y;
    s.zIndex = y;
    layer.addChild(s);
    treePoints.push({ x, y });
    placedLamps++;
  }

  const mushCount = Math.min(28, 10 + Math.floor((worldWidth * worldHeight) / 90000));
  let placedMush = 0;
  attempts = 0;
  while (placedMush < mushCount && attempts < 200) {
    attempts++;
    const x = rng.float(40, worldWidth - 40);
    const y = rng.float(horizon + 50, worldHeight - 30);
    if (tooClose(x, y, 36)) continue;

    const s = new Sprite(mushTex);
    s.anchor.set(0.5, 1);
    const targetH = rng.float(22, 38);
    const scale = targetH / mushTex.height;
    s.scale.set(scale * (rng.chance(0.3) ? -1 : 1), scale);
    s.x = x;
    s.y = y;
    s.zIndex = y;
    layer.addChild(s);
    treePoints.push({ x, y });
    placedMush++;
  }

  layer.sortableChildren = true;
  layer.sortChildren();
}

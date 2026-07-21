import { mapRepoToTraits } from "@/lib/github/mapRepos";
import type { ForestData, TreeTraits, WorldConfig } from "@/lib/github/types";
import { createRng } from "./rng";
import { hashUsername } from "./seed";
import { seasonFromSeed, weatherFromSeed } from "./seasons";

const TILE = 48;
const MIN_DIST = 56;

function placeTrees(
  traits: Omit<TreeTraits, "x" | "y">[],
  rng: ReturnType<typeof createRng>,
  worldWidth: number,
  worldHeight: number
): TreeTraits[] {
  const placed: TreeTraits[] = [];
  const margin = 80;
  const usableW = worldWidth - margin * 2;
  const usableH = worldHeight - margin * 2;

  for (const trait of traits) {
    let x = 0;
    let y = 0;
    let ok = false;

    for (let attempt = 0; attempt < 40; attempt++) {
      x = margin + rng.float(0, usableW);
      y = margin + rng.float(0, usableH);

      ok = placed.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return dx * dx + dy * dy >= MIN_DIST * MIN_DIST;
      });
      if (ok) break;
    }

    if (!ok) {
      // grid fallback
      const cols = Math.max(1, Math.floor(usableW / MIN_DIST));
      const i = placed.length;
      x = margin + (i % cols) * MIN_DIST + rng.float(0, 16);
      y = margin + Math.floor(i / cols) * MIN_DIST + rng.float(0, 16);
    }

    placed.push({ ...trait, x, y });
  }

  // sort by y for painter's algorithm
  placed.sort((a, b) => a.y - b.y);
  return placed;
}

export function buildWorld(data: ForestData): WorldConfig {
  const seed = hashUsername(data.profile.login);
  const rng = createRng(seed);
  const season = seasonFromSeed(rng);
  const weather = weatherFromSeed(rng, season);

  const baseTraits = data.repos
    .slice()
    .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
    .map(mapRepoToTraits);

  const count = Math.max(1, baseTraits.length);
  const cols = Math.ceil(Math.sqrt(count * 1.4));
  const rows = Math.ceil(count / cols);
  const worldWidth = Math.max(1200, cols * TILE * 2.2 + 200);
  const worldHeight = Math.max(900, rows * TILE * 2.2 + 200);

  const trees = placeTrees(baseTraits, rng, worldWidth, worldHeight);

  return {
    seed,
    username: data.profile.login,
    season,
    weather,
    worldWidth,
    worldHeight,
    trees,
  };
}

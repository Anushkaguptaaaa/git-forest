import { mapRepoToTraits } from "@/lib/github/mapRepos";
import type { ForestData, TreeForm, TreeTraits, WorldConfig } from "@/lib/github/types";
import { createRng } from "./rng";
import { hashUsername } from "./seed";
import { seasonFromSeed, weatherFromSeed, loadSeasonOverride } from "./seasons";
import { applySavedTreePositions } from "./treePositions";

/** Spacing between tree bases — drives how big the meadow grows */
const SPACING = 78;
const MIN_DIST = 64;

function assignForms(
  traits: Omit<TreeTraits, "x" | "y" | "form">[]
): Omit<TreeTraits, "x" | "y">[] {
  const alive = traits
    .map((t) => t)
    .filter((t) => !t.isDead && t.species !== "sapling");

  // Top commit activity (height proxy) → legendary weeping elders
  const legendaryCount = Math.max(1, Math.min(5, Math.ceil(alive.length * 0.05)));
  const byHeight = [...alive].sort(
    (a, b) => b.height - a.height || a.name.localeCompare(b.name)
  );
  const legendaryIds = new Set(byHeight.slice(0, legendaryCount).map((t) => t.id));

  return traits.map((t) => {
    let form: TreeForm;
    if (t.isDead || t.species === "dead") {
      form = "bare";
    } else if (legendaryIds.has(t.id)) {
      form = "legendary";
    } else if (t.species === "sapling" || t.height < 42) {
      form = "small";
    } else if (t.height < 72) {
      form = t.species === "pine" || t.species === "cedar" ? "tall" : "broad";
    } else {
      form = "tall";
    }
    return { ...t, form };
  });
}

function placeTrees(
  traits: Omit<TreeTraits, "x" | "y">[],
  rng: ReturnType<typeof createRng>,
  worldWidth: number,
  worldHeight: number
): TreeTraits[] {
  const placed: TreeTraits[] = [];
  const margin = 90;
  const usableW = worldWidth - margin * 2;
  const usableH = worldHeight - margin * 2;

  for (const trait of traits) {
    let x = 0;
    let y = 0;
    let ok = false;
    const minDist = trait.form === "legendary" ? MIN_DIST * 1.25 : MIN_DIST;

    for (let attempt = 0; attempt < 40; attempt++) {
      x = margin + rng.float(0, usableW);
      y = margin + rng.float(0, usableH);

      ok = placed.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const need = Math.max(minDist, p.form === "legendary" ? MIN_DIST * 1.25 : MIN_DIST);
        return dx * dx + dy * dy >= need * need;
      });
      if (ok) break;
    }

    if (!ok) {
      const cols = Math.max(1, Math.floor(usableW / MIN_DIST));
      const i = placed.length;
      x = margin + (i % cols) * MIN_DIST + rng.float(0, 16);
      y = margin + Math.floor(i / cols) * MIN_DIST + rng.float(0, 16);
      x = Math.min(worldWidth - margin, Math.max(margin, x));
      y = Math.min(worldHeight - margin, Math.max(margin, y));
    }

    placed.push({ ...trait, x, y });
  }

  placed.sort((a, b) => a.y - b.y);
  return placed;
}

/** Grow the meadow with repo count — small forests stay compact, large ones sprawl. */
function worldSizeForCount(count: number): { worldWidth: number; worldHeight: number } {
  const n = Math.max(1, count);
  const cols = Math.max(3, Math.ceil(Math.sqrt(n * 1.3)));
  const rows = Math.max(3, Math.ceil(n / cols));
  const worldWidth = Math.max(960, Math.round(cols * SPACING + 220));
  const worldHeight = Math.max(720, Math.round(rows * SPACING + 220));
  return { worldWidth, worldHeight };
}

export function buildWorld(data: ForestData): WorldConfig {
  const seed = hashUsername(data.profile.login);
  const rng = createRng(seed);
  // Always advance RNG the same way so layout stays stable when season is overridden
  const seededSeason = seasonFromSeed(rng);
  const season = loadSeasonOverride(data.profile.login) ?? seededSeason;
  const weather = weatherFromSeed(rng, season);

  const baseTraits = assignForms(
    data.repos
      .slice()
      .sort((a, b) => b.stars - a.stars || a.name.localeCompare(b.name))
      .map(mapRepoToTraits)
  );

  const { worldWidth, worldHeight } = worldSizeForCount(baseTraits.length);
  const placed = placeTrees(baseTraits, rng, worldWidth, worldHeight);
  const trees = applySavedTreePositions(data.profile.login, placed);

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

import { mapRepoToTraits } from "@/lib/github/mapRepos";
import type { ForestData, TreeForm, TreeTraits, WorldConfig } from "@/lib/github/types";
import { createRng } from "./rng";
import { hashUsername } from "./seed";
import { seasonFromSeed, weatherFromSeed, loadSeasonOverride } from "./seasons";
import { applySavedTreePositions } from "./treePositions";

/** Spacing between tree bases — drives how big the meadow grows */
const SPACING = 86;
const MIN_DIST = 58;
/** Default landscape meadow — matches typical viewports so aspect-stretch doesn't leave an empty wing */
const TARGET_ASPECT = 16 / 10;
const MARGIN = 90;

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

/** Fisher–Yates shuffle (seeded). */
function shuffleInPlace<T>(arr: T[], rng: ReturnType<typeof createRng>): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

/**
 * Spread trees across the full meadow with a jittered grid.
 * Avoids the old random pack + top-left fallback that bunched large forests on one side.
 */
function placeTrees(
  traits: Omit<TreeTraits, "x" | "y">[],
  rng: ReturnType<typeof createRng>,
  worldWidth: number,
  worldHeight: number
): TreeTraits[] {
  const n = traits.length;
  if (n === 0) return [];

  const usableW = Math.max(1, worldWidth - MARGIN * 2);
  const usableH = Math.max(1, worldHeight - MARGIN * 2);
  const aspect = usableW / usableH;

  // Grid cells fill the usable rectangle; extra empty cells keep density even
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * aspect)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const cellW = usableW / cols;
  const cellH = usableH / rows;

  const cellIds = Array.from({ length: cols * rows }, (_, i) => i);
  shuffleInPlace(cellIds, rng);

  // Place larger / legendary trees first into roomier cells
  const order = traits
    .map((t, i) => ({ t, i }))
    .sort((a, b) => {
      const score = (t: Omit<TreeTraits, "x" | "y">) =>
        (t.form === "legendary" ? 1000 : 0) + t.height;
      return score(b.t) - score(a.t) || a.t.name.localeCompare(b.t.name);
    });

  const placed: TreeTraits[] = new Array(n);
  const positions: { x: number; y: number; minDist: number }[] = [];

  for (let k = 0; k < order.length; k++) {
    const trait = order[k]!.t;
    const idx = order[k]!.i;
    const cell = cellIds[k % cellIds.length]!;
    const col = cell % cols;
    const row = Math.floor(cell / cols);

    const minDist = trait.form === "legendary" ? MIN_DIST * 1.25 : MIN_DIST;
    // Keep jitter inside the cell so neighbors stay clear
    const padX = Math.min(cellW * 0.35, Math.max(4, cellW / 2 - minDist * 0.35));
    const padY = Math.min(cellH * 0.35, Math.max(4, cellH / 2 - minDist * 0.35));

    let x = MARGIN + col * cellW + cellW / 2 + rng.float(-padX, padX);
    let y = MARGIN + row * cellH + cellH / 2 + rng.float(-padY, padY);
    x = Math.min(worldWidth - MARGIN, Math.max(MARGIN, x));
    y = Math.min(worldHeight - MARGIN, Math.max(MARGIN, y));

    // Small local nudges if still too close to an earlier tree
    for (let attempt = 0; attempt < 12; attempt++) {
      const clash = positions.find((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const need = Math.max(minDist, p.minDist);
        return dx * dx + dy * dy < need * need;
      });
      if (!clash) break;
      x = MARGIN + col * cellW + cellW / 2 + rng.float(-padX, padX);
      y = MARGIN + row * cellH + cellH / 2 + rng.float(-padY, padY);
      x = Math.min(worldWidth - MARGIN, Math.max(MARGIN, x));
      y = Math.min(worldHeight - MARGIN, Math.max(MARGIN, y));
    }

    positions.push({ x, y, minDist });
    placed[idx] = { ...trait, x, y };
  }

  return placed
    .filter((t): t is TreeTraits => t != null)
    .sort((a, b) => a.y - b.y);
}

/** Grow a landscape meadow with repo count — fills typical screens without an empty wing. */
function worldSizeForCount(count: number): { worldWidth: number; worldHeight: number } {
  const n = Math.max(1, count);
  const area = Math.max(960 * 600, n * SPACING * SPACING * 1.2);
  let worldHeight = Math.sqrt(area / TARGET_ASPECT);
  let worldWidth = worldHeight * TARGET_ASPECT;

  // Ensure the jittered grid can fit without crushing spacing
  const cols = Math.max(1, Math.ceil(Math.sqrt(n * TARGET_ASPECT)));
  const rows = Math.max(1, Math.ceil(n / cols));
  worldWidth = Math.max(worldWidth, cols * MIN_DIST + MARGIN * 2 + 40);
  worldHeight = Math.max(worldHeight, rows * MIN_DIST + MARGIN * 2 + 40);

  return {
    worldWidth: Math.max(1120, Math.round(worldWidth)),
    worldHeight: Math.max(700, Math.round(worldHeight)),
  };
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

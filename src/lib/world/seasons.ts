import type { Season, Weather } from "@/lib/github/types";
import type { Rng } from "./rng";

export function seasonFromSeed(rng: Rng): Season {
  return rng.pick(["spring", "summer", "autumn", "winter"] as const);
}

export function weatherFromSeed(rng: Rng, season: Season): Weather {
  const roll = rng.next();
  if (season === "winter") {
    if (roll < 0.35) return "snow";
    if (roll < 0.55) return "fog";
    if (roll < 0.75) return "cloudy";
    return "clear";
  }
  if (season === "autumn") {
    if (roll < 0.25) return "rain";
    if (roll < 0.45) return "fog";
    if (roll < 0.7) return "cloudy";
    return "clear";
  }
  if (season === "spring") {
    if (roll < 0.3) return "rain";
    if (roll < 0.5) return "cloudy";
    return "clear";
  }
  // summer
  if (roll < 0.15) return "rain";
  if (roll < 0.35) return "cloudy";
  return "clear";
}

export const SEASON_PALETTE: Record<
  Season,
  {
    grass: number;
    grassDark: number;
    grassLight: number;
    skyTop: number;
    skyBottom: number;
    accent: number;
  }
> = {
  spring: {
    grass: 0x5ec84a,
    grassDark: 0x3a9a32,
    grassLight: 0x8ae05a,
    skyTop: 0x6eb8ef,
    skyBottom: 0xd0eefc,
    accent: 0xffb7c5,
  },
  summer: {
    grass: 0x4cb83a,
    grassDark: 0x2f8a28,
    grassLight: 0x78d84a,
    skyTop: 0x4a9fe0,
    skyBottom: 0xb8dff5,
    accent: 0xffd166,
  },
  autumn: {
    grass: 0x8aaa3e,
    grassDark: 0x6a7a28,
    grassLight: 0xb0c050,
    skyTop: 0xd4895a,
    skyBottom: 0xf0c9a0,
    accent: 0xe07a3d,
  },
  winter: {
    grass: 0xc8d8c8,
    grassDark: 0xa0b0a0,
    grassLight: 0xe0ece0,
    skyTop: 0x8aa4b8,
    skyBottom: 0xdce6ec,
    accent: 0xb8d4e8,
  },
};

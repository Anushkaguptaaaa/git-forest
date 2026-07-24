import type { GitHubRepo, TreeSpecies, TreeTraits } from "./types";

const LANGUAGE_SPECIES: Record<string, TreeSpecies> = {
  JavaScript: "oak",
  TypeScript: "oak",
  Python: "willow",
  Rust: "cedar",
  Go: "pine",
  Java: "maple",
  Kotlin: "maple",
  Swift: "cherry",
  Ruby: "cherry",
  PHP: "birch",
  "C++": "cedar",
  C: "cedar",
  "C#": "maple",
  Dart: "birch",
  Shell: "pine",
  HTML: "birch",
  CSS: "birch",
  Vue: "oak",
  Svelte: "oak",
  Elixir: "willow",
  Haskell: "willow",
  Scala: "maple",
  Lua: "pine",
  R: "willow",
};

export function languageToSpecies(language: string | null, isArchived: boolean): TreeSpecies {
  if (isArchived) return "dead";
  if (!language) return "sapling";
  return LANGUAGE_SPECIES[language] ?? "oak";
}

/** Log-scale height so mega-repos don't dominate the forest */
export function commitProxyToHeight(size: number, stars: number): number {
  const activity = Math.max(1, size + stars * 10);
  const h = 28 + Math.log2(activity + 1) * 10;
  return Math.min(120, Math.max(24, Math.round(h)));
}

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

/** Ripe fruits for quiet repos — canopy at 1y+, fallen extras at 2y+. */
export function fruitsFromPushedAt(
  pushedAt: string | null,
  isArchived: boolean
): { fruits: number; fallenFruit: number } {
  if (isArchived) return { fruits: 0, fallenFruit: 0 };
  if (!pushedAt) return { fruits: 3, fallenFruit: 1 };
  const age = Date.now() - new Date(pushedAt).getTime();
  if (!Number.isFinite(age) || age < 0) return { fruits: 0, fallenFruit: 0 };
  if (age >= 2 * YEAR_MS) return { fruits: 4, fallenFruit: 1 };
  if (age >= YEAR_MS) return { fruits: 3, fallenFruit: 0 };
  return { fruits: 0, fallenFruit: 0 };
}

export function mapRepoToTraits(repo: GitHubRepo): Omit<TreeTraits, "x" | "y" | "form"> {
  const { fruits, fallenFruit } = fruitsFromPushedAt(repo.pushedAt, repo.isArchived);
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    url: repo.url,
    language: repo.language,
    species: languageToSpecies(repo.language, repo.isArchived),
    height: commitProxyToHeight(repo.size, repo.stars),
    saplings: Math.min(6, Math.floor(Math.log2(repo.forks + 1))),
    isDead: repo.isArchived,
    fruits,
    fallenFruit,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: repo.openIssues,
    commits: repo.commits,
    homepageUrl: repo.homepageUrl,
  };
}

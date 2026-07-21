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

export function mapRepoToTraits(repo: GitHubRepo): Omit<TreeTraits, "x" | "y"> {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    url: repo.url,
    language: repo.language,
    species: languageToSpecies(repo.language, repo.isArchived),
    height: commitProxyToHeight(repo.size, repo.stars),
    flowers: Math.min(12, Math.floor(Math.log2(repo.stars + 1))),
    saplings: Math.min(6, Math.floor(Math.log2(repo.forks + 1))),
    nests: Math.min(5, Math.floor(Math.sqrt(repo.openIssues))),
    fireflies: Math.min(8, Math.floor(Math.log2(repo.stars + repo.forks + 1))),
    isDead: repo.isArchived,
    stars: repo.stars,
    forks: repo.forks,
    openIssues: repo.openIssues,
  };
}

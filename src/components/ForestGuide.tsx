"use client";

interface ForestGuideProps {
  open: boolean;
  onClose: () => void;
}

const SPECIES = [
  { name: "Oak", meaning: "JavaScript, TypeScript, Vue, Svelte, or unknown" },
  { name: "Willow", meaning: "Python, Elixir, Haskell, R" },
  { name: "Cedar", meaning: "Rust, C, C++" },
  { name: "Pine", meaning: "Go, Shell, Lua" },
  { name: "Maple", meaning: "Java, Kotlin, C#, Scala" },
  { name: "Cherry", meaning: "Swift, Ruby" },
  { name: "Birch", meaning: "PHP, HTML, CSS, Dart" },
  { name: "Sapling", meaning: "Repo with no language set" },
  { name: "Deadwood", meaning: "Archived repo — bare trunk only" },
] as const;

const SIGNALS = [
  { name: "Tree height", meaning: "Repo size & star activity" },
  { name: "Star on top", meaning: "More than 10 GitHub stars" },
  { name: "Red apples", meaning: "Quiet for a year (most deciduous trees)" },
  { name: "Cherry blossoms", meaning: "Quiet for a year (cherry trees)" },
  { name: "Pine cones", meaning: "Quiet for a year (pine & cedar)" },
  { name: "Fallen fruit", meaning: "Quiet for two years or more" },
  { name: "Tiny saplings", meaning: "Forks at the base of the tree" },
  { name: "Weeping elder", meaning: "One of the most active repos" },
  { name: "Fireflies", meaning: "Appear across the meadow at night" },
] as const;

export function ForestGuide({ open, onClose }: ForestGuideProps) {
  if (!open) return null;

  return (
    <aside className="forest-guide" role="dialog" aria-label="Forest guide">
      <div className="forest-guide-head">
        <h2 className="font-display forest-guide-title">Field guide</h2>
        <button
          type="button"
          className="font-pixel forest-guide-close"
          onClick={onClose}
          aria-label="Close guide"
        >
          Close
        </button>
      </div>

      <p className="font-pixel forest-guide-lede">
        Every public repo grows into a tree. Here is how to read the grove.
      </p>

      <section className="forest-guide-section">
        <h3 className="font-pixel forest-guide-heading">Species</h3>
        <ul className="forest-guide-list">
          {SPECIES.map((row) => (
            <li key={row.name}>
              <span className="forest-guide-term">{row.name}</span>
              <span className="forest-guide-def">{row.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="forest-guide-section">
        <h3 className="font-pixel forest-guide-heading">Signals</h3>
        <ul className="forest-guide-list">
          {SIGNALS.map((row) => (
            <li key={row.name}>
              <span className="forest-guide-term">{row.name}</span>
              <span className="forest-guide-def">{row.meaning}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="font-pixel forest-guide-foot">
        Click a tree for repo stats · Customize to place props &amp; rearrange
      </p>
    </aside>
  );
}

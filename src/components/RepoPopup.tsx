"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useForestStore } from "@/store/forestStore";

export function RepoPopup() {
  const tree = useForestStore((s) => s.selectedTree);
  const selectTree = useForestStore((s) => s.selectTree);
  const setTreeCommits = useForestStore((s) => s.setTreeCommits);
  const [commitsLoading, setCommitsLoading] = useState(false);

  useEffect(() => {
    if (!tree || tree.commits != null) {
      setCommitsLoading(false);
      return;
    }

    let cancelled = false;
    setCommitsLoading(true);

    fetch(`/api/github/commits?repo=${encodeURIComponent(tree.fullName)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("commit fetch failed");
        return res.json() as Promise<{ commits: number }>;
      })
      .then((json) => {
        if (cancelled) return;
        setTreeCommits(tree.id, json.commits);
      })
      .catch(() => {
        /* leave as — if rate-limited / network error */
      })
      .finally(() => {
        if (!cancelled) setCommitsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tree, setTreeCommits]);

  return (
    <AnimatePresence>
      {tree && (
        <motion.aside
          key={tree.id}
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="repo-popup"
          role="dialog"
          aria-label={`Repository ${tree.name}`}
        >
          <div className="repo-popup-head">
            <div>
              <p className="font-pixel repo-popup-meta">
                {tree.form === "legendary" ? "elder" : tree.form} · {tree.species} ·{" "}
                {tree.language ?? "unknown"}
              </p>
              <h2 className="font-display repo-popup-title">{tree.name}</h2>
            </div>
            <button
              type="button"
              onClick={() => selectTree(null)}
              className="pixel-btn repo-popup-close"
              aria-label="Close"
            >
              X
            </button>
          </div>

          {tree.description && <p className="repo-popup-desc">{tree.description}</p>}

          <dl className="repo-popup-stats repo-popup-stats--3">
            <Stat
              label="Commits"
              value={tree.commits}
              loading={commitsLoading && tree.commits == null}
            />
            <Stat label="Stars" value={tree.stars} />
            <Stat label="Forks" value={tree.forks} />
          </dl>

          {tree.isDead && (
            <p className="repo-popup-archived">Archived — a quiet deadwood in the grove.</p>
          )}
          {!tree.isDead && tree.fruits > 0 && (
            <p className="repo-popup-archived">
              {tree.fallenFruit > 0
                ? "Quiet for over two years — fruiting & fallen apples."
                : "Quiet for over a year — ripe enough to fruit."}
            </p>
          )}

          <div className="repo-popup-actions">
            {tree.homepageUrl && (
              <a
                href={tree.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="pixel-btn repo-popup-link repo-popup-link--live"
              >
                Open live app
              </a>
            )}
            <a
              href={tree.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pixel-btn repo-popup-link"
            >
              Open on GitHub
            </a>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  loading = false,
}: {
  label: string;
  value: number | null;
  loading?: boolean;
}) {
  return (
    <div className="repo-stat">
      <dt>{label}</dt>
      <dd className="font-display">
        {loading ? "…" : value == null ? "—" : value.toLocaleString()}
      </dd>
    </div>
  );
}

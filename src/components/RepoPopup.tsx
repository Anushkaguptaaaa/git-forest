"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useForestStore } from "@/store/forestStore";

export function RepoPopup() {
  const tree = useForestStore((s) => s.selectedTree);
  const selectTree = useForestStore((s) => s.selectTree);

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
                {tree.species} · {tree.language ?? "unknown"}
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

          <dl className="repo-popup-stats">
            <Stat label="Stars" value={tree.stars} hint="flowers" />
            <Stat label="Forks" value={tree.forks} hint="saplings" />
            <Stat label="Issues" value={tree.openIssues} hint="nests" />
            <Stat label="Height" value={tree.height} hint="activity" />
          </dl>

          {tree.isDead && (
            <p className="repo-popup-archived">Archived — a quiet deadwood in the grove.</p>
          )}

          <a
            href={tree.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-btn repo-popup-link"
          >
            Open on GitHub
          </a>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="repo-stat">
      <dt>{label}</dt>
      <dd className="font-display">{value.toLocaleString()}</dd>
      <p>{hint}</p>
    </div>
  );
}

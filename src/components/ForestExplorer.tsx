"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ForestData } from "@/lib/github/types";
import { buildWorld } from "@/lib/world/layout";
import { SEASONS } from "@/lib/world/seasons";
import { useForestStore } from "@/store/forestStore";
import { ForestGuide } from "./ForestGuide";
import { RepoPopup } from "./RepoPopup";

const ForestCanvas = dynamic(
  () => import("./ForestCanvas").then((m) => m.ForestCanvas),
  { ssr: false, loading: () => <ForestLoading label="Planting trees..." /> }
);

interface ForestExplorerProps {
  data: ForestData;
}

export function ForestExplorer({ data }: ForestExplorerProps) {
  const world = useForestStore((s) => s.world);
  const setForest = useForestStore((s) => s.setForest);
  const setSeason = useForestStore((s) => s.setSeason);
  const customizeOpen = useForestStore((s) => s.customizeOpen);
  const setCustomizeOpen = useForestStore((s) => s.setCustomizeOpen);
  const season = world?.season;
  const weather = world?.weather;
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const next = buildWorld(data);
    setForest(data, next);
  }, [data, setForest]);

  return (
    <div className="explorer">
      {world ? <ForestCanvas world={world} /> : <ForestLoading label="Growing forest..." />}

      <div className="crt-overlay pointer-events-none absolute inset-0 z-20" aria-hidden />

      <header className="explorer-header">
        <div className="explorer-header-left">
          <div className="explorer-panel">
            <Link href="/" className="font-display explorer-back">
              ← Git Forest
            </Link>
          </div>
          <button
            type="button"
            className={`explorer-panel font-display explorer-customize${
              customizeOpen ? " is-active" : ""
            }`}
            onClick={() => {
              setGuideOpen(false);
              setCustomizeOpen(!customizeOpen);
            }}
          >
            Customize
          </button>
          <button
            type="button"
            className={`explorer-panel font-display explorer-guide-btn${
              guideOpen ? " is-active" : ""
            }`}
            aria-pressed={guideOpen}
            onClick={() => {
              if (!guideOpen) setCustomizeOpen(false);
              setGuideOpen(!guideOpen);
            }}
          >
            Guide
          </button>
          <div
            className="explorer-panel explorer-seasons"
            role="group"
            aria-label="Season"
          >
            {SEASONS.map((s) => (
              <button
                key={s}
                type="button"
                className={`font-pixel explorer-season${
                  season === s ? " is-active" : ""
                }`}
                aria-pressed={season === s}
                onClick={() => setSeason(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="explorer-panel explorer-profile">
          <div className="explorer-profile-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.profile.avatarUrl}
              alt=""
              width={36}
              height={36}
              className="explorer-avatar"
            />
            <div className="min-w-0">
              <p className="font-display explorer-name">
                {data.profile.name ?? data.profile.login}
              </p>
              <p className="font-pixel explorer-meta">
                @{data.profile.login} · {data.repos.length} trees
                {season ? ` · ${season}` : ""}
                {weather ? ` · ${weather}` : ""}
              </p>
            </div>
          </div>
        </div>
      </header>

      <ForestGuide open={guideOpen} onClose={() => setGuideOpen(false)} />

      <div className="explorer-hint font-pixel">
        <p className="explorer-hint-lore">
          Trees quiet for a year grow fruit· two years, fruit falls
        </p>
        <p className="explorer-hint-controls">
          Scroll zoom · drag to pan · Guide for the legend · Customize to place props
        </p>
      </div>

      <RepoPopup />
    </div>
  );
}

function ForestLoading({ label }: { label: string }) {
  return (
    <div className="explorer-loading">
      <p className="font-pixel explorer-loading-text">{label}</p>
    </div>
  );
}

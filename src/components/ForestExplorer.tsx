"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect } from "react";
import type { ForestData } from "@/lib/github/types";
import { buildWorld } from "@/lib/world/layout";
import { useForestStore } from "@/store/forestStore";
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
  const season = world?.season;
  const weather = world?.weather;

  useEffect(() => {
    const next = buildWorld(data);
    setForest(data, next);
  }, [data, setForest]);

  return (
    <div className="explorer">
      {world ? <ForestCanvas world={world} /> : <ForestLoading label="Growing forest..." />}

      <div className="crt-overlay pointer-events-none absolute inset-0 z-20" aria-hidden />

      <header className="explorer-header">
        <div className="explorer-panel">
          <Link href="/" className="font-display explorer-back">
            ← Git Forest
          </Link>
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

      <div className="explorer-hint font-pixel">
        WASD / arrows · drag · scroll zoom · click trees · click lamps for light
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

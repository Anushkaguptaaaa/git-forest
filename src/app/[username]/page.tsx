import type { Metadata } from "next";
import Link from "next/link";
import { ForestExplorer } from "@/components/ForestExplorer";
import { fetchForestData } from "@/lib/github/client";

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username}'s Forest · Git Forest`,
    description: `Explore ${username}'s GitHub repositories as a procedurally generated pixel-art forest.`,
  };
}

export default async function UsernameForestPage({ params }: PageProps) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  try {
    const data = await fetchForestData(decoded);
    return <ForestExplorer data={data} />;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong";
    return (
      <main className="error-page">
        <div className="forest-bg absolute inset-0" aria-hidden />
        <div className="crt-overlay pointer-events-none absolute inset-0" aria-hidden />
        <div className="error-card">
          <h1 className="font-display error-title">Forest not found</h1>
          <p className="error-message">{message}</p>
          <Link href="/" className="pixel-btn error-link">
            ← Try another username
          </Link>
        </div>
      </main>
    );
  }
}

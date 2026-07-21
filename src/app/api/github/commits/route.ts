import { NextRequest, NextResponse } from "next/server";
import { fetchRepoCommitCount } from "@/lib/github/client";

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo")?.trim() ?? "";

  if (!repo) {
    return NextResponse.json({ error: "Missing repo query param" }, { status: 400 });
  }

  try {
    const commits = await fetchRepoCommitCount(repo);
    return NextResponse.json(
      { commits },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch commits";
    const status = message.includes("Invalid") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

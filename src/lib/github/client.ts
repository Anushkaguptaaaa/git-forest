import type { GitHubProfile, GitHubRepo, ForestData } from "./types";

const LANGUAGE_QUERY = `
  query($login: String!, $cursor: String) {
    user(login: $login) {
      login
      name
      avatarUrl
      bio
      url
      followers { totalCount }
      following { totalCount }
      repositories(
        first: 100
        after: $cursor
        ownerAffiliations: OWNER
        orderBy: { field: UPDATED_AT, direction: DESC }
        privacy: PUBLIC
      ) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          databaseId
          name
          nameWithOwner
          description
          url
          primaryLanguage { name }
          stargazerCount
          forkCount
          issues(states: OPEN) { totalCount }
          isArchived
          isFork
          pushedAt
          createdAt
          diskUsage
        }
      }
    }
  }
`;

interface GraphQLRepoNode {
  databaseId: number;
  name: string;
  nameWithOwner: string;
  description: string | null;
  url: string;
  primaryLanguage: { name: string } | null;
  stargazerCount: number;
  forkCount: number;
  issues: { totalCount: number };
  isArchived: boolean;
  isFork: boolean;
  pushedAt: string | null;
  createdAt: string;
  diskUsage: number;
}

interface GraphQLUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  url: string;
  followers: { totalCount: number };
  following: { totalCount: number };
  repositories: {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: GraphQLRepoNode[];
  };
}

function mapRepo(node: GraphQLRepoNode): GitHubRepo {
  return {
    id: node.databaseId,
    name: node.name,
    fullName: node.nameWithOwner,
    description: node.description,
    url: node.url,
    language: node.primaryLanguage?.name ?? null,
    stars: node.stargazerCount,
    forks: node.forkCount,
    openIssues: node.issues.totalCount,
    isArchived: node.isArchived,
    isFork: node.isFork,
    pushedAt: node.pushedAt,
    createdAt: node.createdAt,
    size: node.diskUsage,
  };
}

async function fetchViaGraphQL(username: string, token: string): Promise<ForestData> {
  const repos: GitHubRepo[] = [];
  let cursor: string | null = null;
  let profile: GitHubProfile | null = null;

  for (let page = 0; page < 3; page++) {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "git-forest",
      },
      body: JSON.stringify({
        query: LANGUAGE_QUERY,
        variables: { login: username, cursor },
      }),
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      throw new Error(`GitHub GraphQL error: ${res.status}`);
    }

    const json = (await res.json()) as {
      data?: { user: GraphQLUser | null };
      errors?: { message: string }[];
    };

    if (json.errors?.length) {
      throw new Error(json.errors[0].message);
    }

    const user = json.data?.user;
    if (!user) {
      throw new Error(`User "${username}" not found`);
    }

    if (!profile) {
      profile = {
        login: user.login,
        name: user.name,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        publicRepos: user.repositories.totalCount,
        followers: user.followers.totalCount,
        following: user.following.totalCount,
        htmlUrl: user.url,
      };
    }

    repos.push(...user.repositories.nodes.map(mapRepo));

    if (!user.repositories.pageInfo.hasNextPage) break;
    cursor = user.repositories.pageInfo.endCursor;
  }

  return {
    profile: profile!,
    repos,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchViaRest(username: string, token?: string): Promise<ForestData> {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "User-Agent": "git-forest",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const userRes = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
    headers,
    next: { revalidate: 300 },
  });

  if (userRes.status === 404) {
    throw new Error(`User "${username}" not found`);
  }
  if (!userRes.ok) {
    throw new Error(`GitHub API error: ${userRes.status}`);
  }

  const user = (await userRes.json()) as {
    login: string;
    name: string | null;
    avatar_url: string;
    bio: string | null;
    public_repos: number;
    followers: number;
    following: number;
    html_url: string;
  };

  const reposRes = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`,
    { headers, next: { revalidate: 300 } }
  );

  if (!reposRes.ok) {
    throw new Error(`GitHub repos error: ${reposRes.status}`);
  }

  const repoNodes = (await reposRes.json()) as Array<{
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    language: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    archived: boolean;
    fork: boolean;
    pushed_at: string | null;
    created_at: string;
    size: number;
  }>;

  const repos: GitHubRepo[] = repoNodes
    .filter((r) => !r.fork)
    .map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      url: r.html_url,
      language: r.language,
      stars: r.stargazers_count,
      forks: r.forks_count,
      openIssues: r.open_issues_count,
      isArchived: r.archived,
      isFork: r.fork,
      pushedAt: r.pushed_at,
      createdAt: r.created_at,
      size: r.size,
    }));

  return {
    profile: {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      publicRepos: user.public_repos,
      followers: user.followers,
      following: user.following,
      htmlUrl: user.html_url,
    },
    repos,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchForestData(username: string): Promise<ForestData> {
  const cleaned = username.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(cleaned)) {
    throw new Error("Invalid GitHub username");
  }

  const token = process.env.GITHUB_TOKEN;

  if (token) {
    try {
      return await fetchViaGraphQL(cleaned, token);
    } catch {
      return await fetchViaRest(cleaned, token);
    }
  }

  return fetchViaRest(cleaned);
}

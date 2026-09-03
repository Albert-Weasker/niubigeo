import type { Entity } from "../core/types.js";
import { githubRepoSlug } from "../utils/domain.js";

export interface GithubProjectMetadata {
  repo: string;
  description?: string | undefined;
  homepage?: string | undefined;
  topics: string[];
  stars?: number | undefined;
  forks?: number | undefined;
  language?: string | undefined;
  license?: string | undefined;
  readme?: string | undefined;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

export async function fetchGithubMetadata(repoUrlOrSlug: string): Promise<GithubProjectMetadata> {
  const repo = githubRepoSlug(repoUrlOrSlug);
  if (!repo) throw new Error(`Invalid GitHub repository: ${repoUrlOrSlug}`);
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "niubigeo-oss" };
  const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, { headers });
  if (!repoResponse.ok) throw new Error(`GitHub metadata request failed with HTTP ${repoResponse.status}`);
  const data = asObject(await repoResponse.json());
  if (!data) throw new Error("GitHub metadata response was not an object.");

  let readme: string | undefined;
  const readmeResponse = await fetch(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`, { headers });
  if (readmeResponse.ok) readme = await readmeResponse.text();

  return {
    repo,
    description: typeof data.description === "string" ? data.description : undefined,
    homepage: typeof data.homepage === "string" ? data.homepage : undefined,
    topics: Array.isArray(data.topics) ? data.topics.filter((topic): topic is string => typeof topic === "string") : [],
    stars: typeof data.stargazers_count === "number" ? data.stargazers_count : undefined,
    forks: typeof data.forks_count === "number" ? data.forks_count : undefined,
    language: typeof data.language === "string" ? data.language : undefined,
    license: typeof asObject(data.license)?.spdx_id === "string" ? String(asObject(data.license)?.spdx_id) : undefined,
    readme,
  };
}

export function enrichEntityFromGithub(entity: Entity, metadata: GithubProjectMetadata): Entity {
  const repoName = metadata.repo.split("/").pop();
  const aliases = [...new Set([...entity.aliases, repoName].filter((value): value is string => Boolean(value)))];
  return {
    ...entity,
    githubRepo: metadata.repo,
    aliases,
  };
}

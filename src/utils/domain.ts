import type { Entity, EntityType } from "../core/types.js";

export function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").toLowerCase();
  }
}

export function extractDomainFromUrl(value: string): string {
  return normalizeDomain(value);
}

export function domainMatches(candidate: string, expected: string): boolean {
  const a = normalizeDomain(candidate);
  const b = normalizeDomain(expected);
  return a === b || a.endsWith(`.${b}`);
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function titleFromDomain(domain: string): string {
  const root = normalizeDomain(domain).split(".")[0] || domain;
  return root
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function entityId(entity: Pick<Entity, "type" | "name" | "domain">): string {
  return slugify(`${entity.type}-${entity.name}-${normalizeDomain(entity.domain)}`);
}

export function entityFromInput(input: {
  type: EntityType;
  domain: string;
  name?: string | undefined;
  aliases?: string[] | undefined;
  githubRepo?: string | undefined;
}): Entity {
  const domain = normalizeDomain(input.domain);
  const name = input.name?.trim() || titleFromDomain(domain);
  const entity: Entity = {
    id: entityId({ type: input.type, name, domain }),
    type: input.type,
    name,
    domain,
    aliases: [...new Set((input.aliases || []).map((alias) => alias.trim()).filter(Boolean))],
  };
  if (input.githubRepo) entity.githubRepo = input.githubRepo;
  return entity;
}

export function urlLooksLikeGithubRepo(url: string): boolean {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/i.test(url.trim());
}

export function githubRepoSlug(urlOrSlug: string): string | null {
  const value = urlOrSlug.trim().replace(/\/$/, "");
  const match = value.match(/github\.com\/([^/\s]+\/[^/\s]+)/i);
  if (match?.[1]) return match[1];
  if (/^[^/\s]+\/[^/\s]+$/.test(value)) return value;
  return null;
}

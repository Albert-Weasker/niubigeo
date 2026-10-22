import type { Entity, EntityType } from "../core/types.js";
import { asciiSlug, splitByCharacters } from "./text.js";

function urlFromInput(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate);
  } catch {
    return null;
  }
}

export function normalizeDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = urlFromInput(trimmed);
    if (!url) return "";
    const hostname = url.hostname.toLowerCase();
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
  } catch {
    return "";
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
  return asciiSlug(value);
}

export function titleFromDomain(domain: string): string {
  const root = normalizeDomain(domain).split(".")[0] || domain;
  return splitByCharacters(root, new Set(["-", "_"]))
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
  const parsed = urlFromInput(url);
  if (!parsed || parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "github.com") return false;
  return parsed.pathname.split("/").filter(Boolean).length === 2;
}

export function githubRepoSlug(urlOrSlug: string): string | null {
  const value = urlOrSlug.trim();
  const alphanumeric = (character: string): boolean => {
    const code = character.toLowerCase().charCodeAt(0);
    return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
  };
  const validParts = (parts: string[]): boolean => {
    const owner = parts[0] || "";
    const repo = parts[1] || "";
    return parts.length === 2 && owner.length > 0 && owner.length <= 39 &&
      alphanumeric(owner[0] || "") && alphanumeric(owner.at(-1) || "") &&
      [...owner].every((character) => alphanumeric(character) || character === "-") &&
      repo.length > 0 && ![".", ".."].includes(repo) &&
      [...repo].every((character) => alphanumeric(character) || ["_", "-", "."].includes(character));
  };
  const parsed = urlFromInput(value);
  if (parsed?.hostname.toLowerCase() === "github.com") {
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const parts = parsed.pathname.split("/").filter(Boolean);
    return validParts(parts) ? `${parts[0]}/${parts[1]}` : null;
  }
  if (value.includes("://")) return null;
  const parts = value.split("/");
  return validParts(parts) ? `${parts[0]}/${parts[1]}` : null;
}

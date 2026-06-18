import { useEffect, useState } from "react";
import type { CategoryNode } from "@cms/storefront";
import { storefront } from "@/lib/storefront";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical commerce URL helpers (L2.5 + L4.6).
//
// The storefront reaches products + categories through their REAL canonical URLs
// resolved by the by-slug commerce resolver (page tree → category → product), not
// the dev `/shop/:id` shortcut. A category's canonical URL is its root→self slug
// chain; a product's is its primary category's slug chain + the product slug.
//
// We build these client-side from the flat category tree (one cached fetch). The
// resolver matches a *product* by its LAST segment alone (slugs are globally unique
// per locale), so a product URL still resolves even if its category chain is
// incomplete — categories need the full chain (per-level walk), so a missing slug
// in the chain yields null and we render the entry as plain text instead of a link.
// ─────────────────────────────────────────────────────────────────────────────

export type CategoryMap = Map<string, CategoryNode>;

export function indexCategories(nodes: CategoryNode[]): CategoryMap {
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Direct subcategories of `parentId`, ordered by sortOrder then label. */
export function childCategories(parentId: string | null, byId: CategoryMap): CategoryNode[] {
  return [...byId.values()]
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.label ?? "").localeCompare(b.label ?? ""));
}

/** Root→self chain of category nodes (for breadcrumbs). Cycle-guarded. */
export function categoryChain(catId: string, byId: CategoryMap): CategoryNode[] {
  const chain: CategoryNode[] = [];
  const seen = new Set<string>();
  let cur: CategoryNode | undefined = byId.get(catId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain;
}

/** Root→self slug chain, or null if any ancestor lacks a slug in this locale. */
export function categorySlugChain(catId: string, byId: CategoryMap): string[] | null {
  const chain = categoryChain(catId, byId);
  if (!chain.length) return null;
  const slugs: string[] = [];
  for (const node of chain) {
    if (!node.slug) return null;
    slugs.push(node.slug);
  }
  return slugs;
}

/** Canonical category URL, or null when the slug chain is unreachable. */
export function categoryHref(locale: string, catId: string, byId: CategoryMap): string | null {
  const chain = categorySlugChain(catId, byId);
  return chain ? `/${locale}/${chain.join("/")}` : null;
}

/**
 * Canonical product URL = primary category slug chain + product slug. Falls back
 * to a bare `/{locale}/{slug}` when the primary category chain is unavailable —
 * the by-slug resolver matches a product by its last segment, so it still resolves.
 */
export function productHref(
  locale: string,
  card: { slug: string; primaryCategoryId: string | null },
  byId: CategoryMap,
): string {
  const chain = card.primaryCategoryId ? categorySlugChain(card.primaryCategoryId, byId) : null;
  const segments = chain ? [...chain, card.slug] : [card.slug];
  return `/${locale}/${segments.join("/")}`;
}

/**
 * Fetch + index the flat category tree for a locale (cached `public, max-age=300`
 * server-side, so repeated mounts hit the browser cache). Returns an empty map
 * while loading or on error — callers degrade to bare product slugs.
 */
export function useCategoryTree(locale: string): CategoryMap {
  const [map, setMap] = useState<CategoryMap>(new Map());
  useEffect(() => {
    let alive = true;
    storefront
      .listCategories({ locale })
      .then((nodes) => alive && setMap(indexCategories(nodes)))
      .catch(() => alive && setMap(new Map()));
    return () => {
      alive = false;
    };
  }, [locale]);
  return map;
}

// ============================================================
// "In the kitchen": what you have in, kept between visits. Ticking
// a grocery puts it here, cooking a recipe takes out what it used,
// and "What can I cook?" starts from it. Staples (salt, oil) are
// always had, so they never need listing.
// ============================================================

import { groceryKey, isStaple } from "./groceries";
import { has } from "./pantry";
import type { Recipe } from "./recipe";

export interface KitchenItem {
  key: string;
  /** As it was named on the list: "Lemons". */
  item: string;
  /** When it came in (ISO time). */
  at: string;
}

const MAX = 300;

/** Puts things in the kitchen, newest first; one line per thing, staples left out. */
export function stock(
  list: readonly KitchenItem[],
  items: readonly string[],
  staples: readonly string[],
  now = new Date(),
): KitchenItem[] {
  const fresh = new Map<string, KitchenItem>();
  for (const raw of items) {
    const item = raw.trim().slice(0, 120);
    const key = groceryKey(item);
    if (!key || isStaple(item, staples) || fresh.has(key)) continue;
    fresh.set(key, { key, item, at: now.toISOString() });
  }
  return [...fresh.values(), ...list.filter((k) => !fresh.has(k.key))].slice(
    0,
    MAX,
  );
}

/** The kitchen without these things. */
export function takeOut(
  list: readonly KitchenItem[],
  keys: readonly string[],
): KitchenItem[] {
  const gone = new Set(keys);
  return list.filter((k) => !gone.has(k.key));
}

/** What a recipe uses from the kitchen, by key. */
export function usedBy(recipe: Recipe, list: readonly KitchenItem[]): string[] {
  const needs = recipe.groups
    .flatMap((g) => g.items.map((i) => groceryKey(i.item)))
    .filter(Boolean);
  return list
    .filter((k) => needs.some((n) => has(n, [k.key])))
    .map((k) => k.key);
}

/**
 * Two copies of the kitchen as one: everything in either, except what one side took out
 * after the other put it in. `gone` records when each key was last taken out.
 */
export function mergeKitchen(
  mine: readonly KitchenItem[],
  myGone: Readonly<Record<string, string>>,
  theirs: readonly KitchenItem[],
  theirGone: Readonly<Record<string, string>>,
): { kitchen: KitchenItem[]; gone: Record<string, string> } {
  const gone: Record<string, string> = { ...theirGone };
  for (const [key, at] of Object.entries(myGone))
    if (!gone[key] || gone[key]! < at) gone[key] = at;
  const byKey = new Map<string, KitchenItem>();
  for (const k of [...theirs, ...mine]) {
    const had = byKey.get(k.key);
    if (!had || had.at <= k.at) byKey.set(k.key, k);
  }
  const kitchen = [...byKey.values()]
    .filter((k) => !gone[k.key] || gone[k.key]! < k.at)
    .sort((a, b) => b.at.localeCompare(a.at));
  return { kitchen: kitchen.slice(0, MAX), gone: trimGone(gone) };
}

/** Keeps the newest 300 removals: enough to stop an old copy bringing things back. */
export function trimGone(gone: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(gone)
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, MAX),
  );
}

/** A kitchen read back from storage, with anything malformed dropped. */
export function normaliseKitchen(value: unknown): KitchenItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (k): k is KitchenItem =>
        !!k &&
        typeof k === "object" &&
        typeof k.key === "string" &&
        typeof k.item === "string" &&
        typeof k.at === "string" &&
        !Number.isNaN(Date.parse(k.at)),
    )
    .map((k) => ({ key: k.key, item: k.item, at: k.at }))
    .slice(0, MAX);
}

export function normaliseGone(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  return trimGone(
    Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (e): e is [string, string] =>
          typeof e[1] === "string" && !Number.isNaN(Date.parse(e[1])),
      ),
    ),
  );
}

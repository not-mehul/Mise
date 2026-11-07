// ============================================================
// A recipe, and the text form the editor works in: ingredients
// one per line (a line ending in ":" starts a group), steps one
// per line. The structured fields are always derived from the
// text, so what the person typed is what is kept.
// ============================================================

import { normaliseLog, type CookEntry } from './cook';
import { newId, parseIngredient, stripListMarker, type IngredientGroup } from './ingredient';
import { findTimers, linkIngredients, type Step } from './steps';

export type SourceKind = 'manual' | 'text' | 'url' | 'instagram' | 'photo';

export interface RecipeSource {
  kind: SourceKind;
  url?: string;
  /** Who wrote it: a site name or an @handle. */
  author?: string;
  /** What was imported, before parsing, for the "original" view. */
  text?: string;
}

export interface Recipe {
  id: string;
  title: string;
  source: RecipeSource;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  groups: IngredientGroup[];
  steps: Step[];
  tags: string[];
  collectionIds: string[];
  notes: string;
  photoId: string | null;
  /** Each time it was cooked, newest first. */
  log: CookEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
}

/** What the editor holds: the recipe as text fields. */
export interface RecipeDraft {
  id: string | null;
  title: string;
  servings: string;
  prepMinutes: string;
  cookMinutes: string;
  totalMinutes: string;
  ingredients: string;
  steps: string;
  tags: string;
  notes: string;
  source: RecipeSource;
  collectionIds: string[];
  photoId: string | null;
  /** Lines the parser couldn't place, for the person to sort. */
  unsorted: string[];
}

export function emptyDraft(source: RecipeSource = { kind: 'manual' }): RecipeDraft {
  return {
    id: null, title: '', servings: '', prepMinutes: '', cookMinutes: '', totalMinutes: '',
    ingredients: '', steps: '', tags: '', notes: '', source, collectionIds: [], photoId: null, unsorted: [],
  };
}

const GROUP_HEADING = /^(.{1,60}?):\s*$/;

/**
 * Ids to keep across an edit, by the line as written. Each id is handed out once, so two
 * identical lines ("1 tsp salt" in the dough and the filling) keep two ids.
 */
export class IdPool {
  private byText = new Map<string, string[]>();
  add(text: string, id: string): void {
    const ids = this.byText.get(text);
    if (ids) ids.push(id);
    else this.byText.set(text, [id]);
  }
  take(text: string): string {
    return this.byText.get(text)?.shift() ?? newId();
  }
}

/** Ingredient text → groups. "For the sauce:" on its own line starts a group. */
export function parseIngredientText(text: string, keep: IdPool = new IdPool()): IngredientGroup[] {
  const groups: IngredientGroup[] = [{ name: '', items: [] }];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const heading = GROUP_HEADING.exec(stripListMarker(trimmed));
    if (heading && !/\d/.test(heading[1]!)) {
      groups.push({ name: heading[1]!.trim(), items: [] });
      continue;
    }
    const raw = stripListMarker(trimmed);
    groups.at(-1)!.items.push(parseIngredient(raw, keep.take(raw)));
  }
  return groups.filter((g, i) => g.items.length || (i > 0 && g.name));
}

/** Step text → steps, one per non-empty line, numbering stripped. Steps keep their ids across an edit. */
export function parseStepText(text: string, groups: IngredientGroup[], keep: IdPool = new IdPool()): Step[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^(?:step\s*\d+\s*[:.)-]?|paso\s*\d+\s*[:.)-]?|étape\s*\d+\s*[:.)-]?|schritt\s*\d+\s*[:.)-]?)\s*/i, ''))
    .map((l) => stripListMarker(l))
    .filter(Boolean)
    .map((text) => ({ id: keep.take(text), text, timers: findTimers(text), ingredientIds: linkIngredients(text, groups) }));
}

function positiveInt(value: string): number | null {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 && n < 10_000 ? n : null;
}

/** Tags are separated by commas ("main course, quick"); "#pasta #quick" splits on the hashes. */
export function parseTags(text: string): string[] {
  const tags = text
    .split(',')
    .flatMap((part) => (/(^|\s)#\S/.test(part) ? part.split(/\s+(?=#)/) : [part]))
    .map((t) => t.replace(/^\s*#/, '').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 40);
  return [...new Set(tags)];
}

/** A draft ready to save, or the reason it isn't. */
export function draftToRecipe(draft: RecipeDraft, existing: Recipe | undefined, now = new Date()): Recipe {
  const keep = new IdPool();
  for (const g of existing?.groups ?? []) for (const i of g.items) keep.add(i.raw, i.id);
  const keepSteps = new IdPool();
  for (const st of existing?.steps ?? []) keepSteps.add(st.text, st.id);
  const groups = parseIngredientText(draft.ingredients, keep);
  const stamp = now.toISOString();
  return {
    id: existing?.id ?? draft.id ?? newId(),
    title: draft.title.trim(),
    source: normaliseSource(draft.source),
    servings: positiveInt(draft.servings),
    prepMinutes: positiveInt(draft.prepMinutes),
    cookMinutes: positiveInt(draft.cookMinutes),
    totalMinutes: positiveInt(draft.totalMinutes),
    groups,
    steps: parseStepText(draft.steps, groups, keepSteps),
    tags: parseTags(draft.tags),
    collectionIds: draft.collectionIds,
    notes: draft.notes.trim(),
    photoId: draft.photoId,
    log: existing?.log ?? [],
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

export function recipeToDraft(recipe: Recipe): RecipeDraft {
  const str = (n: number | null) => (n === null ? '' : String(n));
  return {
    id: recipe.id,
    title: recipe.title,
    servings: str(recipe.servings),
    prepMinutes: str(recipe.prepMinutes),
    cookMinutes: str(recipe.cookMinutes),
    totalMinutes: str(recipe.totalMinutes),
    ingredients: ingredientsToText(recipe.groups),
    steps: recipe.steps.map((s) => s.text).join('\n'),
    tags: recipe.tags.join(', '),
    notes: recipe.notes,
    source: recipe.source,
    collectionIds: recipe.collectionIds,
    photoId: recipe.photoId,
    unsorted: [],
  };
}

export function ingredientsToText(groups: IngredientGroup[]): string {
  return groups
    .map((g) => [g.name ? `${g.name}:` : '', ...g.items.map((i) => i.raw)].filter(Boolean).join('\n'))
    .join('\n\n');
}

/** Total minutes: as given, or prep + cook. */
export function totalTime(r: Pick<Recipe, 'totalMinutes' | 'prepMinutes' | 'cookMinutes'>): number | null {
  if (r.totalMinutes) return r.totalMinutes;
  const sum = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  return sum || null;
}

export function ingredientCount(r: Recipe): number {
  return r.groups.reduce((n, g) => n + g.items.length, 0);
}

/** True when a search matches the title, an ingredient or a tag ("#pasta" matches tags only). */
export function matchesSearch(r: Recipe, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => {
    if (w.startsWith('#')) return r.tags.some((t) => t.startsWith(w.slice(1)));
    if (r.title.toLowerCase().includes(w)) return true;
    if (r.tags.some((t) => t.includes(w))) return true;
    return r.groups.some((g) => g.items.some((i) => i.item.toLowerCase().includes(w)));
  });
}

const SOURCE_KINDS: readonly SourceKind[] = ['manual', 'text', 'url', 'instagram', 'photo'];

/** An http(s) link, or undefined: anything else (no scheme, javascript:) is dropped. */
export function webLink(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
  } catch {
    return undefined;
  }
}

export function normaliseSource(value: unknown): RecipeSource {
  if (!value || typeof value !== 'object') return { kind: 'manual' };
  const v = value as Partial<Record<keyof RecipeSource, unknown>>;
  const source: RecipeSource = { kind: SOURCE_KINDS.includes(v.kind as SourceKind) ? (v.kind as SourceKind) : 'manual' };
  const url = webLink(v.url);
  if (url) source.url = url;
  if (typeof v.author === 'string' && v.author.trim()) source.author = v.author.trim().slice(0, 120);
  if (typeof v.text === 'string' && v.text) source.text = v.text;
  return source;
}

/** The host of a source link, for showing it: "bbcgoodfood.com". */
export function linkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Anything read back from storage or a backup, made safe to use; null if it isn't a recipe. */
export function normaliseRecipe(value: unknown): Recipe | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<Recipe>;
  if (typeof v.id !== 'string' || typeof v.title !== 'string') return null;
  const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null);
  // Ids must be unique within a recipe (keyed lists); copies made before that was enforced get new ones.
  const seen = new Set<string>();
  const uniqueId = (id: unknown) => {
    const next = typeof id === 'string' && id && !seen.has(id) ? id : newId();
    seen.add(next);
    return next;
  };
  const groups = Array.isArray(v.groups)
    ? v.groups
        .filter((g) => g && Array.isArray(g.items))
        .map((g) => ({ name: typeof g.name === 'string' ? g.name : '', items: g.items.filter((i) => i && typeof i.raw === 'string').map((i) => ({ ...parseIngredient(i.raw, uniqueId(i.id)) })) }))
    : [];
  const steps = Array.isArray(v.steps)
    ? v.steps
        .filter((s) => s && typeof s.text === 'string')
        .map((s) => ({ id: uniqueId(s.id), text: s.text, timers: findTimers(s.text), ingredientIds: linkIngredients(s.text, groups) }))
    : [];
  const stamp = new Date().toISOString();
  return {
    id: v.id,
    title: v.title,
    source: normaliseSource(v.source),
    servings: num(v.servings),
    prepMinutes: num(v.prepMinutes),
    cookMinutes: num(v.cookMinutes),
    totalMinutes: num(v.totalMinutes),
    groups,
    steps,
    tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [],
    collectionIds: Array.isArray(v.collectionIds) ? v.collectionIds.filter((t): t is string => typeof t === 'string') : [],
    notes: typeof v.notes === 'string' ? v.notes : '',
    photoId: typeof v.photoId === 'string' ? v.photoId : null,
    log: normaliseLog(v.log),
    createdAt: typeof v.createdAt === 'string' ? v.createdAt : stamp,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : stamp,
  };
}

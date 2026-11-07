// ============================================================
// schema.org Recipe → a recipe draft. Most recipe sites publish it
// as JSON-LD (some as microdata) for search engines, and it maps
// field for field, so these imports need no guessing.
// ============================================================

import { emptyDraft, type RecipeDraft } from '../domain/recipe';
import { decodeEntities, htmlToText } from './html';

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);
const types = (v: Json): string[] => {
  const t = v['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string').map((x) => x.replace(/^.*[/#]/, ''));
};

/** The first Recipe anywhere in the JSON-LD: top level, in arrays, or in an @graph. */
export function findRecipe(values: unknown[]): Json | null {
  const queue = [...values];
  for (let i = 0; i < queue.length && i < 500; i++) {
    const v = queue[i];
    if (Array.isArray(v)) queue.push(...v);
    else if (isObject(v)) {
      if (types(v).includes('Recipe')) return v;
      if (v['@graph']) queue.push(v['@graph']);
      if (isObject(v.mainEntity)) queue.push(v.mainEntity);
    }
  }
  return null;
}

/** Plain text from a schema string, which may hold HTML or entities. */
function clean(v: unknown): string {
  if (typeof v === 'number') return String(v);
  if (typeof v !== 'string') return '';
  return (/[<&]/.test(v) ? htmlToText(v).replace(/\n+/g, ' ') : v).replace(/\s+/g, ' ').trim();
}

/** "PT1H30M" → 90. Also takes plain "45 minutes". */
export function isoMinutes(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(v.trim());
  if (m && (m[1] || m[2] || m[3] || m[4])) {
    const min = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60;
    return min > 0 ? Math.round(min) : null;
  }
  const n = /(\d+)\s*min/i.exec(v);
  return n ? Number(n[1]) : null;
}

function servings(v: unknown): string {
  const first = Array.isArray(v) ? v.find((x) => /\d/.test(String(x))) : v;
  const m = /\d+/.exec(String(first ?? ''));
  return m && Number(m[0]) > 0 && Number(m[0]) < 1000 ? m[0] : '';
}

function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : v === undefined || v === null ? [] : [v];
}

/** Instructions as lines; a HowToSection becomes a "Name:" line before its steps, which starts a section. */
function instructions(v: unknown): string[] {
  const steps: string[] = [];
  const walk = (x: unknown) => {
    if (typeof x === 'string') {
      const text = /</.test(x) ? htmlToText(x) : decodeEntities(x);
      steps.push(...text.split(/\n+/).map((s) => s.trim()).filter(Boolean));
    } else if (Array.isArray(x)) x.forEach(walk);
    else if (isObject(x)) {
      if (types(x).includes('HowToSection') || Array.isArray(x.itemListElement)) {
        const name = clean(x.name).replace(/:$/, '');
        if (name) steps.push(`${name}:`);
        list(x.itemListElement).forEach(walk);
      } else {
        const text = clean(x.text ?? x.name ?? x.description);
        if (text) steps.push(text);
      }
    }
  };
  walk(v);
  return steps;
}

function imageUrl(v: unknown): string | null {
  for (const x of list(v)) {
    if (typeof x === 'string' && /^https?:/i.test(x)) return x;
    if (isObject(x) && typeof x.url === 'string' && /^https?:/i.test(x.url)) return x.url;
    if (isObject(x) && typeof x.contentUrl === 'string') return x.contentUrl;
  }
  return null;
}

function authorName(v: unknown): string | undefined {
  for (const x of list(v)) {
    const name = typeof x === 'string' ? x : isObject(x) ? clean(x.name) : '';
    if (name) return name;
  }
  return undefined;
}

function tags(r: Json): string {
  const words = [...list(r.recipeCategory), ...list(r.recipeCuisine), ...list(r.keywords).flatMap((k) => (typeof k === 'string' ? k.split(',') : []))]
    .map((x) => clean(x).toLowerCase())
    .filter((x) => x && x.length <= 30);
  return [...new Set(words)].slice(0, 8).join(', ');
}

export interface SchemaImport {
  draft: RecipeDraft;
  imageUrl: string | null;
}

/** A schema.org Recipe as a draft for the review screen. */
export function draftFromSchema(r: Json, url: string, site: string | null): SchemaImport {
  const draft = emptyDraft({ kind: 'url', url, author: authorName(r.author) ?? site ?? undefined });
  draft.title = clean(r.name ?? r.headline);
  draft.servings = servings(r.recipeYield ?? r.yield);
  const prep = isoMinutes(r.prepTime);
  const cook = isoMinutes(r.cookTime);
  const total = isoMinutes(r.totalTime);
  draft.prepMinutes = prep ? String(prep) : '';
  draft.cookMinutes = cook ? String(cook) : '';
  draft.totalMinutes = total && total !== (prep ?? 0) + (cook ?? 0) ? String(total) : '';
  draft.ingredients = list(r.recipeIngredient ?? r.ingredients)
    .map(clean)
    .filter(Boolean)
    .join('\n');
  draft.steps = instructions(r.recipeInstructions).join('\n');
  draft.notes = clean(r.description);
  draft.tags = tags(r);
  draft.source.text = [draft.title, draft.ingredients, draft.steps].filter(Boolean).join('\n\n');
  return { draft, imageUrl: imageUrl(r.image) };
}

/** Microdata (itemscope itemtype=…/Recipe) read into the same shape as JSON-LD. Needs a DOM. */
export function microdataRecipe(html: string): Json | null {
  if (typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const root = doc.querySelector('[itemscope][itemtype*="schema.org/Recipe" i]');
  if (!root) return null;
  const out: Json = { '@type': 'Recipe' };
  for (const el of root.querySelectorAll<HTMLElement>('[itemprop]')) {
    // Properties of nested items (a HowToStep's text) are read through their step.
    const owner = el.parentElement?.closest('[itemscope]');
    if (owner !== root && !(owner && owner.getAttribute('itemprop') === 'recipeInstructions')) continue;
    const value = el.getAttribute('content') ?? el.getAttribute('datetime') ?? (el.tagName === 'IMG' ? el.getAttribute('src') : null) ?? el.textContent ?? '';
    for (const prop of (el.getAttribute('itemprop') ?? '').split(/\s+/)) {
      if (!prop) continue;
      const key = prop === 'ingredients' ? 'recipeIngredient' : owner === root ? prop : 'recipeInstructions';
      const v = el.hasAttribute('itemscope') ? '' : value.trim();
      if (!v) continue;
      const prev = out[key];
      out[key] = prev === undefined ? (key === 'recipeIngredient' || key === 'recipeInstructions' ? [v] : v) : Array.isArray(prev) ? [...prev, v] : [prev, v];
    }
  }
  return out.name || out.recipeIngredient ? out : null;
}

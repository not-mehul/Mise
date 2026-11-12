// ============================================================
// Recipe files: a Mise backup or shared recipe (.zip or .json),
// a Paprika export (.paprikarecipes), or schema.org Recipe JSON
// (Mealie and most recipe managers export it). Foreign recipes
// become drafts, so they are checked like any other import.
// ============================================================

import { gunzipSync, unzip, type Unzipped } from 'fflate';
import { emptyDraft, type Macro, type RecipeDraft } from '../domain/recipe';
import { base64ToBytes } from '../lib/base64';
import { isZip, parseBackup, type BackupData } from '../lib/backup';
import { draftFromSchema, findRecipe } from './schema';
import { readMacros } from './text';

export interface ForeignRecipe {
  draft: RecipeDraft;
  photo: Blob | null;
}

export type RecipeFile = { kind: 'mise'; data: BackupData } | { kind: 'recipes'; recipes: ForeignRecipe[] };

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');

/** "45 mins", "1 hr 10 min" → minutes as text, or ''. */
function minutes(v: unknown): string {
  const text = str(v).toLowerCase();
  if (!text) return '';
  let total = 0;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes)?\b/g)) total += Number(m[1]) * (m[2]?.startsWith('h') ? 60 : 1);
  return total > 0 ? String(Math.round(total)) : '';
}

/** One recipe from Paprika's JSON. */
export function draftFromPaprika(p: Json): ForeignRecipe {
  const url = str(p.source_url);
  const draft = emptyDraft({ kind: url ? 'url' : 'manual', ...(url ? { url } : {}), ...(str(p.source) ? { author: str(p.source) } : {}) });
  draft.title = str(p.name);
  draft.servings = /\d+/.exec(str(p.servings))?.[0] ?? '';
  draft.prepMinutes = minutes(p.prep_time);
  draft.cookMinutes = minutes(p.cook_time);
  draft.totalMinutes = minutes(p.total_time);
  draft.ingredients = str(p.ingredients);
  draft.steps = str(p.directions);
  draft.notes = [str(p.description), str(p.notes)].filter(Boolean).join('\n\n');
  draft.tags = Array.isArray(p.categories) ? p.categories.map(str).filter(Boolean).join(', ') : '';
  // Paprika keeps nutrition as free text, one fact per line.
  for (const line of str(p.nutritional_info).split(/\n|;/)) {
    for (const [m, v] of Object.entries(readMacros(line) ?? {}) as [Macro, string][]) if (!draft.nutrition[m]) draft.nutrition[m] = v;
  }
  const photo = str(p.photo_data);
  return { draft, photo: photo ? new Blob([base64ToBytes(photo) as BlobPart], { type: 'image/jpeg' }) : null };
}

function unzipped(bytes: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => unzip(bytes, (err, files) => (err ? reject(err) : resolve(files))));
}

/** Schema.org recipes anywhere in some JSON: one Recipe, a list of them, an @graph, or Mealie's bare recipe. */
function schemaRecipes(data: unknown): ForeignRecipe[] {
  const items = Array.isArray(data) ? data : [data];
  const out: ForeignRecipe[] = [];
  for (const item of items) {
    const found = findRecipe([item]) ?? (item && typeof item === 'object' && 'recipeIngredient' in item && 'name' in item ? (item as Json) : null);
    if (!found) continue;
    const { draft } = draftFromSchema(found, str(found.url) || str(found.orgURL), null);
    if (!draft.source.url) draft.source = { kind: 'manual', ...(draft.source.author ? { author: draft.source.author } : {}) };
    out.push({ draft, photo: null });
  }
  return out;
}

/** Reads a recipe file. Throws when it isn't one Mise knows. */
export async function readRecipeFile(bytes: Uint8Array, name = ''): Promise<RecipeFile> {
  if (isZip(bytes)) {
    const files = await unzipped(bytes);
    if (files['mise.json']) return { kind: 'mise', data: await parseBackup(bytes) };
    const paprika = Object.entries(files).filter(([path]) => path.endsWith('.paprikarecipe'));
    if (paprika.length) {
      return { kind: 'recipes', recipes: paprika.map(([, gz]) => draftFromPaprika(JSON.parse(new TextDecoder().decode(gunzipSync(gz))) as Json)) };
    }
    throw new Error(`Not a recipe file: ${name}`);
  }
  // A single Paprika recipe is gzipped JSON.
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return { kind: 'recipes', recipes: [draftFromPaprika(JSON.parse(new TextDecoder().decode(gunzipSync(bytes))) as Json)] };
  const text = new TextDecoder().decode(bytes);
  const data: unknown = JSON.parse(text);
  if (data && typeof data === 'object' && (data as Json).app === 'mise') return { kind: 'mise', data: await parseBackup(bytes) };
  const recipes = schemaRecipes(data);
  if (!recipes.length) throw new Error(`Not a recipe file: ${name}`);
  return { kind: 'recipes', recipes };
}

// ============================================================
// The Mise text format: a recipe written so Mise can read every
// field exactly, with no guessing. It is Markdown, and it is what
// Share as text and the Markdown export write, so a recipe goes
// out and comes back in the same. Recipes_Guide.md is the spec.
//
//   # Title
//   Serves: 4
//   Prep: 20 min          (also Cook:, Total:)
//   Tags: curry, weeknight
//   Collections: Weeknights
//   Source: https://…     Author: …
//   Calories: 520         (also Protein:, Carbs:, Fat:)
//   A description, if you like.
//   ## Ingredients        ### group, then "- 600 g chicken thighs, diced"
//   ## Method             ### section, then "1. Heat the oil…"
//   ## Notes
//
// Text that doesn't start with "# Title" and hold an Ingredients
// or Method heading is read the usual way, by its shape.
// ============================================================

import { stripListMarker } from '../domain/ingredient';
import { emptyDraft, parseTags, webLink, type Macro, type RecipeDraft, type SourceKind } from '../domain/recipe';
import { headingOf, parseMinutes, readMacros } from './text';

type Field =
  | 'servings' | 'prep' | 'cook' | 'total' | 'tags' | 'collections' | 'source' | 'author'
  | 'nutrition' | 'description' | Macro;

// Keys are matched whole and in any case; "Prep time" and "Prep" are the same field.
const FIELDS: [Field, RegExp][] = [
  ['servings', /^(?:serves|servings?|yields?|makes|portions?)$/i],
  ['prep', /^(?:prep|prep time|preparation|preparation time)$/i],
  ['cook', /^(?:cook|cook time|cooking|cooking time|bake|bake time|baking time)$/i],
  ['total', /^(?:total|total time|ready in|time)$/i],
  ['tags', /^(?:tags?|keywords?|categor(?:y|ies))$/i],
  ['collections', /^collections?$/i],
  ['source', /^(?:source|url|link)$/i],
  ['author', /^(?:author|by|credit)$/i],
  ['calories', /^(?:calories|kcal|energy)$/i],
  ['protein', /^protein$/i],
  ['carbs', /^(?:carbs|carbohydrates?)$/i],
  ['fat', /^fat$/i],
  ['nutrition', /^(?:nutrition|macros|per serving)$/i],
  ['description', /^(?:description|about|summary)$/i],
];
const FIELD_LINE = /^([\p{L}][\p{L} ]{0,24}?)\s*:\s*(.*)$/u;
const TITLE = /^#(?!#)\s+(.+?)\s*#*$/;
const SECTION = /^##(?!#)\s+(.+?)\s*#*$/;
const SUBSECTION = /^###\s+(.+?)\s*#*$/;
/** A step's own marker: "1.", "2)", "Step 3:", or a bullet. */
const STEP_MARKER = /^(?:\d{1,3}\s*[.)]\s+|step\s*\d+\s*[:.)-]?\s*|[-*•]\s+)/i;

function fieldOf(key: string): Field | null {
  return FIELDS.find(([, re]) => re.test(key.trim()))?.[0] ?? null;
}

/** The first whole number: "4", "4 people", "Makes 12 buns". */
function count(value: string): string {
  return /\d{1,4}/.exec(value)?.[0] ?? '';
}

function minutes(value: string): string {
  const v = value.trim();
  if (/^\d{1,4}$/.test(v)) return v;
  const m = parseMinutes(v);
  return m === null ? '' : String(m);
}

function macro(value: string): string {
  return /\d+(?:[.,]\d+)?/.exec(value)?.[0].replace(',', '.') ?? '';
}

/** True when the text is in the Mise format: "# Title" first, then an Ingredients or Method heading. */
export function isMiseText(input: string): boolean {
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim());
  const first = lines.find(Boolean);
  if (!first || !TITLE.test(first)) return false;
  return lines.some((l) => {
    const s = SECTION.exec(l);
    if (!s) return false;
    const h = headingOf(s[1]!);
    return h === 'ingredients' || h === 'steps';
  });
}

export interface MiseText {
  draft: RecipeDraft;
  /** Collections to file it under, by name; Mise makes any that don't exist yet when it's saved. */
  collections: string[];
}

/** Reads a recipe in the Mise format, or null when the text isn't in it. */
export function parseMiseText(input: string, kind: SourceKind = 'text', extra: { url?: string; author?: string } = {}): MiseText | null {
  if (!isMiseText(input)) return null;
  const original = input.replace(/\r\n?/g, '\n').trim();
  const draft = emptyDraft({ kind, text: original, ...extra });
  const collections: string[] = [];
  const lines = original.split('\n').map((l) => l.replace(/\u00a0/g, ' ').trimEnd());

  let at = lines.findIndex((l) => l.trim());
  draft.title = TITLE.exec(lines[at]!.trim())![1]!;
  at++;

  // ---------- the fields, up to the first "##" ----------
  const description: string[] = [];
  let url = extra.url ?? '';
  let author = extra.author ?? '';
  for (; at < lines.length && !SECTION.test(lines[at]!.trim()); at++) {
    const line = lines[at]!.trim();
    if (!line) {
      if (description.length && description.at(-1) !== '') description.push('');
      continue;
    }
    const kv = FIELD_LINE.exec(line);
    const field = kv ? fieldOf(kv[1]!) : null;
    if (kv && field) {
      const value = kv[2]!.trim();
      if (!value) continue;
      switch (field) {
        case 'servings': draft.servings = count(value); break;
        case 'prep': draft.prepMinutes = minutes(value); break;
        case 'cook': draft.cookMinutes = minutes(value); break;
        case 'total': draft.totalMinutes = minutes(value); break;
        case 'tags': draft.tags = parseTags(value).join(', '); break;
        case 'collections':
          for (const name of value.split(',').map((n) => n.trim()).filter(Boolean)) if (!collections.some((c) => c.toLowerCase() === name.toLowerCase())) collections.push(name);
          break;
        case 'source':
          if (webLink(value)) url = webLink(value)!;
          else if (!author) author = value;
          break;
        case 'author': author = value; break;
        case 'nutrition':
          for (const [m, v] of Object.entries(readMacros(line) ?? {}) as [Macro, string][]) draft.nutrition[m] = v;
          break;
        case 'description': description.push(value); break;
        default: draft.nutrition[field] = macro(value);
      }
      continue;
    }
    if (readOldHeader(line, draft)) continue;
    description.push(line);
  }

  // ---------- the sections ----------
  const ingredients: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];
  let section: 'ingredients' | 'steps' | 'notes' = 'notes';
  /** The method numbers or bullets its steps, so a line without one carries on the step before. */
  let marked = false;
  let lastWasStep = false;
  /** Blank lines straight after a heading aren't a paragraph break. */
  let afterHeading = false;
  for (; at < lines.length; at++) {
    const line = lines[at]!.trim();
    const head = SECTION.exec(line);
    if (head) {
      const h = headingOf(head[1]!);
      section = h === 'ingredients' || h === 'steps' ? h : 'notes';
      // "## Notes" needs no label; any other section ("## Storage") keeps its name in the notes.
      if (section === 'notes' && h !== 'notes') pushParagraph(notes, `${head[1]!.replace(/:$/, '')}:`);
      else if (section === 'notes' && notes.length) pushParagraph(notes, '');
      lastWasStep = false;
      afterHeading = true;
      continue;
    }
    if (!line) {
      if (section === 'notes' && !afterHeading && notes.length && notes.at(-1) !== '') notes.push('');
      continue;
    }
    afterHeading = false;
    // "Source: https://…" at the very end, where Mise's older exports put it.
    const kv = FIELD_LINE.exec(line);
    if (kv && fieldOf(kv[1]!) === 'source' && webLink(kv[2]!.trim())) {
      url ||= webLink(kv[2]!.trim())!;
      continue;
    }
    const sub = SUBSECTION.exec(line);
    if (section === 'ingredients') {
      if (sub) ingredients.push(`${sub[1]!.replace(/:$/, '')}:`);
      else ingredients.push(/:\s*$/.test(line) ? line : stripListMarker(line));
    } else if (section === 'steps') {
      // "### Sauce", or "For the sauce:" on its own line, starts a section of the method.
      if (sub || (!STEP_MARKER.test(line) && /^\D.{0,58}:$/.test(line) && line.split(/\s+/).length <= 6)) {
        steps.push(`${(sub ? sub[1]! : line).replace(/:$/, '')}:`);
        lastWasStep = false;
        continue;
      }
      const hasMarker = STEP_MARKER.test(line);
      marked ||= hasMarker;
      const text = line.replace(STEP_MARKER, '').trim();
      if (!hasMarker && marked && lastWasStep) steps[steps.length - 1] += ` ${text}`;
      else steps.push(text);
      lastWasStep = true;
    } else {
      notes.push(sub ? `${sub[1]!.replace(/:$/, '')}:` : line);
    }
  }

  draft.ingredients = ingredients.join('\n');
  draft.steps = steps.join('\n');
  draft.notes = [description.join('\n').trim(), notes.join('\n').trim()].filter(Boolean).join('\n\n');
  if (url) draft.source = { ...draft.source, kind: /(^|\.)instagram\.com$/i.test(new URL(url).hostname) ? 'instagram' : 'url', url };
  if (author) draft.source = { ...draft.source, author: author.slice(0, 120) };
  return { draft, collections };
}

function pushParagraph(list: string[], line: string) {
  if (list.length && list.at(-1) !== '') list.push('');
  if (line) list.push(line);
}

/**
 * The header Mise wrote before this format ("Serves 4 · 45 min", "#pasta #quick",
 * "Per serving: 450 kcal · Protein 32 g"), so older exports read back the same.
 */
function readOldHeader(line: string, draft: RecipeDraft): boolean {
  if (/^#\S/.test(line) && line.split(/\s+/).every((w) => w.startsWith('#'))) {
    draft.tags = parseTags(line).join(', ');
    return true;
  }
  const parts = line.split(/\s*[·•|]\s*/).filter(Boolean);
  const read = parts.map((part) => {
    const serves = /^(?:serves|makes)\s+(\d{1,4})$|^(\d{1,4})\s+servings?$/i.exec(part);
    if (serves) return () => (draft.servings = serves[1] ?? serves[2]!);
    if (/^(?:\d+\s*(?:hours?|hrs?|h|minutes?|mins?|m)\s*)+$/i.test(part)) return () => (draft.totalMinutes = minutes(part));
    return null;
  });
  if (read.every(Boolean)) {
    for (const r of read) r!();
    return true;
  }
  const macros = readMacros(line);
  if (macros) {
    for (const [m, v] of Object.entries(macros) as [Macro, string][]) draft.nutrition[m] = v;
    return true;
  }
  return false;
}

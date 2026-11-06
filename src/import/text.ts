// ============================================================
// Pasted or recognised text → a recipe draft. It reads the title,
// servings and times, then the ingredients and the method, by
// headings when the text has them ("Ingredients", "Method", in all
// four languages) and by the shape of each line when it doesn't.
// Lines it can't place go to `unsorted` for the person to sort.
// ============================================================

import { stripListMarker } from '../domain/ingredient';
import { parseLeadingQuantity } from '../domain/quantity';
import { emptyDraft, type RecipeDraft, type SourceKind } from '../domain/recipe';
import { parseLeadingUnit } from '../domain/units';

type Section = 'intro' | 'ingredients' | 'steps' | 'notes';

const HEADINGS: [Section, RegExp][] = [
  ['ingredients', /^(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|shopping list|ingredientes|ingrédients|zutaten|einkaufsliste)$/i],
  ['steps', /^(?:method|methods|directions|instructions|steps|preparation|prep|how to(?: make(?: it)?)?|recipe|preparación|elaboración|instrucciones|pasos|modo de preparación|préparation|étapes|instructions|recette|zubereitung|anleitung|schritte)$/i],
  ['notes', /^(?:notes?|tips?|recipe notes|cook(?:'|’)s notes|storage|notas|consejos|astuces|remarques|conseils|tipps|hinweise|notizen)$/i],
];

const SERVINGS = /\b(?:serves|servings|serving|yield|yields|makes|portions?|raciones|porciones|para|personnes|pour|portionen|für)\s*:?\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:servings|portions|people|persons|personas|porciones|personnes|parts|portionen|personen)\b/i;
const TIME_LINE = /\b(prep(?:aration)?|cook(?:ing)?|bake|baking|total|ready in|preparación|cocción|total|préparation|cuisson|zubereitung|kochzeit|backzeit|gesamt)\s*(?:time|tiempo|temps|zeit)?\s*:?\s*([^|·•,;]*)/gi;
const CLUTTER = /^(?:#\S+(?:\s+#\S+)*|.*\blink in (?:my )?bio\b.*|.*\b(?:follow|save this|tag a friend|like and share|comment\b.*\bbelow)\b.*|@\S+(?:\s+@\S+)*)$/i;
const NUMBERED_STEP = /^(?:\d{1,2}\s*[.):]|step\s*\d+|paso\s*\d+|étape\s*\d+|schritt\s*\d+)/i;
const EMOJI = /\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}]|\u{FE0F}|\u{200D}/gu;

/** "1 hr 20 mins", "45 minutes", "1h30" → minutes. */
export function parseMinutes(text: string): number | null {
  const t = text.toLowerCase();
  let total = 0;
  let found = false;
  const hm = /(\d+)\s*h\s*(\d{1,2})(?!\s*(?:min|m))/.exec(t);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  for (const m of t.matchAll(/(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|horas?|heures?|stunden?|std|minutes?|mins?|m|minutos?|minuten)\b/g)) {
    const n = Number(m[1]!.replace(',', '.'));
    total += /^(?:h|hr|hrs|hour|hours|hora|horas|heure|heures|stunde|stunden|std)$/.test(m[2]!) ? n * 60 : n;
    found = true;
  }
  return found && total > 0 ? Math.round(total) : null;
}

function headingOf(line: string): Section | null {
  const text = stripListMarker(line).replace(EMOJI, '').replace(/[:：\-–—*_#=]+$/u, '').replace(/^[#*_=\s]+/, '').trim();
  for (const [section, re] of HEADINGS) if (re.test(text)) return section;
  return null;
}

function looksLikeIngredient(line: string): boolean {
  const text = stripListMarker(line);
  if (text.length > 90) return false;
  const q = parseLeadingQuantity(text);
  if (q) return !/^(?:minutes?|mins?|hours?|degrees|°)/i.test(q.rest);
  return !!parseLeadingUnit(text) || /^(?:a|an)\s+(?:pinch|dash|handful|splash)\b/i.test(text) || /\bto taste\b/i.test(text);
}

function looksLikeStep(line: string): boolean {
  return NUMBERED_STEP.test(line) || (line.length >= 50 && /[.!]$|\b(?:add|stir|mix|cook|bake|heat|serve|combine|whisk|pour|place|remove)\b/i.test(line));
}

/** Splits a long run-on method paragraph into sentences. */
function sentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ\d])/u).map((s) => s.trim()).filter(Boolean);
}

export interface ParsedText {
  draft: RecipeDraft;
  /** True when headings told the parser where things are, so the result is more trustworthy. */
  structured: boolean;
}

export function parseRecipeText(input: string, kind: SourceKind = 'text', extra: { url?: string; author?: string } = {}): ParsedText {
  const original = input.replace(/\r\n?/g, '\n').trim();
  const draft = emptyDraft({ kind, text: original, ...extra });
  const lines = original
    .split('\n')
    .map((l) => l.replace(/\u00a0/g, ' ').trim())
    .filter((l) => l && !CLUTTER.test(l.replace(EMOJI, '').trim()));

  const ingredients: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];
  const intro: string[] = [];
  const unsorted: string[] = [];
  let section: Section = 'intro';
  let structured = false;

  for (const line of lines) {
    const heading = headingOf(line);
    if (heading) {
      section = heading;
      structured = true;
      continue;
    }
    // Servings and times, wherever they are.
    const serv = SERVINGS.exec(line);
    const times = [...line.matchAll(TIME_LINE)];
    if (serv && !draft.servings && line.length < 60) {
      draft.servings = serv[1] ?? serv[2] ?? '';
      if (!times.length) continue;
    }
    if (times.length && line.length < 120 && section !== 'steps') {
      let used = false;
      for (const m of times) {
        const minutes = parseMinutes(m[2]!);
        if (minutes === null) continue;
        const label = m[1]!.toLowerCase();
        const field = /^(?:prep|preparation|preparación|préparation|zubereitung)/.test(label)
          ? 'prepMinutes'
          : /^(?:total|ready in|gesamt)/.test(label)
            ? 'totalMinutes'
            : 'cookMinutes';
        if (!draft[field]) draft[field] = String(minutes);
        used = true;
      }
      if (used) continue;
    }

    const clean = line.replace(EMOJI, '').replace(/\s+/g, ' ').trim();
    if (!clean) continue;
    switch (section) {
      case 'ingredients':
        // A group heading ("For the sauce:") stays as it is; parseIngredientText reads it.
        ingredients.push(/:\s*$/.test(clean) ? clean : stripListMarker(clean));
        break;
      case 'steps':
        steps.push(...(clean.length > 160 ? sentences(clean) : [clean]));
        break;
      case 'notes':
        notes.push(clean);
        break;
      default:
        intro.push(clean);
    }
  }

  // The title: the first short line before anything else.
  const titleAt = intro.findIndex((l) => l.length <= 80 && !looksLikeIngredient(l) && !looksLikeStep(l));
  if (titleAt >= 0) draft.title = intro.splice(titleAt, 1)[0]!.replace(/[.!:]+$/, '');

  if (structured) {
    // Text before the first heading is a description; keep it as a note.
    notes.unshift(...intro);
  } else {
    // No headings: sort each line by its shape.
    for (const line of intro) {
      if (looksLikeIngredient(line)) ingredients.push(stripListMarker(line));
      else if (looksLikeStep(line)) steps.push(...(line.length > 160 ? sentences(line) : [line]));
      else unsorted.push(line);
    }
  }

  draft.ingredients = ingredients.join('\n');
  draft.steps = steps.map((s) => s.replace(NUMBERED_STEP, '').replace(/^\s*[.):-]\s*/, '').trim()).filter(Boolean).join('\n');
  draft.notes = notes.join('\n');
  draft.unsorted = unsorted;
  return { draft, structured };
}

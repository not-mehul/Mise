// ============================================================
// Pasted or recognised text → a recipe draft. It reads the title,
// servings and times, then the ingredients and the method, by
// headings when the text has them ("Ingredients", "Method", in all
// four languages) and by the shape of each line when it doesn't.
// Lines it can't place go to `unsorted` for the person to sort.
// ============================================================

import { parseIngredient, stripListMarker } from '../domain/ingredient';
import { parseLeadingQuantity } from '../domain/quantity';
import { emptyDraft, type Macro, type RecipeDraft, type SourceKind } from '../domain/recipe';
import { parseLeadingUnit } from '../domain/units';

type Section = 'intro' | 'ingredients' | 'steps' | 'notes';
type Heading = Section | 'skip';

const HEADINGS: [Heading, RegExp][] = [
  ['ingredients', /^(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|shopping list|ingredientes|ingrédients|zutaten|einkaufsliste)$/i],
  ['steps', /^(?:method|methods|directions|instructions|steps|preparation|prep|how to(?: make(?: it)?)?|preparación|elaboración|instrucciones|pasos|modo de preparación|préparation|étapes|zubereitung|anleitung|schritte)$/i],
  // "Recipe 👇" in a caption says nothing about what follows: the line is dropped, the section kept.
  ['skip', /^(?:recipe|recipes|the recipe|full recipe|receta|recette|rezept)$/i],
  ['notes', /^(?:notes?|tips?|recipe notes|cook(?:'|’)s notes|storage|notas|consejos|astuces|remarques|conseils|tipps|hinweise|notizen)$/i],
];

// "Serves 4" at the start of a line, or "4 servings" anywhere. "pour", "para" and "für" count only
// before people ("pour 4 personnes"), so "Pour 2 cups of water" stays a step.
const SERVINGS = /^(?:serves|servings|serving|yield|yields|makes|portions?|raciones|porciones|portionen|personnes)\s*:?\s*(\d{1,3})\b|\b(?:para|pour|für)\s+(\d{1,3})\s*(?:personas|porciones|raciones|personnes|portions|personen|portionen)\b|\b(\d{1,3})\s*(?:servings|portions|people|persons|personas|porciones|personnes|parts|portionen|personen)\b/i;
// A time line: a label at the start of a segment ("Prep time: 10 min | Cook: 20 min"), with the word
// "time" or a colon, or nothing but the duration after it. "Bake for 25 minutes until golden" is a step.
const TIME_LABEL = /^(prep(?:aration)?|cook(?:ing)?|bake|baking|total|ready in|preparación|cocción|préparation|cuisson|zubereitung|kochzeit|backzeit|gesamt)\s*(time|tiempo|temps|zeit)?\s*(:)?\s*(.*)$/i;
const ONLY_DURATION = /^(?:\d+(?:[.,]\d+)?\s*(?:hours?|hrs?|h|horas?|heures?|stunden?|std|minutes?|mins?|m|minutos?|minuten)\.?\s*)+$/i;
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

/** The labelled durations in a line, or [] when it isn't a line of times. */
function timeSegments(line: string): { label: string; minutes: number }[] {
  const out: { label: string; minutes: number }[] = [];
  for (const segment of line.split(/[|·•,;]/)) {
    const m = TIME_LABEL.exec(stripListMarker(segment.trim()));
    if (!m) continue;
    const rest = m[4]!.trim();
    if (!m[2] && !m[3] && !ONLY_DURATION.test(rest)) continue;
    const minutes = parseMinutes(rest);
    if (minutes !== null) out.push({ label: m[1]!.toLowerCase(), minutes });
  }
  return out;
}

function headingOf(line: string): Heading | null {
  const text = stripListMarker(line).replace(EMOJI, '').replace(/[:：\-–—*_#=]+$/u, '').replace(/^[#*_=\s]+/, '').trim();
  for (const [section, re] of HEADINGS) if (re.test(text)) return section;
  return null;
}

function looksLikeIngredient(line: string): boolean {
  const text = stripListMarker(line);
  if (text.length > 90) return false;
  const q = parseLeadingQuantity(text);
  if (q) return !/^(?:minutes?|mins?|hours?|degrees|°)/i.test(q.rest);
  if (parseLeadingUnit(text) || /^(?:a|an)\s+(?:pinch|dash|handful|splash)\b/i.test(text) || /\bto taste\b/i.test(text)) return true;
  // "Basmati rice - 200g, uncooked": the amount comes after the item.
  return !looksLikeStep(text) && parseIngredient(text).unit !== null;
}

// A line that opens with a kitchen verb is an instruction, however short: "Pour 2 cups of water into the pot."
const STEP_VERB = /^(?:add|stir|mix|cook|bake|heat|serve|combine|whisk|pour|place|remove|preheat|bring|boil|simmer|fry|roast|grill|chop|slice|dice|season|toss|fold|beat|blend|drain|cover|let|leave|put|cut|melt|spread|sprinkle|transfer|top|garnish|knead|rest|marinate|warm|reduce|a[ñn]ade|mezcla|cocina|hornea|calienta|sirve|vierte|corta|ajoute|mélange|faites|cuire|versez|coupez|ajoutez|mélangez|gib|mische|koche|backe|erhitze|schneide|serviere)\b/i;

function looksLikeStep(line: string): boolean {
  if (NUMBERED_STEP.test(line)) return true;
  if (STEP_VERB.test(stripListMarker(line)) && line.split(/\s+/).length >= 3) return true;
  return line.length >= 50 && /[.!]$|\b(?:add|stir|mix|cook|bake|heat|serve|combine|whisk|pour|place|remove)\b/i.test(line);
}

/** Splits a long run-on method paragraph into sentences. */
function sentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ\d])/u).map((s) => s.trim()).filter(Boolean);
}

// ---------- macros ----------

const MACRO_WORDS: [Macro, RegExp][] = [
  ['calories', /^(?:calories|calorie|cals?|kcal|energy|kalorien|energie|calorías|calorias|énergie)$/i],
  ['protein', /^(?:protein|proteins|prot|p|eiweiß|eiweiss|proteína|proteinas|proteínas|protéines|protéine)$/i],
  ['carbs', /^(?:carbs?|carbohydrates?|carbohydrate|c|kohlenhydrate|kh|carbohidratos|hidratos|glucides)$/i],
  ['fat', /^(?:fats?|f|total fat|fett|grasas?|lipides|matières grasses)$/i],
];
const NUM = String.raw`(\d+(?:[.,]\d+)?)`;
const WORD = String.raw`([A-Za-zÀ-ÿß]+(?: fat)?)`;
// "Protein: 40g", "40g protein", "40 g P", "450 kcal", "Calories 450".
const MACRO_PAIRS = [
  new RegExp(`${WORD}\\s*[:=-]?\\s*${NUM}\\s*(?:k?cal|g|grams?)?\\b`, 'giu'),
  new RegExp(`${NUM}\\s*(k?cal|g|grams?)?\\s*(?:of\\s+)?${WORD}`, 'giu'),
];

function macroOf(word: string): Macro | null {
  return MACRO_WORDS.find(([, re]) => re.test(word.trim()))?.[0] ?? null;
}

/**
 * The macros on a line ("Macros: 520 kcal | 45g P | 50g C | 12g F"), or null when it
 * names fewer than two of them or has words that aren't about macros (a recipe line).
 */
export function readMacros(line: string): Partial<Record<Macro, string>> | null {
  const text = line.replace(EMOJI, ' ').replace(/^(?:macros?|nutrition(?: facts)?|per serving|nährwerte|valores nutricionales|valeurs nutritionnelles)[^:]*:\s*/i, '');
  const found: Partial<Record<Macro, string>> = {};
  let covered = '';
  for (const re of MACRO_PAIRS) {
    for (const m of text.matchAll(re)) {
      const [word, num, unit] = re === MACRO_PAIRS[0] ? [m[1]!, m[2]!, ''] : [m[3]!, m[1]!, m[2] ?? ''];
      let macro = macroOf(word);
      if (!macro && /k?cal/i.test(unit)) macro = 'calories';
      if (!macro || found[macro]) continue;
      found[macro] = num.replace(',', '.');
      covered += m[0];
    }
    if (Object.keys(found).length) break;
  }
  // "450 kcal" on its own.
  const kcal = /(\d+(?:[.,]\d+)?)\s*k?cal\b/i.exec(text);
  if (kcal && !found.calories) {
    found.calories = kcal[1]!.replace(',', '.');
    covered += kcal[0];
  }
  const count = Object.keys(found).length;
  if (!count) return null;
  // Most of the line must be the macros, so "Add 40 g of fat" isn't read as one.
  const rest = text.replace(/[\d.,:|/•·;()\-–—+%]/g, ' ').replace(/\b(?:k?cal|g|grams?|of|and|per|serving|portion)\b/gi, ' ');
  const words = rest.split(/\s+/).filter((w) => w && !macroOf(w));
  return count >= 2 || (count === 1 && words.length === 0 && covered.length >= text.trim().length * 0.6) ? found : null;
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
    if (heading === 'skip') continue;
    if (heading) {
      section = heading;
      structured = true;
      continue;
    }
    // Servings and times, wherever they are.
    let serv = section === 'steps' ? null : SERVINGS.exec(stripListMarker(line));
    // "4 servings" mid-sentence ("Divide into 4 servings and serve") is a step, not the yield.
    if (serv?.[3] && line.length >= 30) serv = null;
    const times = section === 'steps' || line.length >= 120 ? [] : timeSegments(line);
    if (serv && !draft.servings && line.length < 60) {
      draft.servings = serv[1] ?? serv[2] ?? serv[3] ?? '';
      if (!times.length) continue;
    }
    if (times.length) {
      let used = false;
      for (const m of times) {
        const minutes = m.minutes;
        const label = m.label;
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

    const macros = section === 'steps' ? null : readMacros(line);
    if (macros) {
      for (const [m, v] of Object.entries(macros) as [Macro, string][]) if (!draft.nutrition[m]) draft.nutrition[m] = v;
      continue;
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

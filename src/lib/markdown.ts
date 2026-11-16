// A recipe as Markdown in the Mise text format (Recipes_Guide.md), for reading
// anywhere, sharing as text, and pasting back into Mise with every field kept.
// The field names stay in English in every language: they are the format's keys.

import type { Recipe } from '../domain/recipe';

export interface MarkdownLabels {
  ingredients: string;
  method: string;
  notes: string;
  /** The names of the collections the recipe is in. */
  collections?: (r: Recipe) => string[];
}

/** 45 → "45 min", 90 → "1 hr 30 min", 120 → "2 hr". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return [h ? `${h} hr` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
}

export function recipeToMarkdown(r: Recipe, l: MarkdownLabels): string {
  const out: string[] = [`# ${r.title}`, ''];
  const fields: [string, string | number | null | undefined][] = [
    ['Serves', r.servings],
    ['Prep', r.prepMinutes ? formatMinutes(r.prepMinutes) : null],
    ['Cook', r.cookMinutes ? formatMinutes(r.cookMinutes) : null],
    ['Total', r.totalMinutes ? formatMinutes(r.totalMinutes) : null],
    ['Tags', r.tags.join(', ')],
    ['Collections', l.collections?.(r).join(', ')],
    ['Source', r.source.url],
    ['Author', r.source.author],
    ['Calories', r.nutrition.calories],
    ['Protein', r.nutrition.protein !== null ? `${r.nutrition.protein} g` : null],
    ['Carbs', r.nutrition.carbs !== null ? `${r.nutrition.carbs} g` : null],
    ['Fat', r.nutrition.fat !== null ? `${r.nutrition.fat} g` : null],
  ];
  const meta = fields.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${k}: ${v}`);
  if (meta.length) out.push(...meta, '');
  if (r.groups.some((g) => g.items.length)) {
    out.push(`## ${l.ingredients}`, '');
    for (const g of r.groups) {
      if (g.name) out.push(`### ${g.name}`, '');
      for (const i of g.items) out.push(`- ${i.raw}`);
      out.push('');
    }
  }
  if (r.steps.length) {
    out.push(`## ${l.method}`, '');
    let section: string | undefined;
    r.steps.forEach((s, i) => {
      if (s.section && s.section !== section) out.push(...(i ? [''] : []), `### ${s.section}`, '');
      section = s.section;
      out.push(`${i + 1}. ${s.text}`);
    });
    out.push('');
  }
  if (r.notes) out.push(`## ${l.notes}`, '', r.notes, '');
  return out.join('\n').trimEnd() + '\n';
}

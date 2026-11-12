// A recipe as Markdown, for reading anywhere or sharing as text.

import type { Recipe } from '../domain/recipe';
import { totalTime } from '../domain/recipe';

export interface MarkdownLabels {
  ingredients: string;
  method: string;
  notes: string;
  serves: (n: number) => string;
  minutes: (n: number) => string;
  source: string;
  /** "Per serving: 450 kcal · Protein 40 g · …", or '' when there are none. */
  macros?: (r: Recipe) => string;
}

export function recipeToMarkdown(r: Recipe, l: MarkdownLabels): string {
  const out: string[] = [`# ${r.title}`, ''];
  const meta = [r.servings ? l.serves(r.servings) : '', totalTime(r) ? l.minutes(totalTime(r)!) : ''].filter(Boolean);
  if (meta.length) out.push(meta.join(' · '), '');
  if (r.tags.length) out.push(r.tags.map((t) => `#${t}`).join(' '), '');
  const macros = l.macros?.(r);
  if (macros) out.push(macros, '');
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
      if (s.section && s.section !== section) out.push('', `### ${s.section}`, '');
      section = s.section;
      out.push(`${i + 1}. ${s.text}`);
    });
    out.push('');
  }
  if (r.notes) out.push(`## ${l.notes}`, '', r.notes, '');
  if (r.source.url) out.push(`${l.source}: ${r.source.url}`, '');
  return out.join('\n').trimEnd() + '\n';
}

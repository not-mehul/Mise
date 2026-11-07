// Keeps the home screen grocery widget showing what is still to buy, in
// shop order, whenever the list changes.

import { byAisle, formatAmounts, type GroceryItem } from '../domain/groceries';
import { locale } from '../i18n/index.svelte';
import { showOnWidget } from '../platform/launcher';
import { groceries } from './groceries.svelte';

/** "lemons · 2", one line per item still to buy, by aisle. */
export function widgetLines(list: GroceryItem[], lang = 'en'): string[] {
  return byAisle(list.filter((g) => !g.ticked)).flatMap(({ items }) =>
    items.map((g) => {
      const amount = formatAmounts(g.amounts, lang);
      return amount ? `${g.item} · ${amount}` : g.item;
    }),
  );
}

export function keepWidgetCurrent(): void {
  let last = '';
  $effect.root(() => {
    $effect(() => {
      const lines = widgetLines(groceries.list, locale());
      const key = JSON.stringify(lines);
      if (key === last) return;
      last = key;
      void showOnWidget(lines);
    });
  });
}

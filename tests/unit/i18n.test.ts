import { describe, expect, it } from 'vitest';
import de from '../../src/i18n/de';
import en from '../../src/i18n/en';
import es from '../../src/i18n/es';
import fr from '../../src/i18n/fr';
import { translateWith, type Messages } from '../../src/i18n/index.svelte';

const placeholders = (v: unknown) => new Set(JSON.stringify(v).match(/\{\w+\}/g));

describe('translations', () => {
  for (const [name, messages] of Object.entries({ es, fr, de })) {
    it(`${name} matches the English keys, plural shapes and placeholders`, () => {
      expect(Object.keys(messages).sort()).toEqual(Object.keys(en).sort());
      for (const [key, value] of Object.entries(en)) {
        const other = (messages as Record<string, unknown>)[key];
        expect(typeof other, key).toBe(typeof value);
        for (const p of placeholders(other)) expect(placeholders(value).has(p), `${key} ${p}`).toBe(true);
      }
    });
  }

  it('interpolates and pluralises per locale', () => {
    const tEn = translateWith(en as Messages, 'en');
    const tDe = translateWith(de, 'de');
    expect(tEn('recipes.count', { count: 1 })).toBe('1 recipe');
    expect(tEn('recipes.count', { count: 3 })).toBe('3 recipes');
    expect(tDe('settings.version', { version: '1.0.0' })).toBe('Version 1.0.0');
  });
});

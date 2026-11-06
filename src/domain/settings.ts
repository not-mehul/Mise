import type { Locale } from '../i18n/index.svelte';

export type ThemeSetting = 'system' | 'light' | 'dark';
export type LanguageSetting = Locale | 'system';

export interface Settings {
  theme: ThemeSetting;
  language: LanguageSetting;
  /** When the last backup was written (ISO time), for the weekly automatic one. */
  lastBackupAt?: string;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', language: 'system' };

const THEMES: readonly ThemeSetting[] = ['system', 'light', 'dark'];
const LANGUAGES: readonly LanguageSetting[] = ['system', 'en', 'es', 'fr', 'de'];

/** Settings read back from storage, with anything unknown replaced by the default. */
export function normaliseSettings(value: unknown): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Record<keyof Settings, unknown>>;
  const settings: Settings = {
    theme: THEMES.includes(v.theme as ThemeSetting) ? (v.theme as ThemeSetting) : DEFAULT_SETTINGS.theme,
    language: LANGUAGES.includes(v.language as LanguageSetting) ? (v.language as LanguageSetting) : DEFAULT_SETTINGS.language,
  };
  if (typeof v.lastBackupAt === 'string' && !Number.isNaN(Date.parse(v.lastBackupAt))) settings.lastBackupAt = v.lastBackupAt;
  return settings;
}

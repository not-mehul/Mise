import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normaliseSettings } from '../../src/domain/settings';

describe('settings', () => {
  it('keeps valid values', () => {
    expect(normaliseSettings({ theme: 'light', language: 'fr' })).toEqual({ theme: 'light', language: 'fr' });
  });

  it('replaces anything unknown with the default', () => {
    expect(normaliseSettings({ theme: 'neon', language: 'xx' })).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('junk')).toEqual(DEFAULT_SETTINGS);
  });
});

<script lang="ts">
  import type { LanguageSetting, ThemeSetting } from '../domain/settings';
  import { LOCALES, LOCALE_NAMES, t, type MessageKey } from '../i18n/index.svelte';
  import { settings } from '../state/settings.svelte';

  const THEMES: { value: ThemeSetting; key: MessageKey }[] = [
    { value: 'system', key: 'settings.themeSystem' },
    { value: 'dark', key: 'settings.themeDusk' },
    { value: 'light', key: 'settings.themeDawn' },
  ];
</script>

<div id="viewSettings" role="tabpanel" aria-labelledby="tabSettings">
  <div class="panel">
    <div class="section-head"><h2>{t('settings.appearance')}</h2></div>
    <div class="setting-row">
      <span class="t-field-label" id="themeLabel">{t('settings.theme')}</span>
      <div class="segmented" role="radiogroup" aria-labelledby="themeLabel">
        {#each THEMES as opt (opt.value)}
          <button
            type="button"
            role="radio"
            aria-checked={settings.current.theme === opt.value}
            data-theme-option={opt.value}
            onclick={() => settings.update({ theme: opt.value })}
          >
            {t(opt.key)}
          </button>
        {/each}
      </div>
    </div>
    <p class="t-hint">{t('settings.themeHint')}</p>
    <label class="setting-row">
      <span class="t-field-label">{t('settings.language')}</span>
      <select
        class="select"
        id="languageSelect"
        value={settings.current.language}
        onchange={(e) => settings.update({ language: e.currentTarget.value as LanguageSetting })}
      >
        <option value="system">{t('settings.languageSystem')}</option>
        {#each LOCALES as code (code)}
          <option value={code}>{LOCALE_NAMES[code]}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('settings.about')}</h2></div>
    <p class="t-hint">Mise · {t('settings.version', { version: __APP_VERSION__ })}</p>
    <p class="t-hint"><b>{t('settings.privacyTerm')}</b> {t('settings.privacy')}</p>
  </div>
</div>

<style>
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .setting-row select {
    width: auto;
    min-width: 12rem;
  }
  .t-hint {
    margin-bottom: 0.75rem;
  }
</style>

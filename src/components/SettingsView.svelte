<script lang="ts">
  import type { LanguageSetting, ThemeSetting } from '../domain/settings';
  import { LOCALES, LOCALE_NAMES, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { isNative } from '../platform/output';
  import { library } from '../state/library.svelte';
  import { settings } from '../state/settings.svelte';
  import { backupNow, exportAs, importFile } from '../state/transfer';
  import { ui } from '../state/ui.svelte';

  const THEMES: { value: ThemeSetting; key: MessageKey }[] = [
    { value: 'system', key: 'settings.themeSystem' },
    { value: 'dark', key: 'settings.themeDusk' },
    { value: 'light', key: 'settings.themeDawn' },
  ];
  let busy = $state(false);

  async function run(task: () => Promise<{ message: string; ok: boolean }>) {
    busy = true;
    try {
      const { message, ok } = await task();
      ui.notify(message, ok ? 'success' : 'error');
    } finally {
      busy = false;
    }
  }

  async function backup() {
    if (!isNative) return run(() => exportAs('backup'));
    await run(async () => {
      if (!library.recipes.length) return { message: t('data.nothing'), ok: false };
      try {
        return { message: t('data.saved', { path: await backupNow() }), ok: true };
      } catch (err) {
        console.error('Backup failed:', err);
        return { message: t('data.exportFailed'), ok: false };
      }
    });
  }

  function onImport(input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = '';
    if (file) void run(() => importFile(file));
  }

  async function removeCollection(id: string, name: string) {
    await library.removeCollection(id);
    ui.notify(t('data.collectionDeleted', { name }), 'info');
  }
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
    <div class="section-head"><h2>{t('data.collections')}</h2></div>
    {#if library.collections.length}
      <ul class="collections">
        {#each library.collections as c (c.id)}
          <li>
            <span>{c.name}</span>
            <button type="button" class="btn btn-muted" aria-label={t('data.deleteCollection', { name: c.name })} onclick={() => removeCollection(c.id, c.name)}>{t('recipe.delete')}</button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="t-hint">{t('data.collectionsEmpty')}</p>
    {/if}
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('data.title')}</h2></div>
    <div class="data-actions">
      <button type="button" class="btn btn-secondary" id="btnBackup" disabled={busy} onclick={backup}>{t('data.backup')}</button>
      <button type="button" class="btn btn-muted" id="btnExportMd" disabled={busy} onclick={() => run(() => exportAs('markdown'))}>{t('data.export')}</button>
    </div>
    <p class="t-hint">{t('data.backupHint')}</p>
    {#if isNative}
      <p class="t-hint">{t('data.auto')}</p>
      <p class="t-hint">{t('data.lastBackup', { when: settings.current.lastBackupAt ? relativeTime(settings.current.lastBackupAt) : t('data.never') })}</p>
    {/if}
    <label class="btn btn-muted file-btn" class:busy>
      {t('data.import')}
      <input type="file" id="importFile" class="visually-hidden" accept=".zip,.json,application/zip,application/json" disabled={busy} onchange={(e) => onImport(e.currentTarget)} />
    </label>
    <p class="t-hint">{t('data.importHint')}</p>
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
  .data-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }
  .file-btn {
    position: relative;
    cursor: pointer;
    margin: var(--space-3) 0;
  }
  .file-btn.busy {
    opacity: 0.6;
  }
  .collections {
    list-style: none;
  }
  .collections li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 52px;
    border-bottom: 1px solid var(--border-faint);
    color: var(--text-strong);
  }
</style>

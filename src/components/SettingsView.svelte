<script lang="ts">
  import { EGGS, eggsFound } from '../lib/delight';
  import { Switch } from 'dusk-dawn';
  import type { LanguageSetting, ThemeSetting } from '../domain/settings';
  import { LOCALES, LOCALE_NAMES, relativeTime, t, type MessageKey } from '../i18n/index.svelte';
  import { volumeKeysAvailable } from '../platform/device';
  import { isNative } from '../platform/output';
  import { voiceAvailable } from '../platform/voice';
  import { groceries } from '../state/groceries.svelte';
  import { library } from '../state/library.svelte';
  import { settings } from '../state/settings.svelte';
  import { sync, type SyncResult } from '../state/sync.svelte';
  import { backupNow, exportAs, importFile } from '../state/transfer.svelte';
  import { ui } from '../state/ui.svelte';

  const THEMES: { value: ThemeSetting; key: MessageKey }[] = [
    { value: 'system', key: 'settings.themeSystem' },
    { value: 'dark', key: 'settings.themeDusk' },
    { value: 'light', key: 'settings.themeDawn' },
  ];
  let busy = $state(false);
  let staple = $state('');

  function addStaple(e: SubmitEvent) {
    e.preventDefault();
    if (!staple.trim()) return;
    groceries.setStaple(staple, true);
    staple = '';
  }

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

  async function syncing(task: () => Promise<SyncResult>) {
    const result = await task().catch(() => 'failed' as const);
    if (result === 'synced') ui.notify(t('sync.done'), 'success');
    else if (result === 'failed') ui.notify(t('sync.failed'), 'error');
  }

  async function removeCollection(id: string, name: string) {
    const undo = await library.removeCollection(id);
    ui.notify(t('data.collectionDeleted', { name }), 'info', { label: t('action.undo'), run: () => void undo() });
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
    <div class="section-head"><h2>{t('settings.cooking')}</h2></div>
    <div class="switches">
      <Switch id="switchReadAloud" checked={settings.current.readAloud} label={t('settings.readAloud')} hint={t('settings.readAloudHint')} onchange={(on) => settings.update({ readAloud: on })} />
      {#if voiceAvailable}
        <Switch id="switchHandsFree" checked={settings.current.handsFree} label={t('settings.handsFree')} hint={t('settings.handsFreeHint')} onchange={(on) => settings.update({ handsFree: on })} />
      {/if}
      {#if volumeKeysAvailable}
        <Switch id="switchVolumeKeys" checked={settings.current.volumeKeys} label={t('settings.volumeKeys')} hint={t('settings.volumeKeysHint')} onchange={(on) => settings.update({ volumeKeys: on })} />
      {/if}
    </div>
    <p class="t-hint">{t('settings.cookingHint')}</p>
  </div>

  <div class="panel">
    <div class="section-head"><h2>{t('settings.groceries')}</h2></div>
    <div class="switches">
      <Switch id="switchListAwake" checked={settings.current.listAwake} label={t('settings.listAwake')} hint={t('settings.listAwakeHint')} onchange={(on) => settings.update({ listAwake: on })} />
    </div>
    <span class="t-field-label" id="staplesLabel">{t('settings.staples')}</span>
    <p class="field-hint">{t('settings.staplesHint')}</p>
    {#if settings.current.staples.length}
      <ul class="chip-row staples" id="staplesList" aria-labelledby="staplesLabel">
        {#each settings.current.staples as s (s)}
          <li><button type="button" class="chip" aria-label={t('settings.removeStaple', { item: s })} onclick={() => groceries.setStaple(s, false)}>{s} ×</button></li>
        {/each}
      </ul>
    {/if}
    <form class="staple-form" onsubmit={addStaple}>
      <input class="input" id="stapleInput" maxlength="60" enterkeyhint="done" placeholder={t('settings.addStaple')} aria-label={t('settings.addStaple')} bind:value={staple} />
      <button type="submit" class="btn btn-muted" disabled={!staple.trim()}>{t('action.add')}</button>
    </form>
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
      {t('data.importAny')}
      <input type="file" id="importFile" class="visually-hidden" accept=".zip,.json,.paprikarecipes,.paprikarecipe,application/zip,application/json" disabled={busy} onchange={(e) => onImport(e.currentTarget)} />
    </label>
    <p class="t-hint">{t('data.importAnyHint')}</p>
  </div>

  {#if isNative}
    <div class="panel" id="syncPanel">
      <div class="section-head"><h2>{t('sync.title')}</h2></div>
      {#if settings.current.syncFolder}
        <p class="t-body-small">{t('sync.folder', { name: settings.current.syncFolder.name || t('sync.unnamed') })}</p>
        <p class="t-hint">{t('sync.last', { when: settings.current.lastSyncAt ? relativeTime(settings.current.lastSyncAt) : t('data.never') })}</p>
        <div class="data-actions">
          <button type="button" class="btn btn-secondary" id="btnSyncNow" disabled={sync.busy} onclick={() => syncing(() => sync.now())}>{t('sync.now')}</button>
          <button type="button" class="btn btn-muted" disabled={sync.busy} onclick={() => syncing(() => sync.choose())}>{t('sync.change')}</button>
          <button type="button" class="btn btn-muted" disabled={sync.busy} onclick={() => sync.stop()}>{t('sync.stop')}</button>
        </div>
      {:else}
        <button type="button" class="btn btn-secondary" id="btnSyncChoose" disabled={sync.busy} onclick={() => syncing(() => sync.choose())}>{t('sync.choose')}</button>
      {/if}
      <p class="t-hint">{t('sync.hint')}</p>
    </div>
  {/if}

  <div class="panel">
    <div class="section-head"><h2>{t('settings.about')}</h2></div>
    <p class="t-hint">Mise · {t('settings.version', { version: __APP_VERSION__ })}</p>
    <p class="t-hint" id="eggCount">{t('settings.eggs', { found: eggsFound(), total: EGGS.length })}</p>
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
  .switches {
    margin-bottom: var(--space-3);
  }
  .staples {
    list-style: none;
    margin: var(--space-3) 0;
  }
  .staple-form {
    display: flex;
    gap: var(--space-2);
    margin-top: var(--space-3);
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

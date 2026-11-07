// Navigation and transient UI state shared between components.

import type { UnitMode } from '../domain/ingredient';
import type { RecipeDraft } from '../domain/recipe';
import type { MiseLink } from '../platform/incoming';
import type { Incoming } from '../platform/shared';
import { t } from '../i18n/index.svelte';

export type Tab = 'recipes' | 'plan' | 'groceries' | 'settings';

/** What the Recipes tab shows: the list, one recipe, the editor, or cooking mode over everything. */
export type Screen =
  | { kind: 'list' }
  | { kind: 'recipe'; id: string }
  /** `owned`: unsaved photos this editor deletes if it is left without saving. */
  | { kind: 'editor'; draft: RecipeDraft; mode: 'check' | 'edit' | 'write'; owned?: string[] }
  | { kind: 'cook'; id: string; servings: number; units: UnitMode };
export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  run: () => void;
  /** Called when the toast goes away without the action being taken. */
  dismissed?: () => void;
}

export interface Toast {
  message: string;
  kind: ToastKind;
  key: number;
  action?: ToastAction;
  /** Fading out. */
  leaving?: boolean;
}

/** How long a toast stays (style.md §8.12): longer when it offers an action. */
export const TOAST_MS = 4000;
export const TOAST_ACTION_MS = 6000;
/** --dur-exit */
const TOAST_EXIT_MS = 160;

class UiState {
  tab = $state<Tab>('recipes');
  /** Something to import, from the share sheet or a mise://import link; the New recipe sheet takes it. */
  incoming = $state.raw<Incoming | null>(null);
  /** Something shared while the editor was open: it waits until the editor closes, so no edits are lost. */
  private waiting: Incoming | null = null;
  screen = $state.raw<Screen>({ kind: 'list' });
  /** The "New recipe" sheet. */
  newOpen = $state(false);
  toast = $state.raw<Toast | null>(null);
  /** Overlays (dialogs, popups) register here so the Android back button can close them. */
  private closers: (() => void)[] = [];

  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private toastKey = 0;

  /** Shows one toast, replacing any current one. */
  notify(message: string, kind: ToastKind = 'info', action?: ToastAction): void {
    if (!this.toast?.leaving) this.toast?.action?.dismissed?.();
    this.toast = { message, kind, key: ++this.toastKey, action };
    this.resumeToast();
  }

  /** Holds the toast on screen while it is touched or hovered. */
  pauseToast(): void {
    clearTimeout(this.toastTimer);
  }

  resumeToast(): void {
    clearTimeout(this.toastTimer);
    const toast = this.toast;
    if (!toast) return;
    this.toastTimer = setTimeout(() => this.dismissToast(toast.key), toast.action ? TOAST_ACTION_MS : TOAST_MS);
  }

  dismissToast(key: number): void {
    const toast = this.toast;
    if (toast?.key !== key || toast.leaving) return;
    clearTimeout(this.toastTimer);
    toast.action?.dismissed?.();
    this.toast = { ...toast, action: undefined, leaving: true };
    setTimeout(() => {
      if (this.toast?.key === key) this.toast = null;
    }, TOAST_EXIT_MS);
  }

  /** Runs the toast's action and closes it. */
  actOnToast(): void {
    const toast = this.toast;
    if (!toast?.action) return;
    clearTimeout(this.toastTimer);
    this.toast = null;
    toast.action.run();
  }

  go(tab: Tab): void {
    this.tab = tab;
    globalThis.scrollTo?.({ top: 0 });
  }

  /** A mise:// link: always lands on Recipes, never changes data (style.md §14.1). */
  openLink(link: MiseLink): void {
    if (link.kind === 'import') return this.importFrom({ kind: 'link', url: link.url, ask: true });
    this.go('recipes');
    if (link.id) this.openRecipe(link.id);
  }

  /** Opens the New recipe sheet on something to import. Nothing is saved until Save recipe. */
  importFrom(incoming: Incoming): void {
    if (this.screen.kind === 'editor') {
      this.waiting = incoming;
      this.go('recipes');
      this.notify(t('editor.shareWaiting'), 'info');
      return;
    }
    if (this.screen.kind === 'cook') this.openRecipe(this.screen.id);
    this.go('recipes');
    this.incoming = incoming;
    this.newOpen = true;
  }

  show(screen: Screen): void {
    this.screen = screen;
    if (this.tab !== 'recipes') this.tab = 'recipes';
    globalThis.scrollTo?.({ top: 0 });
  }

  openRecipe(id: string): void {
    this.show({ kind: 'recipe', id });
  }

  edit(draft: RecipeDraft, mode: 'check' | 'edit' | 'write', owned?: string[]): void {
    this.show({ kind: 'editor', draft, mode, owned });
  }

  /** Leaves the editor: back to the recipe it was editing, or to the list. */
  closeEditor(savedId?: string): void {
    const s = this.screen;
    const id = savedId ?? (s.kind === 'editor' ? s.draft.id : null);
    this.show(id ? { kind: 'recipe', id } : { kind: 'list' });
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting) this.importFrom(waiting);
  }

  pushOverlay(close: () => void): () => void {
    this.closers.push(close);
    return () => {
      this.closers = this.closers.filter((c) => c !== close);
    };
  }

  /** Handles Android back. Returns false when the app should exit. */
  back(): boolean {
    const close = this.closers.pop();
    if (close) {
      close();
      return true;
    }
    if (this.tab === 'recipes' && this.screen.kind === 'cook') {
      this.openRecipe(this.screen.id);
      return true;
    }
    if (this.tab === 'recipes' && this.screen.kind === 'editor') {
      this.closeEditor();
      return true;
    }
    if (this.tab === 'recipes' && this.screen.kind === 'recipe') {
      this.show({ kind: 'list' });
      return true;
    }
    if (this.tab !== 'recipes') {
      this.go('recipes');
      return true;
    }
    return false;
  }
}

export const ui = new UiState();

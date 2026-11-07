import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/data/db';
import { emptyDraft } from '../../src/domain/recipe';
import { library } from '../../src/state/library.svelte';
import { timers } from '../../src/state/timers.svelte';
import { ui } from '../../src/state/ui.svelte';

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  await db.delete();
  await db.open();
  await library.init();
});
afterEach(() => vi.useRealTimers());

describe('timer alarms', () => {
  it('rings with a Stop button, and opening the alarm turns cooking mode to its step', async () => {
    const r = await library.save({ ...emptyDraft(), title: 'Rice', servings: '2', ingredients: '1 cup rice', steps: 'Rinse.\nSimmer 1 minute.' });
    await timers.start({ recipeId: r.id, stepId: r.steps[1]!.id, index: 0, label: 'Step 2', seconds: 60 });
    vi.advanceTimersByTime(61_000);
    expect(timers.list[0]!.done).toBe(true);
    expect(ui.toast?.action?.label).toBe('Stop');

    timers.opened({ id: timers.list[0]!.notifyId, recipeId: r.id, stepId: r.steps[1]!.id });
    expect(ui.screen).toMatchObject({ kind: 'cook', id: r.id, servings: 2 });
    expect(ui.cookJump).toEqual({ recipeId: r.id, stepId: r.steps[1]!.id });

    ui.toast!.action!.run();
    await vi.waitFor(() => expect(timers.list).toEqual([]));
  });

  it('leaves the editor open when an alarm is opened', async () => {
    const r = await library.save({ ...emptyDraft(), title: 'Tea', ingredients: 'tea', steps: 'Steep 3 minutes.' });
    ui.edit({ ...emptyDraft() }, 'write');
    timers.opened({ id: 1, recipeId: r.id, stepId: r.steps[0]!.id });
    expect(ui.screen.kind).toBe('editor');
  });
});

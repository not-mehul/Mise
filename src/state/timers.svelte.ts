// ============================================================
// The running kitchen timers. They outlive cooking mode and the
// app itself: each is saved, and its alarm is set with the system,
// so it rings like an alarm clock even if Mise is closed.
// ============================================================

import { newId } from '../domain/ingredient';
import { extendTimer, normaliseTimers, notifyIdFor, pauseTimer, resumeTimer, startTimer, timeLeft, type Timer, type TimerInput } from '../domain/timers';
import { formatDuration } from '../domain/steps';
import { t } from '../i18n/index.svelte';
import { buzz, chime } from '../platform/device';
import { alarmsReady, cancelAlarm, scheduleAlarm, type OpenedAlarm } from '../platform/notify';
import { isNative } from '../platform/output';
import { library } from './library.svelte';
import { ui } from './ui.svelte';

const KEY = 'mise.timers';

function load(): Timer[] {
  try {
    return normaliseTimers(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}

class Timers {
  list = $state.raw<Timer[]>(load());
  /** The clock the countdowns read, ticking while any timer runs. */
  now = $state(Date.now());
  private ticker: ReturnType<typeof setInterval> | undefined;
  private salt = 0;
  private warned = false;
  /** Rung timers still chiming in the browser, until they are answered or a minute passes. */
  private ringing = new Set<string>();
  private ringer: ReturnType<typeof setInterval> | undefined;

  constructor() {
    this.schedule();
  }

  left(timer: Timer): number {
    return timeLeft(timer, this.now);
  }

  /** The running or rung timer a step's button started, if any. */
  forStep(stepId: string, index: number): Timer | undefined {
    return this.list.find((tm) => tm.stepId === stepId && tm.index === index);
  }

  async start(input: TimerInput): Promise<void> {
    const now = Date.now();
    const timer = startTimer(input, newId(), notifyIdFor(now, ++this.salt), now);
    this.set([...this.list, timer]);
    const allowed = await alarmsReady(t('timer.channel'), t('timer.channelHint'));
    // Without notifications a timer can't ring once the screen is off: say so, once a session.
    if (!allowed && isNative && !this.warned) {
      this.warned = true;
      ui.notify(t('timer.noAlarm'), 'error');
    }
    // Paused or stopped while the permission prompt was up.
    const current = this.list.find((tm) => tm.id === timer.id);
    if (allowed && current?.endsAt) await this.alarm(current);
  }

  /** Sets the alarms again for timers still running, as Mise starts: a restart of the phone clears them. */
  async rearm(): Promise<void> {
    const running = this.list.filter((tm) => !tm.done && tm.endsAt !== null && tm.endsAt > Date.now());
    if (!running.length || !(await alarmsReady(t('timer.channel'), t('timer.channelHint')))) return;
    for (const tm of running) await this.alarm(tm);
  }

  /** The person opened a timer's alarm: back to cooking mode at the step that set it. */
  opened(alarm: OpenedAlarm): void {
    const timer = this.list.find((tm) => tm.notifyId === alarm.id);
    this.hush(timer?.id);
    const recipe = library.get(alarm.recipeId);
    if (recipe) ui.cookAt(recipe.id, recipe.servings ?? 1, alarm.stepId || timer?.stepId);
  }

  async toggle(id: string): Promise<void> {
    const timer = this.list.find((tm) => tm.id === id);
    if (!timer || timer.done) return;
    const now = Date.now();
    const next = timer.endsAt === null ? resumeTimer(timer, now) : pauseTimer(timer, now);
    this.replace(next);
    if (next.endsAt === null) await cancelAlarm(next.notifyId);
    else await this.alarm(next);
  }

  /** Adds a minute, or starts a rung timer again for a minute. */
  async extend(id: string, seconds = 60): Promise<void> {
    const timer = this.list.find((tm) => tm.id === id);
    if (!timer) return;
    const next = extendTimer(timer, seconds, Date.now());
    this.hush(id);
    this.replace(next);
    await cancelAlarm(next.notifyId);
    if (next.endsAt !== null) await this.alarm(next);
  }

  /** Stops a timer, or clears one that has rung. */
  async stop(id: string): Promise<void> {
    const timer = this.list.find((tm) => tm.id === id);
    if (!timer) return;
    this.hush(id);
    this.set(this.list.filter((tm) => tm.id !== id));
    await cancelAlarm(timer.notifyId);
  }

  private title(timer: Timer): string {
    return library.get(timer.recipeId)?.title ?? 'Mise';
  }

  private async alarm(timer: Timer): Promise<void> {
    await scheduleAlarm(timer.notifyId, timer.endsAt!, {
      title: this.title(timer),
      body: t('timer.doneBody', { label: timer.label, time: formatDuration(timer.seconds) }),
      recipeId: timer.recipeId,
      stepId: timer.stepId,
      stopLabel: t('action.stop'),
    });
  }

  /** Stops the browser chime for one timer, or for all of them. */
  private hush(id?: string): void {
    if (id) this.ringing.delete(id);
    else this.ringing.clear();
    if (!this.ringing.size && this.ringer) {
      clearInterval(this.ringer);
      this.ringer = undefined;
    }
  }

  private ring(ids: string[]): void {
    buzz();
    // On the phone the alarm rings, with Mise open or not; a browser chimes until it is answered.
    if (isNative) return;
    for (const id of ids) this.ringing.add(id);
    chime();
    const until = Date.now() + 60_000;
    this.ringer ??= setInterval(() => {
      if (Date.now() > until) this.hush();
      else chime();
    }, 3000);
  }

  private replace(timer: Timer): void {
    this.set(this.list.map((tm) => (tm.id === timer.id ? timer : tm)));
  }

  private set(list: Timer[]): void {
    this.list = list;
    this.now = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      // Private mode: the timers hold until the app closes.
    }
    this.schedule();
  }

  /** Ticks once a second while a timer runs, and stops ticking when none do. */
  private schedule(): void {
    const running = this.list.some((tm) => !tm.done && tm.endsAt !== null);
    if (running && !this.ticker) this.ticker = setInterval(() => this.tick(), 1000);
    if (!running && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = undefined;
    }
  }

  private tick(): void {
    this.now = Date.now();
    const rung = this.list.filter((tm) => !tm.done && tm.endsAt !== null && tm.endsAt <= this.now);
    if (!rung.length) return;
    this.set(this.list.map((tm) => (rung.includes(tm) ? { ...tm, done: true } : tm)));
    this.ring(rung.map((tm) => tm.id));
    for (const tm of rung) {
      ui.notify(t('timer.done', { label: tm.label, title: this.title(tm) }), 'info', {
        label: t('action.stop'),
        run: () => void this.stop(tm.id),
      });
    }
  }
}

export const timers = new Timers();

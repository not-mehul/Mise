// ============================================================
// The running kitchen timers. They outlive cooking mode and the
// app itself: each is saved, and its alarm is a scheduled system
// notification, so it rings even if Mise is closed.
// ============================================================

import { newId } from '../domain/ingredient';
import { extendTimer, normaliseTimers, notifyIdFor, pauseTimer, resumeTimer, startTimer, timeLeft, type Timer, type TimerInput } from '../domain/timers';
import { formatDuration } from '../domain/steps';
import { t } from '../i18n/index.svelte';
import { buzz } from '../platform/device';
import { alarmsReady, cancelAlarm, scheduleAlarm } from '../platform/notify';
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
    // Paused or stopped while the permission prompt was up.
    const current = this.list.find((tm) => tm.id === timer.id);
    if (allowed && current?.endsAt) await this.alarm(current);
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
    this.replace(next);
    await cancelAlarm(next.notifyId);
    if (next.endsAt !== null) await this.alarm(next);
  }

  /** Stops a timer, or clears one that has rung. */
  async stop(id: string): Promise<void> {
    const timer = this.list.find((tm) => tm.id === id);
    if (!timer) return;
    this.set(this.list.filter((tm) => tm.id !== id));
    await cancelAlarm(timer.notifyId);
  }

  private title(timer: Timer): string {
    return library.get(timer.recipeId)?.title ?? 'Mise';
  }

  private async alarm(timer: Timer): Promise<void> {
    await scheduleAlarm(timer.notifyId, this.title(timer), t('timer.doneBody', { label: timer.label, time: formatDuration(timer.seconds) }), timer.endsAt!);
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
    // With Mise open the notification shows too; this is the in-app ring.
    buzz();
    for (const tm of rung) ui.notify(t('timer.done', { label: tm.label, title: this.title(tm) }), 'info');
  }
}

export const timers = new Timers();

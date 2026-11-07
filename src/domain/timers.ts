// ============================================================
// Kitchen timers: several can run at once, each counting down
// to a moment so that a sleeping phone keeps the right time.
// ============================================================

export interface Timer {
  id: string;
  /** The id its system notification is scheduled under. */
  notifyId: number;
  recipeId: string;
  /** Which step started it, so its button shows it running. */
  stepId: string;
  /** Which of the step's timers it is. */
  index: number;
  /** "Step 3", shown on the chip and in the notification. */
  label: string;
  seconds: number;
  /** When it rings (ms since epoch), or null while paused. */
  endsAt: number | null;
  /** Time left while paused (ms). */
  left: number;
  done: boolean;
}

export type TimerInput = Pick<Timer, 'recipeId' | 'stepId' | 'index' | 'label' | 'seconds'>;

/** A notification id: a positive 31-bit integer, unique enough for a handful of timers. */
export function notifyIdFor(now: number, salt: number): number {
  return ((Math.floor(now / 1000) % 1_000_000) * 100 + (salt % 100)) | 0 || 1;
}

export function startTimer(input: TimerInput, id: string, notifyId: number, now = Date.now()): Timer {
  return { ...input, id, notifyId, endsAt: now + input.seconds * 1000, left: input.seconds * 1000, done: false };
}

/** Milliseconds left, never below zero. */
export function timeLeft(timer: Timer, now = Date.now()): number {
  if (timer.done) return 0;
  return Math.max(0, timer.endsAt === null ? timer.left : timer.endsAt - now);
}

export function pauseTimer(timer: Timer, now = Date.now()): Timer {
  if (timer.done || timer.endsAt === null) return timer;
  return { ...timer, endsAt: null, left: timeLeft(timer, now) };
}

export function resumeTimer(timer: Timer, now = Date.now()): Timer {
  if (timer.done || timer.endsAt !== null) return timer;
  return { ...timer, endsAt: now + timer.left };
}

/** Adds time; a timer that has rung starts again with just the added time. */
export function extendTimer(timer: Timer, seconds: number, now = Date.now()): Timer {
  const ms = seconds * 1000;
  if (timer.done) return { ...timer, done: false, endsAt: now + ms, left: ms };
  if (timer.endsAt === null) return { ...timer, left: timer.left + ms };
  return { ...timer, endsAt: timer.endsAt + ms };
}

/** Timers read back from storage. Ones that rang long ago are dropped. */
export function normaliseTimers(value: unknown, now = Date.now()): Timer[] {
  if (!Array.isArray(value)) return [];
  const out: Timer[] = [];
  for (const v of value as Partial<Timer>[]) {
    if (!v || typeof v.id !== 'string' || typeof v.recipeId !== 'string' || typeof v.seconds !== 'number' || typeof v.notifyId !== 'number') continue;
    const timer: Timer = {
      id: v.id,
      notifyId: v.notifyId,
      recipeId: v.recipeId,
      stepId: typeof v.stepId === 'string' ? v.stepId : '',
      index: typeof v.index === 'number' ? v.index : 0,
      label: typeof v.label === 'string' ? v.label : '',
      seconds: v.seconds,
      endsAt: typeof v.endsAt === 'number' ? v.endsAt : null,
      left: typeof v.left === 'number' ? v.left : v.seconds * 1000,
      done: v.done === true,
    };
    const rangAt = timer.endsAt;
    if (rangAt !== null && rangAt <= now) timer.done = true;
    // A timer that rang while Mise was closed is kept for an hour, so you see it went off.
    if (timer.done && rangAt !== null && now - rangAt > 3600_000) continue;
    out.push(timer);
  }
  return out;
}

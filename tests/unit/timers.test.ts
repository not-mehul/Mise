import { describe, expect, it } from 'vitest';
import { extendTimer, normaliseTimers, notifyIdFor, pauseTimer, resumeTimer, startTimer, timeLeft } from '../../src/domain/timers';

const input = { recipeId: 'r', stepId: 's', index: 0, label: 'Step 2', seconds: 600 };
const t0 = 1_800_000_000_000;

describe('timers', () => {
  it('counts down to a moment', () => {
    const timer = startTimer(input, 'a', 1, t0);
    expect(timeLeft(timer, t0)).toBe(600_000);
    expect(timeLeft(timer, t0 + 60_000)).toBe(540_000);
    expect(timeLeft(timer, t0 + 700_000)).toBe(0);
  });

  it('pauses and resumes without losing time', () => {
    const paused = pauseTimer(startTimer(input, 'a', 1, t0), t0 + 100_000);
    expect(paused.endsAt).toBeNull();
    expect(timeLeft(paused, t0 + 900_000)).toBe(500_000);
    const resumed = resumeTimer(paused, t0 + 900_000);
    expect(timeLeft(resumed, t0 + 1_000_000)).toBe(400_000);
  });

  it('adds time, and starts a rung timer again', () => {
    const timer = startTimer(input, 'a', 1, t0);
    expect(timeLeft(extendTimer(timer, 60, t0), t0)).toBe(660_000);
    expect(timeLeft(extendTimer(pauseTimer(timer, t0), 60, t0), t0)).toBe(660_000);
    const again = extendTimer({ ...timer, done: true }, 60, t0 + 700_000);
    expect(again.done).toBe(false);
    expect(timeLeft(again, t0 + 700_000)).toBe(60_000);
  });

  it('makes positive 32-bit notification ids', () => {
    for (const salt of [0, 1, 99, 150]) {
      const id = notifyIdFor(t0, salt);
      expect(Number.isInteger(id) && id > 0 && id < 2 ** 31).toBe(true);
    }
    expect(notifyIdFor(t0, 1)).not.toBe(notifyIdFor(t0, 2));
  });

  it('marks timers that ran out while closed, and drops old ones', () => {
    const running = startTimer(input, 'a', 1, t0);
    const [rang] = normaliseTimers([running], t0 + 601_000);
    expect(rang?.done).toBe(true);
    expect(normaliseTimers([running], t0 + 600_000 + 3_700_000)).toEqual([]);
    expect(normaliseTimers([pauseTimer(running, t0)], t0 + 99_000_000)).toHaveLength(1);
    expect(normaliseTimers([{ id: 'x' }, null, 'junk'], t0)).toEqual([]);
    expect(normaliseTimers('junk', t0)).toEqual([]);
  });
});

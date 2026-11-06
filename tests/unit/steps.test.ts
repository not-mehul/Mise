import { describe, expect, it } from 'vitest';
import { parseIngredient } from '../../src/domain/ingredient';
import { findTimers, formatDuration, linkIngredients } from '../../src/domain/steps';

const seconds = (text: string) => findTimers(text).map((t) => t.seconds);

describe('step timers', () => {
  it('finds durations in prose', () => {
    expect(seconds('Simmer for 10 minutes, then rest 5 min.')).toEqual([600, 300]);
    expect(seconds('Bake 1 hour 30 minutes')).toEqual([5400]);
    expect(seconds('Roast for 1½ hours')).toEqual([5400]);
    expect(seconds('Cook 10–12 minutes until golden')).toEqual([600]);
    expect(seconds('Kochen Sie 20 Minuten')).toEqual([1200]);
    expect(seconds('Cuire 15 minutes à 180°C')).toEqual([900]);
    expect(seconds('Hornear 45 minutos')).toEqual([2700]);
    expect(seconds('Rest 30s')).toEqual([30]);
  });

  it('ignores numbers that are not durations', () => {
    expect(seconds('Heat oven to 200C and add 2 eggs')).toEqual([]);
    expect(seconds('Cut into 4 s shapes')).toEqual([]);
  });

  it('marks where the duration sits', () => {
    const text = 'Simmer for 10 minutes.';
    const [t] = findTimers(text);
    expect(text.slice(t!.start, t!.end)).toBe('10 minutes');
  });

  it('links the ingredients a step names', () => {
    const flour = parseIngredient('200 g plain flour', 'flour');
    const eggs = parseIngredient('2 large eggs', 'eggs');
    const salt = parseIngredient('salt', 'salt');
    const groups = [{ name: '', items: [flour, eggs, salt] }];
    expect(linkIngredients('Whisk the egg into the flour.', groups)).toEqual(['flour', 'eggs']);
  });

  it('formats durations', () => {
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatDuration(45)).toBe('45 s');
  });
});

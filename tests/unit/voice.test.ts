import { describe, expect, it } from 'vitest';
import { voiceCommand } from '../../src/domain/voice';

describe('hands-free commands', () => {
  it('hears short commands in each language', () => {
    expect(voiceCommand('Next')).toBe('next');
    expect(voiceCommand('okay next step please')).toBe('next');
    expect(voiceCommand('Siguiente')).toBe('next');
    expect(voiceCommand('étape suivante')).toBe('next');
    expect(voiceCommand('zurück')).toBe('back');
    expect(voiceCommand('start the timer')).toBe('timer');
    expect(voiceCommand('What do I need?')).toBe('ingredients');
    expect(voiceCommand('stopp')).toBe('stop');
  });

  it('tries each guess, and ignores sentences', () => {
    expect(voiceCommand(['nest', 'next'])).toBe('next');
    expect(voiceCommand('stir until it is golden then go to the next step')).toBeNull();
    expect(voiceCommand('hello')).toBeNull();
    expect(voiceCommand('')).toBeNull();
  });
});

// Read aloud: cooking mode speaks each step with the system voice. The plugin
// uses Android's text-to-speech, and the browser's speechSynthesis on the web.

import { TextToSpeech } from '@capacitor-community/text-to-speech';

let run = 0;
let talking = false;

/** True while a step is being read, so hands-free doesn't take the voice for a command. */
export const isSpeaking = (): boolean => talking;

/** Speaks the text, cutting off anything still being read. */
export async function speak(text: string, lang: string): Promise<void> {
  const mine = ++run;
  try {
    await TextToSpeech.stop().catch(() => undefined);
    if (mine !== run || !text.trim()) return;
    talking = true;
    await TextToSpeech.speak({ text, lang, rate: 1, category: 'playback' });
  } catch (err) {
    // No voice for the language, or none installed: cooking carries on silently.
    console.warn('Reading aloud failed:', err);
  } finally {
    if (mine === run) talking = false;
  }
}

export function stopSpeaking(): void {
  run++;
  talking = false;
  void TextToSpeech.stop().catch(() => undefined);
}

// Listening for hands-free commands in cooking mode: Android's speech
// recognizer (HandsFreePlugin.java), or the browser's where it has one. The
// microphone is asked for only when hands-free is turned on, and is used
// only while cooking mode is open.

import { registerPlugin } from '@capacitor/core';
import { isNative } from './output';

interface HandsFreePlugin {
  start(options: { lang: string }): Promise<{ granted: boolean }>;
  stop(): Promise<void>;
  addListener(event: 'heard', listener: (e: { texts: string[] }) => void): Promise<{ remove: () => Promise<void> }>;
}

const HandsFree = registerPlugin<HandsFreePlugin>('HandsFree');

interface WebRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function webRecognition(): (new () => WebRecognition) | undefined {
  const g = globalThis as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

export const voiceAvailable = isNative || !!webRecognition();

/** Listens until the returned function is called. `onHeard` gets the recognizer's guesses, best first. */
export async function listen(lang: string, onHeard: (texts: string[]) => void, onRefused: () => void): Promise<() => void> {
  if (isNative) {
    const handle = await HandsFree.addListener('heard', (e) => onHeard(e.texts));
    const { granted } = await HandsFree.start({ lang }).catch(() => ({ granted: false }));
    if (!granted) {
      void handle.remove();
      onRefused();
      return () => undefined;
    }
    return () => {
      void HandsFree.stop().catch(() => undefined);
      void handle.remove();
    };
  }
  const Recognition = webRecognition();
  if (!Recognition) {
    onRefused();
    return () => undefined;
  }
  let on = true;
  const rec = new Recognition();
  rec.lang = lang;
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i]!;
      if (result.isFinal) onHeard(Array.from(result, (alt) => alt.transcript));
    }
  };
  // Browsers stop listening after a pause; start again while cooking mode is open.
  rec.onend = () => {
    if (on) setTimeout(() => on && rec.start(), 250);
  };
  try {
    rec.start();
  } catch {
    onRefused();
  }
  return () => {
    on = false;
    rec.stop();
  };
}

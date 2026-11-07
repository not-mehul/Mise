// ============================================================
// Hands-free cooking: what a few spoken words ask cooking mode
// to do. The words are matched whole, in any of the four
// languages, so a sentence that merely contains "next" (the
// step being read aloud) doesn't count unless it is short.
// ============================================================

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'timer' | 'ingredients' | 'stop';

const WORDS: [VoiceCommand, string[]][] = [
  ['next', ['next', 'next step', 'continue', 'forward', 'siguiente', 'adelante', 'próximo', 'suivant', 'suivante', 'étape suivante', 'weiter', 'nächster', 'nächster schritt', 'nächste']],
  ['back', ['back', 'go back', 'previous', 'atrás', 'anterior', 'volver', 'retour', 'précédent', 'précédente', 'zurück', 'vorher', 'vorheriger']],
  ['repeat', ['repeat', 'again', 'say again', 'read', 'read it', 'repite', 'repetir', 'otra vez', 'lee', 'répète', 'répéter', 'encore', 'lis', 'wiederholen', 'nochmal', 'noch mal', 'vorlesen']],
  ['timer', ['timer', 'start timer', 'start the timer', 'temporizador', 'cronómetro', 'empieza', 'minuteur', 'lance le minuteur', 'chrono', 'timer starten', 'wecker', 'starten']],
  ['ingredients', ['ingredients', 'what do i need', 'ingredientes', 'qué necesito', 'ingrédients', 'zutaten', 'was brauche ich']],
  ['stop', ['stop', 'quiet', 'silence', 'shush', 'para', 'cállate', 'silencio', 'arrête', 'tais-toi', 'stopp', 'ruhe', 'halt']],
];

const clean = (s: string) =>
  s
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\b(please|por favor|s'il te plaît|s'il vous plaît|bitte|mise|ok|okay|hey)\b/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The command in what was heard, or null. Each alternative the recognizer offers is tried in turn. */
export function voiceCommand(heard: string | string[]): VoiceCommand | null {
  for (const raw of Array.isArray(heard) ? heard : [heard]) {
    const said = clean(raw);
    if (!said || said.split(' ').length > 4) continue;
    for (const [command, words] of WORDS) if (words.includes(said)) return command;
    // "next one", "okay next": the last word on its own.
    const last = said.split(' ').at(-1)!;
    for (const [command, words] of WORDS) if (words.includes(last)) return command;
  }
  return null;
}

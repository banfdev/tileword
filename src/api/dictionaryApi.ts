// Free Dictionary API — no key required
// https://dictionaryapi.dev

export type DictEntry = {
  phonetic: string;       // IPA e.g. /tiː/
  partOfSpeech: string;  // noun, verb, exclamation…
  definition: string;    // first definition
  example?: string;      // usage example if provided
};

const cache = new Map<string, DictEntry | null>();

export async function lookupWord(word: string): Promise<DictEntry | null> {
  const w = word.toLowerCase().trim();
  if (cache.has(w)) return cache.get(w)!;

  try {
    const res = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(w)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) { cache.set(w, null); return null; }

    const data = await res.json();
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry) { cache.set(w, null); return null; }

    const phonetic =
      entry.phonetics?.find((p: { text?: string }) => p.text)?.text ??
      entry.phonetic ??
      '';
    const meaning = entry.meanings?.[0];
    const def     = meaning?.definitions?.[0];

    const result: DictEntry = {
      phonetic,
      partOfSpeech: meaning?.partOfSpeech ?? '',
      definition:   def?.definition ?? '',
      example:      def?.example,
    };
    cache.set(w, result);
    return result;
  } catch {
    return null;
  }
}

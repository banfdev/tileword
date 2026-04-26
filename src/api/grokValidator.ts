export type GrokWordInfo = {
  valid: boolean;
  phonetic?: string;   // IPA e.g. /tiː/
  definition?: string; // ≤7 words
  example?: string;    // short child-friendly sentence
};

const cache = new Map<string, GrokWordInfo>();

export async function validateWithGrok(word: string): Promise<GrokWordInfo | null> {
  const apiKey = import.meta.env.VITE_XAI_API_KEY as string | undefined;
  if (!apiKey) return null;

  const w = word.toLowerCase();
  if (cache.has(w)) return cache.get(w)!;

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [
          {
            role: 'user',
            content:
              `Is "${w}" a valid English word? Reply ONLY with compact JSON, no markdown fences.\n` +
              `If valid: {"valid":true,"phonetic":"/IPA/","definition":"max 6 words","example":"short child-friendly sentence"}\n` +
              `If not a word: {"valid":false}`,
          },
        ],
        temperature: 0,
        max_tokens: 120,
      }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim() ?? '';
    // strip any accidental markdown fences
    const clean = raw.replace(/^```[a-z]*\n?/i, '').replace(/```$/,'').trim();
    const info: GrokWordInfo = JSON.parse(clean);
    cache.set(w, info);
    return info;
  } catch {
    return null;
  }
}

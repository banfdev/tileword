// Standalone word-validation component.
// Pipeline: local dict (caller) → Free Dictionary API → AI (opt-in, on click).
// Designed to be dropped into any screen; calls back on resolution.

import { useState, useEffect, useRef } from 'react';
import { lookupWord } from '../api/dictionaryApi';
import { validateWithGrok } from '../api/grokValidator';
import type { DictEntry } from '../api/dictionaryApi';

export type ValidatedWordInfo = {
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  example?: string;
  source: 'dictionary' | 'ai';
};

type Props = {
  word: string;                              // unknown word to verify
  onValid: (info: ValidatedWordInfo) => void;
  onInvalid: () => void;
};

type Phase = 'dict' | 'ai-prompt' | 'ai' | 'done';

const hasGrok = () => !!(import.meta.env.VITE_XAI_API_KEY as string | undefined);

export function WordValidator({ word, onValid, onInvalid }: Props) {
  const [phase, setPhase] = useState<Phase>('dict');
  // keep callbacks stable across re-renders
  const onValidRef   = useRef(onValid);
  const onInvalidRef = useRef(onInvalid);
  useEffect(() => { onValidRef.current = onValid; onInvalidRef.current = onInvalid; });

  useEffect(() => {
    let cancelled = false;
    setPhase('dict');

    lookupWord(word).then(entry => {
      if (cancelled) return;
      if (entry) {
        onValidRef.current({ ...entry, source: 'dictionary' });
        setPhase('done');
      } else if (hasGrok()) {
        setPhase('ai-prompt');
      } else {
        onInvalidRef.current();
        setPhase('done');
      }
    });

    return () => { cancelled = true; };
  }, [word]);

  const handleAiCheck = () => {
    setPhase('ai');
    validateWithGrok(word)
      .then(result => {
        if (result?.valid) {
          onValidRef.current({
            phonetic:     result.phonetic ?? '',
            partOfSpeech: '',
            definition:   result.definition ?? '',
            example:      result.example,
            source:       'ai',
          });
        } else {
          onInvalidRef.current();
        }
        setPhase('done');
      })
      .catch(() => { onInvalidRef.current(); setPhase('done'); });
  };

  if (phase === 'done') return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {(phase === 'dict' || phase === 'ai') && (
        <span style={{ fontSize: 12, color: '#ffffff33', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Spinner />
          {phase === 'dict' ? 'Checking dictionary…' : 'Asking AI…'}
        </span>
      )}

      {phase === 'ai-prompt' && (
        <button
          onClick={handleAiCheck}
          title="Not in dictionary — ask AI to verify?"
          style={{
            background: 'none',
            border: '1px solid #C77DFF44',
            borderRadius: 8,
            color: '#C77DFF77',
            fontSize: 11,
            padding: '4px 12px',
            cursor: 'pointer',
            letterSpacing: '0.07em',
            transition: 'all 0.18s',
            outline: 'none',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#C77DFF';
            e.currentTarget.style.borderColor = '#C77DFF99';
            e.currentTarget.style.background = '#C77DFF11';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#C77DFF77';
            e.currentTarget.style.borderColor = '#C77DFF44';
            e.currentTarget.style.background = 'none';
          }}
        >
          ✨ Ask AI
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: 'inline-block',
      width: 10, height: 10,
      border: '1.5px solid #ffffff22',
      borderTopColor: '#ffffff55',
      borderRadius: '50%',
      animation: 'wvSpin 0.7s linear infinite',
    }} />
  );
}

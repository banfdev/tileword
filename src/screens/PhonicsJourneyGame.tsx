import { useState, useEffect, useCallback } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import { PHONICS_LEVELS, makeLevelTiles } from '../data/levels';
import { checkWordInSet, addCustomWord } from '../data/words';
import { getTileSound } from '../data/tiles';
import type { Tile, TileCategoryKey } from '../data/tiles';
import { AudioEngine } from '../audio/AudioEngine';
import { validateWithGrok } from '../api/grokValidator';
import type { GrokWordInfo } from '../api/grokValidator';

// From CLAUDE.md NLP Sound Map
const PHONEME_SPEECH: Record<string, string> = {
  ea:'ee', ee:'ee', ai:'ay', ay:'ay', oa:'oh', oe:'oh',
  oo:'oo', ou:'ow', ow:'ow', ue:'yoo', ui:'oo', eu:'yoo',
  oi:'oy', oy:'oy', au:'aw', aw:'aw', ie:'eye',
  ar:'ar', er:'ur', ir:'ur', or:'or', ur:'ur',
  ch:'ch', sh:'sh', th:'th',
  str:'str', bl:'bl', br:'br', cl:'cl', cr:'cr', dr:'dr',
  fl:'fl', fr:'fr', gl:'gl', gr:'gr', pl:'pl', pr:'pr',
  sk:'sk', sl:'sl', sm:'sm', sn:'sn', sp:'sp', st:'st',
  sw:'sw', tr:'tr', tw:'tw', wh:'wh', wr:'rr', qu:'kw',
  ng:'ing', ck:'k', nk:'nk', tch:'ch', dge:'j',
  a:'ah', e:'eh', i:'ih', o:'oh', u:'uh',
  b:'buh', c:'kuh', d:'duh', f:'fuh', g:'guh', h:'huh',
  j:'juh', k:'kuh', l:'luh', m:'muh', n:'nuh', p:'puh',
  r:'ruh', s:'ss', t:'tuh', v:'vuh', w:'wuh', x:'ks',
  y:'yuh', z:'zz',
};

function speakPhoneme(text: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(PHONEME_SPEECH[text] ?? text);
  utt.rate = 0.85;
  utt.pitch = 1.1;
  window.speechSynthesis.speak(utt);
}

function speakWord(word: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.rate = 0.72;
  utt.pitch = 1.0;
  window.speechSynthesis.speak(utt);
}

const CAT_COLOR: Record<TileCategoryKey, string> = {
  open_vowel:     '#E84855',
  closed_vowel:   '#F4A261',
  double_vowel:   '#2EC4B6',
  r_vowel:        '#CBF3F0',
  main_consonants:'#FFBF69',
  specials:       '#C77DFF',
  others:         '#9EF01A',
};

type Props = { onBack: () => void };

export function PhonicsJourneyGame({ onBack }: Props) {
  const vw = useWindowSize();
  const isMobile = vw < 640;

  const [levelIdx, setLevelIdx]       = useState(0);
  const [tiles, setTiles]             = useState<Tile[]>(() => makeLevelTiles(PHONICS_LEVELS[0].tileTexts));
  const [builderIds, setBuilderIds]   = useState<number[]>([]);
  const [foundWords, setFoundWords]   = useState<string[]>([]);
  const [feedback, setFeedback]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [wordInfo, setWordInfo]       = useState<(GrokWordInfo & { word: string }) | null>(null);
  const [checking, setChecking]       = useState(false);
  const [shaking, setShaking]         = useState(false);
  const [popping, setPopping]         = useState(false);
  const [entered, setEntered]         = useState(false);

  useEffect(() => { setTimeout(() => setEntered(true), 60); }, []);

  const level = PHONICS_LEVELS[levelIdx];
  const inBuilderSet = new Set(builderIds);
  const builderTiles = builderIds.map(id => tiles.find(t => t.id === id)!).filter(Boolean);
  const currentWord  = builderTiles.map(t => getTileSound(t)).join('');

  const acceptWord = (word: string, newList: string[]) => {
    setFoundWords(newList);
    speakWord(word);
    AudioEngine.play('wordCorrect');
    setPopping(true);
    setTimeout(() => setPopping(false), 600);
    setFeedback({ msg: `✓ ${word}!`, ok: true });
    setTimeout(() => setFeedback(null), 2500);
    setBuilderIds([]);
    // fetch Grok info in background for every accepted word
    validateWithGrok(word).then(info => {
      if (info?.valid) setWordInfo({ ...info, word });
    });
  };

  const goToLevel = (idx: number) => {
    setLevelIdx(idx);
    setTiles(makeLevelTiles(PHONICS_LEVELS[idx].tileTexts));
    setBuilderIds([]);
    setFoundWords([]);
    setFeedback(null);
    setWordInfo(null);
    AudioEngine.play('gameStart');
  };

  const handleTileClick = (tile: Tile) => {
    AudioEngine.play('tileClick');
    speakPhoneme(tile.text);
    if (inBuilderSet.has(tile.id)) {
      setBuilderIds(ids => ids.filter(id => id !== tile.id));
    } else {
      setBuilderIds(ids => [...ids, tile.id]);
    }
  };

  const handleBuilderRemove = (tileId: number) => {
    setBuilderIds(ids => ids.filter(id => id !== tileId));
  };

  const handleClear = () => { setBuilderIds([]); setFeedback(null); };

  const handleSubmit = useCallback(() => {
    if (builderTiles.length < 2 || checking) return;
    const word = currentWord;

    if (foundWords.includes(word)) {
      setFeedback({ msg: 'Already found!', ok: false });
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }

    if (checkWordInSet(word)) {
      acceptWord(word, [...foundWords, word]);
    } else {
      // Grok fallback: validate words not in local dictionary
      setChecking(true);
      setFeedback({ msg: 'Checking…', ok: true });
      validateWithGrok(word).then(info => {
        setChecking(false);
        if (info?.valid) {
          addCustomWord(word);
          acceptWord(word, [...foundWords, word]);
        } else {
          setShaking(true);
          AudioEngine.play('wordWrong');
          setFeedback({ msg: `"${word}" — not a word`, ok: false });
          setTimeout(() => { setShaking(false); setFeedback(null); }, 2200);
        }
      }).catch(() => {
        setChecking(false);
        setShaking(true);
        AudioEngine.play('wordWrong');
        setFeedback({ msg: `"${word}" — not a word`, ok: false });
        setTimeout(() => { setShaking(false); setFeedback(null); }, 2200);
      });
    }
  }, [builderTiles, currentWord, foundWords, checking]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Backspace') setBuilderIds(ids => ids.slice(0, -1));
      if (e.key === 'Escape') handleClear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit]);

  const canUnlock = foundWords.length >= level.wordsToUnlock;
  const isLast    = levelIdx === PHONICS_LEVELS.length - 1;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a12',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      padding: isMobile ? '70px 16px 24px' : '80px 24px 32px',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes pjShake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-9px); }
          40% { transform: translateX(9px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(4px); }
        }
        @keyframes pjPop {
          0% { transform: scale(1); }
          35% { transform: scale(1.2); }
          65% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        @keyframes pjIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pjSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pjGlow {
          0%,100% { box-shadow: 0 0 0 2px #2EC4B688, 0 4px 20px #2EC4B633; }
          50%      { box-shadow: 0 0 0 3px #2EC4B6cc, 0 4px 32px #2EC4B666; }
        }
        @keyframes pjStar {
          0%   { opacity: 1; transform: scale(0.6); }
          60%  { opacity: 0.7; transform: scale(1.6); }
          100% { opacity: 0; transform: scale(2.2); }
        }
      `}</style>

      {/* Back button */}
      <button
        onClick={() => { AudioEngine.play('backToMenu'); onBack(); }}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 200,
          background: 'none', border: '1px solid #ffffff22', borderRadius: 8,
          color: '#ffffff55', fontSize: 13, cursor: 'pointer', padding: '6px 14px',
          transition: 'all 0.2s', outline: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffffffaa'; e.currentTarget.style.borderColor = '#ffffff44'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff55'; e.currentTarget.style.borderColor = '#ffffff22'; }}
      >← Back</button>

      {/* Level progress dots */}
      <div style={{ position: 'fixed', top: 22, right: 16, display: 'flex', gap: 7, zIndex: 200 }}>
        {PHONICS_LEVELS.map((_, i) => (
          <div
            key={i}
            title={`Level ${i + 1}`}
            onClick={() => i <= levelIdx && goToLevel(i)}
            style={{
              width: 9, height: 9, borderRadius: '50%',
              background: i < levelIdx ? '#2EC4B6' : i === levelIdx ? '#f0c060' : '#ffffff1a',
              cursor: i <= levelIdx ? 'pointer' : 'default',
              transition: 'all 0.3s',
              boxShadow: i === levelIdx ? '0 0 8px #f0c06088' : 'none',
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 20 : 26,
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Level header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#ffffff2a', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 5 }}>
            Level {level.id} of {PHONICS_LEVELS.length}
          </div>
          <div style={{
            fontSize: isMobile ? 22 : 27,
            fontWeight: 900,
            color: '#f0e8c0',
            fontFamily: "'Noto Serif SC', serif",
            marginBottom: 10,
          }}>{level.title}</div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            background: '#2EC4B60d',
            border: '1px solid #2EC4B628',
            borderRadius: 24,
            padding: '7px 18px',
          }}>
            <span style={{
              fontSize: 20, color: '#2EC4B6',
              fontFamily: "'Noto Serif SC', serif", fontWeight: 900,
            }}>{level.focus}</span>
            <span style={{ color: '#ffffff33', fontSize: 13 }}>•</span>
            <span style={{ color: '#ffffff77', fontSize: 13 }}>{level.description}</span>
          </div>
        </div>

        {/* Tile grid — 4 columns */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 13,
          width: '100%',
        }}>
          {tiles.map(tile => {
            const color = CAT_COLOR[tile.category];
            const active = inBuilderSet.has(tile.id);
            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                style={{
                  height: isMobile ? 74 : 86,
                  borderRadius: 14,
                  background: active
                    ? `linear-gradient(145deg, ${color}40, ${color}20)`
                    : `linear-gradient(145deg, ${color}16, ${color}08)`,
                  border: `2px solid ${active ? color + 'cc' : color + '3a'}`,
                  color: active ? color : `${color}bb`,
                  fontSize: tile.text.length > 3 ? 14 : tile.text.length > 2 ? 18 : tile.text.length > 1 ? 22 : 28,
                  fontWeight: 900,
                  fontFamily: "'Noto Serif SC', serif",
                  cursor: 'pointer',
                  transform: active ? 'translateY(-5px) scale(1.05)' : 'translateY(0) scale(1)',
                  boxShadow: active
                    ? `0 8px 28px ${color}30, 0 0 0 1px ${color}55`
                    : `0 2px 8px ${color}14`,
                  transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
                  outline: 'none',
                  letterSpacing: '0.02em',
                  userSelect: 'none',
                }}
              >
                {tile.text}
              </button>
            );
          })}
        </div>

        {/* Word builder */}
        <div style={{
          width: '100%',
          background: '#111120',
          border: '1.5px solid #ffffff0d',
          borderRadius: 18,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          animation: shaking ? 'pjShake 0.42s ease' : popping ? 'pjPop 0.5s ease' : 'none',
        }}>

          {/* Tile chips in builder */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: 'center', minHeight: 48, alignItems: 'center',
          }}>
            {builderTiles.length === 0 ? (
              <span style={{ color: '#ffffff1a', fontSize: 14 }}>Click tiles above to build a word</span>
            ) : (
              builderTiles.map((tile) => {
                const color = CAT_COLOR[tile.category];
                return (
                  <button
                    key={tile.id}
                    onClick={() => handleBuilderRemove(tile.id)}
                    title="Remove"
                    style={{
                      background: `linear-gradient(135deg, ${color}2a, ${color}14)`,
                      border: `1.5px solid ${color}77`,
                      borderRadius: 9,
                      padding: '7px 13px',
                      color: color,
                      fontSize: tile.text.length > 3 ? 13 : 16,
                      fontWeight: 900,
                      fontFamily: "'Noto Serif SC', serif",
                      cursor: 'pointer',
                      outline: 'none',
                      animation: 'pjSlideIn 0.2s ease both',
                      transition: 'opacity 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.6'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    {tile.text}
                  </button>
                );
              })
            )}
          </div>

          {/* Word preview */}
          {currentWord && (
            <div style={{
              fontSize: isMobile ? 22 : 26,
              fontWeight: 700,
              color: '#ffffff66',
              letterSpacing: '0.08em',
              fontFamily: "'Noto Serif SC', serif",
            }}>{currentWord}</div>
          )}

          {/* Feedback */}
          {feedback && (
            <div style={{
              fontSize: 15, fontWeight: 800,
              color: feedback.ok ? '#2EC4B6' : '#E84855',
              animation: 'pjSlideIn 0.2s ease',
              letterSpacing: '0.04em',
            }}>{feedback.msg}</div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={handleClear}
              disabled={builderTiles.length === 0}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 11,
                background: 'none',
                border: `1.5px solid ${builderTiles.length > 0 ? '#ffffff1a' : '#ffffff0a'}`,
                color: builderTiles.length > 0 ? '#ffffff44' : '#ffffff1a',
                fontSize: 13, cursor: builderTiles.length > 0 ? 'pointer' : 'default',
                transition: 'all 0.2s', outline: 'none',
              }}
            >Clear</button>
            <button
              onClick={handleSubmit}
              disabled={builderTiles.length < 2 || checking}
              style={{
                flex: 3, padding: '11px 0', borderRadius: 11,
                background: builderTiles.length >= 2
                  ? 'linear-gradient(135deg, #f0c06033, #f0c06016)'
                  : 'none',
                border: `1.5px solid ${builderTiles.length >= 2 ? '#f0c060aa' : '#ffffff0a'}`,
                color: builderTiles.length >= 2 ? '#f0c060' : '#ffffff22',
                fontSize: 15, fontWeight: 800,
                cursor: builderTiles.length >= 2 && !checking ? 'pointer' : 'default',
                letterSpacing: '0.08em', transition: 'all 0.2s', outline: 'none',
                opacity: checking ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (builderTiles.length >= 2 && !checking) { e.currentTarget.style.background = 'linear-gradient(135deg, #f0c06055, #f0c06028)'; } }}
              onMouseLeave={e => { if (builderTiles.length >= 2) { e.currentTarget.style.background = 'linear-gradient(135deg, #f0c06033, #f0c06016)'; } }}
            >{checking ? 'Checking…' : 'Submit ↵'}</button>
          </div>
        </div>

        {/* Word info card (Grok) */}
        {wordInfo && wordInfo.phonetic && (
          <div style={{
            width: '100%',
            background: 'linear-gradient(135deg, #f0c06010, #f0c06006)',
            border: '1px solid #f0c06033',
            borderRadius: 14,
            padding: '14px 18px',
            animation: 'pjSlideIn 0.35s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 18, fontWeight: 900, color: '#f0c060' }}>{wordInfo.word}</span>
              <span style={{ fontSize: 14, color: '#f0c06099', fontStyle: 'italic', letterSpacing: '0.04em' }}>{wordInfo.phonetic}</span>
            </div>
            {wordInfo.definition && (
              <div style={{ fontSize: 13, color: '#ffffffaa', marginBottom: 5, lineHeight: 1.5 }}>
                {wordInfo.definition}
              </div>
            )}
            {wordInfo.example && (
              <div style={{ fontSize: 12, color: '#ffffff55', fontStyle: 'italic', lineHeight: 1.5 }}>
                "{wordInfo.example}"
              </div>
            )}
          </div>
        )}

        {/* Found words */}
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10,
            fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            <span style={{ color: '#ffffff2a' }}>Words Found ({foundWords.length})</span>
            <span style={{
              color: canUnlock ? '#2EC4B6' : '#ffffff22',
              transition: 'color 0.4s',
            }}>
              {foundWords.length} / {level.wordsToUnlock} to {isLast ? 'complete' : 'next level'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {foundWords.length === 0 && (
              <span style={{ color: '#ffffff18', fontSize: 13 }}>
                {level.targetWords.slice(0, 3).join(', ')}... try these!
              </span>
            )}
            {foundWords.map(word => (
              <button
                key={word}
                onClick={() => speakWord(word)}
                title="Click to hear"
                style={{
                  background: '#2EC4B60f',
                  border: '1px solid #2EC4B630',
                  borderRadius: 20,
                  padding: '5px 15px',
                  color: '#2EC4B6',
                  fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', outline: 'none',
                  animation: 'pjSlideIn 0.3s ease',
                  letterSpacing: '0.05em',
                  fontFamily: "'Noto Serif SC', serif",
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2EC4B622'; e.currentTarget.style.borderColor = '#2EC4B666'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2EC4B60f'; e.currentTarget.style.borderColor = '#2EC4B630'; }}
              >{word}</button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'center' }}>
          {levelIdx > 0 && (
            <button
              onClick={() => goToLevel(levelIdx - 1)}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'none', border: '1.5px solid #ffffff14',
                color: '#ffffff33', fontSize: 13, cursor: 'pointer', outline: 'none',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff66'; e.currentTarget.style.borderColor = '#ffffff28'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ffffff33'; e.currentTarget.style.borderColor = '#ffffff14'; }}
            >← Prev</button>
          )}
          {canUnlock && !isLast && (
            <button
              onClick={() => goToLevel(levelIdx + 1)}
              style={{
                flex: 1, padding: '13px 24px', borderRadius: 13,
                background: 'linear-gradient(135deg, #2EC4B628, #2EC4B614)',
                border: '2px solid #2EC4B6aa',
                color: '#2EC4B6', fontSize: 16, fontWeight: 900,
                cursor: 'pointer', letterSpacing: '0.08em', outline: 'none',
                animation: 'pjGlow 2s ease-in-out infinite',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2EC4B640, #2EC4B622)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2EC4B628, #2EC4B614)'; }}
            >Next Level →</button>
          )}
          {canUnlock && isLast && (
            <div style={{
              flex: 1, textAlign: 'center', padding: '13px 24px',
              background: 'linear-gradient(135deg, #f0c06028, #f0c06014)',
              border: '2px solid #f0c060aa', borderRadius: 13,
              color: '#f0c060', fontSize: 16, fontWeight: 900,
              animation: 'pjGlow 2s ease-in-out infinite',
              letterSpacing: '0.06em',
            }}>
              Phonics Master!
            </div>
          )}
          {!canUnlock && (
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: '10px',
              color: '#ffffff18',
              fontSize: 13,
            }}>
              Find {level.wordsToUnlock - foundWords.length} more word{level.wordsToUnlock - foundWords.length !== 1 ? 's' : ''} to unlock next level
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
import { PHONICS_LEVELS, makeLevelTiles } from '../data/levels';
import { checkWordInSet, addCustomWord } from '../data/words';
import { getTileSound } from '../data/tiles';
import type { Tile, TileCategoryKey } from '../data/tiles';
import { AudioEngine } from '../audio/AudioEngine';
import { WordValidator } from '../components/WordValidator';
import type { ValidatedWordInfo } from '../components/WordValidator';
import { startSession, recordWordFound, recordLevelCompleted, getLearningStats } from '../data/learningStore';
import type { LearningStats } from '../data/learningStore';

// ---- Phoneme speech (from CLAUDE.md NLP Sound Map) --------------------------
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
  utt.rate = 0.85; utt.pitch = 1.1;
  window.speechSynthesis.speak(utt);
}

function speakWord(word: string) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(word);
  utt.rate = 0.72;
  window.speechSynthesis.speak(utt);
}

// ---- Positive reinforcement -------------------------------------------------
const PRAISE = [
  'Bravo!', 'Amazing!', 'Brilliant!', 'Superstar!', 'Well done!',
  'Excellent!', 'You got it!', 'Nice work!', 'Spectacular!',
  'Phonics pro!', 'Outstanding!', 'Fantastic!', 'Keep it up!',
  "You nailed it!", 'Spot on!',
];
let praiseIdx = 0;
const nextPraise = () => PRAISE[praiseIdx++ % PRAISE.length];

// ---- Category colours -------------------------------------------------------
const CAT_COLOR: Record<TileCategoryKey, string> = {
  open_vowel:     '#E84855',
  closed_vowel:   '#F4A261',
  double_vowel:   '#2EC4B6',
  r_vowel:        '#CBF3F0',
  main_consonants:'#FFBF69',
  specials:       '#C77DFF',
  others:         '#9EF01A',
};

// ---- Metrics modal ----------------------------------------------------------
function MetricsModal({ stats, onClose }: { stats: LearningStats; onClose: () => void }) {
  const pct = Math.round((stats.levelsCompleted.length / 7) * 100);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#12121e',
          border: '1px solid #ffffff18',
          borderRadius: 20,
          padding: '28px 28px',
          maxWidth: 380, width: '100%',
          animation: 'pjSlideIn 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f0e8c0', letterSpacing: '0.04em' }}>Your Progress</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff44', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Words Found', value: stats.totalWordsFound },
            { label: 'Unique Words', value: stats.uniqueWords.length },
            { label: 'Sessions', value: stats.sessions },
            { label: 'Day Streak', value: `${stats.streakDays} 🔥` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: '#1a1a2e', borderRadius: 12, padding: '12px 16px',
              border: '1px solid #ffffff0d',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#f0c060' }}>{value}</div>
              <div style={{ fontSize: 10, color: '#ffffff44', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 3 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Level progress bar */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: '#ffffff33', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 6 }}>
            Levels Completed — {stats.levelsCompleted.length}/7
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {[1,2,3,4,5,6,7].map(id => (
              <div key={id} style={{
                flex: 1, height: 6, borderRadius: 3,
                background: stats.levelsCompleted.includes(id) ? '#2EC4B6' : '#ffffff14',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#2EC4B6', marginTop: 5 }}>{pct}% of curriculum complete</div>
        </div>

        {/* Recent words */}
        {stats.recentWords.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#ffffff33', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>Recent Words</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {stats.recentWords.slice(0, 16).map(({ word }) => (
                <span key={word} onClick={() => speakWord(word)} style={{
                  background: '#2EC4B60d', border: '1px solid #2EC4B628',
                  borderRadius: 16, padding: '3px 11px',
                  color: '#2EC4B688', fontSize: 12, cursor: 'pointer',
                  fontFamily: "'Noto Serif SC', serif",
                }}>{word}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Word info card ---------------------------------------------------------
function WordInfoCard({ word, info }: { word: string; info: ValidatedWordInfo }) {
  return (
    <div style={{
      width: '100%',
      background: 'linear-gradient(135deg, #f0c06010, #f0c06006)',
      border: '1px solid #f0c06028',
      borderRadius: 14,
      padding: '13px 18px',
      animation: 'pjSlideIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 17, fontWeight: 900, color: '#f0c060' }}>{word}</span>
        {info.phonetic && <span style={{ fontSize: 13, color: '#f0c06088', fontStyle: 'italic' }}>{info.phonetic}</span>}
        {info.partOfSpeech && <span style={{ fontSize: 10, color: '#ffffff33', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{info.partOfSpeech}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 9, color: info.source === 'ai' ? '#C77DFF55' : '#2EC4B644', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {info.source === 'ai' ? '✨ ai' : '📖 dict'}
        </span>
      </div>
      {info.definition && <div style={{ fontSize: 13, color: '#ffffffaa', lineHeight: 1.5, marginBottom: info.example ? 4 : 0 }}>{info.definition}</div>}
      {info.example && <div style={{ fontSize: 11, color: '#ffffff44', fontStyle: 'italic', lineHeight: 1.5 }}>"{info.example}"</div>}
    </div>
  );
}

// ---- Main screen ------------------------------------------------------------
type Props = { onBack: () => void };

export function PhonicsJourneyGame({ onBack }: Props) {
  const vw = useWindowSize();
  const isMobile = vw < 640;

  const [levelIdx, setLevelIdx]       = useState(0);
  const [tiles, setTiles]             = useState<Tile[]>(() => makeLevelTiles(PHONICS_LEVELS[0].tileTexts));
  const [builderIds, setBuilderIds]   = useState<number[]>([]);
  const [foundWords, setFoundWords]   = useState<string[]>([]);
  const [praise, setPraise]           = useState<string | null>(null);
  const [pendingWord, setPendingWord] = useState<string | null>(null);  // word awaiting validator
  const [wordInfo, setWordInfo]       = useState<(ValidatedWordInfo & { word: string }) | null>(null);
  const [shaking, setShaking]         = useState(false);
  const [popping, setPopping]         = useState(false);
  const [entered, setEntered]         = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [stats, setStats]             = useState<LearningStats>(getLearningStats);

  useEffect(() => {
    setTimeout(() => setEntered(true), 60);
    startSession();
  }, []);

  const level        = PHONICS_LEVELS[levelIdx];
  const inBuilderSet = new Set(builderIds);
  const builderTiles = builderIds.map(id => tiles.find(t => t.id === id)!).filter(Boolean);
  const currentWord  = builderTiles.map(t => getTileSound(t)).join('');
  const canUnlock    = foundWords.length >= level.wordsToUnlock;
  const isLast       = levelIdx === PHONICS_LEVELS.length - 1;

  // track level completion
  const prevCanUnlock = useRef(false);
  useEffect(() => {
    if (canUnlock && !prevCanUnlock.current) {
      recordLevelCompleted(level.id);
      setStats(getLearningStats());
    }
    prevCanUnlock.current = canUnlock;
  }, [canUnlock, level.id]);

  const showPraise = (msg: string) => {
    setPraise(msg);
    setTimeout(() => setPraise(null), 1800);
  };

  const acceptWord = useCallback((word: string, info?: ValidatedWordInfo) => {
    setFoundWords(ws => {
      const next = [...ws, word];
      recordWordFound(word, level.id);
      setStats(getLearningStats());
      return next;
    });
    speakWord(word);
    AudioEngine.play('wordCorrect');
    setPopping(true);
    setTimeout(() => setPopping(false), 600);
    showPraise(nextPraise());
    setPendingWord(null);
    setBuilderIds([]);
    if (info) setWordInfo({ ...info, word });
  }, [level.id]);

  const rejectWord = useCallback((word: string) => {
    setShaking(true);
    AudioEngine.play('wordWrong');
    setPendingWord(null);
    // brief shake then clear
    setTimeout(() => setShaking(false), 450);
  }, []);

  const goToLevel = (idx: number) => {
    setLevelIdx(idx);
    setTiles(makeLevelTiles(PHONICS_LEVELS[idx].tileTexts));
    setBuilderIds([]);
    setFoundWords([]);
    setPendingWord(null);
    setWordInfo(null);
    setPraise(null);
    prevCanUnlock.current = false;
    AudioEngine.play('gameStart');
  };

  const handleTileClick = (tile: Tile) => {
    if (pendingWord) return; // locked while validating
    AudioEngine.play('tileClick');
    speakPhoneme(tile.text);
    if (inBuilderSet.has(tile.id)) {
      setBuilderIds(ids => ids.filter(id => id !== tile.id));
    } else {
      setBuilderIds(ids => [...ids, tile.id]);
    }
  };

  const handleSubmit = useCallback(() => {
    if (builderTiles.length < 2 || pendingWord) return;
    const word = currentWord;

    if (foundWords.includes(word)) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }

    if (checkWordInSet(word)) {
      acceptWord(word);
    } else {
      // Hand off to WordValidator pipeline (Free Dict → AI)
      setPendingWord(word);
    }
  }, [builderTiles, currentWord, foundWords, pendingWord, acceptWord]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Backspace' && !pendingWord) setBuilderIds(ids => ids.slice(0, -1));
      if (e.key === 'Escape') { setBuilderIds([]); setPendingWord(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSubmit, pendingWord]);

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
          35% { transform: scale(1.18); }
          65% { transform: scale(0.96); }
          100% { transform: scale(1); }
        }
        @keyframes pjSlideIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes pjPraise {
          0%   { opacity: 0; transform: translateY(10px) scale(0.8); }
          20%  { opacity: 1; transform: translateY(-4px) scale(1.12); }
          70%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.95); }
        }
        @keyframes pjGlow {
          0%,100% { box-shadow: 0 0 0 2px #2EC4B688, 0 4px 20px #2EC4B633; }
          50%      { box-shadow: 0 0 0 3px #2EC4B6cc, 0 4px 32px #2EC4B666; }
        }
        @keyframes wvSpin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Back button */}
      <button
        onClick={() => { AudioEngine.play('backToMenu'); onBack(); }}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 200,
          background: 'none', border: '1px solid #ffffff1a', borderRadius: 8,
          color: '#ffffff44', fontSize: 13, cursor: 'pointer', padding: '6px 14px',
          transition: 'all 0.2s', outline: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffffffaa'; e.currentTarget.style.borderColor = '#ffffff44'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff44'; e.currentTarget.style.borderColor = '#ffffff1a'; }}
      >← Back</button>

      {/* Metrics button */}
      <button
        onClick={() => { setStats(getLearningStats()); setShowMetrics(true); }}
        title="Your progress"
        style={{
          position: 'fixed', top: 16, left: isMobile ? 'auto' : 100, right: isMobile ? 60 : 'auto',
          zIndex: 200, background: 'none', border: '1px solid #ffffff1a', borderRadius: 8,
          color: '#ffffff44', fontSize: 13, cursor: 'pointer', padding: '6px 12px',
          transition: 'all 0.2s', outline: 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ffffffaa'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#ffffff44'; }}
      >📊</button>

      {/* Level progress dots */}
      <div style={{ position: 'fixed', top: 22, right: 16, display: 'flex', gap: 7, zIndex: 200 }}>
        {PHONICS_LEVELS.map((_, i) => (
          <div
            key={i}
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

      {/* Praise overlay */}
      {praise && (
        <div style={{
          position: 'fixed', top: '30%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 300, pointerEvents: 'none',
          fontSize: isMobile ? 32 : 42,
          fontWeight: 900,
          color: '#f0c060',
          fontFamily: "'Noto Serif SC', serif",
          textShadow: '0 0 30px #f0c06088',
          animation: 'pjPraise 1.8s ease forwards',
          whiteSpace: 'nowrap',
          letterSpacing: '0.04em',
        }}>{praise}</div>
      )}

      {/* Metrics modal */}
      {showMetrics && <MetricsModal stats={stats} onClose={() => setShowMetrics(false)} />}

      {/* Main content */}
      <div style={{
        width: '100%', maxWidth: 520,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 18 : 22,
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.5s cubic-bezier(0.16,1,0.3,1)',
      }}>

        {/* Level header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: '#ffffff2a', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: 5 }}>
            Level {level.id} of {PHONICS_LEVELS.length}
          </div>
          <div style={{ fontSize: isMobile ? 21 : 26, fontWeight: 900, color: '#f0e8c0', fontFamily: "'Noto Serif SC', serif", marginBottom: 10 }}>
            {level.title}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            background: '#2EC4B60d', border: '1px solid #2EC4B624', borderRadius: 24, padding: '7px 18px',
          }}>
            <span style={{ fontSize: 19, color: '#2EC4B6', fontFamily: "'Noto Serif SC', serif", fontWeight: 900 }}>{level.focus}</span>
            <span style={{ color: '#ffffff33', fontSize: 13 }}>•</span>
            <span style={{ color: '#ffffff77', fontSize: 13 }}>{level.description}</span>
          </div>
        </div>

        {/* Tiles grid — 4 columns */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 12, width: '100%',
        }}>
          {tiles.map(tile => {
            const color  = CAT_COLOR[tile.category];
            const active = inBuilderSet.has(tile.id);
            const locked = !!pendingWord;
            return (
              <button
                key={tile.id}
                onClick={() => handleTileClick(tile)}
                disabled={locked}
                style={{
                  height: isMobile ? 72 : 84, borderRadius: 14,
                  background: active
                    ? `linear-gradient(145deg, ${color}40, ${color}1e)`
                    : `linear-gradient(145deg, ${color}14, ${color}07)`,
                  border: `2px solid ${active ? color + 'bb' : color + '38'}`,
                  color: active ? color : `${color}aa`,
                  fontSize: tile.text.length > 3 ? 13 : tile.text.length > 2 ? 17 : tile.text.length > 1 ? 22 : 28,
                  fontWeight: 900, fontFamily: "'Noto Serif SC', serif",
                  cursor: locked ? 'default' : 'pointer',
                  opacity: locked ? 0.5 : 1,
                  transform: active ? 'translateY(-5px) scale(1.05)' : 'translateY(0) scale(1)',
                  boxShadow: active ? `0 8px 24px ${color}2a, 0 0 0 1px ${color}44` : `0 2px 8px ${color}12`,
                  transition: 'all 0.16s cubic-bezier(0.16,1,0.3,1)',
                  outline: 'none', letterSpacing: '0.02em', userSelect: 'none',
                }}
              >{tile.text}</button>
            );
          })}
        </div>

        {/* Word builder */}
        <div style={{
          width: '100%', background: '#111120',
          border: '1.5px solid #ffffff0c', borderRadius: 18,
          padding: '16px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          animation: shaking ? 'pjShake 0.42s ease' : popping ? 'pjPop 0.5s ease' : 'none',
        }}>

          {/* Builder chips */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: 'center', minHeight: 46, alignItems: 'center',
          }}>
            {builderTiles.length === 0 && !pendingWord && (
              <span style={{ color: '#ffffff1a', fontSize: 13 }}>Click tiles to build a word</span>
            )}
            {pendingWord && (
              <span style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 20, fontWeight: 700, color: '#ffffff55', letterSpacing: '0.08em' }}>
                {pendingWord}
              </span>
            )}
            {!pendingWord && builderTiles.map(tile => {
              const color = CAT_COLOR[tile.category];
              return (
                <button
                  key={tile.id}
                  onClick={() => setBuilderIds(ids => ids.filter(id => id !== tile.id))}
                  style={{
                    background: `linear-gradient(135deg, ${color}28, ${color}12)`,
                    border: `1.5px solid ${color}66`,
                    borderRadius: 9, padding: '6px 13px',
                    color: color, fontSize: tile.text.length > 3 ? 12 : 15,
                    fontWeight: 900, fontFamily: "'Noto Serif SC', serif",
                    cursor: 'pointer', outline: 'none',
                    animation: 'pjSlideIn 0.18s ease both', transition: 'opacity 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.55'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >{tile.text}</button>
              );
            })}
          </div>

          {/* Word preview (when not pending) */}
          {!pendingWord && currentWord && (
            <div style={{
              fontSize: isMobile ? 20 : 24, fontWeight: 700,
              color: '#ffffff55', letterSpacing: '0.08em',
              fontFamily: "'Noto Serif SC', serif",
            }}>{currentWord}</div>
          )}

          {/* Validator (shown while checking unknown word) */}
          {pendingWord && (
            <WordValidator
              word={pendingWord}
              onValid={info => {
                addCustomWord(pendingWord);
                acceptWord(pendingWord, info);
              }}
              onInvalid={() => rejectWord(pendingWord)}
            />
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={() => { setBuilderIds([]); setPendingWord(null); }}
              disabled={builderTiles.length === 0 && !pendingWord}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 11,
                background: 'none',
                border: `1.5px solid ${builderTiles.length > 0 || pendingWord ? '#ffffff18' : '#ffffff08'}`,
                color: builderTiles.length > 0 || pendingWord ? '#ffffff44' : '#ffffff18',
                fontSize: 13, cursor: 'pointer', transition: 'all 0.2s', outline: 'none',
              }}
            >Clear</button>
            <button
              onClick={handleSubmit}
              disabled={builderTiles.length < 2 || !!pendingWord}
              style={{
                flex: 3, padding: '11px 0', borderRadius: 11,
                background: builderTiles.length >= 2 && !pendingWord
                  ? 'linear-gradient(135deg, #f0c06030, #f0c06014)' : 'none',
                border: `1.5px solid ${builderTiles.length >= 2 && !pendingWord ? '#f0c060aa' : '#ffffff08'}`,
                color: builderTiles.length >= 2 && !pendingWord ? '#f0c060' : '#ffffff22',
                fontSize: 15, fontWeight: 800,
                cursor: builderTiles.length >= 2 && !pendingWord ? 'pointer' : 'default',
                letterSpacing: '0.08em', transition: 'all 0.2s', outline: 'none',
              }}
              onMouseEnter={e => { if (builderTiles.length >= 2 && !pendingWord) e.currentTarget.style.background = 'linear-gradient(135deg, #f0c06050, #f0c06028)'; }}
              onMouseLeave={e => { if (builderTiles.length >= 2 && !pendingWord) e.currentTarget.style.background = 'linear-gradient(135deg, #f0c06030, #f0c06014)'; }}
            >Submit ↵</button>
          </div>
        </div>

        {/* Word info card */}
        {wordInfo && <WordInfoCard word={wordInfo.word} info={wordInfo} />}

        {/* Found words */}
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
          }}>
            <span style={{ color: '#ffffff28' }}>Found ({foundWords.length})</span>
            <span style={{ color: canUnlock ? '#2EC4B6' : '#ffffff22', transition: 'color 0.4s' }}>
              {foundWords.length} / {level.wordsToUnlock} to {isLast ? 'finish' : 'next level'}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {foundWords.length === 0 && (
              <span style={{ color: '#ffffff18', fontSize: 12 }}>
                Try: {level.targetWords.slice(0, 3).join(', ')}…
              </span>
            )}
            {foundWords.map(word => (
              <button
                key={word}
                onClick={() => speakWord(word)}
                title="Hear it"
                style={{
                  background: '#2EC4B60e', border: '1px solid #2EC4B62a',
                  borderRadius: 20, padding: '4px 14px',
                  color: '#2EC4B6', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', outline: 'none',
                  animation: 'pjSlideIn 0.28s ease',
                  fontFamily: "'Noto Serif SC', serif", letterSpacing: '0.05em',
                  transition: 'all 0.14s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#2EC4B620'; e.currentTarget.style.borderColor = '#2EC4B655'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#2EC4B60e'; e.currentTarget.style.borderColor = '#2EC4B62a'; }}
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
                background: 'none', border: '1.5px solid #ffffff12',
                color: '#ffffff33', fontSize: 13, cursor: 'pointer', outline: 'none', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ffffff66'; e.currentTarget.style.borderColor = '#ffffff26'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#ffffff33'; e.currentTarget.style.borderColor = '#ffffff12'; }}
            >← Prev</button>
          )}

          {canUnlock && !isLast && (
            <button
              onClick={() => goToLevel(levelIdx + 1)}
              style={{
                flex: 1, padding: '13px 24px', borderRadius: 13,
                background: 'linear-gradient(135deg, #2EC4B624, #2EC4B610)',
                border: '2px solid #2EC4B6aa',
                color: '#2EC4B6', fontSize: 16, fontWeight: 900,
                cursor: 'pointer', letterSpacing: '0.08em', outline: 'none',
                animation: 'pjGlow 2s ease-in-out infinite', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2EC4B638, #2EC4B620)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #2EC4B624, #2EC4B610)'; }}
            >Next Level →</button>
          )}

          {canUnlock && isLast && (
            <div style={{
              flex: 1, textAlign: 'center', padding: '13px 24px',
              background: 'linear-gradient(135deg, #f0c06024, #f0c06010)',
              border: '2px solid #f0c060aa', borderRadius: 13,
              color: '#f0c060', fontSize: 16, fontWeight: 900,
              animation: 'pjGlow 2s ease-in-out infinite',
              letterSpacing: '0.06em',
            }}>Phonics Master! 🎓</div>
          )}

          {!canUnlock && (
            <div style={{ flex: 1, textAlign: 'center', color: '#ffffff18', fontSize: 12, padding: '10px' }}>
              {level.wordsToUnlock - foundWords.length} more word{level.wordsToUnlock - foundWords.length !== 1 ? 's' : ''} to unlock next level
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

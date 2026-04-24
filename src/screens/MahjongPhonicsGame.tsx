import { useState, useEffect, useCallback, useRef } from 'react';
import { TILE_CATEGORIES, getTileSound, buildDeck, shuffle, freshTileId, parseTile } from '../data/tiles';
import { WORD_LIST, SESSION_CUSTOM_WORDS, checkWordInSet, buildWordFromTiles, addCustomWord } from '../data/words';
import { DEFAULT_SETTINGS } from '../data/settings';
import type { Settings } from '../data/settings';
import { TILE_THEMES } from '../themes/tileThemes';
import { AudioEngine } from '../audio/AudioEngine';
import { Tile } from '../components/Tile';
import type { Tile as TileData } from '../data/tiles';
import { CheerBurst } from '../components/CheerBurst';
import { WordSmokeCanvas, makeSmokeWord, getWordsForSound } from '../components/WordSmokeCanvas';
import type { SmokeWordData } from '../components/WordSmokeCanvas';
import { Modal } from '../components/Modal';

type ScoredWord = { tiles: TileData[]; word: string; pts: number; hinted: boolean; originalPts: number };
type ChallengeWord = { word: string; tiles: TileData[] };

type GameProps = { onBackToTitle: () => void; settings?: Settings };

export function MahjongPhonicsGame({ onBackToTitle, settings = DEFAULT_SETTINGS }: GameProps) {
  const [deck, setDeck] = useState(() => shuffle(buildDeck()));
  const [hand, setHand] = useState<TileData[]>([]);
  const [selected, setSelected] = useState<TileData[]>([]);
  const [words, setWords] = useState<ScoredWord[]>([]);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [deckIndex, setDeckIndex] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [invalidShake, setInvalidShake] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [dictReady, setDictReady] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [allWordsScored, setAllWordsScored] = useState<ScoredWord[]>([]);
  const [challengeWord, setChallengeWord] = useState<ChallengeWord | null>(null);
  const loadedWordSet = useRef<Set<string> | null>(null);
  const msgTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- WORD SMOKE -------------------------------------------------------------
  const smokeEnabled = settings.smokeEffect;
  const [cheerKey, setCheerKey] = useState(0);
  const [smokeWords, setSmokeWords] = useState<SmokeWordData[]>([]);
  const spawnTimerRef = useRef<{ interval: ReturnType<typeof setInterval> | null; t1: ReturnType<typeof setTimeout> | null; t2: ReturnType<typeof setTimeout> | null }>({ interval: null, t1: null, t2: null });
  const hoverTileRef = useRef<TileData | null>(null);
  const usedRecentlyRef = useRef(new Set<string>());

  const removeWord = useCallback((id: number) => {
    setSmokeWords(prev => prev.filter(w => w.id !== id));
  }, []);

  const handleTileHover = useCallback((tile: TileData | null, x: number, y: number) => {
    clearInterval(spawnTimerRef.current.interval ?? undefined);
    clearTimeout(spawnTimerRef.current.t1 ?? undefined);
    clearTimeout(spawnTimerRef.current.t2 ?? undefined);
    if (!tile || !smokeEnabled) { hoverTileRef.current = null; return; }
    hoverTileRef.current = tile;

    const cat = TILE_CATEGORIES[tile.category];
    const color = cat.color;
    const sound = getTileSound(tile);
    const wordPool = getWordsForSound(sound);
    if (wordPool.length === 0) return;

    const spawnOne = () => {
      if (!hoverTileRef.current) return;
      let word: string | undefined;
      for (let i = 0; i < 12; i++) {
        word = wordPool[Math.floor(Math.random() * wordPool.length)];
        if (!usedRecentlyRef.current.has(word)) break;
      }
      if (!word) return;
      usedRecentlyRef.current.add(word);
      if (usedRecentlyRef.current.size > 8) {
        const first = usedRecentlyRef.current.values().next().value as string;
        usedRecentlyRef.current.delete(first);
      }
      setSmokeWords(prev => [...prev.slice(-16), makeSmokeWord(word!, x, y, color)]);
    };

    spawnOne();
    spawnTimerRef.current.t1 = setTimeout(() => { if (hoverTileRef.current) spawnOne(); }, 700);
    spawnTimerRef.current.t2 = setTimeout(() => { if (hoverTileRef.current) spawnOne(); }, 1400);
    spawnTimerRef.current.interval = setInterval(spawnOne, 1100);
  }, [smokeEnabled]);

  // Deal initial 13 tiles
  useEffect(() => {
    const d = shuffle(buildDeck());
    setDeck(d);
    setHand(d.slice(0, 13));
    setDeckIndex(13);
    setDictReady(true);
    AudioEngine.startMusic();
    return () => AudioEngine.stopMusic();
  }, []);

  useEffect(() => {
    AudioEngine.setMusicVolume(settings.ambientMusic);
  }, [settings.ambientMusic]);
  useEffect(() => {
    AudioEngine.setSfxVolume(settings.soundEffects);
  }, [settings.soundEffects]);

  const showMsg = (text: string, type = "info") => {
    if (msgTimeout.current) clearTimeout(msgTimeout.current);
    setMessage({ text, type });
    msgTimeout.current = setTimeout(() => setMessage({ text: "", type: "" }), 3000);
  };

  const toggleTile = (tile: TileData) => {
    if (settings.soundEffects > 0) AudioEngine.play("tileClick");
    setSelected(prev => {
      const already = prev.findIndex(t => t.id === tile.id);
      if (already !== -1) {
        // deselect - remove only the first match (safety guard)
        return prev.filter((_, i) => i !== already);
      }
      // guard: never add duplicates (safety against double event fires)
      if (prev.some(t => t.id === tile.id)) return prev;
      return [...prev, tile];
    });
  };

  const makeWord = () => {
    if (selected.length === 0) { showMsg("Select some tiles first!", "warn"); return; }
    const word = buildWordFromTiles(selected);
    if (word.length < 2) { showMsg("Word is too short!", "warn"); return; }
    const found = checkWordInSet(word);
    if (!found) {
      if (settings.soundEffects > 0) AudioEngine.play("wordWrong");
      // Instead of immediately shaking, offer a challenge prompt
      setChallengeWord({ word, tiles: [...selected] });
      return;
    }
    scoreWord(word, selected);
  };

  // Score a validated word (extracted so challenge flow can reuse it)
  const scoreWord = (word: string, tiles: TileData[]) => {
    if (settings.soundEffects > 0) AudioEngine.play("wordCorrect");
    const catBonus: Record<string, number> = { specials: 5, r_vowel: 4, double_vowel: 3, others: 2, main_consonants: 1, open_vowel: 1, closed_vowel: 1 };
    const basePts = tiles.reduce((acc, t) => {
      return acc + (catBonus[t.category] ?? 1);
    }, 0) * word.length;
    const usedHint = settings.hintPenalty && showHint && hintUsedWords.has(word);
    const pts = usedHint ? Math.max(1, Math.floor(basePts / 2)) : basePts;
    setWords(prev => [...prev, { tiles, word, pts, hinted: usedHint, originalPts: basePts }]);
    setScore(s => s + pts);
    setHand(prev => prev.filter(t => !tiles.find(s => s.id === t.id)));
    setSelected([]);
    setHintUsedWords(new Set());
    setChallengeWord(null);
    if (settings.cheerEffect) setCheerKey(k => k + 1);
    showMsg(`+${pts} pts! "${word}"${usedHint ? " (hint −50%)" : ""} added!`, "success");
  };

  // Accept a challenged word: add to session dictionary then score it
  const acceptChallenge = () => {
    if (!challengeWord) return;
    addCustomWord(challengeWord.word);
    scoreWord(challengeWord.word, challengeWord.tiles);
  };

  // Reject: shake and clear
  const rejectChallenge = () => {
    setChallengeWord(null);
    setInvalidShake(true);
    setTimeout(() => { setInvalidShake(false); setSelected([]); }, 600);
  };

  const clearSelection = () => { setSelected([]); };

  // -- AUTO-MAKE WORD ---------------------------------------------------------
  // When autoMakeWord is on, check after every selection change: if the current
  // tiles already spell a valid word, score it automatically after a brief delay
  // so the player can see the selection before it fires.
  useEffect(() => {
    if (!settings.autoMakeWord || !dictReady || animating || selected.length < 1) return;
    const word = buildWordFromTiles(selected);
    if (word.length < 2 || !checkWordInSet(word)) return;
    const t = setTimeout(() => { makeWord(); }, 320);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, settings.autoMakeWord, dictReady, animating]);
  // Works on both hand tiles and already-selected tiles
  const cycleVariant = (tile: TileData) => {
    if (settings.soundEffects > 0) AudioEngine.play("tileCycle");
    const cycle = (t: TileData): TileData => {
      if (!t.variants) return t;
      if (t.id !== tile.id) return t;
      return { ...t, activeVariant: (t.activeVariant + 1) % t.variants.length };
    };
    setHand(prev => prev.map(cycle));
    setSelected(prev => prev.map(cycle));
  };

  // -- RESET GAME ------------------------------------------------------------
  const resetGame = () => {
    if (settings.soundEffects > 0) AudioEngine.play("resetGame");
    const d = shuffle(buildDeck());
    setDeck(d);
    setHand(d.slice(0, 13));
    setDeckIndex(13);
    setSelected([]);
    setWords([]);
    setRound(1);
    setScore(0);
    setAnimating(false);
    setHintWords([]);
    setShowHint(false);
    setHintsLeft(MAX_HINTS);
    setGameOver(false);
    setAllWordsScored([]);
    showMsg("🔄 Game reset! New tiles dealt.", "info");
  };

  // -- HINT SYSTEM ------------------------------------------------------------
  const MAX_HINTS = 3;
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [showHint, setShowHint] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [highlightIds, setHighlightIds] = useState(new Set<number>());
  const [hintUsedWords, setHintUsedWords] = useState(new Set<string>());
  const [hintWords, setHintWords] = useState<Array<{ word: string; tileIds: number[]; pts: number }>>([]);
  // Auto-pulse: IDs of tiles gently glowing right now (ambient short-word hint)
  const [autoPulseIds, setAutoPulseIds] = useState(new Set<number>());
  const autoPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Score a candidate word given tile ids
  const scoreCandidate = useCallback((tileIds: number[]) => {
    const catBonus: Record<string, number> = { specials:5, r_vowel:4, double_vowel:3, others:2, main_consonants:1, open_vowel:1, closed_vowel:1 };
    return tileIds.reduce((acc, id) => {
      const t = hand.find(h => h.id === id);
      return acc + (t ? (catBonus[t.category] ?? 1) : 0);
    }, 0);
  }, [hand]);

  // Core matching helper - returns array of { word, tileIds, pts } from current hand
  const findAllCandidates = useCallback((maxLen = 99) => {
    // Build per-tile option lists (each tile can produce 1 or more sounds via variants)
    const tileSounds = hand.map(tile =>
      tile.variants
        ? tile.variants.map(v => ({ sound: v, tile }))
        : [{ sound: tile.text.replace(/-/g, ""), tile }]
    );
    const usedAlready = new Set(words.map(w => w.word));
    const catBonus: Record<string, number> = { specials:5, r_vowel:4, double_vowel:3, others:2, main_consonants:1, open_vowel:1, closed_vowel:1 };
    const found: Array<{ word: string; tileIds: number[]; pts: number }> = [];

    // Backtracking matcher: tries every tile at every position so that
    // both d+oor AND d+o+or can match "door", and words like "answer"
    // are found even if an "an" tile could theoretically steal the match.
    function matchWord(word: string, pos: number, usedFlags: boolean[], tileIds: number[]): { ok: boolean; tileIds: number[] } | null {
      if (pos === word.length) return { ok: true, tileIds: [...tileIds] };
      for (let i = 0; i < tileSounds.length; i++) {
        if (usedFlags[i]) continue;
        for (const { sound, tile } of tileSounds[i]) {
          if (word.slice(pos, pos + sound.length) === sound) {
            usedFlags[i] = true;
            tileIds.push(tile.id);
            const result = matchWord(word, pos + sound.length, usedFlags, tileIds);
            if (result?.ok) return result;
            tileIds.pop();
            usedFlags[i] = false;
          }
        }
      }
      return null;
    }

    for (const word of [...WORD_LIST, ...SESSION_CUSTOM_WORDS]) {
      if (word.length < 2 || word.length > maxLen) continue;
      if (usedAlready.has(word)) continue;
      const usedFlags = new Array(tileSounds.length).fill(false);
      const result = matchWord(word, 0, usedFlags, []);
      if (result?.ok) {
        const pts = result.tileIds.reduce((acc, id) => {
          const t = hand.find(h => h.id === id);
          return acc + (t ? (catBonus[t.category] ?? 1) : 0);
        }, 0) * word.length;
        found.push({ word, tileIds: result.tileIds, pts });
      }
    }
    return found;
  }, [hand, words]);

  // Hint button: costs 1 charge, reveals the single highest-scoring word
  const findHints = () => {
    if (hintsLeft <= 0) { showMsg("No hints left this round!", "warn"); return; }
    setHintLoading(true);
    setShowHint(false);
    setHighlightIds(new Set());
    setTimeout(() => {
      const candidates = findAllCandidates();
      if (candidates.length === 0) {
        setHintLoading(false);
        showMsg("🤔 No words found - try cycling dual tiles!", "warn");
        return;
      }
      // Pick the best-scoring word
      const best = candidates.reduce((a, b) => b.pts > a.pts ? b : a, candidates[0]);
      setHintWords([best]);
      setHintsLeft(n => n - 1);
      setShowHint(true);
      setHintLoading(false);
      if (settings.soundEffects > 0) AudioEngine.play("hintReveal");
      highlightHintWord(best);
    }, 300);
  };

  const highlightHintWord = (hint: { word: string; tileIds: number[] }) => {
    setHighlightIds(new Set(hint.tileIds));
    setHintUsedWords(prev => new Set([...prev, hint.word]));
    setTimeout(() => setHighlightIds(new Set()), 3500);
  };

  // Legacy compat - kept so old calls still work
  const highlightHint = highlightHintWord;

  // -- AUTO-PULSE (ambient short-word glow) -----------------------------------
  // Every 7–11 seconds, quietly illuminate 2–3 tiles that spell a short word
  // (≤4 chars). This costs nothing and gives a subtle nudge without spoiling.
  useEffect(() => {
    const schedule = () => {
      const jitter = 7000 + Math.random() * 4000;
      autoPulseTimerRef.current = setTimeout(() => {
        if (animating) { schedule(); return; }
        const shortCandidates = findAllCandidates(4); // words up to 4 chars
        if (shortCandidates.length > 0) {
          const pick = shortCandidates[Math.floor(Math.random() * Math.min(shortCandidates.length, 6))];
          setAutoPulseIds(new Set(pick.tileIds));
          setTimeout(() => setAutoPulseIds(new Set()), 1600); // glow lasts 1.6s
        }
        schedule();
      }, jitter);
    };
    schedule();
    return () => clearTimeout(autoPulseTimerRef.current ?? undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hand, words, animating]);

  // Check whether a given tile array can form ANY word - used to detect dead hands
  const isDeadHand = useCallback((tiles: TileData[]) => {
    const tileSounds = tiles.map(tile =>
      tile.variants
        ? tile.variants.map(v => ({ sound: v, tile }))
        : [{ sound: tile.text.replace(/-/g, ""), tile }]
    );
    function matchWord(word: string, pos: number, usedFlags: boolean[]) {
      if (pos === word.length) return true;
      for (let i = 0; i < tileSounds.length; i++) {
        if (usedFlags[i]) continue;
        for (const { sound } of tileSounds[i]) {
          if (word.slice(pos, pos + sound.length) === sound) {
            usedFlags[i] = true;
            if (matchWord(word, pos + sound.length, usedFlags)) return true;
            usedFlags[i] = false;
          }
        }
      }
      return false;
    }
    const allWords = [...WORD_LIST, ...SESSION_CUSTOM_WORDS];
    for (const word of allWords) {
      if (word.length < 2 || word.length > 12) continue;
      if (matchWord(word, 0, new Array(tileSounds.length).fill(false))) return false;
    }
    return true;
  }, []);

  const endRound = () => {
    if (words.length === 0) { showMsg("Make at least one word to end the round!", "warn"); return; }
    if (settings.soundEffects > 0) AudioEngine.play("roundEnd");
    setAnimating(true);
    setTimeout(() => {
      // Replace used tiles
      const usedIds = new Set(words.flatMap(w => w.tiles.map(t => t.id)));
      const remaining = hand.filter(t => !usedIds.has(t.id));
      const needed = 13 - remaining.length;
      let newDeckIndex = deckIndex;
      const newTiles = [];
      for (let i = 0; i < needed; i++) {
        if (newDeckIndex < deck.length) {
          newTiles.push(deck[newDeckIndex++]);
        } else {
          // Reshuffle used tiles back
          const recycled = shuffle(words.flatMap(w => w.tiles));
          deck.splice(newDeckIndex, 0, ...recycled);
          newTiles.push(deck[newDeckIndex++]);
        }
      }
      setDeckIndex(newDeckIndex);
      const newHand = [...remaining, ...newTiles];
      setHand(newHand);
      setAllWordsScored(prev => [...prev, ...words]);
      setWords([]);
      setSelected([]);
      setRound(r => r + 1);
      setHintsLeft(MAX_HINTS);
      setShowHint(false);
      setAnimating(false);
      if (settings.soundEffects > 0) AudioEngine.play("dealTiles");
      showMsg(`Round ${round + 1} begins! ${needed} new tiles dealt.`, "info");
      // Check if new hand is a dead end - trigger end screen if so
      if (isDeadHand(newHand)) {
        setTimeout(() => {
          if (settings.soundEffects > 0) AudioEngine.play("sessionEnd");
          setGameOver(true);
        }, 800);
      }
    }, 600);
  };

  const catLegend = Object.entries(TILE_CATEGORIES);

  const _th = TILE_THEMES[settings.tileTheme] || TILE_THEMES.neon;
  return (
    <div style={{
      minHeight: "100vh",
      background: _th.pageBg,
      backgroundImage: _th.pageBgImage ? `
        radial-gradient(ellipse at 20% 20%, #1a0a2e44 0%, transparent 50%),
        radial-gradient(ellipse at 80% 80%, #0a1a2e44 0%, transparent 50%),
        repeating-linear-gradient(0deg, transparent, transparent 60px, #ffffff03 60px, #ffffff03 61px),
        repeating-linear-gradient(90deg, transparent, transparent 60px, #ffffff03 60px, #ffffff03 61px)
      ` : "none",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: _th.pageText,
      padding: "0 0 40px",
      transition: "background 0.4s, color 0.4s",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity:0; } to { opacity:1; } } @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } } @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 0 2px #f0c06088, 0 0 12px 2px #f0c06033; } 50% { box-shadow: 0 0 0 3px #f0c060cc, 0 0 24px 6px #f0c06077; } } @keyframes smokeRise { 0% { opacity:0; transform:translateX(-50%) translateY(0px); } 12% { opacity:0.85; } 80% { opacity:0.6; } 100% { opacity:0; transform:translateX(-50%) translateY(-160px); } } @keyframes shake { 0%,100% { transform:translateX(0); } 15% { transform:translateX(-7px); } 30% { transform:translateX(7px); } 45% { transform:translateX(-5px); } 60% { transform:translateX(5px); } 75% { transform:translateX(-3px); } 90% { transform:translateX(3px); } } @keyframes tileAutoPulse { 0%,100% { box-shadow: 0 3px 8px #00000088, inset 0 1px 0 #ffffff0a; transform: translateY(0) scale(1); } 30% { box-shadow: 0 0 0 2px #C77DFFcc, 0 0 20px 6px #C77DFF55, 0 6px 18px #00000088; transform: translateY(-4px) scale(1.05); } 60% { box-shadow: 0 0 0 2px #C77DFF88, 0 0 12px 3px #C77DFF33, 0 4px 12px #00000088; transform: translateY(-2px) scale(1.02); } }`}</style>
      {/* Header */}
      <div style={{
        borderBottom: `1px solid ${_th.headerBorder}`,
        background: _th.headerBg,
        backdropFilter: "blur(12px)",
        padding: "14px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {onBackToTitle && (
            <button
              onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }}
              title="Return to home screen"
              style={{
                background: "#ffffff08", border: "1px solid #ffffff18",
                color: "#ffffff88", borderRadius: 10, padding: "7px 14px",
                cursor: "pointer", fontSize: 12, fontWeight: 700,
                display: "flex", alignItems: "center", gap: 6,
                transition: "all 0.15s", flexShrink: 0,
                letterSpacing: "0.06em",
              }}
            >
              🚪 Home
            </button>
          )}
          <div style={{ fontSize: 28 }}>🀄</div>
          <div>
            <div style={{ fontFamily: "'Noto Serif SC', serif", fontSize: 20, fontWeight: 800, letterSpacing: "0.06em", color: "#f0c060" }}>
              Phonics Mahjong
            </div>
            <div style={{ fontSize: 11, color: "#ffffff55", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Word Building Game
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#ffffff44", textTransform: "uppercase", letterSpacing: "0.1em" }}>Round</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0c060", fontFamily: "monospace" }}>{round}</div>
          </div>
          <div style={{ width: 1, height: 36, background: "#ffffff15" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#ffffff44", textTransform: "uppercase", letterSpacing: "0.1em" }}>Score</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#9EF01A", fontFamily: "monospace" }}>{score}</div>
          </div>
          <div style={{ width: 1, height: 36, background: "#ffffff15" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#ffffff44", textTransform: "uppercase", letterSpacing: "0.1em" }}>Tiles Left</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#2EC4B6", fontFamily: "monospace" }}>{deck.length - deckIndex}</div>
          </div>
          <div style={{ width: 1, height: 36, background: "#ffffff15" }} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#ffffff44", textTransform: "uppercase", letterSpacing: "0.1em" }}>Dictionary</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: dictReady ? "#9EF01A" : "#F4A261", fontFamily: "monospace", marginTop: 3 }}>
              {dictReady ? "✓ 20k Ready" : (
                <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⟳</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowRules(r => !r)}
            style={{
              background: "#ffffff0f", border: "1px solid #ffffff1a",
              color: "#ffffff88", borderRadius: 8, padding: "6px 14px",
              cursor: "pointer", fontSize: 12, letterSpacing: "0.06em",
            }}
          >
            {showRules ? "Hide" : "Rules"}
          </button>
          <button
            onClick={resetGame}
            title="Reset the entire game and reshuffle all tiles"
            style={{
              background: "linear-gradient(135deg, #E8485522, #E8485511)",
              border: "1px solid #E8485566",
              color: "#ff6b78", borderRadius: 8, padding: "6px 14px",
              cursor: "pointer", fontSize: 12, letterSpacing: "0.06em",
              fontWeight: 700,
            }}
          >
            🔄 Reset
          </button>
        </div>
      </div>

      {/* Rules Panel */}
      {showRules && (
        <div style={{
          margin: "16px 24px 0",
          background: "#ffffff06",
          border: "1px solid #ffffff12",
          borderRadius: 12,
          padding: "20px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c060", marginBottom: 8 }}>🎮 How to Play</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "#ffffff88" }}>
              1. You have 13 tiles in your hand<br/>
              2. Click tiles to select them in order<br/>
              3. Press <b style={{color:"#fff"}}>Make Word</b> to validate and score<br/>
              4. Valid words score instantly - invalid ones clear so you can retry<br/>
              5. Build multiple words, then <b style={{color:"#fff"}}>End Round</b><br/>
              6. Used tiles are replaced with new ones
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c060", marginBottom: 8 }}>✨ Scoring</div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "#ffffff88" }}>
              Points = word length x tile values<br/>
              Specials: 5pts | R-Vowel: 4pts<br/>
              Double Vowel: 3pts | Others: 2pts<br/>
              Consonants/Vowels: 1pt each<br/><br/>
              Longer words with rare tiles score more!
            </div>
          </div>
        </div>
      )}

      {/* Message Banner */}
      {message.text && (
        <div style={{
          margin: "12px 24px 0",
          padding: "10px 18px",
          borderRadius: 10,
          background: {
            success: "#9EF01A22",
            error: "#E8485522",
            warn: "#F4A26122",
            info: "#2EC4B622",
          }[message.type] || "#ffffff11",
          border: `1px solid ${{
            success: "#9EF01A55",
            error: "#E8485555",
            warn: "#F4A26155",
            info: "#2EC4B655",
          }[message.type] || "#ffffff22"}`,
          fontSize: 13,
          color: {
            success: "#c8ff5a",
            error: "#ff6b78",
            warn: "#ffbe85",
            info: "#5de8e0",
          }[message.type] || "#e0e0f0",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}>
          {message.text}
        </div>
      )}

      {/* -- WORDS SCORED - Mahjong discard row, above the board ---------------- */}
      <div style={{ padding: "16px 24px 0" }}>
        <div style={{
          background: "#ffffff05",
          border: "1px solid #ffffff0d",
          borderRadius: 14,
          padding: "14px 18px",
          minHeight: 64,
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: words.length > 0 ? 12 : 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#ffffff33" }}>
              Words This Round
            </div>
            {words.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, color: "#ffffff33", letterSpacing: "0.1em", textTransform: "uppercase" }}>Round total</span>
                <span style={{ fontSize: 15, color: "#f0c060", fontWeight: 800, fontFamily: "monospace" }}>
                  {words.reduce((s, w) => s + w.pts, 0)}
                </span>
              </div>
            )}
          </div>
          {/* Word chips - rendered as their actual tiles */}
          {words.length === 0 ? (
            <div style={{ color: "#ffffff18", fontSize: 12, fontStyle: "italic", paddingTop: 4 }}>
              Score words to see them appear here…
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {words.map((w, i) => (
                <div key={i} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: w.hinted ? "#F4A2610d" : "#9EF01A0d",
                  border: w.hinted ? "1px solid #F4A26144" : "1px solid #9EF01A33",
                  borderRadius: 20, padding: "4px 12px 4px 10px",
                }}>
                  <span style={{ fontFamily: "'Noto Serif SC', serif", color: w.hinted ? "#ffbe85" : "#c8ff5a", fontWeight: 700, fontSize: 14 }}>
                    {w.word}{w.hinted ? " 💡" : ""}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: w.hinted ? "#F4A261" : "#9EF01A" }}>+{w.pts}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* -- MAIN BOARD AREA ----------------------------------------------------- */}
      <div style={{ display: "flex", gap: 18, padding: "14px 24px 0", alignItems: "flex-start" }}>

        {/* Left: Word Builder + Hand */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Word Builder */}
          <div style={{
            background: "#ffffff06",
            border: "1px solid #ffffff10",
            borderRadius: 14,
            padding: "14px 18px",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#ffffff33" }}>
                Word Builder {selected.length > 0 ? `- ${selected.length} tile${selected.length !== 1 ? "s" : ""}` : ""}
              </div>
              {/* Auto indicator */}
              <div style={{ fontSize: 10, color: settings.autoMakeWord ? "#9EF01A88" : "#ffffff22", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4 }}>
                {settings.autoMakeWord ? "⚡ Auto-on" : "Manual mode"}
              </div>
            </div>

            {/* Selected tiles row */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8,
              minHeight: 60,
              alignItems: "center",
              background: "#ffffff03",
              borderRadius: 10,
              padding: "10px 12px",
              border: selected.length > 0 ? "1px solid #ffffff14" : "1px dashed #ffffff0a",
              marginBottom: selected.length > 0 ? 10 : 0,
            }}>
              {selected.length === 0 ? (
                <div style={{ color: "#ffffff1a", fontSize: 13, fontStyle: "italic" }}>
                  Click tiles from your hand to build a word…
                </div>
              ) : (
                selected.map(t => (
                  <Tile key={t.id} tile={t} selected onClick={() => toggleTile(t)} onCycleVariant={cycleVariant} onHover={handleTileHover} small theme={settings.tileTheme} animated={settings.tileAnimations} showLabel={settings.soundLabels} />
                ))
              )}
            </div>

            {/* Preview + action buttons */}
            {selected.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, fontFamily: "'Noto Serif SC', serif", color: "#f0c060", fontWeight: 800, fontSize: 22, letterSpacing: "0.04em" }}>
                  {selected.map(t => getTileSound(t)).join("")}
                </div>
                {/* Make Word button - only shown when autoMakeWord is off */}
                {!settings.autoMakeWord && (
                  <button onClick={makeWord} disabled={animating || !dictReady} style={{
                    ...btnStyle(!dictReady ? "#888" : "#9EF01A", !dictReady ? "#111" : "#0d1400"),
                    opacity: !dictReady ? 0.5 : 1,
                    cursor: !dictReady ? "wait" : "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                    animation: invalidShake ? "shake 0.5s ease" : "none",
                    fontSize: 13, padding: "9px 20px",
                  }}>
                    {!dictReady
                      ? <><span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⟳</span> Loading…</>
                      : "✓ Make Word"}
                  </button>
                )}
                {/* Shake animation on Make Word even in auto mode */}
                {settings.autoMakeWord && invalidShake && (
                  <div style={{
                    padding: "7px 14px", borderRadius: 9,
                    background: "#E8485522", border: "1px solid #E8485566",
                    color: "#ff6b78", fontSize: 12, fontWeight: 700,
                    animation: "shake 0.5s ease",
                  }}>✕ Not a word</div>
                )}
                <button onClick={clearSelection} style={{
                  padding: "9px 16px", borderRadius: 9,
                  background: "#ffffff08", border: "1px solid #ffffff18",
                  color: "#ffffff55", fontSize: 12, fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.06em", transition: "all 0.15s",
                }}>
                  ✕ Clear
                </button>
              </div>
            )}

            {/* -- Challenge Prompt - word not in built-in list -- */}
            {challengeWord && (
              <div style={{
                marginTop: 12,
                background: "linear-gradient(135deg, #F4A26114, #F4A26108)",
                border: "1px solid #F4A26155",
                borderRadius: 12,
                padding: "14px 16px",
                animation: "fadeIn 0.2s ease",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>🤔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#ffbe85", marginBottom: 3 }}>
                      "<span style={{ fontFamily: "'Noto Serif SC', serif" }}>{challengeWord.word}</span>" isn't in our list
                    </div>
                    <div style={{ fontSize: 11, color: "#ffffff55", lineHeight: 1.5, marginBottom: 10 }}>
                      If it's a real word, you can add it to your session dictionary and score it - or clear and try something else.
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={acceptChallenge} style={{
                        padding: "7px 16px", borderRadius: 9,
                        background: "linear-gradient(135deg, #F4A26133, #F4A26118)",
                        border: "1px solid #F4A26177",
                        color: "#ffbe85", fontSize: 12, fontWeight: 800,
                        cursor: "pointer", letterSpacing: "0.06em",
                      }}>
                        ✓ It's a real word - add &amp; score
                      </button>
                      <button onClick={rejectChallenge} style={{
                        padding: "7px 14px", borderRadius: 9,
                        background: "#ffffff08", border: "1px solid #ffffff18",
                        color: "#ffffff44", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", letterSpacing: "0.06em",
                      }}>
                        ✕ Clear selection
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Hand */}
          <div style={{
            background: "#ffffff06",
            border: "1px solid #ffffff10",
            borderRadius: 14,
            padding: "14px 18px",
          }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.16em", color: "#ffffff33", marginBottom: 14 }}>
              Your Hand - {hand.length} tiles
            </div>
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 10,
              opacity: animating ? 0.4 : 1,
              transition: "opacity 0.3s",
            }}>
              {(() => {
                const selIds = new Set(selected.map(s => s.id));
                return hand.map(tile => (
                  <Tile
                    key={tile.id}
                    tile={tile}
                    selected={selIds.has(tile.id)}
                    highlighted={highlightIds.has(tile.id)}
                    autoPulse={autoPulseIds.has(tile.id) && !selIds.has(tile.id) && !highlightIds.has(tile.id)}
                    onClick={toggleTile}
                    onCycleVariant={cycleVariant}
                    onHover={handleTileHover}
                    disabled={animating}
                    theme={settings.tileTheme}
                    animated={settings.tileAnimations}
                    showLabel={settings.soundLabels}
                  />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right Panel - compact controls */}
        <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>

          {/* End Round */}
          <button
            onClick={endRound}
            disabled={words.length === 0 || animating}
            style={{
              width: "100%", padding: "14px",
              borderRadius: 12,
              background: words.length > 0 && !animating
                ? "linear-gradient(135deg, #E84855, #c0192a)"
                : "#ffffff08",
              border: words.length > 0 && !animating
                ? "1px solid #E8485566" : "1px solid #ffffff12",
              color: words.length > 0 && !animating ? "#fff" : "#ffffff28",
              fontSize: 14, fontWeight: 700,
              cursor: words.length > 0 && !animating ? "pointer" : "default",
              letterSpacing: "0.08em", textTransform: "uppercase",
              transition: "all 0.2s",
            }}
          >
            {animating ? "Dealing…" : "🀄 End Round"}
          </button>

          {/* Hint - 3 charges per round */}
          <div>
            {/* Charge dots */}
            <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 8 }}>
              {Array.from({ length: MAX_HINTS }).map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: i < hintsLeft ? "#C77DFF" : "#ffffff18",
                  boxShadow: i < hintsLeft ? "0 0 6px #C77DFF88" : "none",
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
            <button
              onClick={findHints}
              disabled={hintLoading || animating || hintsLeft <= 0}
              style={{
                width: "100%", padding: "11px",
                borderRadius: 12,
                background: hintsLeft > 0
                  ? "linear-gradient(135deg, #C77DFF22, #C77DFF11)"
                  : "#ffffff05",
                border: hintsLeft > 0 ? "1px solid #C77DFF55" : "1px solid #ffffff0f",
                color: hintsLeft > 0 ? "#e4acff" : "#ffffff22",
                fontSize: 13, fontWeight: 700,
                cursor: hintLoading || animating || hintsLeft <= 0 ? "default" : "pointer",
                letterSpacing: "0.06em",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                opacity: hintLoading ? 0.7 : 1, transition: "all 0.2s",
                marginBottom: showHint ? 10 : 0,
              }}
            >
              {hintLoading
                ? <><span style={{ display:"inline-block", animation:"spin 0.8s linear infinite" }}>⟳</span> Searching…</>
                : hintsLeft <= 0
                ? "💡 No Hints Left"
                : `💡 Best Hint (${hintsLeft} left)`}
            </button>

            {showHint && hintWords.length > 0 && (
              <div style={{
                background: "#C77DFF0d", border: "1px solid #C77DFF22",
                borderRadius: 10, padding: "10px 12px",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em", color: "#C77DFF77" }}>
                  Best word found - tiles glowing ✦
                </div>
                {hintWords.map((h, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    background: "#C77DFF18", border: "1px solid #C77DFF33",
                    borderRadius: 8, padding: "6px 10px",
                  }}>
                    <span style={{
                      fontFamily: "'Noto Serif SC', serif", color: "#e4acff",
                      fontWeight: 800, fontSize: 16, letterSpacing: "0.04em",
                    }}>{h.word}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C77DFF", fontFamily: "monospace" }}>
                      +{h.pts}pt{h.pts !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 9, color: "#ffffff28", fontStyle: "italic", textAlign: "center" }}>
                  Tiles glow for 3.5s
                </div>
              </div>
            )}

            {/* Auto-pulse legend */}
            <div style={{
              marginTop: 8, padding: "7px 10px",
              background: "#C77DFF08", borderRadius: 8, border: "1px solid #C77DFF18",
              fontSize: 9, color: "#C77DFF55", letterSpacing: "0.08em", textAlign: "center",
            }}>
              ✦ Purple pulse = short word hiding in your tiles
            </div>
          </div>

          {/* Category Legend */}
          <div style={{
            background: "#ffffff05", border: "1px solid #ffffff0d",
            borderRadius: 14, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", color: "#ffffff28", marginBottom: 10 }}>
              Tile Categories
            </div>
            {catLegend.map(([key, cat]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 3, background: cat.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: "#ffffff55" }}>{cat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <WordSmokeCanvas words={smokeWords} onWordDone={removeWord} />
      {cheerKey > 0 && <CheerBurst key={cheerKey} />}

      {/* -- GAME OVER OVERLAY - no more words possible ----------------------- */}
      {gameOver && (() => {
        const finalWords = [...allWordsScored, ...words];
        const totalPts = finalWords.reduce((s, w) => s + w.pts, 0);
        const longestWord = finalWords.reduce((a, b) => b.word.length > a.length ? b.word : a, "");
        const bestWord = finalWords.reduce((a, b) => b.pts > a.pts ? b : a, { word: "-", pts: 0 });
        const avgLen = finalWords.length ? (finalWords.reduce((s, w) => s + w.word.length, 0) / finalWords.length).toFixed(1) : "0";
        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 500,
            background: "#000000cc",
            backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            animation: "fadeIn 0.4s ease",
          }}>
            <div style={{
              background: "#13131f",
              border: "1px solid #f0c06033",
              borderRadius: 24,
              padding: "40px 44px",
              maxWidth: 520, width: "90%",
              maxHeight: "85vh", overflowY: "auto",
              boxShadow: "0 40px 100px #000000dd, 0 0 0 1px #f0c06022",
              animation: "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>🀄</div>
              <div style={{
                fontFamily: "'Noto Serif SC', serif",
                fontSize: 30, fontWeight: 900, color: "#f0c060",
                letterSpacing: "0.04em", marginBottom: 6,
              }}>Game Over</div>
              <div style={{
                fontSize: 13, color: "#ffffff44",
                letterSpacing: "0.14em", textTransform: "uppercase",
                marginBottom: 32,
              }}>
                No more words possible with your tiles
              </div>

              {/* Score hero */}
              <div style={{
                background: "linear-gradient(135deg, #f0c06022, #f0c06008)",
                border: "1px solid #f0c06033",
                borderRadius: 16, padding: "20px 28px",
                marginBottom: 24,
              }}>
                <div style={{ fontSize: 11, color: "#f0c06077", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 6 }}>Final Score</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#f0c060", fontFamily: "monospace", lineHeight: 1 }}>{totalPts}</div>
                <div style={{ fontSize: 12, color: "#ffffff44", marginTop: 6 }}>across {round} round{round !== 1 ? "s" : ""}</div>
              </div>

              {/* Stats grid */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 10, marginBottom: 28,
              }}>
                {[
                  { label: "Words Scored", value: finalWords.length, color: "#9EF01A" },
                  { label: "Avg Word Length", value: avgLen, color: "#2EC4B6" },
                  { label: "Longest Word", value: longestWord || "-", color: "#C77DFF" },
                  { label: "Best Word", value: bestWord.word !== "-" ? `${bestWord.word} (+${bestWord.pts})` : "-", color: "#F4A261" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "#ffffff06", border: "1px solid #ffffff0f",
                    borderRadius: 12, padding: "12px 14px", textAlign: "left",
                  }}>
                    <div style={{ fontSize: 9, color: "#ffffff33", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'Noto Serif SC', serif" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Words played scroll */}
              {finalWords.length > 0 && (
                <div style={{
                  background: "#ffffff05", border: "1px solid #ffffff0a",
                  borderRadius: 12, padding: "12px 14px",
                  maxHeight: 120, overflowY: "auto",
                  marginBottom: 24, textAlign: "left",
                }}>
                  <div style={{ fontSize: 9, color: "#ffffff28", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>All Words Played</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {finalWords.map((w, i) => (
                      <span key={i} style={{
                        fontFamily: "'Noto Serif SC', serif", fontSize: 13, fontWeight: 700,
                        color: w.hinted ? "#ffbe85" : "#c8ff5a",
                        background: w.hinted ? "#F4A2610d" : "#9EF01A0d",
                        border: w.hinted ? "1px solid #F4A26133" : "1px solid #9EF01A22",
                        borderRadius: 14, padding: "2px 9px",
                      }}>{w.word}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                <button onClick={resetGame} style={{
                  padding: "13px 32px", borderRadius: 12,
                  background: "linear-gradient(135deg, #f0c060, #e8963a)",
                  border: "none", color: "#1a0e04",
                  fontSize: 14, fontWeight: 800,
                  cursor: "pointer", letterSpacing: "0.08em",
                  boxShadow: "0 4px 20px #f0c06044",
                }}>🔄 Play Again</button>
                {onBackToTitle && (
                  <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{
                    padding: "13px 24px", borderRadius: 12,
                    background: "#ffffff08", border: "1px solid #ffffff18",
                    color: "#ffffff66", fontSize: 14, fontWeight: 700,
                    cursor: "pointer", letterSpacing: "0.06em",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>🚪 Home</button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function btnStyle(bg: string, darkBg: string, textColor?: string) {
  return {
    padding: "8px 18px",
    borderRadius: 9,
    background: `linear-gradient(135deg, ${bg}33, ${bg}18)`,
    border: `1px solid ${bg}66`,
    color: textColor || bg,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: "0.06em",
    transition: "all 0.15s",
  };
}

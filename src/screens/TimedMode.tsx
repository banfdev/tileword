import { useState, useEffect, useCallback, useRef } from 'react';
import { useWindowSize } from '../hooks/useWindowSize';
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

type ScoredWord = { word: string; pts: number; tiles: TileData[]; hinted: boolean; originalPts: number };

// --- TIMED MODE ---------------------------------------------------------------
const TIME_OPTIONS = [
  { label: "1 min",  seconds: 60 },
  { label: "2 min",  seconds: 120 },
  { label: "5 min",  seconds: 300 },
  { label: "10 min", seconds: 600 },
];

type GameProps = { onBackToTitle: () => void; settings?: Settings };

export function TimedMode({ onBackToTitle, settings = DEFAULT_SETTINGS }: GameProps) {
  const vw = useWindowSize();
  const isMobile = vw < 640;
  // screens: "pick" | "play" | "done"
  const [phase, setPhase] = useState("pick");
  const [chosenTime, setChosenTime] = useState(120);
  const [timeLeft, setTimeLeft] = useState(120);
  const [hand, setHand] = useState<TileData[]>([]);
  const [deck, setDeck] = useState<TileData[]>([]);
  const [deckIndex, setDeckIndex] = useState(0);
  const [selected, setSelected] = useState<TileData[]>([]);
  const [invalidShake, setInvalidShake] = useState(false);
  const [wordsScored, setWordsScored] = useState<ScoredWord[]>([]);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [smokeWords, setSmokeWords] = useState<SmokeWordData[]>([]);
  const [smokeEnabled, setSmokeEnabled] = useState(settings.smokeEffect);
  const [timedCheerKey, setTimedCheerKey] = useState(0);
  const [highlightIds, setHighlightIds] = useState(new Set<number>());
  const [hintWords, setHintWords] = useState<Array<{ word: string; tileIds: number[] }>>([]);
  const [showHint, setShowHint] = useState(false);
  const [challengeWord, setChallengeWord] = useState<{ word: string; tiles: TileData[] } | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spawnTimerRef = useRef<{ interval: ReturnType<typeof setInterval> | null; t1: ReturnType<typeof setTimeout> | null; t2: ReturnType<typeof setTimeout> | null }>({ interval: null, t1: null, t2: null });
  const hoverTileRef = useRef<TileData | null>(null);
  const usedRecentlyRef = useRef(new Set<string>());
  const msgTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Refs for synchronous access in makeWord (avoid stale closures)
  const deckRef = useRef<TileData[]>([]);
  const deckIndexRef = useRef(0);
  const handRef = useRef<TileData[]>([]);

  // -- Start game --------------------------------------------------------------
  const startGame = (secs: number) => {
    if (settings.soundEffects > 0) AudioEngine.play("gameStart");
    if (settings.soundEffects > 0) setTimeout(() => AudioEngine.play("dealTiles"), 400);
    const d = shuffle(buildDeck());
    deckRef.current = d;
    deckIndexRef.current = 24;
    handRef.current = d.slice(0, 24);
    setDeck(d);
    setHand(d.slice(0, 24));
    setDeckIndex(24);
    setChosenTime(secs);
    setTimeLeft(secs);
    setSelected([]);
    setWordsScored([]);
    setScore(0);
    setMessage({ text: "", type: "" });
    setHintWords([]);
    setShowHint(false);
    setPhase("play");
  };

  // Keep refs in sync with state
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { deckIndexRef.current = deckIndex; }, [deckIndex]);
  useEffect(() => { handRef.current = hand; }, [hand]);

  // Music lifecycle
  useEffect(() => {
    AudioEngine.startMusic();
    return () => AudioEngine.stopMusic();
  }, []);
  useEffect(() => {
    AudioEngine.setMusicVolume(settings.ambientMusic);
  }, [settings.ambientMusic]);
  useEffect(() => {
    AudioEngine.setSfxVolume(settings.soundEffects);
  }, [settings.soundEffects]);

  // -- Countdown ---------------------------------------------------------------
  useEffect(() => {
    if (phase !== "play") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current ?? undefined);
          setPhase("done");
          if (settings.soundEffects > 0) { AudioEngine.play("timeUp"); AudioEngine.play("sessionEnd"); }
          return 0;
        }
        if (t <= 10 && settings.soundEffects > 0) AudioEngine.play("timerTick");
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current ?? undefined);
  }, [phase]);

  const fmt = (s: number) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const pct = timeLeft / chosenTime;
  const timerColor = pct > 0.5 ? "#9EF01A" : pct > 0.25 ? "#F4A261" : "#E84855";

  // -- Message -----------------------------------------------------------------
  const showMsg = (text: string, type = "info") => {
    if (msgTimeout.current) clearTimeout(msgTimeout.current);
    setMessage({ text, type });
    msgTimeout.current = setTimeout(() => setMessage({ text: "", type: "" }), 2500);
  };

  // -- Tile interactions --------------------------------------------------------
  const toggleTile = (tile: TileData) => {
    if (settings.soundEffects > 0) AudioEngine.play("tileClick");
    setSelected(prev => {
      const already = prev.findIndex(t => t.id === tile.id);
      if (already !== -1) return prev.filter((_, i) => i !== already);
      if (prev.some(t => t.id === tile.id)) return prev;
      return [...prev, tile];
    });
  };

  const cycleVariant = (tile: TileData) => {
    if (settings.soundEffects > 0) AudioEngine.play("tileCycle");
    const cycle = (t: TileData) => (!t.variants || t.id !== tile.id) ? t
      : { ...t, activeVariant: (t.activeVariant + 1) % t.variants.length };
    setHand(prev => prev.map(cycle));
    setSelected(prev => prev.map(cycle));
  };

  // -- Make Word (check + score in one step) -----------------------------------
  const scoreTimedWord = (word: string, tiles: TileData[]) => {
    if (settings.soundEffects > 0) AudioEngine.play("wordCorrect");
    const catBonus: Record<string, number> = { specials:5, r_vowel:4, double_vowel:3, others:2, main_consonants:1, open_vowel:1, closed_vowel:1 };
    const basePts = tiles.reduce((acc, t) => {
      return acc + (catBonus[t.category] ?? 1);
    }, 0) * word.length;
    const usedHint = settings.hintPenalty && showHint && hintWords.some(h => h.word === word);
    const pts = usedHint ? Math.max(1, Math.floor(basePts / 2)) : basePts;
    if (settings.cheerEffect) setTimedCheerKey(k => k + 1);
    setWordsScored(prev => [...prev, { tiles, word, pts, hinted: usedHint, originalPts: basePts }]);
    setScore(s => s + pts);
    // Replace used tiles via refs to avoid stale closures
    const usedIds = new Set(tiles.map(t => t.id));
    const currentDeck = deckRef.current;
    let idx = deckIndexRef.current;
    const remaining = handRef.current.filter(t => !usedIds.has(t.id));
    const needed = 24 - remaining.length;
    const newTiles = [];
    for (let i = 0; i < needed; i++) {
      if (idx >= currentDeck.length) idx = 0;
      const src = currentDeck[idx++];
      newTiles.push(parseTile(src.text, src.category, freshTileId()));
    }
    deckIndexRef.current = idx;
    const nextHand = [...remaining, ...newTiles];
    handRef.current = nextHand;
    setHand(nextHand);
    showMsg(`+${pts} pts! "${word}" scored!`, "success");
    setSelected([]);
    setHintWords([]);
    setShowHint(false);
    setChallengeWord(null);
  };

  const makeWord = () => {
    if (selected.length === 0) { showMsg("Select some tiles first!", "warn"); return; }
    const word = buildWordFromTiles(selected);
    if (word.length < 2) { showMsg("Too short!", "warn"); return; }
    if (wordsScored.find(w => w.word === word)) { showMsg(`"${word}" already scored!`, "warn"); return; }
    if (!checkWordInSet(word)) {
      if (settings.soundEffects > 0) AudioEngine.play("wordWrong");
      setChallengeWord({ word, tiles: [...selected] });
      return;
    }
    scoreTimedWord(word, selected);
  };

  const acceptTimedChallenge = () => {
    if (!challengeWord) return;
    addCustomWord(challengeWord.word);
    scoreTimedWord(challengeWord.word, challengeWord.tiles);
  };

  const rejectTimedChallenge = () => {
    setChallengeWord(null);
    setInvalidShake(true);
    setTimeout(() => { setInvalidShake(false); setSelected([]); }, 600);
  };

  const clearSelection = () => { setSelected([]); };

  // -- AUTO-MAKE WORD (timed mode) ----------------------------------------------
  useEffect(() => {
    if (!settings.autoMakeWord || phase !== "play" || selected.length < 1) return;
    const word = buildWordFromTiles(selected);
    if (word.length < 2 || !checkWordInSet(word)) return;
    if (wordsScored.find(w => w.word === word)) return;
    const t = setTimeout(() => { makeWord(); }, 320);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, settings.autoMakeWord, phase]);

  // -- Hint --------------------------------------------------------------------
  const findHints = () => {
    const tileSounds = hand.map(tile => tile.variants
      ? tile.variants.map(v => ({ sound: v, tile }))
      : [{ sound: tile.text.replace(/-/g,""), tile }]);
    const found: Array<{ word: string; tileIds: number[] }> = [];
    const used = new Set(wordsScored.map(w => w.word));

    function matchWord(word: string, pos: number, usedFlags: boolean[], ids: number[]): { ok: boolean; ids: number[] } {
      if (pos === word.length) return { ok: true, ids: [...ids] };
      for (let i = 0; i < tileSounds.length; i++) {
        if (usedFlags[i]) continue;
        for (const { sound, tile } of tileSounds[i]) {
          if (word.slice(pos, pos + sound.length) === sound) {
            usedFlags[i] = true; ids.push(tile.id);
            const r = matchWord(word, pos + sound.length, usedFlags, ids);
            if (r.ok) return r;
            ids.pop(); usedFlags[i] = false;
          }
        }
      }
      return { ok: false, ids: [] };
    }

    const allWords = [...WORD_LIST, ...SESSION_CUSTOM_WORDS];
    for (const word of allWords) {
      if (found.length >= 6) break;
      if (word.length < 2 || used.has(word)) continue;
      const r = matchWord(word, 0, new Array(tileSounds.length).fill(false), []);
      if (r.ok) found.push({ word, tileIds: r.ids });
    }
    setHintWords(found);
    setShowHint(true);
    if (found.length === 0) showMsg("No obvious words found - try cycling tiles!", "warn");
  };

  const highlightHint = (hint: { word: string; tileIds: number[] }) => {
    if (settings.soundEffects > 0) AudioEngine.play("hintReveal");
    setHighlightIds(new Set(hint.tileIds));
    setTimeout(() => setHighlightIds(new Set()), 3000);
  };

  // -- Smoke -------------------------------------------------------------------
  const removeWord = useCallback((id: number) => setSmokeWords(prev => prev.filter(w => w.id !== id)), []);
  const handleTileHover = useCallback((tile: TileData | null, x: number, y: number) => {
    clearInterval(spawnTimerRef.current.interval ?? undefined);
    clearTimeout(spawnTimerRef.current.t1 ?? undefined);
    clearTimeout(spawnTimerRef.current.t2 ?? undefined);
    if (!tile || !smokeEnabled) { hoverTileRef.current = null; return; }
    hoverTileRef.current = tile;
    const color = TILE_CATEGORIES[tile.category].color;
    const wordPool = getWordsForSound(getTileSound(tile));
    if (!wordPool.length) return;
    const spawnOne = () => {
      if (!hoverTileRef.current) return;
      let word: string | undefined;
      for (let i=0;i<12;i++){
        word=wordPool[Math.floor(Math.random()*wordPool.length)];
        if(!usedRecentlyRef.current.has(word)) break;
      }
      if (!word) return;
      usedRecentlyRef.current.add(word);
      if(usedRecentlyRef.current.size>8){const f=usedRecentlyRef.current.values().next().value as string;usedRecentlyRef.current.delete(f);}
      setSmokeWords(prev=>[...prev.slice(-16),makeSmokeWord(word!,x,y,color)]);
    };
    spawnOne();
    spawnTimerRef.current.t1=setTimeout(()=>{if(hoverTileRef.current)spawnOne();},700);
    spawnTimerRef.current.t2=setTimeout(()=>{if(hoverTileRef.current)spawnOne();},1400);
    spawnTimerRef.current.interval=setInterval(spawnOne,1100);
  }, [smokeEnabled]);

  // -- Stats for end screen ----------------------------------------------------
  const longestWord = wordsScored.reduce((a,b)=>b.word.length>a.length?b.word:a,"");
  const bestWord = wordsScored.reduce((a,b)=>b.pts>a.pts?b:a,{word:"-",pts:0});
  const avgLen = wordsScored.length ? (wordsScored.reduce((s,w)=>s+w.word.length,0)/wordsScored.length).toFixed(1) : 0;

  // --- PICK SCREEN -------------------------------------------------------------
  if (phase === "pick") return (
    <div style={{
      minHeight:"100vh", background:"#0d0d14",
      backgroundImage:"radial-gradient(ellipse at 30% 40%, #2a0a0a66 0%,transparent 55%),radial-gradient(ellipse at 75% 70%, #0a1a2e55 0%,transparent 55%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#e0e0f0",
    }}>
      <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}} @keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{textAlign:"center",animation:"slideUp 0.6s ease both"}}>
        <div style={{fontSize:48,marginBottom:12}}>⏱</div>
        <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:36,fontWeight:900,color:"#E84855",marginBottom:6,letterSpacing:"0.04em"}}>Timed Mode</div>
        <div style={{fontSize:13,color:"#ffffff55",marginBottom:40,letterSpacing:"0.12em",textTransform:"uppercase"}}>24 tiles · Auto-replace · Race the clock</div>

        <div style={{fontSize:13,color:"#ffffff77",marginBottom:18,letterSpacing:"0.1em",textTransform:"uppercase"}}>Choose your time limit</div>
        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap",marginBottom:44}}>
          {TIME_OPTIONS.map(opt => (
            <button key={opt.seconds} onClick={()=>startGame(opt.seconds)} style={{
              padding:"18px 28px", borderRadius:14,
              background: "linear-gradient(135deg,#E8485522,#E8485511)",
              border:"2px solid #E8485566",
              color:"#ff6b78", fontSize:18, fontWeight:800,
              cursor:"pointer", letterSpacing:"0.06em",
              transition:"all 0.2s", fontFamily:"'Noto Serif SC',serif",
              boxShadow:"0 4px 24px #E8485522",
            }}
            onMouseEnter={e=>{e.currentTarget.style.background="linear-gradient(135deg,#E8485544,#E8485522)";e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 10px 32px #E8485544";}}
            onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,#E8485522,#E8485511)";e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 24px #E8485522";}}>
              {opt.label}
            </button>
          ))}
        </div>
        <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{
          background:"#ffffff0a",border:"1px solid #ffffff15",color:"#ffffff88",
          borderRadius:10,padding:"9px 18px",cursor:"pointer",fontSize:12,fontWeight:700,
          display:"flex",alignItems:"center",gap:6,margin:"0 auto",letterSpacing:"0.06em",
        }}>🚪 Home</button>
      </div>
    </div>
  );

  // --- END SCREEN --------------------------------------------------------------
  if (phase === "done") return (
    <div style={{
      minHeight:"100vh", background:"#0d0d14",
      backgroundImage:"radial-gradient(ellipse at 50% 40%, #1a0a2e88 0%,transparent 60%)",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"'Segoe UI',system-ui,sans-serif", color:"#e0e0f0",
    }}>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
      <div style={{
        background:"#13131f", border:"1px solid #ffffff18", borderRadius:24,
        padding:"40px 44px", maxWidth:520, width:"90%",
        boxShadow:"0 40px 100px #000000cc",
        animation:"popIn 0.5s cubic-bezier(0.16,1,0.3,1) both",
        textAlign:"center",
      }}>
        <div style={{fontSize:52,marginBottom:8}}>🏁</div>
        <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:30,fontWeight:900,color:"#f0c060",marginBottom:4}}>Time's Up!</div>
        <div style={{fontSize:12,color:"#ffffff44",letterSpacing:"0.14em",textTransform:"uppercase",marginBottom:32}}>
          {fmt(chosenTime)} game · {wordsScored.length} word{wordsScored.length!==1?"s":""} scored
        </div>

        {/* Big score */}
        <div style={{
          background:"linear-gradient(135deg,#f0c06022,#f0c06008)",
          border:"1px solid #f0c06033", borderRadius:16,
          padding:"20px", marginBottom:20,
        }}>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:"0.14em",color:"#f0c06088",marginBottom:4}}>Final Score</div>
          <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:56,fontWeight:900,color:"#f0c060",lineHeight:1}}>{score}</div>
          <div style={{fontSize:12,color:"#f0c06066",marginTop:4}}>{wordsScored.length>0?`${(score/wordsScored.length).toFixed(1)} pts / word`:""}</div>
        </div>

        {/* Stat grid */}
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"1fr 1fr 1fr",gap:12,marginBottom:24}}>
          {[
            ["Words", wordsScored.length],
            ["Best Word", bestWord.word!=="-"?`${bestWord.word} (+${bestWord.pts})`:"-"],
            ["Longest", longestWord||"-"],
            ["Avg Length", avgLen||"-"],
            ["Top Score", bestWord.pts||0],
            ["Letters", wordsScored.reduce((s,w)=>s+w.word.length,0)],
          ].map(([label,val],i)=>(
            <div key={i} style={{
              background:"#ffffff08",border:"1px solid #ffffff0f",
              borderRadius:12,padding:"12px 10px",
            }}>
              <div style={{fontSize:10,color:"#ffffff44",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{label}</div>
              <div style={{fontSize:14,fontWeight:700,color:"#e0e0f0",fontFamily:"'Noto Serif SC',serif"}}>{val}</div>
            </div>
          ))}
        </div>

        {/* Words list */}
        {wordsScored.length > 0 && (
          <div style={{
            background:"#9EF01A0a",border:"1px solid #9EF01A18",
            borderRadius:12,padding:"14px 16px",marginBottom:24,
            maxHeight:130,overflowY:"auto",textAlign:"left",
          }}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.12em",color:"#9EF01A77",marginBottom:10}}>Words Scored</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {wordsScored.map((w,i)=>(
                <span key={i} style={{
                  background:w.hinted?"#F4A26115":"#9EF01A15",
                  border:w.hinted?"1px solid #F4A26133":"1px solid #9EF01A33",
                  borderRadius:6, padding:"3px 9px",
                  color:w.hinted?"#ffbe85":"#c8ff5a", fontSize:12, fontWeight:700,
                  fontFamily:"'Noto Serif SC',serif",
                  display:"inline-flex", alignItems:"center", gap:4,
                }}>
                  {w.word}{w.hinted?" 💡":""}
                  {w.hinted&&w.originalPts&&<span style={{opacity:0.4,fontSize:10,textDecoration:"line-through"}}>{w.originalPts}</span>}
                  <span style={{opacity:0.6,fontSize:10}}>+{w.pts}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:12,justifyContent:"center"}}>
          <button onClick={()=>startGame(chosenTime)} style={{
            padding:"12px 28px",borderRadius:12,
            background:"linear-gradient(135deg,#E84855,#c0192a)",
            border:"1px solid #E8485566",color:"#fff",
            fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",
          }}>▶ Play Again</button>
          <button onClick={()=>setPhase("pick")} style={{
            padding:"12px 28px",borderRadius:12,
            background:"#ffffff0a",border:"1px solid #ffffff18",
            color:"#ffffff77",fontSize:14,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",
          }}>⏱ Change Time</button>
          <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{
            padding:"12px 18px",borderRadius:12,
            background:"#ffffff06",border:"1px solid #ffffff12",
            color:"#ffffff88",fontSize:13,fontWeight:700,cursor:"pointer",
            display:"flex",alignItems:"center",gap:6,letterSpacing:"0.06em",
          }}>🚪 Home</button>
        </div>
      </div>
    </div>
  );

  // --- PLAY SCREEN -------------------------------------------------------------
  const wordPreview = selected.map(t=>getTileSound(t)).join("").toLowerCase();
  const msgColors: Record<string, string> = {success:"#c8ff5a",error:"#ff6b78",warn:"#ffbe85",info:"#5de8e0"};
  const msgBg: Record<string, string> = {success:"#9EF01A22",error:"#E8485522",warn:"#F4A26122",info:"#2EC4B622"};

  const _th = TILE_THEMES[settings.tileTheme] || TILE_THEMES.neon;
  return (
    <div style={{
      minHeight:"100vh",
      background: _th.pageBg,
      backgroundImage: _th.pageBgImage ? "radial-gradient(ellipse at 20% 20%,#1a0a2e44 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,#0a1a2e44 0%,transparent 50%),repeating-linear-gradient(0deg,transparent,transparent 60px,#ffffff03 60px,#ffffff03 61px),repeating-linear-gradient(90deg,transparent,transparent 60px,#ffffff03 60px,#ffffff03 61px)" : "none",
      fontFamily:"'Segoe UI',system-ui,sans-serif",
      color: _th.pageText,
      paddingBottom:40, transition:"background 0.4s",
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes smokeRise{0%{opacity:0;transform:translateX(-50%) translateY(0)}12%{opacity:0.85}80%{opacity:0.6}100%{opacity:0;transform:translateX(-50%) translateY(-160px)}} @keyframes timerPulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{
        borderBottom:`1px solid ${_th.headerBorder}`,background:_th.headerBg,
        backdropFilter:"blur(12px)",padding: isMobile ? "10px 14px" : "12px 24px",
        display:"flex",alignItems:"center",justifyContent:"space-between",
        position:"sticky",top:0,zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap: isMobile ? 8 : 12}}>
          <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{
            background:"#ffffff08",border:"1px solid #ffffff18",
            color:"#ffffff88",borderRadius:10,padding:"7px 14px",
            cursor:"pointer",fontSize:12,fontWeight:700,
            display:"flex",alignItems:"center",gap:6,
            flexShrink:0,transition:"all 0.15s",letterSpacing:"0.06em",
          }}>🚪{!isMobile && " Home"}</button>
          {!isMobile && <div style={{fontSize:22}}>⏱</div>}
          {!isMobile && (
            <div>
              <div style={{fontFamily:"'Noto Serif SC',serif",fontSize:18,fontWeight:800,color:"#E84855",letterSpacing:"0.06em"}}>Timed Mode</div>
              <div style={{fontSize:10,color:"#ffffff44",letterSpacing:"0.1em",textTransform:"uppercase"}}>24 tiles · Auto-replace</div>
            </div>
          )}
        </div>

        {/* Big countdown */}
        <div style={{
          fontFamily:"monospace",fontSize: isMobile ? 28 : 38,fontWeight:900,
          color:timerColor,letterSpacing:"0.1em",
          textShadow:`0 0 20px ${timerColor}88`,
          animation: pct < 0.17 ? "timerPulse 0.8s ease infinite" : "none",
          transition:"color 0.5s",
        }}>{fmt(timeLeft)}</div>

        <div style={{display:"flex",gap: isMobile ? 8 : 14,alignItems:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,color:"#ffffff44",textTransform:"uppercase",letterSpacing:"0.1em"}}>Score</div>
            <div style={{fontSize: isMobile ? 18 : 22,fontWeight:700,color:"#9EF01A",fontFamily:"monospace"}}>{score}</div>
          </div>
          <div style={{width:1,height:32,background:"#ffffff15"}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:10,color:"#ffffff44",textTransform:"uppercase",letterSpacing:"0.1em"}}>Words</div>
            <div style={{fontSize: isMobile ? 18 : 22,fontWeight:700,color:"#f0c060",fontFamily:"monospace"}}>{wordsScored.length}</div>
          </div>
          {!isMobile && (
            <>
              <div style={{width:1,height:32,background:"#ffffff15"}}/>
              <button onClick={()=>setSmokeEnabled(v=>!v)} style={{
                background:smokeEnabled?"linear-gradient(135deg,#2EC4B622,#2EC4B611)":"#ffffff08",
                border:smokeEnabled?"1px solid #2EC4B655":"1px solid #ffffff18",
                color:smokeEnabled?"#5de8e0":"#ffffff33",
                borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:11,
                fontWeight:700,transition:"all 0.2s",letterSpacing:"0.06em",
              }}>{smokeEnabled?"💨 ON":"💨 OFF"}</button>
            </>
          )}
        </div>
      </div>

      {/* Timer bar */}
      <div style={{height:3,background:"#ffffff0a",position:"relative"}}>
        <div style={{
          position:"absolute",left:0,top:0,height:"100%",
          width:`${pct*100}%`,
          background:`linear-gradient(90deg,${timerColor}88,${timerColor})`,
          transition:"width 1s linear, background 0.5s",
          boxShadow:`0 0 8px ${timerColor}88`,
        }}/>
      </div>

      {/* Message */}
      {message.text && (
        <div style={{
          margin: isMobile ? "8px 14px 0" : "10px 20px 0",padding:"9px 16px",borderRadius:10,
          background:msgBg[message.type]||"#ffffff11",
          border:`1px solid ${(msgBg[message.type]||"#ffffff22").replace("22","55")}`,
          fontSize:13,color:msgColors[message.type]||"#e0e0f0",fontWeight:500,
        }}>{message.text}</div>
      )}

      <div style={{display:"flex",flexDirection: isMobile ? "column" : "row",gap:18,padding: isMobile ? "10px 14px 0" : "16px 20px 0",alignItems:"flex-start"}}>
        {/* Main area */}
        <div style={{flex:1}}>
          {/* Word builder */}
          <div style={{background:"#ffffff06",border:"1px solid #ffffff10",borderRadius:14,padding:"14px 18px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.14em",color:"#ffffff44"}}>
                Word Builder - {selected.length} tile{selected.length!==1?"s":""}
              </div>
              <div style={{fontSize:10,color:settings.autoMakeWord?"#9EF01A88":"#ffffff22",letterSpacing:"0.1em"}}>
                {settings.autoMakeWord ? "⚡ Auto-on" : "Manual mode"}
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:7,minHeight:48,alignItems:"center",background:"#ffffff03",borderRadius:10,padding:"8px 10px",border:selected.length>0?"1px solid #ffffff14":"1px dashed #ffffff0a",marginBottom:selected.length>0?8:0}}>
              {selected.length===0
                ? <div style={{color:"#ffffff18",fontSize:13,fontStyle:"italic"}}>Click tiles below…</div>
                : selected.map(t=><Tile key={t.id} tile={t} selected onClick={()=>toggleTile(t)} onCycleVariant={cycleVariant} onHover={handleTileHover} small theme={settings.tileTheme}/>)
              }
            </div>
            {selected.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginTop:8}}>
                <div style={{flex:1,fontFamily:"'Noto Serif SC',serif",color:"#f0c060",fontWeight:800,fontSize:20,letterSpacing:"0.04em"}}>{wordPreview}</div>
                {!settings.autoMakeWord && (
                  <button onClick={makeWord} style={{padding:"7px 16px",borderRadius:9,background:"linear-gradient(135deg,#9EF01A33,#9EF01A18)",border:"1px solid #9EF01A66",color:"#c8ff5a",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",animation:invalidShake?"shake 0.5s ease":"none"}}>
                    ✓ Make Word
                  </button>
                )}
                {settings.autoMakeWord && invalidShake && (
                  <div style={{padding:"5px 12px",borderRadius:9,background:"#E8485522",border:"1px solid #E8485566",color:"#ff6b78",fontSize:12,fontWeight:700,animation:"shake 0.5s ease"}}>✕ Not a word</div>
                )}
                <button onClick={clearSelection} style={{padding:"7px 14px",borderRadius:9,background:"#ffffff08",border:"1px solid #ffffff18",color:"#ffffff55",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em"}}>
                  ✕ Clear
                </button>
              </div>
            )}

            {/* Challenge prompt for timed mode */}
            {challengeWord && (
              <div style={{
                marginTop: 12,
                background: "linear-gradient(135deg, #F4A26114, #F4A26108)",
                border: "1px solid #F4A26155",
                borderRadius: 12, padding: "12px 14px",
                animation: "fadeIn 0.2s ease",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontSize: 18, lineHeight: 1 }}>🤔</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#ffbe85", marginBottom: 2 }}>
                      "<span style={{ fontFamily: "'Noto Serif SC', serif" }}>{challengeWord.word}</span>" isn't in our list
                    </div>
                    <div style={{ fontSize: 11, color: "#ffffff44", marginBottom: 8 }}>Real word? Add it and score, or clear.</div>
                    <div style={{ display: "flex", gap: 7 }}>
                      <button onClick={acceptTimedChallenge} style={{
                        padding:"5px 12px", borderRadius:8,
                        background:"#F4A26133", border:"1px solid #F4A26177",
                        color:"#ffbe85", fontSize:11, fontWeight:800, cursor:"pointer",
                      }}>✓ Add &amp; Score</button>
                      <button onClick={rejectTimedChallenge} style={{
                        padding:"5px 10px", borderRadius:8,
                        background:"#ffffff08", border:"1px solid #ffffff18",
                        color:"#ffffff44", fontSize:11, fontWeight:700, cursor:"pointer",
                      }}>✕ Clear</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 24-tile hand - 4 rows of 6 */}
          <div style={{background:"#ffffff06",border:"1px solid #ffffff10",borderRadius:14,padding:"14px 18px"}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.14em",color:"#ffffff44",marginBottom:12}}>
              Your 24 Tiles
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:9}}>
              {(() => {
                const selIds = new Set(selected.map(s => s.id));
                return hand.map(tile => (
                  <Tile key={tile.id} tile={tile}
                    selected={selIds.has(tile.id)}
                    highlighted={highlightIds.has(tile.id)}
                    onClick={toggleTile}
                    onCycleVariant={cycleVariant}
                    onHover={handleTileHover}
                    theme={settings.tileTheme}
                    animated={settings.tileAnimations}
                    showLabel={settings.soundLabels}
                  />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div style={{width: isMobile ? "100%" : 210,flexShrink:0}}>
          {/* Hint */}
          <div style={{marginBottom:12}}>
            <button onClick={findHints} style={{
              width:"100%",padding:"10px",borderRadius:12,
              background:"linear-gradient(135deg,#C77DFF22,#C77DFF11)",
              border:"1px solid #C77DFF55",color:"#e4acff",
              fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:"0.06em",
              marginBottom:showHint&&hintWords.length>0?10:0,
            }}>💡 Hint</button>
            {showHint&&hintWords.length>0&&(
              <div style={{background:"#C77DFF0d",border:"1px solid #C77DFF22",borderRadius:10,padding:"10px 12px"}}>
                <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:"0.12em",color:"#C77DFF88",marginBottom:7}}>Click to highlight</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {hintWords.map((h,i)=>(
                    <button key={i} onClick={()=>highlightHint(h)} style={{
                      background:"#C77DFF18",border:"1px solid #C77DFF44",
                      borderRadius:6,padding:"3px 8px",color:"#e4acff",
                      fontSize:12,fontWeight:700,cursor:"pointer",
                      fontFamily:"'Noto Serif SC',serif",
                    }}>{h.word}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Words this game */}
          <div style={{background:"#ffffff06",border:"1px solid #ffffff10",borderRadius:14,padding:"14px 16px",maxHeight:420,overflowY:"auto"}}>
            <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:"0.14em",color:"#ffffff44",marginBottom:10}}>Words Scored</div>
            {wordsScored.length===0
              ? <div style={{color:"#ffffff22",fontSize:12,fontStyle:"italic"}}>No words yet…</div>
              : [...wordsScored].reverse().map((w,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:w.hinted?"#F4A2610a":"#9EF01A0f",border:w.hinted?"1px solid #F4A26133":"1px solid #9EF01A22",borderRadius:8,padding:"6px 10px",marginBottom:6}}>
                  <span style={{fontFamily:"'Noto Serif SC',serif",color:w.hinted?"#ffbe85":"#c8ff5a",fontWeight:700,fontSize:14}}>{w.word}{w.hinted?" 💡":""}</span>
                  <span style={{fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>
                    {w.hinted&&w.originalPts&&<span style={{color:"#ffffff33",textDecoration:"line-through",fontSize:10}}>{w.originalPts}</span>}
                    <span style={{color:w.hinted?"#F4A261":"#9EF01A"}}>+{w.pts}</span>
                  </span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {timedCheerKey > 0 && <CheerBurst key={timedCheerKey} />}
      <WordSmokeCanvas words={smokeWords} onWordDone={removeWord}/>
    </div>
  );
}

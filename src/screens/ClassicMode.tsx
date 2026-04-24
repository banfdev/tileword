import { useState, useEffect, useCallback, useRef } from 'react';
import { TILE_CATEGORIES, getTileSound, buildDeck, shuffle, freshTileId, parseTile } from '../data/tiles';
import { WORD_LIST, SESSION_CUSTOM_WORDS, checkWordInSet, buildWordFromTiles, addCustomWord } from '../data/words';
import { DEFAULT_SETTINGS } from '../data/settings';
import type { Settings } from '../data/settings';
import { TILE_THEMES } from '../themes/tileThemes';
import { AudioEngine } from '../audio/AudioEngine';
import { Tile } from '../components/Tile';
import { CheerBurst } from '../components/CheerBurst';
import { WordSmokeCanvas, makeSmokeWord, getWordsForSound } from '../components/WordSmokeCanvas';
import type { SmokeWordData } from '../components/WordSmokeCanvas';
import { Modal } from '../components/Modal';

// --- CLASSIC MODE -------------------------------------------------------------
// Rules: Real Mahjong adapted for phonics.
//  • Each player holds 13 tiles.
//  • On your turn: draw 1 from the deck OR claim the top discard, then discard 1.
//  • Win condition: after drawing, arrange ALL 14 tiles into valid words using
//    every tile exactly once (partition into words). Declare "Mahjong!" to win.
//  • Bots play automatically with a short thinking delay.
// -----------------------------------------------------------------------------

const BOT_NAMES  = ["Bot Bào", "Bot Lóng", "Bot Fèng"];
const BOT_COLORS = ["#E84855", "#2EC4B6", "#F4A261"];
const PLAYER_COLOR = "#f0c060";
const HAND_SIZE = 13;

import type { Tile as TileData } from '../data/tiles';

type WordGroup = { word: string; tiles: TileData[] };

// Check whether `tiles` (14 tiles) can be partitioned entirely into valid words.
// Returns the partition (array of word-groups) or null.
export function findWinningPartition(tiles: TileData[]): WordGroup[] | null {
  const tileSounds = tiles.map(tile =>
    tile.variants
      ? tile.variants.map(v => ({ sound: v, tile }))
      : [{ sound: tile.text.replace(/-/g, ""), tile }]
  );

  // Backtracking: try to assign every tile to a word
  function solve(usedFlags: boolean[], groups: WordGroup[]): WordGroup[] | null {
    const firstFree = usedFlags.indexOf(false);
    if (firstFree === -1) return groups; // all tiles used - winning hand!

    // Try every word in the dictionary
    const allWords = [...WORD_LIST, ...SESSION_CUSTOM_WORDS];
    for (const word of allWords) {
      if (word.length < 2) continue;
      // Try to match this word starting from firstFree tile
      const matchResult = tryMatch(word, usedFlags, firstFree);
      if (matchResult) {
        // Mark those tiles used and recurse
        matchResult.idxUsed.forEach(i => { usedFlags[i] = true; });
        const result = solve(usedFlags, [...groups, { word, tiles: matchResult.tilesUsed }]);
        if (result) return result;
        matchResult.idxUsed.forEach(i => { usedFlags[i] = false; });
      }
    }
    return null;
  }

  type MatchResult = { idxUsed: number[]; tilesUsed: TileData[] };
  function tryMatch(word: string, usedFlags: boolean[], mustInclude: number): MatchResult | null {
    function matchFrom(pos: number, usedLocal: boolean[], idxUsed: number[], tilesUsed: TileData[], usedMustInclude: boolean): MatchResult | null {
      if (pos === word.length) return usedMustInclude ? { idxUsed, tilesUsed } : null;
      for (let i = 0; i < tileSounds.length; i++) {
        if (usedFlags[i] || usedLocal[i]) continue;
        for (const { sound, tile } of tileSounds[i]) {
          if (word.slice(pos, pos + sound.length) === sound) {
            usedLocal[i] = true;
            const r = matchFrom(pos + sound.length, usedLocal, [...idxUsed, i], [...tilesUsed, tile], usedMustInclude || i === mustInclude);
            if (r) return r;
            usedLocal[i] = false;
          }
        }
      }
      return null;
    }
    return matchFrom(0, new Array(tileSounds.length).fill(false), [], [], false);
  }

  return solve(new Array(tiles.length).fill(false), []);
}

// Bot AI: pick up discard if it helps form a word, otherwise draw.
// Then discard the tile least useful to completing words.
export function botTakeTurn(hand: TileData[], discardTop: TileData | null) {
  const catBonus: Record<string, number> = { specials:5, r_vowel:4, double_vowel:3, others:2, main_consonants:1, open_vowel:1, closed_vowel:1 };

  function handScore(h: TileData[]) {
    let score = 0;
    const tileSounds = h.map(t => t.variants ? t.variants[t.activeVariant] : t.text.replace(/-/g,""));
    for (const word of WORD_LIST) {
      if (word.length < 2) continue;
      let pos = 0; const used = new Array(h.length).fill(false);
      let ok = true;
      while (pos < word.length) {
        let adv = false;
        for (let i = 0; i < h.length; i++) {
          if (used[i]) continue;
          const s = tileSounds[i];
          if (word.slice(pos, pos + s.length) === s) { used[i] = true; pos += s.length; adv = true; break; }
        }
        if (!adv) { ok = false; break; }
      }
      if (ok && pos === word.length) used.forEach((u, i) => { if (u) score += (catBonus[h[i].category] ?? 1); });
    }
    return score;
  }

  // Decide whether to take discard
  let workingHand = hand;
  let tookDiscard = false;
  if (discardTop) {
    const withDiscard = [...hand, discardTop];
    if (handScore(withDiscard) > handScore(hand) + 2) {
      workingHand = withDiscard;
      tookDiscard = true;
    }
  }

  // Choose which tile to discard: tile whose removal maximally preserves score
  let bestDiscard = null, bestScore = -Infinity;
  for (let i = 0; i < workingHand.length; i++) {
    const without = workingHand.filter((_, j) => j !== i);
    const s = handScore(without);
    if (s > bestScore) { bestScore = s; bestDiscard = workingHand[i]; }
  }
  if (!bestDiscard) bestDiscard = workingHand[workingHand.length - 1];

  const newHand = workingHand.filter(t => t.id !== bestDiscard.id);
  return { newHand, discarded: bestDiscard, tookDiscard };
}

type GameProps = { onBackToTitle: () => void; settings?: Settings };

export function ClassicMode({ onBackToTitle, settings = DEFAULT_SETTINGS }: GameProps) {
  const [phase, setPhase]       = useState("lobby");
  const [botCount, setBotCount] = useState(1);
  const [difficulty, setDifficulty] = useState("normal"); // "easy"|"normal"|"hard"|"challenging"

  // -- Difficulty config ---------------------------------------------------------
  const DIFF = {
    easy:        { label:"Easy",        color:"#9EF01A", playerTimer:60, botMin:20, botMax:30, botSmart:false, botClaims:false, botWinCheck:false, hints:3, emoji:"🌱" },
    normal:      { label:"Normal",      color:"#f0c060", playerTimer:45, botMin:12, botMax:25, botSmart:true,  botClaims:false, botWinCheck:true,  hints:1, emoji:"⚖️"  },
    hard:        { label:"Hard",        color:"#E84855", playerTimer:30, botMin:5,  botMax:20, botSmart:true,  botClaims:true,  botWinCheck:true,  hints:0, emoji:"🔥" },
    challenging: { label:"Challenging", color:"#C77DFF", playerTimer:20, botMin:3,  botMax:10, botSmart:true,  botClaims:true,  botWinCheck:true,  hints:0, emoji:"💀" },
  };
  const diff = DIFF[difficulty as keyof typeof DIFF];

  type WinnerState = { owner: string; words: Array<{ word: string; tiles: TileData[]; id: number }> };
  type FormedWord = { word: string; tiles: TileData[]; id: number };

  // -- Game state ---------------------------------------------------------------
  const [playerHand, setPlayerHand]   = useState<TileData[]>([]);
  const [botHands, setBotHands]       = useState<TileData[][]>([[], [], []]);
  const [discardPile, setDiscardPile] = useState<TileData[]>([]);
  const [deckTiles, setDeckTiles]     = useState<TileData[]>([]);
  const [deckIdx, setDeckIdx]         = useState(0);
  const [turn, setTurn]               = useState("player");
  const [turnPhase, setTurnPhase]     = useState("draw");
  const [drawnTile, setDrawnTile]     = useState<TileData | null>(null);
  const [selectedDiscard, setSelectedDiscard] = useState<TileData | null>(null);
  const [selectedIds, setSelectedIds] = useState(new Set<number>());
  const [message, setMessage]         = useState({ text: "", type: "" });
  const [winner, setWinner]           = useState<WinnerState | null>(null);
  const [cheerKey, setCheerKey]       = useState(0);
  const [botThinking, setBotThinking] = useState(false);
  const [winPartition, setWinPartition] = useState<WordGroup[] | null>(null);
  const [canClaimDiscard, setCanClaimDiscard] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [botTimeLeft, setBotTimeLeft] = useState<number | null>(null);
  const [hintsLeft, setHintsLeft]     = useState(0);
  const [hintTileId, setHintTileId]   = useState<number | null>(null);
  // -- Word-forming state -------------------------------------------------------
  const [formedWords, setFormedWords]   = useState<FormedWord[]>([]);
  const [wbSelected, setWbSelected]     = useState<TileData[]>([]);
  const [handTab, setHandTab]           = useState("hand");
  const [fusedIds, setFusedIds]         = useState(new Set<number>());
  const [invalidWbShake, setInvalidWbShake] = useState(false);
  const [newFusedWordId, setNewFusedWordId] = useState<number | null>(null);

  const msgRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckRef   = useRef<TileData[]>([]);
  const deckIdxRef = useRef(0);
  const formedWordIdRef = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -- Helpers ------------------------------------------------------------------
  const showMsg = (text: string, type = "info") => {
    if (msgRef.current) clearTimeout(msgRef.current);
    setMessage({ text, type });
    msgRef.current = setTimeout(() => setMessage({ text:"", type:"" }), 3500);
  };

  const drawFromDeck = () => {
    const deck = deckRef.current;
    let idx = deckIdxRef.current;
    if (idx >= deck.length) idx = 0;
    const src = deck[idx++];
    deckIdxRef.current = idx;
    return parseTile(src.text, src.category, freshTileId());
  };

  // -- Music ---------------------------------------------------------------------
  useEffect(() => { AudioEngine.startMusic(); return () => AudioEngine.stopMusic(); }, []);
  useEffect(() => { AudioEngine.setMusicVolume(settings.ambientMusic); }, [settings.ambientMusic]);
  useEffect(() => { AudioEngine.setSfxVolume(settings.soundEffects); }, [settings.soundEffects]);

  // -- Start ---------------------------------------------------------------------
  const startGame = () => {
    AudioEngine.play("gameStart");
    const d = shuffle(buildDeck());
    deckRef.current = d; deckIdxRef.current = 0;
    setDeckTiles(d);

    let idx = 0;
    const deal = () => {
      const src = d[idx % d.length]; idx++;
      return parseTile(src.text, src.category, freshTileId());
    };

    const pHand = Array.from({ length: HAND_SIZE }, deal);
    const bHands = Array.from({ length: 3 }, () => Array.from({ length: HAND_SIZE }, deal));
    deckIdxRef.current = idx;

    setPlayerHand(pHand);
    setBotHands(bHands);
    setDiscardPile([]);
    setTurn("player"); setTurnPhase("draw");
    setDrawnTile(null); setSelectedDiscard(null); setSelectedIds(new Set());
    setWinner(null); setWinPartition(null);
    setBotThinking(false);
    setFormedWords([]); setWbSelected([]); setFusedIds(new Set()); setHandTab("hand");
    setNewFusedWordId(null);
    setHintsLeft(diff.hints); setHintTileId(null);
    setTimeLeft(diff.playerTimer);
    setTimeout(() => AudioEngine.play("dealTiles"), 300);
    setPhase("play");
  };

  // -- Auto-draw at start of player turn ----------------------------------------
  useEffect(() => {
    if (phase !== "play" || turn !== "player" || turnPhase !== "draw") return;
    // Small delay so the UI settles before auto-drawing
    const t = setTimeout(() => {
      const tile = drawFromDeck();
      AudioEngine.play("tileClick");
      setPlayerHand(prev => {
        const newHand = [...prev, tile];
        setDrawnTile(tile);
        setTurnPhase("discard");
        // Check win partition for banner (optional helper)
        const partition = findWinningPartition(newHand);
        if (partition) setWinPartition(partition);
        return newHand;
      });
      showMsg("Tile drawn - fuse words or discard one to end your turn.", "info");
    }, 350);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, turnPhase, phase]);

  // -- canClaimDiscard: available during draw phase ------------------------------
  useEffect(() => {
    setCanClaimDiscard(turn === "player" && turnPhase === "draw" && discardPile.length > 0);
  }, [turn, turnPhase, discardPile]);

  // -- 30-second countdown during player discard phase --------------------------
  useEffect(() => {
    if (phase !== "play" || turn !== "player" || turnPhase !== "discard") {
      setTimeLeft(diff.playerTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setTimeLeft(diff.playerTimer);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current ?? undefined);
          setPlayerHand(hand => {
            const target = hand.find(t => t.id === drawnTile?.id) || hand[hand.length - 1];
            if (!target) return hand;
            setDiscardPile(p => [...p, target]);
            setSelectedDiscard(null); setSelectedIds(new Set());
            setWbSelected([]);
            setDrawnTile(null); setWinPartition(null);
            showMsg(`⏰ Time's up! "${getTileSound(target)}" was auto-discarded.`, "warn");
            setTimeout(() => advanceTurn("player"), 300);
            return hand.filter(t => t.id !== target.id);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, turnPhase, phase]);

  // -- Player: claim top discard (replaces auto-drawn tile) ---------------------
  // Now only callable BEFORE the auto-draw settles - i.e., during draw phase
  // (the auto-draw happens after 350ms so there's a brief window).
  // Simpler: keep "Claim Discard" as a button that replaces the last drawn tile.
  // Player presses it during discard phase to swap drawn tile for top discard.

  // -- Player: claim top discard (swap it for the auto-drawn tile) --------------
  const playerClaimDiscard = () => {
    if (turn !== "player" || turnPhase !== "discard" || discardPile.length === 0) return;
    const top = discardPile[discardPile.length - 1];
    AudioEngine.play("tileClick");
    // Put drawn tile back into discard, take top discard into hand
    setDiscardPile(prev => {
      const withoutTop = prev.slice(0, -1);
      return drawnTile ? [...withoutTop, drawnTile] : withoutTop;
    });
    setPlayerHand(prev => {
      const withoutDrawn = drawnTile ? prev.filter(t => t.id !== drawnTile.id) : prev;
      return [...withoutDrawn, top];
    });
    setDrawnTile(top);
    showMsg(`Swapped drawn tile for "${getTileSound(top)}" from discard.`, "info");
  };

  // -- Player: select tile to discard -------------------------------------------
  const toggleSelectTile = (tile: TileData) => {
    if (turn !== "player" || turnPhase !== "discard") return;
    AudioEngine.play("tileClick");
    // Only one tile can be selected at a time - clicking again deselects
    setSelectedDiscard(prev => prev?.id === tile.id ? null : tile);
    setSelectedIds(prev => {
      const id = tile.id;
      const alreadySelected = prev.has(id);
      return alreadySelected ? new Set() : new Set([id]);
    });
  };

  // -- Player: confirm discard ---------------------------------------------------
  const playerDiscard = () => {
    if (!selectedDiscard || turn !== "player" || turnPhase !== "discard") return;
    AudioEngine.play("tileCycle");
    setDiscardPile(prev => [...prev, selectedDiscard]);
    setPlayerHand(prev => prev.filter(t => t.id !== selectedDiscard.id));
    setSelectedDiscard(null); setSelectedIds(new Set());
    setWbSelected([]);
    setDrawnTile(null); setWinPartition(null);
    showMsg(`You discarded "${getTileSound(selectedDiscard)}".`, "info");
    advanceTurn("player");
  };

  // -- Player: declare Mahjong ---------------------------------------------------
  const declareMahjong = () => {
    // Win: all tiles in formedWords (hand empty, 14 tiles fused into valid words)
    const totalFused = formedWords.reduce((s, g) => s + g.tiles.length, 0);
    if (playerHand.length > 0 || totalFused < 14 || formedWords.length === 0) {
      showMsg("You need all 14 tiles fused into words to declare Mahjong!", "warn");
      return;
    }
    AudioEngine.play("sessionEnd");
    if (settings.cheerEffect) setCheerKey(k => k + 1);
    setWinner({ owner: "player", words: formedWords });
    setPhase("done");
  };

  // -- Word builder: toggle tile into/out of builder ----------------------------
  const wbToggleTile = (tile: TileData) => {
    // Allow word building during bot turn too; only block if player is in discard-selection mode
    if (turn === "player" && turnPhase === "discard") return;
    AudioEngine.play("tileClick");
    setWbSelected(prev => {
      const idx = prev.findIndex(t => t.id === tile.id);
      return idx !== -1 ? prev.filter((_, i) => i !== idx) : [...prev, tile];
    });
  };

  // -- Word builder: commit the selected tiles as a word ------------------------
  const wbCommitWord = () => {
    if (wbSelected.length === 0) return;
    const word = buildWordFromTiles(wbSelected);
    if (word.length < 2) {
      showMsg("Too short!", "warn"); return;
    }
    if (!checkWordInSet(word)) {
      AudioEngine.play("wordWrong");
      setInvalidWbShake(true);
      setTimeout(() => setInvalidWbShake(false), 550);
      showMsg(`"${word}" isn't a recognised word.`, "error");
      return;
    }
    AudioEngine.play("wordCorrect");
    const wordId = ++formedWordIdRef.current;
    const group = { word, tiles: [...wbSelected], id: wordId };
    setFormedWords(prev => [...prev, group]);
    setFusedIds(prev => { const n = new Set(prev); wbSelected.forEach(t => n.add(t.id)); return n; });
    setPlayerHand(prev => prev.filter(t => !wbSelected.find(s => s.id === t.id)));
    setWbSelected([]);
    setNewFusedWordId(wordId);
    setHandTab("words");
    setTimeout(() => setNewFusedWordId(null), 1200);
    showMsg(`"${word}" fused! ${playerHand.length - wbSelected.length} tiles left.`, "success");
  };

  // -- Word builder: break apart a fused word (return tiles to hand) ------------
  const wbBreakWord = (wordId: number) => {
    const group = formedWords.find(g => g.id === wordId);
    if (!group) return;
    AudioEngine.play("tileCycle");
    setFormedWords(prev => prev.filter(g => g.id !== wordId));
    setFusedIds(prev => { const n = new Set(prev); group.tiles.forEach(t => n.delete(t.id)); return n; });
    setPlayerHand(prev => [...prev, ...group.tiles]);
    showMsg(`"${group.word}" broken apart - tiles returned to hand.`, "info");
  };

  // -- Hint: highlight a tile that appears in a valid word ----------------------
  const useHint = () => {
    if (hintsLeft <= 0 || playerHand.length === 0) return;
    AudioEngine.play("tileClick");
    // Find a tile in hand that appears in any valid word alongside another hand tile
    const handSounds = playerHand.map(t => getTileSound(t));
    let bestTile = null;
    outer: for (const word of WORD_LIST) {
      if (word.length < 2) continue;
      let pos = 0; const used = new Array(playerHand.length).fill(false);
      let ok = true;
      while (pos < word.length) {
        let adv = false;
        for (let i = 0; i < playerHand.length; i++) {
          if (used[i]) continue;
          const s = handSounds[i];
          if (word.slice(pos, pos + s.length) === s) { used[i] = true; pos += s.length; adv = true; break; }
        }
        if (!adv) { ok = false; break; }
      }
      if (ok && pos === word.length) {
        // Pick the first used tile not already fused
        for (let i = 0; i < playerHand.length; i++) {
          if (used[i]) { bestTile = playerHand[i]; break outer; }
        }
      }
    }
    if (!bestTile) { showMsg("No hint available - try different tiles!", "warn"); return; }
    setHintsLeft(h => h - 1);
    setHintTileId(bestTile.id);
    showMsg(`💡 Hint: try using "${getTileSound(bestTile)}" in a word!`, "info");
    setTimeout(() => setHintTileId(null), 3000);
  };
  const advanceTurn = (current: string) => {
    const order = ["player", ...Array.from({ length: botCount }, (_, i) => `bot${i}`)];
    const next = order[(order.indexOf(current) + 1) % order.length];
    setTurn(next); setTurnPhase("draw");
  };

  // -- Bot turn ------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "play" || !turn.startsWith("bot")) {
      setBotTimeLeft(null);
      if (botTimerRef.current) clearInterval(botTimerRef.current);
      return;
    }
    const botIdx = parseInt(turn.replace("bot", ""));
    if (botIdx >= botCount) { advanceTurn(turn); return; }

    // Always display 30s on the clock; secretly fire at a random time within difficulty range
    const displayTime = 30;
    const fireAt = diff.botMin + Math.floor(Math.random() * (diff.botMax - diff.botMin + 1));
    setBotTimeLeft(displayTime);
    setBotThinking(true);

    let remaining = displayTime;
    botTimerRef.current = setInterval(() => {
      remaining -= 1;
      setBotTimeLeft(remaining);
      if (remaining <= fireAt) {
        clearInterval(botTimerRef.current ?? undefined);
        setBotTimeLeft(null);

        // Execute the bot's actual move
        setBotHands(prev => {
          const hand = prev[botIdx];
          const discardTop = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;

          let workingHand = hand;
          let tookDiscard = false;

          if (discardTop && diff.botClaims) {
            // Challenging/Hard: check if discard gives a win
            const withDiscard = [...hand, discardTop];
            const partition = diff.botWinCheck ? findWinningPartition(withDiscard) : null;
            if (partition) {
              setDiscardPile(p => p.slice(0, -1));
              setBotThinking(false);
              setWinner({ owner: `bot${botIdx}`, words: partition.map((g, i) => ({ ...g, id: i })) });
              AudioEngine.play("sessionEnd");
              setPhase("done");
              return prev;
            }
            // Smart bots also evaluate whether to claim discard
            const result = botTakeTurn(hand, discardTop);
            if (result.tookDiscard) {
              workingHand = [...hand, discardTop];
              tookDiscard = true;
              setDiscardPile(p => p.slice(0, -1));
              showMsg(`${BOT_NAMES[botIdx]} claimed the discard.`, "info");
            }
          }

          if (!tookDiscard) {
            const drawn = drawFromDeck();
            workingHand = [...hand, drawn];
          }

          // Win check on 14-tile hand
          if (diff.botWinCheck) {
            const partition = findWinningPartition(workingHand);
            if (partition) {
              setBotThinking(false);
              setWinner({ owner: `bot${botIdx}`, words: partition.map((g, i) => ({ ...g, id: i })) });
              AudioEngine.play("sessionEnd");
              setPhase("done");
              return prev;
            }
          }

          // Discard strategy based on difficulty
          let finalHand, discarded;
          if (!diff.botSmart) {
            // Easy: discard a random tile
            const randIdx = Math.floor(Math.random() * workingHand.length);
            discarded = workingHand[randIdx];
            finalHand = workingHand.filter((_, i) => i !== randIdx);
          } else {
            // Normal/Hard/Challenging: smart discard
            const result = botTakeTurn(workingHand, null);
            finalHand = result.newHand;
            discarded = result.discarded;
          }

          setDiscardPile(p => [...p, discarded]);
          AudioEngine.play("tileCycle");
          showMsg(`${BOT_NAMES[botIdx]} discarded "${getTileSound(discarded)}".`, "info");

          const newBotHands = [...prev];
          newBotHands[botIdx] = finalHand;
          setBotThinking(false);
          setTimeout(() => advanceTurn(turn), 400);
          return newBotHands;
        });
      }
    }, 1000);

    return () => { if (botTimerRef.current) clearInterval(botTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase]);

  // -- Cycle variant -------------------------------------------------------------
  const cycleVariant = (tile: TileData) => {
    AudioEngine.play("tileCycle");
    const cycle = (t: TileData): TileData => (!t.variants || t.id !== tile.id) ? t
      : { ...t, activeVariant: (t.activeVariant + 1) % t.variants.length };
    setPlayerHand(prev => prev.map(cycle));
  };

  // ----------------------------------------------------------------------------
  // LOBBY
  // ----------------------------------------------------------------------------
  if (phase === "lobby") {
  const _th = TILE_THEMES[settings.tileTheme] || TILE_THEMES.neon;
  return (
    <div style={{ minHeight:"100vh", background:_th.pageBg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif", color:_th.pageText }}>
      <div style={{ width:400, display:"flex", flexDirection:"column", alignItems:"center", gap:28 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:52, marginBottom:10 }}>🀄</div>
          <div style={{ fontFamily:"'Noto Serif SC',serif", fontSize:28, fontWeight:900, color:"#C77DFF" }}>Classic Mahjong</div>
          <div style={{ fontSize:11, color:"#ffffff44", letterSpacing:"0.14em", textTransform:"uppercase", marginTop:6 }}>Draw · Discard · Declare</div>
        </div>

        <div style={{ width:"100%", background:"#ffffff06", border:"1px solid #ffffff10", borderRadius:16, padding:"22px 24px" }}>
          <div style={{ fontSize:11, color:"#ffffff44", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:14 }}>How to win</div>
          <div style={{ fontSize:12, color:"#ffffff66", lineHeight:1.8 }}>
            🎯 Hold <b style={{color:"#fff"}}>13 tiles</b>. On your turn, draw 1 then discard 1.<br/>
            ✋ You may <b style={{color:"#C77DFF"}}>claim the top discard</b> instead of drawing.<br/>
            🀄 When your 14-tile hand can form <b style={{color:"#f0c060"}}>valid words using every tile</b>, declare <b style={{color:"#9EF01A"}}>Mahjong!</b>
          </div>
        </div>

        <div style={{ width:"100%", background:"#ffffff06", border:"1px solid #ffffff10", borderRadius:16, padding:"22px 24px" }}>
          <div style={{ fontSize:11, color:"#ffffff44", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:14 }}>Difficulty</div>
          <div style={{ display:"flex", gap:8 }}>
            {Object.entries(DIFF).map(([key, d]) => (
              <button key={key} onClick={() => setDifficulty(key)} style={{
                flex:1, padding:"12px 6px", borderRadius:12,
                background: difficulty===key ? `${d.color}22` : "#ffffff08",
                border: difficulty===key ? `2px solid ${d.color}88` : "1px solid #ffffff18",
                color: difficulty===key ? d.color : "#ffffff44",
                fontSize:9, fontWeight:800, cursor:"pointer", transition:"all 0.15s",
                textTransform:"uppercase", letterSpacing:"0.08em",
              }}>
                <div style={{ fontSize:18, marginBottom:4 }}>{d.emoji}</div>
                {d.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop:12, fontSize:11, color:"#ffffff33", lineHeight:1.7 }}>
            {difficulty==="easy"        && "⏱ 60s timer · Bots discard randomly · 3 hints"}
            {difficulty==="normal"      && "⏱ 45s timer · Bots play smart · 1 hint"}
            {difficulty==="hard"        && "⏱ 30s timer · Bots play smart & claim discards · No hints"}
            {difficulty==="challenging" && "⏱ 20s timer · Bots are aggressive & fast · No hints"}
          </div>
        </div>

        <div style={{ width:"100%", background:"#ffffff06", border:"1px solid #ffffff10", borderRadius:16, padding:"22px 24px" }}>
          <div style={{ fontSize:11, color:"#ffffff44", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:14 }}>Opponents</div>
          <div style={{ display:"flex", gap:10 }}>
            {[1,2,3].map(n => (
              <button key={n} onClick={() => setBotCount(n)} style={{
                flex:1, padding:"16px 0", borderRadius:12,
                background: botCount===n ? "linear-gradient(135deg,#C77DFF33,#C77DFF18)" : "#ffffff08",
                border: botCount===n ? "2px solid #C77DFF88" : "1px solid #ffffff18",
                color: botCount===n ? "#e4acff" : "#ffffff55",
                fontSize:20, fontWeight:800, cursor:"pointer", transition:"all 0.15s",
              }}>
                {n}
                <div style={{ fontSize:9, textTransform:"uppercase", letterSpacing:"0.1em", marginTop:3, opacity:0.6 }}>{n===1?"bot":"bots"}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:6 }}>
            {Array.from({length:botCount},(_,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:BOT_COLORS[i] }}/>
                <span style={{ fontSize:12, color:"#ffffff55" }}>{BOT_NAMES[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={startGame} style={{ width:"100%", padding:"16px", borderRadius:14, background:"linear-gradient(135deg,#C77DFF,#9b4dca)", border:"none", color:"#fff", fontSize:16, fontWeight:800, cursor:"pointer", letterSpacing:"0.08em", boxShadow:"0 4px 24px #C77DFF44" }}>
          ▶ Start Game
        </button>
        <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{ background:"none", border:"none", color:"#ffffff33", cursor:"pointer", fontSize:13, letterSpacing:"0.1em" }}>← Back</button>
      </div>
    </div>
  );
  } // end lobby

  // ----------------------------------------------------------------------------
  // DONE
  // ----------------------------------------------------------------------------
  if (phase === "done" && winner) {
    const _th = TILE_THEMES[settings.tileTheme] || TILE_THEMES.neon;
    const isPlayerWin = winner.owner === "player";
    const winnerName  = isPlayerWin ? "You" : BOT_NAMES[parseInt(winner.owner.replace("bot",""))];
    const winnerColor = isPlayerWin ? PLAYER_COLOR : BOT_COLORS[parseInt(winner.owner.replace("bot",""))];
    return (
      <div style={{ minHeight:"100vh", background:_th.pageBg, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Segoe UI',system-ui,sans-serif", color:_th.pageText }}>
        <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ background:_th.cardBg, border:`1px solid ${winnerColor}33`, borderRadius:24, padding:"36px 40px", maxWidth:520, width:"90%", textAlign:"center", boxShadow:"0 40px 100px #000000dd", animation:"slideUp 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
          <div style={{ fontSize:52, marginBottom:8 }}>{isPlayerWin ? "🏆" : "🤖"}</div>
          <div style={{ fontFamily:"'Noto Serif SC',serif", fontSize:28, fontWeight:900, color:winnerColor, marginBottom:4 }}>
            {isPlayerWin ? "Mahjong! You Win!" : `${winnerName} wins!`}
          </div>
          <div style={{ fontSize:11, color:"#ffffff33", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:28 }}>Winning hand</div>

          {/* Show winning word groups as tile rows */}
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28, textAlign:"left" }}>
            {winner.words.map((group, gi) => (
              <div key={gi} style={{ display:"flex", alignItems:"center", gap:8, background:"#ffffff06", border:"1px solid #ffffff0f", borderRadius:12, padding:"10px 14px" }}>
                <div style={{ display:"flex", gap:4 }}>
                  {group.tiles.map((tile, ti) => {
                    const cat = TILE_CATEGORIES[tile.category];
                    const sound = getTileSound(tile);
                    return (
                      <div key={ti} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(145deg,#1e1e2e,#16161f)", border:`1.5px solid ${cat.color}66`, borderRadius:5, minWidth:sound.length>2?26:20, height:28, padding:"0 3px" }}>
                        <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:sound.length>3?8:sound.length>2?10:13, fontWeight:700, color:cat.color }}>{sound}</span>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:15, fontWeight:800, color:winnerColor }}>{group.word}</span>
              </div>
            ))}
          </div>

          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <button onClick={() => setPhase("lobby")} style={{ padding:"12px 28px", borderRadius:12, background:"linear-gradient(135deg,#C77DFF,#9b4dca)", border:"none", color:"#fff", fontSize:14, fontWeight:800, cursor:"pointer", letterSpacing:"0.08em" }}>🔄 Play Again</button>
            <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{ padding:"12px 20px", borderRadius:12, background:"#ffffff08", border:"1px solid #ffffff18", color:"#ffffff66", fontSize:14, fontWeight:700, cursor:"pointer" }}>🚪 Home</button>
          </div>
        </div>
        {cheerKey > 0 && isPlayerWin && <CheerBurst key={cheerKey} />}
      </div>
    );
  }

  // ----------------------------------------------------------------------------
  // PLAY
  // ----------------------------------------------------------------------------
  const isPlayerTurn = turn === "player";
  const topDiscard   = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null;
  const turnLabel    = isPlayerTurn
    ? (turnPhase === "draw" ? "Drawing tile…" : "Fuse words or discard to end turn")
    : `${BOT_NAMES[parseInt(turn.replace("bot",""))] ?? "Bot"} is thinking…`;
  const turnColor = isPlayerTurn ? PLAYER_COLOR : (BOT_COLORS[parseInt(turn.replace("bot",""))] || "#ffffff");

  // Total fused tile count - when 14, player can declare
  const fusedCount  = formedWords.reduce((s, g) => s + g.tiles.length, 0);
  const canDeclare  = playerHand.length === 0 && fusedCount === 14 && formedWords.length > 0;
  const wbPreview   = wbSelected.map(t => getTileSound(t)).join("").toLowerCase();

  const _th = TILE_THEMES[settings.tileTheme] || TILE_THEMES.neon;

  return (
    <div style={{ minHeight:"100vh", background:_th.pageBg, backgroundImage: _th.pageBgImage ? "radial-gradient(ellipse at 50% 0%, #1a3a1a44 0%, transparent 60%)" : _th.label==="Mahjong" ? "radial-gradient(ellipse at 50% 0%, #0a2a0a66 0%, transparent 60%)" : "none", fontFamily:"'Segoe UI',system-ui,sans-serif", color:_th.pageText, display:"flex", flexDirection:"column" }}>
      <style>{`
        @keyframes tileDeal{from{opacity:0;transform:translateY(-12px) scale(0.9)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes discardDrop{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes thinkPulse{0%,100%{opacity:0.4}50%{opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(6px)}45%{transform:translateX(-4px)}60%{transform:translateX(4px)}75%{transform:translateX(-2px)}90%{transform:translateX(2px)}}
        @keyframes mahjongGlow{0%,100%{box-shadow:0 0 0 2px #9EF01A88,0 0 12px 3px #9EF01A33}50%{box-shadow:0 0 0 3px #9EF01Acc,0 0 28px 8px #9EF01A55}}
        @keyframes fuseIn{0%{opacity:0;transform:scale(0.8) translateY(-10px)}60%{transform:scale(1.04) translateY(1px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fusedPulse{0%,100%{box-shadow:0 0 0 1.5px #9EF01A66,0 0 8px 2px #9EF01A22}50%{box-shadow:0 0 0 2px #9EF01Acc,0 0 16px 5px #9EF01A55}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes timerPulse{0%,100%{opacity:1}50%{opacity:0.5}}
        button:focus { outline: none; box-shadow: none; }
      `}</style>

      {/* -- Header -- */}
      <div style={{ borderBottom:`1px solid ${_th.headerBorder}`, background:_th.headerBg, backdropFilter:"blur(12px)", padding:"11px 22px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => { AudioEngine.play("backToMenu"); onBackToTitle(); }} style={{ background:"#ffffff08", border:"1px solid #ffffff18", color:"#ffffff88", borderRadius:10, padding:"6px 14px", cursor:"pointer", fontSize:12, fontWeight:700, letterSpacing:"0.06em" }}>🚪 Home</button>
          <span style={{ fontSize:20 }}>🀄</span>
          <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:17, fontWeight:800, color:"#C77DFF" }}>Classic Mahjong</span>
          <span style={{ fontSize:10, fontWeight:700, color:diff.color, background:`${diff.color}18`, border:`1px solid ${diff.color}44`, borderRadius:8, padding:"3px 8px", letterSpacing:"0.1em", textTransform:"uppercase" }}>{diff.emoji} {diff.label}</span>
        </div>
        <div style={{ padding:"7px 18px", borderRadius:20, background:`${turnColor}18`, border:`1px solid ${turnColor}44`, color:turnColor, fontSize:12, fontWeight:700, animation:botThinking?"thinkPulse 1s ease-in-out infinite":"none", transition:"all 0.3s", maxWidth:280, textAlign:"center" }}>
          {turnLabel}
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {Array.from({length:botCount},(_,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:8, background:turn===`bot${i}`?`${BOT_COLORS[i]}18`:"#ffffff08", border:turn===`bot${i}`?`1px solid ${BOT_COLORS[i]}44`:"1px solid #ffffff10", transition:"all 0.3s" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:BOT_COLORS[i] }}/>
              <span style={{ fontSize:11, color:BOT_COLORS[i], fontWeight:700 }}>{BOT_NAMES[i].split(" ")[1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* -- Message -- */}
      {message.text && (
        <div style={{ margin:"8px 20px 0", padding:"8px 16px", borderRadius:8, fontSize:13, fontWeight:500, background:{success:"#9EF01A22",error:"#E8485522",warn:"#F4A26122",info:"#C77DFF18"}[message.type]||"#ffffff11", border:`1px solid ${{success:"#9EF01A55",error:"#E8485555",warn:"#F4A26155",info:"#C77DFF44"}[message.type]||"#ffffff22"}`, color:{success:"#c8ff5a",error:"#ff6b78",warn:"#ffbe85",info:"#e4acff"}[message.type]||"#e0e0f0" }}>{message.text}</div>
      )}

      {/* -- Main layout -- */}
      <div style={{ flex:1, display:"flex", gap:14, padding:"14px 20px 14px" }}>

        {/* -- Center: discard pile -- */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:_th.cardBg, border:`2px solid ${_th.cardBorder}`, borderRadius:18, padding:"16px 20px", minHeight:120, boxShadow:"inset 0 2px 16px #00000055" }}>
            <div style={{ fontSize:9, color:_th.pageText+"44", textTransform:"uppercase", letterSpacing:"0.18em", marginBottom:10 }}>Discard Pile</div>
            {discardPile.length === 0 ? (
              <div style={{ color:_th.pageText+"22", fontSize:12, fontStyle:"italic" }}>No discards yet…</div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"flex-start" }}>
                {[...discardPile].reverse().map((tile, i) => {
                  const cat = TILE_CATEGORIES[tile.category];
                  const sound = getTileSound(tile);
                  const isTop = i === 0;
                  return (
                    <div key={tile.id} style={{
                      display:"inline-flex", alignItems:"center", justifyContent:"center",
                      background: _th.tileBg(cat, false),
                      border: isTop ? `2px solid ${cat.color}88` : `1px solid ${cat.color}33`,
                      borderRadius:6, minWidth:sound.length>3?30:sound.length>2?26:22, height:32, padding:"0 4px",
                      opacity: isTop ? 1 : 0.4,
                      boxShadow: isTop ? `0 0 12px ${cat.color}33` : "none",
                      animation: isTop ? "discardDrop 0.3s ease" : "none",
                    }}>
                      <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:sound.length>3?9:sound.length>2?11:14, fontWeight:700, color:_th.tileText(cat, false) }}>{sound}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Declare Mahjong banner */}
          {canDeclare && (
            <div style={{ background:"linear-gradient(135deg,#9EF01A22,#9EF01A0a)", border:"2px solid #9EF01A66", borderRadius:14, padding:"14px 18px", animation:"mahjongGlow 1.5s ease-in-out infinite, fadeIn 0.3s ease" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#c8ff5a", marginBottom:3 }}>🀄 All tiles fused into words!</div>
                  <div style={{ fontSize:11, color:"#9EF01A77" }}>You can declare Mahjong</div>
                </div>
                <button onClick={declareMahjong} style={{ padding:"10px 22px", borderRadius:12, background:"linear-gradient(135deg,#9EF01A,#6abf12)", border:"none", color:"#0d1400", fontSize:14, fontWeight:900, cursor:"pointer", letterSpacing:"0.06em", boxShadow:"0 4px 16px #9EF01A44", outline:"none" }}>
                  Declare Mahjong!
                </button>
              </div>
            </div>
          )}
        </div>

        {/* -- Right: action panel -- */}
        <div style={{ width:196, flexShrink:0, display:"flex", flexDirection:"column", gap:10 }}>

          {/* Timer - player countdown or bot countdown */}
          {isPlayerTurn && turnPhase === "discard" && (
            <div style={{ background: timeLeft <= 10 ? "#E8485522" : "#ffffff06", border: `1px solid ${timeLeft <= 10 ? "#E8485566" : "#ffffff10"}`, borderRadius:14, padding:"12px 14px", textAlign:"center", transition:"all 0.3s" }}>
              <div style={{ fontSize:9, color: timeLeft <= 10 ? "#ff6b78" : "#ffffff33", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Time to discard</div>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, color: timeLeft <= 10 ? "#ff6b78" : "#f0c060", lineHeight:1, marginBottom:6 }}>{timeLeft}</div>
              <div style={{ background:"#ffffff10", borderRadius:4, height:4, overflow:"hidden" }}>
                <div style={{ height:"100%", background: timeLeft <= 10 ? "#E84855" : "#f0c060", width:`${(timeLeft/diff.playerTimer)*100}%`, transition:"width 1s linear", borderRadius:4 }}/>
              </div>
            </div>
          )}
          {!isPlayerTurn && botTimeLeft !== null && (
            <div style={{ background: botTimeLeft <= 5 ? `${turnColor}22` : "#ffffff06", border: `1px solid ${botTimeLeft <= 5 ? turnColor + "66" : "#ffffff10"}`, borderRadius:14, padding:"12px 14px", textAlign:"center", transition:"all 0.3s" }}>
              <div style={{ fontSize:9, color:`${turnColor}88`, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>
                {BOT_NAMES[parseInt(turn.replace("bot",""))]?.split(" ")[1]} thinking
              </div>
              <div style={{ fontFamily:"monospace", fontSize:28, fontWeight:900, color: botTimeLeft <= 5 ? turnColor : "#ffffff55", lineHeight:1, marginBottom:6 }}>{botTimeLeft}</div>
              <div style={{ background:"#ffffff10", borderRadius:4, height:4, overflow:"hidden" }}>
                <div style={{ height:"100%", background: turnColor, width:`${(botTimeLeft/30)*100}%`, transition:"width 1s linear", borderRadius:4 }}/>
              </div>
            </div>
          )}

          {/* Claim Discard */}
          <div style={{ background:_th.cardBg, border:`1px solid ${_th.cardBorder}`, borderRadius:14, padding:"14px" }}>
            <div style={{ fontSize:9, color:_th.pageText+"44", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>Discard Pile</div>
            <button onClick={playerClaimDiscard} disabled={!isPlayerTurn||turnPhase!=="discard"||discardPile.length===0} style={{ width:"100%", padding:"10px", borderRadius:10, background:isPlayerTurn&&turnPhase==="discard"&&discardPile.length>0?"linear-gradient(135deg,#C77DFF33,#C77DFF18)":"#ffffff08", border:isPlayerTurn&&turnPhase==="discard"&&discardPile.length>0?"1px solid #C77DFF66":"1px solid #ffffff10", color:isPlayerTurn&&turnPhase==="discard"&&discardPile.length>0?"#e4acff":"#ffffff22", fontSize:12, fontWeight:700, cursor:isPlayerTurn&&turnPhase==="discard"&&discardPile.length>0?"pointer":"default", letterSpacing:"0.06em", outline:"none", boxShadow:"none" }}>
              ✋ Swap for Discard
              {topDiscard && <div style={{ fontSize:9, opacity:0.7, marginTop:2 }}>"{getTileSound(topDiscard)}"</div>}
            </button>
          </div>

          {/* Discard selected */}
          <div style={{ background:_th.cardBg, border:`1px solid ${_th.cardBorder}`, borderRadius:14, padding:"14px" }}>
            <div style={{ fontSize:9, color:_th.pageText+"44", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:10 }}>
              {turnPhase==="discard" ? "Tap tile → discard" : "Waiting…"}
            </div>
            {selectedDiscard && (
              <div style={{ marginBottom:8, display:"flex", justifyContent:"center" }}>
                <div style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(145deg,${TILE_CATEGORIES[selectedDiscard.category].bg},#16161f)`, border:`2px solid ${TILE_CATEGORIES[selectedDiscard.category].color}88`, borderRadius:6, minWidth:28, height:34, padding:"0 5px" }}>
                  <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:14, fontWeight:700, color:TILE_CATEGORIES[selectedDiscard.category].color }}>{getTileSound(selectedDiscard)}</span>
                </div>
              </div>
            )}
            <button onClick={playerDiscard} disabled={!selectedDiscard||turnPhase!=="discard"} style={{ width:"100%", padding:"10px", borderRadius:10, background:selectedDiscard&&turnPhase==="discard"?"linear-gradient(135deg,#E8485533,#E8485518)":"#ffffff08", border:selectedDiscard&&turnPhase==="discard"?"1px solid #E8485566":"1px solid #ffffff10", color:selectedDiscard&&turnPhase==="discard"?"#ff6b78":"#ffffff22", fontSize:12, fontWeight:700, cursor:selectedDiscard&&turnPhase==="discard"?"pointer":"default", letterSpacing:"0.06em", outline:"none", boxShadow:"none" }}>🗑 Discard</button>
          </div>

          {/* Tile counter */}
          <div style={{ background:_th.cardBg, border:`1px solid ${_th.cardBorder}`, borderRadius:14, padding:"12px 14px", textAlign:"center" }}>
            <div style={{ fontSize:9, color:_th.pageText+"33", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:6 }}>Progress</div>
            <div style={{ display:"flex", justifyContent:"center", gap:3, flexWrap:"wrap", marginBottom:6 }}>
              {Array.from({length:14}, (_,i) => (
                <div key={i} style={{ width:10, height:10, borderRadius:2, background: i < fusedCount ? "#9EF01A" : "#ffffff15", transition:"background 0.3s" }}/>
              ))}
            </div>
            <div style={{ fontSize:11, color:"#ffffff44" }}>{fusedCount}/14 tiles fused</div>
          </div>

          {/* Hint button (only if difficulty grants hints) */}
          {diff.hints > 0 && (
            <div style={{ background:_th.cardBg, border:`1px solid ${_th.cardBorder}`, borderRadius:14, padding:"12px 14px", textAlign:"center" }}>
              <div style={{ fontSize:9, color:_th.pageText+"33", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:8 }}>Hints</div>
              <button onClick={useHint} disabled={hintsLeft <= 0 || !isPlayerTurn} style={{ width:"100%", padding:"9px", borderRadius:10, background: hintsLeft > 0 && isPlayerTurn ? "linear-gradient(135deg,#f0c06033,#f0c06018)" : "#ffffff08", border: hintsLeft > 0 && isPlayerTurn ? "1px solid #f0c06066" : "1px solid #ffffff10", color: hintsLeft > 0 && isPlayerTurn ? "#f0c060" : "#ffffff22", fontSize:12, fontWeight:700, cursor: hintsLeft > 0 && isPlayerTurn ? "pointer" : "default", outline:"none" }}>
                💡 Hint ({hintsLeft})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* -- Hand area (tabbed) -- */}
      <div style={{ background:_th.cardBg, borderTop:`1px solid ${_th.cardBorder}`, padding:"0 20px 18px" }}>
        {/* Tabs */}
        <div style={{ display:"flex", gap:0, marginBottom:12, borderBottom:"1px solid #ffffff0f", paddingTop:2 }}>
          {[
            { id:"hand", label:`Your Hand (${playerHand.length})` },
            { id:"words", label:`Fused Words (${formedWords.length})` },
          ].map(tab => (
            <button key={tab.id} onClick={() => setHandTab(tab.id)} style={{ padding:"10px 18px", background:"none", border:"none", borderBottom: handTab===tab.id ? "2px solid #C77DFF" : "2px solid transparent", color: handTab===tab.id ? "#e4acff" : "#ffffff33", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:"0.06em", transition:"all 0.15s", outline:"none" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Hand tab */}
        {handTab === "hand" && (
          <div>
            {/* Word builder strip */}
            {wbSelected.length > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12, padding:"10px 14px", background:"#C77DFF0a", border:"1px solid #C77DFF33", borderRadius:12, animation:"fadeIn 0.2s ease" }}>
                <div style={{ display:"flex", gap:4, flexWrap:"wrap", flex:1 }}>
                  {wbSelected.map(t => {
                    const cat = TILE_CATEGORIES[t.category];
                    const sound = getTileSound(t);
                    return (
                      <div key={t.id} onClick={() => wbToggleTile(t)} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", background:`linear-gradient(145deg,${cat.bg},#16161f)`, border:`2px solid ${cat.color}`, borderRadius:6, minWidth:sound.length>3?28:sound.length>2?24:20, height:28, padding:"0 4px", cursor:"pointer", boxShadow:`0 0 8px ${cat.color}44` }}>
                        <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:sound.length>3?8:sound.length>2?10:13, fontWeight:700, color:cat.color }}>{sound}</span>
                      </div>
                    );
                  })}
                </div>
                <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:20, fontWeight:800, color:"#e4acff", minWidth:60 }}>{wbPreview}</span>
                <button onClick={wbCommitWord} style={{ padding:"8px 16px", borderRadius:10, background:"linear-gradient(135deg,#9EF01A33,#9EF01A18)", border:"1px solid #9EF01A66", color:"#c8ff5a", fontSize:12, fontWeight:700, cursor:"pointer", letterSpacing:"0.06em", outline:"none", animation:invalidWbShake?"shake 0.5s ease":"none" }}>✓ Fuse Word</button>
                <button onClick={() => setWbSelected([])} style={{ padding:"8px 12px", borderRadius:10, background:"#ffffff08", border:"1px solid #ffffff18", color:"#ffffff44", fontSize:12, fontWeight:700, cursor:"pointer", outline:"none" }}>✕</button>
              </div>
            )}

            <div style={{ fontSize:9, color:"#ffffff22", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:10 }}>
              {isPlayerTurn && turnPhase==="discard"
                ? <span style={{ color:"#F4A261" }}>Tap a tile to select for discard, or fuse words first</span>
                : !isPlayerTurn
                ? <span style={{ color:"#9EF01A88" }}>Bot is thinking - tap tiles to build words now!</span>
                : <span>Waiting…</span>}
            </div>

            <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
              {playerHand.length === 0 ? (
                <div style={{ color:"#ffffff22", fontSize:12, fontStyle:"italic" }}>No tiles in hand - all fused!</div>
              ) : playerHand.map(tile => {
                const isWbSel = wbSelected.some(t => t.id === tile.id);
                const isDiscardSel = selectedIds.has(tile.id);
                const isBotTurn = !isPlayerTurn;
                return (
                  <div key={tile.id} style={{ position:"relative" }}>
                    <Tile
                      tile={tile}
                      selected={isPlayerTurn && turnPhase==="discard" ? isDiscardSel : isWbSel}
                      highlighted={tile.id === hintTileId}
                      onClick={isPlayerTurn && turnPhase==="discard" ? toggleSelectTile : wbToggleTile}
                      onCycleVariant={cycleVariant}
                      theme={settings.tileTheme}
                      animated={settings.tileAnimations}
                      showLabel={settings.soundLabels}
                      disabled={isPlayerTurn && turnPhase==="draw"}
                    />
                    {tile.id === drawnTile?.id && (
                      <div style={{ position:"absolute", top:-6, right:-4, background:"#9EF01A", color:"#0d1400", fontSize:7, fontWeight:900, borderRadius:4, padding:"1px 4px", letterSpacing:"0.06em", pointerEvents:"none" }}>NEW</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fused Words tab */}
        {handTab === "words" && (
          <div>
            {formedWords.length === 0 ? (
              <div style={{ color:"#ffffff22", fontSize:12, fontStyle:"italic", padding:"8px 0" }}>
                No words fused yet - select tiles in the Hand tab to build words.
              </div>
            ) : (
              <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
                {formedWords.map(group => {
                  const isNew = group.id === newFusedWordId;
                  return (
                    <div key={group.id} style={{
                      display:"inline-flex", flexDirection:"column", alignItems:"center", gap:5,
                      padding:"10px 12px",
                      background:"linear-gradient(145deg,#0d1f0d,#0a160a)",
                      border:"1.5px solid #9EF01A44",
                      borderRadius:12,
                      animation: isNew ? "fuseIn 0.5s cubic-bezier(0.16,1,0.3,1)" : "none",
                      boxShadow: isNew ? "0 0 20px #9EF01A44" : "0 0 0 1px #9EF01A11",
                      transition:"box-shadow 0.4s",
                      cursor:"default",
                      position:"relative",
                    }}>
                      {/* Tile chips fused together */}
                      <div style={{ display:"flex", gap:0, alignItems:"center" }}>
                        {group.tiles.map((tile, ti) => {
                          const cat = TILE_CATEGORIES[tile.category];
                          const sound = getTileSound(tile);
                          const isFirst = ti === 0;
                          const isLast  = ti === group.tiles.length - 1;
                          return (
                            <div key={tile.id} style={{
                              display:"inline-flex", alignItems:"center", justifyContent:"center",
                              background:_th.tileBg(cat, false),
                              border:`1.5px solid ${cat.color}88`,
                              borderLeft: !isFirst ? `1px solid ${cat.color}33` : `1.5px solid ${cat.color}88`,
                              borderRadius: isFirst ? "7px 0 0 7px" : isLast ? "0 7px 7px 0" : "0",
                              minWidth:sound.length>3?28:sound.length>2?24:20,
                              height:32, padding:"0 4px",
                              boxShadow:`inset 0 0 6px ${cat.color}22, 0 0 4px ${cat.color}33`,
                            }}>
                              <span style={{ fontFamily:"'Noto Serif SC',serif", fontSize:sound.length>3?8:sound.length>2?11:14, fontWeight:700, color:_th.tileText(cat, false), lineHeight:1 }}>{sound}</span>
                            </div>
                          );
                        })}
                      </div>
                      {/* Word label */}
                      <div style={{ fontSize:11, fontFamily:"'Noto Serif SC',serif", fontWeight:800, color:"#9EF01A", letterSpacing:"0.04em" }}>{group.word}</div>
                      {/* Break button */}
                      <button onClick={() => wbBreakWord(group.id)} title="Break apart" style={{ position:"absolute", top:-6, right:-6, width:16, height:16, borderRadius:"50%", background:"#E8485533", border:"1px solid #E8485566", color:"#ff6b78", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", outline:"none", padding:0, lineHeight:1 }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {cheerKey > 0 && <CheerBurst key={cheerKey} />}
    </div>
  );
}



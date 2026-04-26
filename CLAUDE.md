# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Guidelines

Derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls. These bias toward caution over speed — use judgment on trivial tasks.

### 1. Think Before Coding

Before implementing: state assumptions explicitly, ask if uncertain. If multiple interpretations exist, present them — don't pick silently. If a simpler approach exists, say so. If something is unclear, stop and ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes

Touch only what you must. When editing existing code: don't improve adjacent code, comments, or formatting; match existing style. If you notice unrelated dead code, mention it — don't delete it. Remove imports/variables/functions that *your* changes made unused, but don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Transform tasks into verifiable goals:
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan with a verify step for each.

## Commands

```bash
npm install
npm run dev      # dev server → http://localhost:5173/tileword/
npm run build    # production build → dist/ (single inlined HTML file)
npm run preview  # preview the production build locally
```

No test suite is configured.

## Architecture

**React + Vite SPA — no router.** Navigation is a single `screen` string in `App.jsx` (`"title" | "singleplayer" | "endless" | "timed" | "classic"`). `App` owns the global `settings` state and passes it down to every screen.

**Screen hierarchy:**
- `TitleScreen` → `SinglePlayerMenu` → one of three game screens
- `MahjongPhonicsGame` — Endless mode (draw tiles, build words, score points)
- `TimedMode` — same mechanics with a countdown
- `ClassicMode` — full Mahjong rules: 13-tile hand, draw/discard, bot opponents, win by partitioning all 14 tiles into valid words (`findWinningPartition` uses backtracking)

**Data layer (`src/data/`):**
- `tiles.js` — 108-tile deck across 7 phonics categories (`TILE_CATEGORIES`). Dual tiles like `"ai/ay"` store both variants; `getTileSound` resolves the active one. `buildDeck()` constructs the full deck; `freshTileId()` gives globally unique IDs across recycled decks.
- `words.js` — ~3,500-word list embedded directly (no network). Also exposes `SESSION_CUSTOM_WORDS` for words added at runtime and `buildWordFromTiles` / `checkWordInSet` helpers.
- `settings.js` — `DEFAULT_SETTINGS` object (smoke effect, cheer, hint penalty, volumes, theme).

**AudioEngine (`src/audio/AudioEngine.js`)** — singleton IIFE. Due to browser autoplay policy, `AudioContext` is deferred until `AudioEngine.unlock()` is called, which `App` triggers on the first click/keydown anywhere. All sounds are synthesised from oscillators and noise (no audio files).

**Themes (`src/themes/tileThemes.js`)** — three themes (`neon`, `mahjong`, `paper`). Each theme exports function-valued style properties (`tileBg`, `tileBorder`, `tileText`, `tileShadow`) that take `(cat, selected, highlighted)` and return CSS strings. Components call these functions inline.

**Deployment:** GitHub Actions (`.github/workflows/deploy.yml`) builds and pushes to GitHub Pages on every push to `main`. The Vite `base` is `/tileword/` — change this in `vite.config.js` if the repo is renamed.

**Note:** All source files are TypeScript (`.ts`/`.tsx`). Imports use extensionless paths; Vite resolves `.tsx` → `.ts` → `.jsx` → `.js`.

## Goal
The best phonics game on GitHub Pages.
No login. Instant play. Mahjong meets language learning.

## Deployment
- GitHub Pages via CI/CD
- banfdev.github.io/tileword

## Core Philosophy
Tiles represent SOUNDS not letters.
Minimalist — complexity is the enemy. Player must feel smart immediately.
Inspired by Hangman but teaches pronunciation through sound-building.
The best phonics game on GitHub Pages.
No login. No timer. No lives. Instant play.

## The ~83 Tile System
- Single vowels: a e i o u
- Vowel combos: ai ay ea ee ie oa oe oo ou ow ue ui eu oi oy au aw
- R-controlled: ar er ir or ur
- Blends: bl br ch cl cr dr fl fr gl gr pl pr sh sk sl sm sn sp st str sw th tr tw wh wr
- Endings: ck ng nk tch dge le tion ing
- Prefixes: re pre un dis out over
- Single consonants: b c d f g h j k l m n p r s t v w x y z

## Tile Tiers (critical)
- Tier 1 PERFECT: t+ea+m = team (pure phonics, use these)
- Tier 2 GOOD: g+ar+f+ie+ld = garfield (acceptable)
- Tier 3 AVOID: g+u+l+l+i+b+i+l+i+t+y = gullibility (meaningless, never include)

## Level Progression
- Level 1: ea → t ea m p ch r b n → tea eat team each teach beach bean
- Level 2: ee → t ee f r s n gr qu → see tree free green queen
- Level 3: ea + ee → player discovers both say "ee" 🤯
- Level 4: ai + ay → rain clay play train (same sound different spelling)
- Level 5: ar or er → car corn teacher (bossy R)
- Level 6: blends → bl+ea=bleat tr+ee=tree str+ea+m=stream
- Level 7: free build, all tiles weighted by frequency

## Gameplay
- 8 curated tiles per level
- Player builds as many words as possible
- Each tile click plays its sound
- Completed word plays full pronunciation

## NLP Sound Map
ea=ee, ee=ee, ai=ay, ay=ay, oa=oh, oo=oo, ar=ar, er=ur, ir=ur, or=or
ch=ch, sh=sh, th=th, str=str
Single consonants: t=tuh, m=muh, p=puh, b=buh etc.

## Tech Stack
React TSX, Vite, GitHub Pages, no backend, no login

## Success Criteria
A 6-year-old picks it up in 30 seconds.

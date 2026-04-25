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

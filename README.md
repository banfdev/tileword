# TileWord – Phonics Mahjong

A word-building phonics game inspired by Mahjong. Draw tiles representing English sound modules, combine them into valid words, and score points based on tile rarity.

## Game modes

- **Endless** — build words round after round, no timer
- **Timed** — race the clock, 1–10 minute sessions
- **Classic Mahjong** — draw, discard, declare Mahjong against bots

## Features

- 108 tiles across 7 phonics categories
- 3,500+ word dictionary (embedded, no network required)
- 3 visual themes: Neon, Mahjong, Paper
- Full Web Audio engine — 16 sound effects + ambient music
- Auto-make word mode, hint system, challenge words

## Development

```bash
npm install
npm run dev        # → http://localhost:5173/tileword/
npm run build      # builds to dist/
npm run preview    # preview the production build locally
```

## Deployment

Push to `main` — GitHub Actions builds and deploys automatically to GitHub Pages.

See `.github/workflows/deploy.yml` for the pipeline.

> **Note:** If your GitHub repo is not named `tileword`, update the `base` field in `vite.config.js` to match your repo name.

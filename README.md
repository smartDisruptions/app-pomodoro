# Patch's Pomodoro

A pomodoro timer starring **Patch**, the hacker from the Smart Disruptions Neo Dojo cast. Wind the tomato, watch it
ripen while you focus, quarantine your distractions (the six Neo Dojo rogues), grow tomatoes on Patch's windowsill,
and sew the patches you earn onto her hoodie. Lo-fi on. Works offline and installs as an app. No runtime
dependencies, built to run fast on an old phone.

Version 2 rebuilds the March 2026 Next.js app from the ground up. Your v1 history (sessions, tasks, settings,
achievements) moves in automatically on first open; the old data is left untouched.

## Run it

```bash
npm install                          # optional: esbuild, so the build minifies (it works without it)
node build.mjs                       # → dist/ (index.html, app.<build>.js, icons, manifest, audio, sw.js)
node tools/serve.mjs dist 5173       # http://127.0.0.1:5173/
node --test                          # the unit tests (finds test/*.test.mjs)
```

`node build.mjs --inline` puts the script inside index.html (one self-contained file). Deployed on Vercel as a static
site (`vercel.json`: `npm install`, `node build.mjs`, output `dist/`).

Dev URLs: `?speed=60` (time runs 60× faster) · `?hour=22` (pin the time of day) · `?q=0..3` (quality tier) ·
`?dev=1` · `?nosw=1`.

## How it's built

- `CONTRACT.md` — how the modules fit: ownership, APIs, events, the speed budget, testing. Read it first.
- `DESIGN.md` — the idea, the look, the motion, Patch, the sound, the words.
- `src/` — one module per file, concatenated in order into one `'use strict'` IIFE by `build.mjs`:
  `00-core` (shared tools) · `10-text` (every word Patch says) · `20-engine` (timer, data, stats) · `30-audio` ·
  `40-patch` (Patch herself) · `45-scene` (her room, on a canvas) · `50-dial` (the tomato timer) · `60-ui` (sheets) ·
  `99-main` (boot and the frame loop).
- `stubs/` — a minimal working version of every module (the app runs end to end on stubs alone).
- `tools/shot.mjs` (headless screenshots from a step script) and `tools/perf.mjs` (frame cost under CPU throttling).
- `public/audio/AUDIO.md` — where every sound came from.

Patch and the rogues are from the Neo Dojo cast by [Smart Disruptions](https://smartdisruptions.com).

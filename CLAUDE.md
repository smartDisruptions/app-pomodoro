# Patch's Pomodoro — working in this repo

- **Read `CONTRACT.md` first, then `DESIGN.md`.** CONTRACT.md is the source of truth for how modules fit (ownership,
  APIs, BUS events, the speed budget). DESIGN.md is the look, the voice and Patch's canon. Don't deviate from either
  without Josh's say-so; if they're wrong, fix the doc in the same change.
- **No dependencies, no framework.** Vanilla JS modules in `src/`, joined by `node build.mjs` into one HTML file.
  Each module declares one top-level `const` namespace. Words live in `src/10-text.js`.
- **Check every change:** `node build.mjs --check`, `node --test`, then look at it:
  `node tools/shot.mjs --dir dist --out .shots --steps "wait 900; shot home"` (and `tools/perf.mjs --throttle 4`).
  It must run fast on an old phone: budgets in CONTRACT.md §9.
- **Deploys:** Vercel builds `main` to production (the site smartdisruptions.com links to it). Work on a branch, get
  the preview URL to Josh, merge only after he's approved it. Author commits as `Josh <smartdisruptions@gmail.com>`
  (Vercel blocks other authors).
- **Patch's canon** is her public cast bio only (hoodie, hotfixes, three terminals, lo-fi and nothing else). Keep
  the unreleased Patch Notes story (her grandmother, the shop) out of this app.

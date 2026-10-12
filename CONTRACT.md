# Patch's Pomodoro — build contract

*Read this whole file, then `DESIGN.md` (the look, the feel, the voice), then `src/00-core.js`, `src/10-text.js` and
`src/99-main.js` (short; they are the engine room). This file is the single source of truth for how the modules fit.
Where it is silent, use judgment and say what you chose in your report.*

## 0. The pitch

**Patch's Pomodoro** rebuilds `app-pomodoro` (a Next.js app from March 2026) from the ground up as one small,
dependency-free HTML file starring **Patch**, the hacker from the Neo Dojo cast. You're in her room above the city;
you wind a tomato kitchen timer that ripens while you focus; distractions are the six Neo Dojo rogues and get
quarantined; achievements are embroidered patches you sew on her hoodie. DESIGN.md §2 has the whole idea.

Josh's bar, verbatim: *"build a stunning and creative pomodoro timer. It needs to have interactive parts and features
that make it stand out. You can use Patch from Smart Disruptions as the mascot for it. It needs to run fast even on an
old and slow mobile device. Blow me away."*

## 1. Rules of engagement (every agent)

- **Paths.** Repo `REPO=/home/user/app-pomodoro` (branch `ccr-0415918b-of7ssl`). Vault (read-only reference)
  `/home/user/josh-ai-builder-brain`. The old app's source (read-only, for reference and migration):
  `/home/user/smartdisruptions/app-pomodoro`. Your scratch folder is in your brief (`$SCR`); write builds,
  screenshots and temp files there, never in `$REPO` (except the files you own).
- **You own exactly the files your brief names.** Never edit anyone else's file; other agents are editing theirs
  right now in the same folder. If you need something from another module, code against this contract and the stubs
  (`stubs/` = executable documentation of every API), degrade gracefully when it isn't there yet, and list the request
  in your report. If the contract is wrong or missing something, say so in your report; don't route around it silently.
- **Don't commit, push or touch git.** The orchestrator integrates and commits.
- **One top-level name per module.** Your file declares exactly one top-level `const`: your namespace,
  `const Dial = (() => { …; return { … }; })();`. Everything else lives inside the closure. No `import`/`export`,
  no top-level `return`, and never the string `</script` anywhere. `SHEET.def(...)` calls run inside your closure.
- **CSS:** inject your styles once with `CSS('<module>', text)` in `init()`. Prefix every class and id you create
  with your module's prefix (§4). Use the theme variables from `shell.html` (`var(--surface)`, `var(--accent)`, …);
  never hard-code a theme colour for chrome (brand colours like the tomato are fine). Support both themes
  (`html[data-theme=night|day]`), `html.wide`, `html.short`, `html.rm`, `html.heads-down`, and `html[data-q="2"|"3"]`
  (drop expensive effects: no `backdrop-filter`, no big blurred shadows at q ≥ 2).
- **Words come from `TEXT`** (`src/10-text.js`). Patch's lines: `LINE(key, vars)`. Never write your own Patch lines;
  if you truly need one, add it to a `NEW_TEXT` object at the top of your closure, mark each `// NEW-TEXT`, keep it in
  her voice (dry, warm, short, first person), and list it in your report. Plain interface words ("Close", "Done")
  aren't Patch's lines.
- **Build into your scratch folder** and test there:
  ```
  node $REPO/build.mjs --out $SCR/dist                       # your module + every other real module that compiles
  node $REPO/build.mjs --out $SCR/solo --real dial           # only yours real, stubs for the rest (isolation)
  ```
  Test in isolation first, then against everything (`--real all`) before you finish. If someone else's module
  breaks your test, stub it (`--stub name`) and say so in your report.
- **Look at your work.** `tools/shot.mjs` drives a build in headless Chromium and screenshots it; open the PNGs with
  the Read tool. Iterate visually until it is beautiful, not just correct.
  ```
  node $REPO/tools/shot.mjs --dir $SCR/dist --out $SCR/shots --steps "wait 900; shot home; speed 120; start; wait 1500; shot running; perf"
  ```
  Steps are listed at the top of `tools/lib.mjs`. Check **390x844 @2** (default), **375x667**, **844x390**
  (phone landscape) and **1440x900 --dpr 1** (desktop); `--touch` makes it a touch device; `--query "hour=22"` pins
  the time of day (try 7, 13, 19, 23); `--scheme light` + `sheet settings` to check the day theme.
- **Syntax-check** with `node --check $REPO/src/NN-yours.js`, then `node $REPO/build.mjs --check`.
- **Performance is a feature** (§9). Measure: `node $REPO/tools/perf.mjs --dir $SCR/dist --throttle 4 --phases "…"`.
- **Finish with a report:** what you built; the API you actually expose (anything beyond this contract); BUS events
  you emit or rely on; NEW-TEXT lines; settings you read; known gaps; perf numbers (work median and p95 at 4×); and
  the screenshot paths that show it best.

## 2. Architecture

One HTML page: a full-bleed canvas (`#scene`) for Patch's room, and a DOM layer (`#app`) for every control.
`build.mjs` concatenates the modules in this order inside one `'use strict'` IIFE, inlines the fonts, and writes
`dist/` (index.html + `public/` + a stamped `sw.js`):

| File | Namespace | Owner | What |
|---|---|---|---|
| `src/00-core.js` | shared globals (§3) | orchestrator | tools, BUS, LAYOUT, PAL, ICON, DB/TIMER shells |
| `src/10-text.js` | `TEXT`, `LINE`, `ROGUE`, `PATCHDEF` | orchestrator | every word Patch says; rogues; patches |
| `src/20-engine.js` | `Engine` | Engine agent | timer, data, migration, stats, unlocks, notifications, **the Changelog sheet** |
| `src/30-audio.js` | `Snd` | Audio agent | effects, music, ambience, haptics; files in `public/audio/` |
| `src/40-patch.js` | `Patch` | Patch agent | Patch herself (rig, poses, faces, hoodie), her speech bubble, the rogue sprites |
| `src/45-scene.js` | `Scene` | Scene agent | the room on the canvas: sky, city, rain, desk, props, plant, jar, effects |
| `src/50-dial.js` | `Dial` | Dial agent | the tomato timer, readout, controls, heads-down mode, break activities, Bug Hunt |
| `src/60-ui.js` | `UI` | UI agent | top bar, dock, sheets, tasks, patches, settings, capture, reflect, onboarding, toasts |
| `src/99-main.js` | `MAIN` | orchestrator | boot, the frame loop, input routing, keys, quality, `window.__pomo` |
| `shell.html`, `public/*`, `build.mjs`, `tools/*` | — | orchestrator | page shell, icons, manifest, service worker, tooling |
| `test/*.test.mjs` | — | Engine agent (others may add their own `test/<module>.test.mjs`) | `node --test` (from the repo root; it finds `test/*.test.mjs`) |

## 3. Shared globals (`00-core.js` — read it, it's short)

- Math/util: `TAU clamp lerp rnd pick easeOut easeIn easeInOut easeOutBack smooth mulberry makeCanvas wait uid`.
- `$(id)`, `h(tag, attrs, ...kids)` (DOM builder), `CSS(id, text)`, `ANNOUNCE(text)` (screen readers), `ICON(name)`.
- Formatting: `mmss(sec)` "24:59" · `hm(sec)` "1h 05m" · `dateKey(ms)` "2026-10-12" (local) · `dayStart weekStart
  (Monday) addDays dayDiff plural clockTime pad2`.
- `BUS.on/off/emit` (synchronous, fenced). `CLOCK.real/rdt/frame`. `reportErr(where, e)`. `try1(mod, fn, …args)`.
- `store.get/set/del` (localStorage, prefix `pomo2:`), `store.raw(key)` (un-prefixed, for v1 migration).
- `PREFS {haptics, motion, talk, sound}` (Engine keeps it synced) · `RM()` reduced motion (live) · `vibrate(p)`.
- `QS DEV TOUCH`. `DAY.hour()` (float; `?hour=` pins it) · `DAY.part()` `'night'|'dawn'|'day'|'dusk'`.
- Canvas & layout: `cv ctx VW VH DPR WIDE SHORT QUALITY QL LAYOUT layout() publishDial()`. **`LAYOUT`** (CSS px):
  `W H wide short safe{t,b,l,r} top{x,y,w,h} dock{…} stage{…} deskY ui{…} dial{cx,cy,r}`. Also CSS variables
  `--top-*`, `--dock-*`, `--stage-*`, `--ui-*` (`-x -y -w -h`), `--desk-y`, `--dial-cx --dial-cy --dial-r`.
- Art: `svgCanvas(svg, w, h, pxPerUnit) → Promise<canvas>` · `glowOf(rgb, px, core)` (cached glow sprite) · `PAL` · `FONT`.
- State: **`DB`** (the saved document, §8.1; reassigned on load/import/clear: always read the global) · **`TIMER`**
  (mutated in place by the Engine) · `freshDB()` · `defaultSettings()` · `FOCUSMODE.on`.
- Sheets: `SHEET.def(id, impl)` · `SHEET.open(id, arg)` · `SHEET.close()` · `SHEETS` (§8.6).

## 4. The page, layers and prefixes

| Layer | z | Owner | Prefix |
|---|---|---|---|
| `#scene` canvas | 0 | Scene (main draws it every frame via `Scene.draw`) | — |
| `#dial` | 5 | Dial: tomato, readout, controls, chips, break card | `dl-` |
| `#top` | 10 | UI: wordmark, today/goal, streak, mute, heads-down | `ui-` |
| `#dock` | 10 | UI: Tasks · Changelog · Patches · Settings | `ui-` |
| `#bubble` | 12 | Patch: the speech bubble | `pt-` |
| `#activity` | 20 | Dial: breathing, stretch, window overlays, Bug Hunt | `dl-` |
| `#sheets` | 30 | UI: scrim + the open sheet (Engine renders the Changelog body inside, prefix `lg-`) | `ui-`, `lg-` |
| `#toasts` | 40 | UI | `ui-` |
| `#live` | — | core `ANNOUNCE` | — |

`#app` has `pointer-events: none`; buttons, links, inputs, labels and anything with `data-hit` get them back. Taps
that reach the canvas go to `Scene.tap()` via main. Position your layer with the LAYOUT CSS variables.

## 5. Boot, hooks, the frame

Main calls each hook if it exists, fenced in try/catch:
- **`init()`** once, in the order Engine → Snd → Patch → Scene → Dial → UI. The Engine loads `DB` first, so
  everyone else can read `DB` and `TIMER` in their `init()`. **Register BUS handlers here.**
- **`layout()`** after core `layout()` on boot, resize, orientation and quality changes, in the order
  **Dial → UI → Patch → Scene**. The Dial may refine `LAYOUT.dial` here (main then calls `publishDial()`), so the
  Scene sees the final tomato position. Then main emits `layout`.
- **`bake()`** (Patch, Scene): after every layout. May return a Promise; keep drawing the old canvases until the
  new ones are ready. Must be idempotent. Main emits `baked` when both resolve.
- **`update(dt)`** every drawn frame (real seconds, ≤ 0.05) in the order Patch → Scene → Dial → UI.
  The frame is capped at `QUALITY[QL].fps` (30 on the low tiers): never assume 60.
- **`Scene.draw(ctx)`** every drawn frame: the whole canvas. The Scene calls `Patch.draw(...)` inside it.
- Boot emits `boot` after init, then `ready` after the first layout, bake and fonts. `window.__pomo.ready` turns true.
- The Engine does **not** run on the frame loop: it keeps its own timer (§8.1), so time is right even when frames stop.

## 6. Keys

Main sends every keydown to `UI.key(e)` first, then (unless typing in a field) to `Dial.key(e)`; return `true` if
you handled it. No modifiers (Ctrl/Cmd/Alt) are ever claimed.

| Key | Owner | Does |
|---|---|---|
| Space, Enter (nothing focused) | Dial | start / pause / resume |
| ← → (− +) | Dial | wind ∓1 minute (Shift: 5) |
| R · S | Dial | reset · skip (during a running focus: press twice within 2 s; the first press shows a hint) |
| D | Dial | Distracted? → `SHEET.open('capture')` |
| F | Dial | heads-down mode on/off |
| Esc | UI, then Dial | close the sheet · leave heads-down · end an activity |
| T · L · P · , | UI | Tasks · Changelog · Patches · Settings |
| M | UI | mute / unmute (`Snd.mute()`) |
| ? | UI | keyboard help sheet |

While a sheet is open (`UI.busy()`), the Dial ignores keys.

## 7. BUS events

| event | payload | from → to |
|---|---|---|
| `boot` `ready` `baked` | | main → all |
| `layout` | `{W, H, wide, short}` | main → all (after the layout hooks) |
| `quality` | `{QL, why}` | main → all (a relayout and re-bake follow) |
| `theme` · `daypart` | `{theme}` · `{part}` | main → all (Scene re-bakes its sky on `daypart`) |
| `gesture` | | main (first touch/key) → Snd (unlock audio) |
| `hidden` · `visible` | | main → Engine (reconcile time on `visible`), Snd (keep the music playing: people switch apps while they focus), all |
| `timer:tick` | `{left, dur, mode, state}` | Engine → Dial (readout), UI (title chip) — once per displayed second while running, and on every change |
| `timer:state` | `{state, mode}` | Engine → all — after any state change |
| `timer:start` · `timer:pause` · `timer:resume` | `{mode, dur}` · `{}` · `{}` | Engine → Snd, Patch, Scene, Dial, UI |
| `timer:reset` | `{abandoned}` | Engine → all |
| `timer:skip` | `{from, to}` | Engine → all |
| `timer:done` | `{mode, session, next, away}` | Engine → all: the celebration (DESIGN.md §7). `away: true` = it finished while the app was hidden (celebrate quietly) |
| `timer:mode` | `{mode, cycle}` | Engine → all — the next session is set up (after done/skip/setMode/reset) |
| `timer:wind` | `{left, dur}` | Engine → Dial, Patch |
| `timer:milestone` | `{kind: 'half'|'five'|'one'}` | Engine → Dial, Scene (subtle cues only; Patch stays quiet) |
| `session:new` · `session:rated` | `{session}` | Engine → UI, Scene, Patch, Changelog |
| `task:change` | `{task, op: 'add'|'update'|'remove'|'done'|'undone'|'active'|'move'|'clear'}` | Engine → UI, Dial, Patch |
| `rogue:capture` | `{rogue}` | Engine → Patch (zap + line), Scene (pop-in, beam, jar), Snd, UI |
| `rogue:change` | `{rogue, op: 'resolve'|'reopen'|'delete'}` | Engine → UI |
| `patch:unlock` | `{id}` | Engine → UI (toast), Patch (line), Snd |
| `hoodie` | `{ids}` | Engine → Patch (re-bake the hoodie) |
| `settings` | `{key, value}` | Engine → all (`key` undefined = everything changed) |
| `data` | `{op: 'import'|'clear'|'migrated'|'seed', n}` | Engine → all: resync everything from `DB` |
| `stats` | | Engine → UI, Changelog (refresh) |
| `scene:tap` | `{id, x, y}` | Scene → Patch, Snd, others. ids: `patch plant window mug screens radio jar` |
| `harvest` | `{x, y, r}` | Dial → Scene: fly the ripe tomato from (x, y) CSS px to the plant |
| `focusmode` | `{on}` | Dial → UI, Scene, Patch |
| `activity` | `{id, phase: 'start'|'end', score?, done?}` | Dial → Patch (pose), Scene, Snd, Engine-facing calls are direct |
| `activity:step` | `{id, step, pose?, breath?: 'in'|'hold'|'out'|'rest'}` | Dial → Patch (stretch poses, breathing), Snd |
| `ui:sheet` | `{id}` (null when closed) | UI → Dial, Patch, Scene |
| `onboard:done` | | UI → Patch (greet_first) |
| `patch:say` | `{key, vars}` or `{text}` | anyone → Patch: ask for a line without a hard dependency |
| `sfx` | `{name, vol}` | anyone → Snd: play an effect without a hard dependency |

## 8. Module APIs

### 8.1 Engine (`src/20-engine.js`, plus `test/engine.test.mjs`)

**`DB` schema** — `freshDB()` and `defaultSettings()` in core are the canonical shape (v: 2). Settings keys and
values are listed in `defaultSettings()`; validate everything you write (clamp minutes: focus 1–120, short 1–30,
long 1–60, longEvery 1–12, dailyGoal 1–24; volumes 0–1). Save with `store.set('db', DB)`, debounced (~300 ms) except
on state changes that must survive a crash (start, done, capture), which save at once.

**Timer** (`TIMER` in core, mutated in place; persisted in `DB.timer` so a reload mid-session carries on):
`start() pause() resume() toggle() reset() skip() finish() setMode(mode) wind(seconds) left() progress() nextMode()`.
- `start()`: idle → running (new `sessionId`, `startAt`, `endAt = now + left`). `toggle()`: idle→start,
  running→pause, paused→resume.
- `reset()`: running/paused → idle with the planned duration; a focus session with ≥ 60 s elapsed counts as
  abandoned (`DB.counters.abandoned++`, and it breaks "no resets" streaks); emits `timer:reset {abandoned}`.
- `skip()`: to the next mode, idle. Skipping a focus session records nothing and doesn't advance the cycle.
- `finish()`: complete the current session now, as if time ran out (tests and dev).
- `setMode(mode)`: only when idle.
- `wind(seconds)`: set the time, in any state: idle → `dur = left = s`; running → `endAt = now + s`, `dur = elapsed + s`;
  paused → `left = s`, `dur = elapsed + s`. Clamp 60 s … 120 min. One-off: it doesn't change the default in settings.
- The clock is wall time (`Date.now()`), never frame-counted. Tick with your own `setInterval` (~250 ms) while
  running; emit `timer:tick` when the displayed whole second changes. `timer:milestone` once each at half, 5 min
  left and 1 min left (focus only, sessions ≥ 10 min).
- **Completion** (left reaches 0, or `finish()`): record the session (`kind planned actual start end taskId rating:null
  note:'' rogues music ok:true`), bump the active task's `done`, advance `cycle` after a focus session (long break
  after every `longEvery`), evaluate patches, emit `session:new`, `timer:done {mode, session, next, away}`, then set
  up the next mode (`timer:mode`) and auto-start it if `autoBreak` / `autoFocus` says so.
- **Away and back:** on `visible` and on boot, if a running session's `endAt` has passed, complete it with
  `end = endAt` (not now) and `away: true`; if auto-start chains, complete each in turn from its own end time.
- `setSpeed(f)`: dev/test only; time passes `f`× faster (also `?speed=f`).

**Tasks:** `addTask(title, est=1) → task` · `updateTask(id, patch)` · `removeTask(id)` · `toggleTaskDone(id)` ·
`setActiveTask(id|null)` · `moveTask(id, toIndex)` · `clearDoneTasks()` · `activeTask() → task|null`.
A new task becomes active if none is. Finishing a task with `done ≤ est` (and `done ≥ 1`) unlocks Shipped It.

**Rogues:** `captureRogue(kind, note='') → rogue` (counts toward the running/paused focus session) ·
`resolveRogue(id, done=true)` · `deleteRogue(id)` · `openRogues() → [unresolved with a note]`.

**Reflection:** `rateSession(id, rating 1..5, note)` → `session:rated`.

**Settings:** `setSetting(key, value)` → validate, save, sync `PREFS`, emit `settings {key, value}`. Changing a
duration while idle in that mode resets the displayed time to the new duration.

**Patches:** evaluate after every completed session, capture, task done, `recordBreak`, `recordGame`, and once on
boot (catch-up). Unlock = `DB.patches[id] = Date.now()` + `patch:unlock {id}` (one event per patch). Rules (exact):

| id | unlocks when |
|---|---|
| `first_tomato` `ten_down` `full_crate` `hundred_club` | completed focus sessions ≥ 1 / 10 / 50 / 100 |
| `hour_power` `deep_worker` | total focus seconds ≥ 3 600 / 18 000 |
| `hat_trick` `weekly_warrior` `monthly_master` | streak ≥ 3 / 7 / 30 (consecutive local days with ≥ 1 completed focus, ending today) |
| `night_owl` · `early_bird` | a focus session ends at local hour ≥ 22 or < 4 · at hour ≥ 4 and < 7 |
| `full_stack` | a cycle completes (`longEvery` focus sessions) all on one local day with no abandoned focus in between |
| `marathon` | ≥ 8 completed focus sessions on one local day |
| `weekend_shift` | completed focus on a Saturday and on the Sunday right after it |
| `clean_build` | 4 consecutive completed focus sessions (no abandon between) with `rogues === 0` each |
| `quarantine` · `rogues_gallery` | ≥ 10 rogues logged in total · at least one of each of the 6 kinds |
| `shipped_it` | a task marked done with `1 ≤ done ≤ est` |
| `hotfix` | a focus session completes ≥ 3 local days after the previous completed one |
| `lofi_forever` | ≥ 10 completed focus sessions recorded with `music === 'lofi'` and sound on |
| `exterminator` · `breathe_easy` | `recordGame('bughunt', score)` with score ≥ 25 · `counters.breathe ≥ 5` |

`hoodieToggle(id) → bool` (sew on / unpick; max 4, unlocked only; emits `hoodie {ids}`) ·
`recordBreak(kind)` (`'breathe'|'stretch'|'window'`, a finished activity) · `recordGame('bughunt', score)`.

**Stats:** `stats()` →
```js
{ today: { key, tomatoes, focusSec, rogues, goal, shipped },
  week: { start, version /* 'v2026.42' = ISO year.week */, days: [{ key, label /* 'Mon' */, tomatoes, focusSec }] /* ×7, Mon→Sun */, tomatoes, focusSec, rogues, shipped },
  streak: { current, longest, todayDone },
  heat: [{ key, tomatoes, future }] /* 84 days = 12 weeks, Monday-first columns, oldest first, ends with this week */,
  byHour: [24] /* completed focus sessions by start hour, last 30 days */,
  byRogue: { week: { kind: n }, all: { kind: n } },
  totals: { tomatoes, focusSec, sessions, rogues, shipped, avgRating /* 1..5 | null */, since /* first day key */ },
  recent: [/* last 30 sessions, newest first, each + taskTitle */] }
```
Cache it; invalidate on any change; emit `stats` after changes.

**Data:** `exportJSON() → string` · `exportCSV() → string` (one row per session) · `importJSON(text) → {ok, error}`
(accepts this app's export; validate and merge-safe: replace, then `data {op:'import'}`) · `clearAll()` ·
`markOnboarded()`. `seed('demo')` (dev only: ~6 weeks of plausible sessions, tasks, rogues and a few patches for
screenshots; sets `DB.meta.demo = true` and emits `data {op:'seed'}`).

**v1 migration** (once, on boot, when `DB.meta.migratedV1` is false and the v1 keys exist): read the old Zustand
keys `pomo-sessions-v1`, `pomo-tasks-v1`, `pomo-settings-v1`, `pomo-achievements-v1` with `store.raw()` (format
`{"state": {…}, "version": n}`; exact shapes in the old source `src/stores/*.ts`, `src/types/index.ts`). Map sessions
(`shortBreak` → `short`, `longBreak` → `long`, ISO → ms, `focusRating` → `rating`), tasks (`completedSessions` →
`done`, `est = max(1, done)`), settings (`workDuration` → `focusMin`, …, `ambientSoundEnabled` → `music: 'lofi'|'off'`,
theme `light` → `day`, others → `night`), achievements → patches via `TEXT.patches[].v1` (keep the unlock dates).
**Never delete or change the v1 keys.** Set `DB.meta.migratedV1 = true`, `DB.meta.v1Sessions = n`, emit
`data {op:'migrated', n}`. Test it with `tools/shot.mjs --v1 test/fixtures/v1.json`.

**Platform:** while running: `document.title = '24:56 · Focus'` (idle: the app name) · Screen Wake Lock if
`settings.wakeLock` (release on pause/idle, re-request on `visible`) · on `timer:done` while hidden (or the window
isn't focused) and `settings.notify`: a notification (`TEXT.notify`; via `navigator.serviceWorker.ready` →
`showNotification` when available, else `new Notification`) · `requestNotify() → Promise<permission>`.

**The Changelog sheet** (the Engine owns its content): `SHEET.def('log', { title: 'Changelog', size: 'tall', render })`.
Sections: a header with `week.version` and a one-line summary; Today (tomatoes vs goal as a ring of tomatoes, focus
time, rogues); streak (current, longest); this week as bars; the 12-week **crate** (84 cells, each a tiny tomato
whose ripeness shows the count: empty slot · green · orange · red); when you focus (24-hour histogram); the
**rogues' gallery** (six rogues, `Patch.rogueURL(kind)` images when available, counts this week / all time, the top
one called out); recent sessions (time, length, task, rating, note, rogues); and the weekly **patch notes** block
written like release notes ("Shipped: 3 tasks · 18 tomatoes · Fixed: 4 rogues quarantined · Known issue: Zatsu (6)").
Inline SVG and CSS only; prefix `lg-`; refresh on `stats` while open.

### 8.2 Snd (`src/30-audio.js`, files in `public/audio/`)

`init()` · `sfx(name, {vol, rate, delay}) → {stop()}` · `music(bed | null, {fade})` (beds: `'focus' 'break' null`;
normally the module directs itself from timer events, so others rarely call this) · `preview(channel)` (Settings: a
3-second taste of `'lofi'|'rain'|'city'`) · `haptic(name)` (`tick start done capture error`) · `setVolume(kind, v)`
(`'master'|'music'`) · `mute(on?) → muted` · `muted` · `beat() → {playing, phase 0..1, bpm}` (Patch nods on the beat) ·
`level() → 0..1`. Every call is a silent no-op before the first gesture or when muted or when a file is missing.
Set up the Media Session (title, artist "Patch", play/pause → `Engine.toggle()`) so lock-screen controls work.

- **Effects** (synthesise with WebAudio where it sounds good; tiny files otherwise): `tap open close toggle start
  pause resume reset skip wind_tick wind_release bell chime capture quarantine unlock sew ship harvest pop squash
  split test breath_in breath_out error whoosh type`. Also respond to BUS `sfx {name}`.
- **Music** (DESIGN.md §8): channels from `settings.music` (`'lofi' 'rain' 'city' 'off'`); the director: focus
  running → focus bed; break running → break bed; paused → duck to ~30%; idle → fade out (3 s). Crossfades, never
  hard cuts. Loops must be gapless. **Load music lazily** (after the first gesture, only the channel in use) with
  `fetch` → `Blob` → object URL on an `<audio>` element (streams compressed audio, works offline through the service
  worker; don't decode long files into AudioBuffers: an old phone runs out of memory). Gapless: two elements and a
  short crossfade at the loop point, or loop points baked in.
- **Sources you may reuse:** Patch's lo-fi loop and friends from Patch Notes, in the vault at
  `Tools/patch-notes/audio/` (`m_shop.mp3` = her lo-fi, 54 s seamless loop, 80 BPM; `m_title.mp3` = rain and Rhodes,
  no drums, 30 s loop; `amb_rain.mp3`, `amb_neon.mp3`, `amb_room.mp3`; `AUDIO.md` has how they were made and cut).
  Don't use `m_sidea` (its story isn't public). You may generate a few new lo-fi tracks with the ElevenLabs tools
  for variety (budget in your brief). Keep every file small (≤ 96 kbps, mono for ambience).
- `public/audio/AUDIO.md`: what each file is, where it came from, prompts and generation ids, loop points, sizes.

### 8.3 Patch (`src/40-patch.js`)

`init()` · `bake() → Promise` · `update(dt)` · **`draw(c, x, y, size, opts)`**: draw Patch with `c` already in CSS-px
space (the Scene sets `setTransform(DPR,0,0,DPR,0,0)`); `(x, y)` = the point on the desk's back edge under her
centre; `size` = her full standing height in CSS px (most of her lower body is hidden by the desk the Scene draws
after her). `opts`: `{dim}` (heads-down) · `say(text, {ms, force})` / `sayLine(key, vars, opts)` (speech bubble in
`#bubble`; respects `PREFS.talk` unless `force`; queues; never during a running focus unless it's a reaction to a tap
or a capture) · `pose(name, {hold})` · `anchor() → {x, y}` (CSS px above her head) · `hand() → {x, y}` (her pointing
hand, for the zap beam) · `hit(x, y) → bool` · **`rogue(kind) → canvas|null`** and **`rogueURL(kind) → dataURL|null`**
(the six rogues as small baked sprites, ported from the cast sheet; emit `rogues:ready` when baked) · `ready`.

She drives herself from BUS events (DESIGN.md §6, §7): greeting on `ready` (after onboarding), `type` while a focus
runs (nodding to `Snd.beat()`), `cheer` on `timer:done`, `zap` on `rogue:capture`, activity poses from `activity` and
`activity:step`, `doze` after ~3 minutes idle, reactions to `scene:tap {id:'patch'}`, lines on `task:change` done,
`patch:unlock`, `session:rated`, `timer:wind` (custom times), `patch:say`. Her hoodie shows up to four patches from
`DB.hoodie`, drawn from `UI.badgeSVG(id)` (fall back to a stitched circle in the patch's colour).

### 8.4 Scene (`src/45-scene.js`)

`init()` · `bake() → Promise` · `layout()` · `update(dt)` · **`draw(c)`** (the whole canvas, every frame; start with
`c.setTransform(DPR,0,0,DPR,0,0)`) · `tap(x, y) → id|null` (emit `scene:tap`) · `hover(x, y) → bool` ·
`burst(kind, x, y)` (`'confetti' 'sparkle' 'zap'`) · `plant() → {x, y}` (where tomatoes land).

The room (DESIGN.md §3, §4): the window and the city, with the sky following `DAY.hour()` (dawn, day, dusk, night)
and re-baked on `daypart`; rain on the glass (`settings.weather`: `'auto'` = a rainy day roughly 2 days in 5, seeded
by date; always rain when `settings.music === 'rain'`); her holo-terminals with scrolling code; the desk below
`LAYOUT.deskY` with lamp light and a contact shadow under the tomato at `LAYOUT.dial`; props: mug with steam, a lo-fi
radio (its EQ bars move with `Snd.beat()`), the **tomato plant** on the sill (one tomato per completed focus today,
ripe red, plus green buds for the rest of `dailyGoal`), the **quarantine jar** (today's captured rogues as tiny
blobs with crimson eyes). Patch is drawn between the room and the desk. Effects: confetti glyphs on `timer:done`, the
harvest flight on `harvest`, a rogue popping in and being zapped into the jar on `rogue:capture`, lightning when
rain starts. Heads-down: dim the room to the screens and the window. Hotspots → `scene:tap` ids: `patch plant window
mug screens radio jar` (the window cycles `settings.weather`; the radio cycles `settings.music` via
`Engine.setSetting`). In `LAYOUT.wide`, keep the right column (`LAYOUT.ui`) a calm, darker part of the wall.

### 8.5 Dial (`src/50-dial.js`)

`init()` · `layout()` (may refine `LAYOUT.dial`) · `update(dt)` · `key(e) → bool` · `rect() → {x, y, w, h}`
(the tomato, CSS px) · `activity(id|null)` (`'window' 'breathe' 'stretch' 'bughunt'`) · `focusMode(on)`
(sets `FOCUSMODE.on`, `html.heads-down`, emits `focusmode`).

- **The tomato** (DESIGN.md §4): DOM + inline SVG. The cream band around its waist carries minute ticks and numbers
  (0–90) and **slides horizontally under a fixed mint pointer** to show the minutes left. **Drag the band to wind**
  (1:1 with the finger, detents every minute with `Snd.sfx('wind_tick')` + `Snd.haptic('tick')`, inertia on fling);
  releasing a wind while idle starts the timer (`Engine.wind` then `Engine.start`); tap the tomato to start/pause.
  While running, the band glides on the compositor (one CSS transition over the remaining time; `RM()`: step once a
  second). **Ripening:** during focus the tomato goes green → orange → red by cross-fading pre-rendered colour layers
  (opacity transitions), driven by `Engine.progress()`. `role="slider"`, arrow keys, `aria-valuetext` like
  "24 minutes left".
- **On `timer:done`:** shake like a ringing kitchen timer, then at ~1.1 s emit `harvest {x, y, r}` with the tomato's
  centre and pop it off; a fresh tomato grows in for the next session.
- **Readout & controls:** big `mmss` digits, the mode label, cycle dots (●●○○), the active task chip (opens
  `SHEET.open('tasks')`), Reset · Start/Pause · Skip, mode chips (Focus / Short / Long, idle only), **Distracted?**
  (while a focus session is running or paused → `SHEET.open('capture')`), and the heads-down toggle.
- **Breaks:** while a break runs, offer the four activities from `TEXT.breaks` and, if this focus captured rogues
  with notes, "Review N for later" (`SHEET.open('tasks', {section: 'later'})`). Activities run in `#activity`:
  window (a 20 s look-away), breathe (box breathing, an expanding ring, `activity:step {breath}`), stretch (the steps,
  with `activity:step {pose}` so Patch demonstrates), **Bug Hunt** (45 s: Bagu bugs crawl across the screen; a tap
  splits a bug in two smaller ones, the smallest squash; a rare "test" pickup clears the screen — Bagu's canon; DOM
  sprites from `Patch.rogueURL('bagu')`, transforms only). On finishing: `Engine.recordBreak(kind)` /
  `Engine.recordGame('bughunt', score)` and `activity {id, phase:'end', done, score}`. Activities end cleanly if the
  break ends first.
- **Heads-down** (`F`): hide the chips and dim the controls until touched; `Esc` leaves.

### 8.6 UI (`src/60-ui.js`)

`init()` · `layout()` · `update(dt)` · `key(e) → bool` · `open(id, arg)` · `close()` · `isOpen() → id|null` ·
`busy() → bool` · `toast(text, {icon, color, ms})` · `confirm(text, {ok, cancel, danger}) → Promise<bool>` ·
**`badgeSVG(id) → string`** (a complete `<svg viewBox="0 0 100 100">`: an embroidered patch with a satin-stitch
border and a bold pictogram, one per `TEXT.patches` id; Patch draws these on her hoodie).

- **Sheet system:** renders `SHEETS[id]` (`title`, `size: 'tall'|'half'|'auto'`, `render(body, arg)`, `opened(arg)`,
  `closed()`; optional: `retarget(arg)` (re-opened while open), `refresh()`, `esc() → bool` (consume Esc), `key(e)`,
  `focus(panel)`, `bare: true` (no title row)); bottom sheet on phones (drag down or tap the scrim to close), right panel when `LAYOUT.wide`; focus
  trap, Esc, returns focus to the opener; emits `ui:sheet`. One sheet at a time; `confirm` stacks above.
- **Top bar:** the wordmark; today's tomatoes vs goal (a mini tomato + "3/8"); the streak (flame + days); mute;
  heads-down. Fades away in heads-down. **Dock:** Tasks · Changelog · Patches · Settings, with a dot on Patches when
  an unlock hasn't been seen, and the open-task count on Tasks.
- **Sheets you own:** `tasks` (add with an estimate in tomatoes, set active, mark shipped with a stamp, reorder,
  delete, clear shipped, and the **For later** list of quarantined notes; `arg.section === 'later'` scrolls there) ·
  `patches` (the 22 patches: locked ones as stitched outlines, tap for details, sew on / unpick, max four) ·
  `settings` (every key in `defaultSettings()`, grouped: Timer · Sound · Patch · Display · Data; previews; notification
  permission; export JSON/CSV as downloads, import, delete all with confirm; about + credit) · `capture` (the six
  rogues as big cards: sprite, name, `what`, examples; an optional note; Quarantine it → `Engine.captureRogue`) ·
  `reflect` (after a focus session if `settings.reflect`: Rough / Fine / Locked in + note → `Engine.rateSession`;
  opened ~2.6 s after `timer:done`, never when `away`) · `onboard` (first run: the four `TEXT.onboard` cards, then
  `Engine.markOnboarded()` and `onboard:done`; mention migrated v1 sessions) · `help` (the key map).
- **Toasts:** patch unlocks (the badge, the name), task shipped, import done; queued, one at a time, never over an
  open sheet's buttons.

## 9. Look, feel, speed

- **Style:** DESIGN.md. Neo Dojo vector style; the palette in `PAL` / CSS variables; Dela Gothic One + JetBrains Mono.
- **Native on a phone:** portrait first; 44 px hit areas; drags follow the finger 1:1; haptics on detents and big
  moments; nothing selects, zooms or pulls-to-refresh; respect the safe areas (`LAYOUT.safe`, `--sat` …).
- **Native on a desktop:** hover states, the pointer cursor on anything interactive, the key map, crisp at DPR 1 and 2.
- **Reduced motion** (`RM()`): no shakes, flights, confetti or parallax; cross-fades instead; fully usable.
- **Speed budget** (the target is an old, slow phone): at `--throttle 4`, 390x844@2, **work median ≤ 4 ms and
  p95 ≤ 8 ms per frame** in every phase (idle, focus running, break + activity, a sheet open, winding, the
  celebration), measured with `tools/perf.mjs`. Your module's share: Patch ≤ 1 ms, Scene ≤ 2 ms (incl. Patch), Dial
  and UI ≈ 0 while nothing moves. Rules:
  - **Canvas:** bake everything static in `bake()` and blit. No `shadowBlur`, no `filter`, no per-frame gradients,
    no per-frame `getImageData`, canvas creation, string building or closures in hot paths. Glow = baked sprites +
    `globalCompositeOperation = 'lighter'`. Particles in typed arrays, capped by `QUALITY[QL].parts`.
  - **DOM:** while timing, change the DOM at most once a second (the readout). Animate only `transform` and `opacity`.
    No layout reads after writes in the same frame. `will-change` only on the few elements that move continuously.
    No `backdrop-filter` at q ≥ 2. Heavy sheets build their DOM on open, not at boot.
  - **Boot:** first paint fast; build sheets lazily; bake the rogue sprites after `ready` in idle time.
  - **Memory:** music streams through `<audio>`; images baked at the size they're shown.

## 10. Testing hooks and the definition of done

- `window.__pomo` (main): `ready VERSION BUS TIMER LAYOUT QUALITY TEXT DB QL ERR mods emit start pause toggle reset
  skip finish wind speed sheet close activity focusMode seed quality layout perf perfReset errors stop`.
- URL: `?speed=60` (Engine time multiplier) · `?hour=22` · `?q=0..3` · `?dev=1` · `?nosw=1`.
- Tools: `tools/shot.mjs` (steps, screenshots, console + module errors), `tools/perf.mjs` (throttled phases).
- `node --test` (from the repo root; it finds `test/*.test.mjs`) (the Engine's unit tests: the timer, away-and-back, cycles, every patch rule, stats, migration).
- **Done means:** your module works in isolation and with every other real module; zero console errors and zero
  `__pomo.errors()` in your flows at all four sizes and both themes; reduced motion works; your perf numbers are inside
  the budget at 4×; your report is written.

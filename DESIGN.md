# Patch's Pomodoro — design

*The look, the feel and the voice. CONTRACT.md says how the code fits; this file says what it should feel like.
Where they disagree, CONTRACT.md wins on code and this file wins on taste.*

## 1. The bar

Josh's ask (2026-10-12), verbatim: *"Update and upgrade the app. You may even rebuild it from the ground up. Your goal
is to build a stunning and creative pomodoro timer. It needs to have interactive parts and features that make it stand
out. You can use Patch from Smart Disruptions as the mascot for it. It needs to run fast even on an old and slow mobile
device. Blow me away."*

So: **stunning, creative, interactive, Patch, fast on an old phone.** Every feature earns its place by being one of
those. A pomodoro app is opened every day, so it must also be *calm*: delight lives at the edges (winding, finishing,
breaks, tapping things), never in the middle of a focus session.

## 2. The idea in one paragraph

You're in **Patch's room above the Neo Dojo city**. Lo-fi on, rain on the window, her three holo-terminals glowing.
On the desk in front of you sits a **wind-up tomato kitchen timer** that Patch modded. You **drag the tomato's band to
wind it**, it clicks through the minutes, and when you let go it starts ticking. While you focus the tomato **ripens
from green to red**. When it rings, Patch cheers, the ripe tomato is **picked and grows on her windowsill plant**, and
the break begins: look out the window, breathe with her, stretch with her, or squash bugs for 45 seconds. When a
distraction shows up mid-focus you tap **Distracted?** and name the rogue that tried it (the six Neo Dojo rogues are
the six kinds of distraction); Patch quarantines it for later and you keep going. Achievements are **embroidered
patches** you can sew onto her hoodie. Your stats are a **changelog**. It all runs offline, in one small file.

## 3. The screens

### Portrait phone (the primary target, 390×844 and down to 375×667)
```
┌──────────────────────────────┐
│ PATCH'S POMODORO   🍅3/8 🔥5 │  top bar (UI): wordmark · today/goal · streak · heads-down
│  ┌────────────────────────┐  │
│  │  sky + city (real time)│  │  the room (Scene, canvas): window, rain, neon city,
│  │ ▫   holo    holo    🌱 │  │  holo-terminals, the tomato plant on the sill (today's
│  │      ( Patch )         │  │  harvest), mug, radio — Patch behind her desk
│ ═══════════════════════════  │  ← LAYOUT.deskY: the back edge of the desk
│         ╭──────────╮         │
│        (  tomato    )        │  the tomato timer (Dial): drag the band to wind
│        ( ═1|5═20═25 )        │
│         ╰──────────╯         │
│            24:56             │  readout (Dial): big mono digits
│      FOCUS · ●●○○  ⓘ task    │  mode, cycle dots, the task you're on
│     ↺   [ ❚❚ Pause ]   ⏭     │  controls (Dial) · Distracted? appears while focusing
│ Tasks  Changelog Patches  ⚙  │  dock (UI) → sheets
└──────────────────────────────┘
```
### Landscape phone and desktop (`LAYOUT.wide`)
The room fills the left (Patch bigger, more city). The right column (`LAYOUT.ui`) holds the tomato, readout and
controls on a darker part of the wall, so they read clearly. Sheets open as a right-hand panel instead of a bottom
sheet. Nothing required is ever only in the extra width.

### Heads-down mode
One tap (or **F**): the top bar and dock fade away, the room dims to her screens and the window, the controls fade
to a whisper until touched, and the screen stays awake. The tomato and the time stay.

## 4. Look

- **Style: the Neo Dojo / Kiru vector style.** Flat shapes with soft 2–3 stop gradients, the moonlit sticker outline
  `#3d4c95` around characters, a cool moon rim light (`#a9bcff`) from the window side, warm amber key light from the
  desk lamp, and each character's one signature neon. Patch's is **mint `#3dffc2`**; she owns that colour in this app.
  Reference: `Tools/neo-dojo-cast/index.html` in the vault (`// 05 PATCH`, the rogues `RG-01…06`) and the Patch
  Notes rig (`Tools/patch-notes/src/35-cast.js`).
- **Palette** (core `PAL`, CSS vars in `shell.html`): night `#0c0f22`, panels `#151a35/#1b2145`, outline `#3d4c95`,
  moon `#a9bcff`, text `#eef1f8`, muted `#9aa3cf`; mint `#3dffc2` (focus, Patch, primary actions); amber `#ffb35c`
  (breaks, warmth); gold `#f5c542` (patches, streaks); tomato `#ff4a3d` / deep `#c8231a` / highlight `#ff9a86`;
  unripe `#8fd14f` / `#4e9a2e`; leaf `#2fbf71` / `#1b7a45`; rogue crimson `#ff2340`.
  **Day theme** swaps the chrome to warm paper (`#f4efe6` / `#fffaf2`) with ink text; the room itself follows the
  real clock either way (dawn, day, dusk, night skies).
- **Type:** Dela Gothic One for the wordmark and sheet titles (caps, the Kiru brand face); JetBrains Mono 700 for the
  timer, labels and anything Patch "types"; the system UI font for body text. Both brand faces are subset and inlined
  (13 KB total). Labels: mono, 11–12 px, uppercase, `letter-spacing: .14em`.
- **Shapes:** generous radii (16–24 px sheets and cards, pills for buttons), 44 px minimum hit areas, soft shadows
  only on things that float (sheets, the tomato, toasts). Icons: core `ICON()` (24×24 stroke set) everywhere.
- **The tomato** is the hero object: glossy, slightly lobed, a cream timer band around its waist with black minute
  ticks and numbers, a mint pointer notch, a crown of leaves and a stem. It should look like you could pick it up.
- **Patch's patches** (achievements) look embroidered: a satin-stitch border (dashed stroke), a twill fill, a simple
  bold pictogram, each in its own colour (`TEXT.patches[].color`).

## 5. Motion

- **Springy, physical, short.** `--ease` for most moves, `--ease-back` for things that land. 140 / 260 / 480 ms.
- **Calm during focus.** While a focus session runs: no bouncing, no speech, no flashing. Allowed: the band creeping,
  the tomato ripening, Patch typing and nodding to the beat, rain, the city's slow lights.
- **Celebrate at the edges.** Finishing a tomato is the big moment (§7). Winding, starting, capturing a rogue,
  shipping a task, unlocking a patch each get a small, distinct beat.
- **Reduced motion** (`RM()`, `html.rm`): no shakes, no confetti flights, no parallax; state changes cross-fade.
  The band steps once a second instead of gliding. Everything still works.

## 6. Patch

- **Canon (public cast bio):** "She ships hotfixes from a hoodie. Her glasses show three terminals at once, and her
  headphones play lo-fi and nothing else, ever." A Black woman hacker: afro under her headphones, mint holo-glasses,
  gold hoops, a hoodie with `</>` on it. Don't add backstory. (Patch Notes added family canon that isn't public yet;
  keep it out of this app.)
- **Where she is:** behind her desk, upper body visible above `LAYOUT.deskY`. Her holo-terminals float beside her.
- **What she does** (poses): `idle` (breathing, blinking, glancing at you), `type` (focus: headphones on, typing on a
  holo keyboard, nodding to the beat), `think`, `sip` (tea), `stretch_up`, `shoulders`, `neck`, `shake`, `breathe`
  (eyes closed, shoulders rise and fall), `cheer` (a tomato finished), `wave` (hello), `zap` (she points her holo-glove:
  a rogue is quarantined), `doze` (idle a long time: head nods, a small "z"), `startle` (tapped mid-doze).
  Expressions: `neutral smirk think surprise sad determined laugh sleepy`.
- **When she talks:** short lines from `TEXT.lines` in a speech bubble by her head. On open (a greeting by time of
  day), on finishing, on breaks, on capturing a rogue, on shipping a task, on a new patch, and when tapped. **Never
  during a running focus session** unless tapped or a rogue is logged. Setting "Patch talks" off silences her (she
  still reacts with poses).
- **Her hoodie:** up to four sewn-on patches, chosen in the Patches sheet, drawn small on her hoodie.

## 7. The big moment: a tomato finishes

| t (s) | what happens | owner |
|---|---|---|
| 0.0 | the bell rings; the tomato shakes like a real kitchen timer (≈1 s, decaying) | Audio, Dial |
| 0.0 | Patch jumps into `cheer`; `</>` `{}` `;` glyph confetti in mint and gold bursts from her screens | Patch, Scene |
| 1.1 | the ripe tomato pops off the dial and arcs into the plant on the sill (Dial emits `harvest`; Scene flies it) | Dial, Scene |
| 1.6 | a new tomato appears on the plant with a little bounce; the top bar count ticks up | Scene, UI |
| 1.8 | Patch says a `done_focus` line | Patch |
| 2.6 | the reflection sheet slides up (if on): Rough / Fine / Locked in, and an optional note | UI |
| after | patch unlocks toast in, one at a time; the break is ready with its four activities | UI, Dial |

With reduced motion: the bell, a cross-fade, the count, the line. No flights, no confetti.

## 8. Sound

- **Lo-fi first.** Patch's lo-fi loop (from Patch Notes, `m_shop`, 80 BPM) and a calmer rain-and-Rhodes bed for
  breaks, plus new lo-fi tracks for variety. Channels: Lo-fi radio, Rain, Night city, Off.
- **Music follows the timer:** focus running → the focus bed; break running → the break bed; paused → ducked;
  idle → fades out. Nothing plays before the first tap (autoplay rules) and nothing plays when muted.
- **Effects are small and physical:** a ratchet click per wound minute, a "clack" on start, the bell, a leaf-rustle
  pop on harvest, a glitch-zap and a jar clink on quarantine, a stamp on shipping a task, a zip-zip of embroidery on a
  new patch, a squish on a bug. Synthesised where possible (tiny, instant), quiet, never harsh.
- **Haptics** (Android) mirror the important sounds: detents, start, finish, capture.

## 9. Words

All copy lives in `src/10-text.js`. Patch: dry, warm, short, first person. Interface words: plain and direct
("Start", "Tasks", "Delete all data"). Never label the person using it. The stats sheet is a **Changelog**
("v2026.42 · 18 tomatoes shipped · 4 rogues quarantined · known issue: Zatsu (6)").

## 10. Accessibility

Real buttons with labels; the tomato is a `role="slider"` (arrow keys wind it, Enter starts); a polite live region
announces state changes (`ANNOUNCE`); focus is trapped in open sheets and returns to the opener; contrast ≥ 4.5:1 for
text in both themes; nothing relies on colour alone (the cycle dots are filled vs hollow; rogues have names).
Keyboard map in CONTRACT.md §6.

## 11. Speed is a feature

The target is an old, slow phone. One file, no libraries, no network after the first load. The room is baked into
a few canvases and blitted; the tomato's band and ripening run on the compositor (transform and opacity only);
the DOM changes once a second while timing. Quality steps down by itself on a device that can't keep up.
Budgets and rules: CONTRACT.md §9.

# Patch's Pomodoro — audio

Every sound the app makes: where it came from, how it was cut and measured, and how `Snd` (`src/30-audio.js`) plays it.
Built 2026-10-12. Nobody listened by ear while making it: every pick and cut was made by measuring (loudness, beat grid,
spectrograms viewed as images, waveform correlation). Josh is the first listener.

**Seven files, 2.90 MB in all.** Everything else (about forty effects) is synthesised in the browser.

| File | What | Source | Length | Loop | Beats | First downbeat | Loudness | True peak | Size |
|---|---|---|---|---|---|---|---|---|---|
| `lofi-1.mp3` | Patch's lo-fi (track 1 of the radio) | Patch Notes `m_shop` | 53.999 s · 2,381,356 smp | seamless | 72 (80 BPM) | 2.947 s | −18.5 LUFS | −4.6 dBTP | 649,508 B |
| `lofi-2.mp3` | lo-fi, F major, Rhodes and koto (track 2) | new: ElevenLabs `kTRu8EDbfcPRoQNKuRvL` | 60.000 s · 2,646,020 smp | seamless | 80 | 0.025 s | −18.5 LUFS | −4.4 dBTP | 721,293 B |
| `lofi-3.mp3` | lo-fi, D minor, guitar and shamisen (track 3) | new: ElevenLabs `o7GuDGM1QP0HQn70ezNZ` | 72.001 s · 3,175,227 smp | seamless | 96 | 0.029 s | −18.4 LUFS | −3.5 dBTP | 865,489 B |
| `break-1.mp3` | the break bed: rain and Rhodes, no drums | Patch Notes `m_title` | 30.022 s · 1,323,980 smp | seamless | 40 | 2.921 s | −18.5 LUFS | −5.4 dBTP | 361,743 B |
| `rain.mp3` | the Rain channel (mono) | Patch Notes `amb_rain` | 14.920 s · 657,972 smp | seamless | — | — | −23.8 LUFS | −1.4 dBTP | 180,558 B |
| `city.mp3` | the Night city channel (mono) | new: ElevenLabs `ODCtzwXVT2yBfEivSTU5` + Patch Notes `amb_neon` | 20.000 s · 882,000 smp | seamless | — | — | −24.5 LUFS | −5.9 dBTP | 241,371 B |
| `bell.mp3` | the kitchen-timer bell (mono) | new: ElevenLabs `C8lF5xL0cTtoQocr2wpP`, reshaped | 1.950 s | one-shot | — | — | −17.6 (100 ms) | −1.6 dBFS | 24,137 B |

Loudness is integrated (EBU R128) over the decoded file; lengths are what a gapless decoder returns (ffmpeg and Chromium
both return exactly these sample counts). The Patch Notes originals (`Tools/patch-notes/audio/` in the vault, where
their own `AUDIO.md` tells how they were made) were copied and re-encoded, never modified. `m_sidea` was not used: its
story isn't public.

## How each file was made

### Encoding, and why the loops have no seam

All files are 44.1 kHz MP3, CBR 96 kbps (music stereo, everything else mono), encoded with libmp3lame through
ffmpeg 6.1. A plain MP3 can't loop cleanly: the encoder adds silence at both ends, and its first and last frames are
coded against that silence. So every loop was encoded **wrapped in itself**: its last 1152 samples go in front, its
first 1152 behind, and the LAME tag's encoder-delay and padding fields are then moved to cover them (delay 576 → 1728,
padding + 1152; the tag CRC recomputed, LAME's convention). A gapless decoder returns the loop exactly, and the
samples either side of the seam were coded with the real music around them. Checked: ffmpeg and Chromium's
`decodeAudioData` both return the exact sample counts above.

Chromium's `<audio loop>` still leaves a hole at the wrap (measured by recording the element's output: 12.2 ms for a
PCM WAV, 33.6 ms for a standard gapless MP3, 50.9 ms for an MP3 without the tag). So on Chromium `Snd` plays loops
through a MediaSource instead: it appends the same MP3 again and again with
`timestampOffset = k·L − 2257/44100` and an append window of exactly `[k·L, (k+1)·L)` (2257 = 1728 encoder delay +
529 decoder delay). Recorded across the seam, the output matches the decoded loop sample for sample (offset 0,
correlation ≥ 0.9998 for `lofi-3`, 0.986 for the noise of `rain`). Because of the wrap-around padding, an error of up
to ±1152 samples in that offset would only rotate the loop, never open a gap.

### Music: loudness and the beat grid

Music is normalised to **−18 LUFS** (true peak under −3 dBTP), the rain and the city to about −23.5 and −24.5.
The beat grid was measured on each final file: onset strength (log-band spectral flux, 5.8 ms frames) folded on a
Fourier comb at 70–90 BPM (fundamental plus harmonics) gives tempo and beat phase; the downbeat is the beat class with
the most harmonic change and the strongest kick. All four music files are exactly 80 BPM (ElevenLabs keeps strict
time); each loop is a whole number of bars, so `beat()` works from `currentTime` alone.

### `lofi-1` and `break-1` (Patch Notes)

Already seamless loops (`m_shop`: 18 bars; `m_title`: 10 bars). Decoded, set to −18 LUFS (+0.4 and 0 dB), re-encoded
as above. `m_shop`'s loop starts 51 ms after a downbeat (so its first downbeat in the file is at 2.947 s).

### `lofi-2` and `lofi-3` (new)

ElevenLabs Music v2.5 (`eleven_music_v2_5`), instrumental, 100 s, two takes per track, on the flow
**[Patch's Pomodoro audio](https://elevenlabs.io/app/flows/F1r0iAhpNEdjXlSyeoae)** (flow `F1r0iAhpNEdjXlSyeoae`). The
prompts describe sound only (no artist, song or franchise), in the family of `m_shop`.

| Track | Prompt | Takes | Pick and why | Cut |
|---|---|---|---|---|
| `lofi-2` | Warm, mellow lo-fi hip hop instrumental at 80 BPM in F major. Dusty laid-back boom-bap drums with a soft kick, a gentle snare on two and four and lightly swung hi-hats, warm Rhodes electric piano chords with a slight tape wobble, a round soft bass, and a few sparse koto plucks answering the chords, with vinyl crackle and quiet rain throughout. Calm, focused late-night mood; it starts on the full groove and stays steady and even all the way through, with no intro, no breakdown and no big changes, an unobtrusive background bed. | `xtpAVjgvJMzyKCpVXOMl`, `kTRu8EDbfcPRoQNKuRvL` | `kTRu8…`: brighter (spectral centroid 224 Hz, close to `m_shop`'s 187 Hz; the other take sits at 95 Hz, almost all sub-bass, and its melody only enters at 37 s), a 28-bar body. Its second half has 2 dB less bass and 3 dB more melody: a gentle A/B within the loop. | bars 10 → 30 (20 bars) from 32.92 s; end nudged +0.5 ms |
| `lofi-3` | Soft, dreamy lo-fi hip hop instrumental at 80 BPM in D minor. Dusty relaxed boom-bap drums with a head-nodding groove, muted jazz guitar chords and mellow Rhodes electric piano, a deep round bass, and an occasional gentle shamisen pluck, with vinyl crackle and quiet rain throughout. Cozy and focused, working late with the city lights outside; it starts on the full groove and stays steady and even all the way through, with no intro, no breakdown and no big changes, an unobtrusive background bed. | `aYfuBIfAeTQly52V1DB4`, `o7GuDGM1QP0HQn70ezNZ` | `o7GuD…`: the steadiest (±0.3 dB per bar over 28 bars; the other alternates ±0.8 dB and is duller, −33.8 dB above 4 kHz) and the most self-similar at 24 bars. | bars 4 → 28 (24 bars) from 14.94 s; end nudged −3.9 ms |

Both models ignored "no intro": every take opened with 4 bars without bass and ended with an outro, so the loops come
from the steady bodies. **How a loop was cut:** a search over bar-aligned start/end pairs (16, 20, 24, 28 bars inside
the body) scores how alike the bars around the end are to the bars around the start (log-band energy, chroma and
onset pattern in eighth-bar cells, each z-scored against the body so the shared bass doesn't swamp it); the end is then
nudged ±120 ms to line up the drum onsets (onset cross-correlation, 1.45 ms frames). The 1.5 s that follow the end
are crossfaded into the head, equal-power per band (split at 220 Hz) with the gain corrected for each band's
correlation (`lofi-2` low band ρ = +0.47, `lofi-3` ρ = −0.02), so phase-aligned bass doesn't bump and anti-phase bass
doesn't dip. The file's end runs straight into its start: the spectral change across the seam is 0.94 for `lofi-3`
(median frame-to-frame change 0.81, 99th percentile 3.67) and 1.60 for `lofi-2` (0.80 / 3.51).

**Cost:** 1,499.67 credits a take × 4 = **5,998.7 credits** (the estimate had said 11,000), 27.3¢ a take.

### `city` (new, plus Patch Notes' neon sign)

ElevenLabs Sound Effects v2 (`eleven_text_to_sound_v2`), 20 s, prompt influence 0.45, loop mode, two takes:
*"Distant city at night heard through an open window high above the street, soft steady traffic hum, faint far-off
car passes, gentle wind, calm and continuous, no sirens, no voices, no music."* Pick: `ODCtzwXVT2yBfEivSTU5`; the other
(`azQaiAbA8iDzEMZ6GOE3`) has a ~15.6 kHz whine through its first third. The take is a steady low traffic hum and loops
by itself (wrap step 0.0005 against a 99th-percentile step of 0.0008). Patch Notes' `amb_neon` (a neon sign buzzing
outside a window) is layered 10 dB under it, made to the same 20.000 s with a 1 s correlation-compensated crossfade
(ρ low −0.26), then the mix is set to −24 LUFS. 66.66 credits a take.

### `rain` (Patch Notes)

`amb_rain` (steady night rain, already a seamless 14.92 s loop), +5.6 dB to −23 LUFS (measured −23.8 on one pass),
mono, re-encoded as above.

### `bell` (new, reshaped)

ElevenLabs Sound Effects v2, 2 s, influence 0.6, two takes: *"Mechanical wind-up kitchen timer ringing, a fast metal
hammer trill on a small bright steel bell for about one second, then the ring decays, close-mic, dry room."* Both are
genuine-sounding rings: a bouncing clapper (strikes in pairs ~6–12 ms apart, ~16 a second) on a bell with inharmonic
modes. Pick: `C8lF5xL0cTtoQocr2wpP`, the less shrill (centroid 6.6 kHz; the other, `AU3cHQDbfWtgEHxOWZI1`, is
9.1 kHz with a mode at 11.5 kHz at full level). Its modes: 1.70–1.74 kHz (a beating doublet), 4.5 kHz, 7.95 kHz (the
loudest), 11.3 kHz. As generated it rings flat for 1.5 s and stops dead, so it was reshaped:
- the full trill for 0.32 s, then the spring runs down (an exponential, τ 0.36 s);
- the strikes end at 1.36 s and a ring-out of the bell's own modes takes over (a 1717/1726 Hz doublet for a slow 9 Hz
  shimmer, 4.51, 7.95 and 11.26 kHz), at the level of the last 80 ms;
- EQ: high-pass 180 Hz, −5 dB at 7.95 kHz, −6 dB shelf above 10 kHz, +1.5 dB at 1.72 kHz (bright but not piercing);
- 2.0 s, an 80 ms tail fade, peak −1 dBFS. In the app it's scaled by 0.629 (−4.0 dB) to its loudness tier.

6.67 credits a take. **ElevenLabs in total: 6,145.3 credits** (4 of the 4 allowed music generations, 4 of the 8
allowed sound-effect generations), about $1.12.

## The synthesised effects

Rendered in the browser from short recipes (`DSPKIT` in `src/30-audio.js`): struck modes (rotating phasors and
2-pole resonators), filtered noise clicks and grains, gliding band-passes, sine chirps, soft pads. Each render is
seeded (the same every time), ends on a raised-cosine tail, and is loudness-matched to its tier: the K-weighting of
BS.1770, but the loudest **100 ms** window (a 400 ms window rates a 40 ms click far quieter than it sounds). They render
in a Web Worker (off the main thread) a moment after the app is up, so a tap never waits; where a Worker can't start
they render in idle time instead.

| Tier (100 ms loudness at full volume) | Effects |
|---|---|
| hero, −18 | `bell` |
| celebration, −21 to −23 | `unlock` `ship` `test` (−21) · `capture` `quarantine` `sew` (−22) · `chime` `harvest` (−23) |
| interaction, −24 to −28 | `start` `squash` (−24) · `resume` `reset` `wind_release` `split` `snip` (−25) · `pause` `error` (−26) · `skip` `pop` `radio` `mug` `jar` (−27) · `land` `patch` `glass` (−28) |
| interface, −29 to −32 | `wind_tick` `toggle` `screens` `rustle` `whoosh` (−29) · `tap` `open` (−30) · `close` (−31) · `type` (−32) |
| soft beds | `breath_in` `breath_out` (−31) · `thunder` (−27) · the focus tick: `tick` (−37), `tock` (−38) |

At the default volumes the lo-fi bed plays near −30 LUFS: interface sounds sit just under it, everything you do sits
over it, and the bell rings clearly on top. What they are: `tap` a tiny glassy tick · `toggle` a switch, down and up ·
`open`/`close` rising and falling air · `start` the timer's latch (a clack, a settling click, a small upward "go") ·
`pause`/`resume` softer latches · `reset` the ratchet unwinding, faster and faster, then landing · `skip` a forward
flick · `wind_tick` one detent of the tomato's ratchet (pawl, a little metal, a little plastic; four variants) ·
`wind_release` the spring taking up and the escapement starting to whirr · `bell` the kitchen timer (file; a
synthesised one from the same modes stands in until it has loaded) · `chime` two soft rising notes · `capture` an FM
zap falling through the floor, bit-crushed and stuttering · `quarantine` a glass-jar clink, a bounce, the lid ·
`unlock` a celesta arpeggio and a shimmer · `sew` thread pulled through twill twice, and a sparkle · `ship` a rubber
stamp and a bright chime · `harvest` a stem snap, a soft pop, leaves · `land` the tomato landing on the plant · `pop`
`squash` `split` `test` Bug Hunt · `breath_in`/`breath_out` four seconds of air opening and closing over a soft
A-minor pad · `error` a soft "nuh-uh" · `whoosh` · `type` a soft key · and for the room: `patch` (a holo "bwip"),
`rustle` (the plant), `glass` (a knuckle on the window), `mug` (a spoon on her mug), `screens` (data blips), `radio`
(a switch and the dial sweeping through static), `jar` (glass and rattling rogues), `snip` (unpicking a patch),
`thunder` (far off, when the rain comes in).

Checked by rendering every effect and playing it through an `OfflineAudioContext`: no clipped or non-finite sample,
DC offset under 0.0006, every tail under −90 dB at its last millisecond, and every effect within 0.5 dB of its tier
(re-measured outside the browser with the standard's own 48 kHz K-weighting coefficients).

## How the app plays it (`Snd`)

- **Unlock.** Nothing exists before the first real activation (`pointerup`, `touchend`, `click`, `keydown`, or BUS
  `gesture` when `navigator.userActivation` says it is one): browsers warn about a context made earlier, and iOS
  ignores a touch's `pointerdown`. Inside that gesture the AudioContext is created and resumed and the music starts.
  On iOS a one-sample buffer also opens the output, and on WebKit (iOS, Safari) the music elements are "blessed" (a
  50 ms silent WAV played and paused) so they may play later on their own. Anything not needed that instant (Media
  Session, prefetch, the bell, effect renders) waits for idle time. The first tap costs 50–80 ms once, almost all of
  it the AudioContext constructor (measured in headless Chromium: 51 ms, and 73 ms with the CPU slowed 4×).
- **Music** streams through two `<audio>` elements (crossfades) from fetched blobs, never decoded into AudioBuffers;
  only the channel in use is fetched, after the first gesture (`fetch` is served by the service worker, so it works
  offline). A third element plays the 3 s previews.
- **The director** follows the timer: focus running → the focus bed, a break running → the break bed, paused → ducked
  to 30% (and after 5 minutes paused, faded out), idle → a 3 s fade. Beds start with a 1.6 s fade-in and switch with
  2–2.5 s equal-power crossfades; it keeps playing when the tab is hidden. Channels (`settings.music`): **lofi** =
  the radio (`lofi-1` → `lofi-2` → `lofi-3`, the next track each focus session) with `break-1` for breaks; **rain** and
  **city** play their ambience in both beds; **off**.
- **The radio rotates on the beat.** After a track has looped three times the next one starts on the other element,
  silent, so that its bar 1 lands on one of the current track's bar lines; while silent it's pulled into step by
  seeks that aim ahead by a learned seek latency (~40–75 ms) until the two clocks agree within 3 ms; then a two-bar
  (6 s) equal-power crossfade. Verified by recording both elements: the two tracks' beats lined up within 2–6 ms.
  Also checked in real time with the whole app running: `lofi-2` started 153 s in, near the end of `lofi-1`'s third
  loop, and was in step within 1 ms. Sampled every 20 ms across the handover, `beat()` never stepped by more than 6 ms (p99 1.5 ms).
  (A Chromium detail that mattered: an element at volume exactly 0 is moved to a null audio sink and stalls ~22–33 ms
  when its volume comes back, so a playing element never goes below −66 dB.)
- **Volume:** effects `volume²`; music `volume² × musicVol^1.5`; `mute()` (persisted) and `settings.sound` silence
  everything. iOS can't set an element's volume, so there the music starts and stops instead of fading (lo-fi gets a
  short tape-stop) and the hardware buttons set its level.
- **`beat()`** is computed on demand from the louder element's `currentTime` (tempo and first downbeat per file, above)
  and cached per frame; **`level()`** reads a 10-per-second loudness envelope stored for each music file (64 steps,
  −24 dB → 0) at the same moment. Neither allocates.
- **The focus tick** (`settings.tick`) is one two-second buffer (tick, tock) looping on the audio clock, started when
  the readout next turns over and re-aligned every 30 s.
- **The Media Session** shows "Focus · Lo-fi radio" by Patch, the session's progress as the position; play/pause drive
  the timer (lock screen, headphone buttons), ⏭ skips to the next lo-fi track.
- **Old phones:** nothing runs per frame; fades step on a 33 ms timer only while one runs; effects render in a Worker;
  a quiet context is suspended after 20 s when the timer is idle (not on iOS) and woken by the next tap.

## Rebuilding

The tools are in this agent's scratch folder, not the repo; the method is above. To recut a track: decode the take,
measure the beat grid, search bar-aligned loops, nudge the end on the onsets, crossfade 1.5 s of what follows into the
head, normalise, then encode wrapped in itself and move the LAME delay/padding (+1152 each) and fix the tag CRC. Each
generation id above is a node's take on the flow, so a cue can be regenerated or re-picked there.

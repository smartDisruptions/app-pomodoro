// ───────────────────────────── 50. Dial: the tomato timer, its readout and controls, heads-down, breaks, Bug Hunt ─────────────────────────────
// The hero object: a wind-up tomato kitchen timer Patch modded. DOM + inline SVG drawn once into static layers;
// everything that moves while timing runs on the compositor (one transform animation for the band, opacity
// animations for the ripening), so the main thread does nothing but swap the readout once a second.
// CONTRACT.md §8.5 · DESIGN.md §3–5, §7.
const Dial = (() => {
  // ── plain interface words (not Patch's lines; hers come from TEXT via LINE) ──
  const W = {
    tomato: 'Tomato timer',
    windHelp: 'Drag sideways or use the arrow keys to wind it. Enter starts and pauses.',
    paused: 'Paused',
    left: (m) => (m < 1 ? 'Less than a minute left' : plural(m, 'minute') + ' left'),
    set: (m) => plural(m, 'minute'),
    again: { r: 'Press R again to reset', s: 'Press S again to skip', tr: 'Tap again to reset', ts: 'Tap again to skip' },
    cycle: (n, of) => `Tomato ${n} of ${of} in this cycle`,
    acts: { window: 'Window', breathe: 'Breathe', stretch: 'Stretch', bughunt: 'Bug Hunt' },
    review: 'Review', later: 'for later',
    end: 'End', done: 'Done', next: 'Next', again2: 'Play again',
    breakLeft: 'Break', best: 'Best', newBest: 'New best', squashed: 'squashed', score: 'Squashed', time: 'Time',
    round: (n, of) => `Round ${n} of ${of}`, step: (n, of) => `Step ${n} of ${of}`,
    sec: 'seconds',
    started: (mode, min) => `${TEXT.modes[mode].label} started, ${plural(min, 'minute')}.`,
    announcePause: 'Paused.', announceResume: 'Resumed.', announceReset: 'Reset.',
    announceDone: (mode, next) => `${TEXT.modes[mode].label} done. ${TEXT.modes[next] ? TEXT.modes[next].label + ' next.' : ''}`,
  };

  // ── geometry: the tomato is drawn in a 200-unit box; the body is an oblate, lobed sphere ──
  const TB = { cx: 100, cy: 114, rx: 84, ry: 73.4 };   // the bottom rests at cy + 0.86·rx, where the Scene puts the desk shadow
  const UNIT = 200 / TB.rx;                 // box size per body radius
  const BAND = { x: 13, y: 101, w: 174, h: 27 };   // the timer band, in box units (a touch wider than the body: it sits proud)
  const VMIN = -26, VMAX = 146, MAXMIN = 120, MINMIN = 1;   // the strip covers these minutes; numbers 0..120
  const VIS = 17;                           // minutes visible across the band

  // ── state ──
  let root, tom, shadowEl, popEl, liftEl, wobEl, layO, layR, bandEl, stripEl, notchEl, leavesEl;
  let haloEl, timeEl, statusEl, modeEl, dotsEl, taskEl, ctrlEl, bReset, bMain, bSkip, ctxEl, chipsEl, distEl, breakEl, hdBtn, hintEl, padEl;
  let S = 200, ppm = 10, bandW = 174;   // live sizes (CSS px): the tomato's box, pixels per minute on the band, the band's width
  let lay = 'tall';
  let built = false, laidOut = false;
  // the band
  let bandAnim = null, bandFrom = 0, bandT0 = 0, bandDur = 0, bandV = 25;
  // ripening
  let ripeAnims = [];
  // readout
  let shownSec = -1, shownMin = -1, readoutHold = false;
  // winding
  let drag = null, fling = null, snapTw = null, lastDet = null, lastTickT = 0, leafTilt = 0, leafTarget = 0;
  // the big moment
  let celebrating = false, timers = [];
  // press-twice protection
  let armed = null, armT = 0;
  // heads-down
  let wakeT = 0;
  // last focus session (for "Review N for later")
  let lastFocusId = null;
  // activities (second half of this file)
  let act = null;

  const now = () => performance.now();
  const later = (ms, fn) => { const t = setTimeout(() => { timers = timers.filter((x) => x !== t); try { fn(); } catch (e) { reportErr('dial:later', e); } }, ms); timers.push(t); return t; };
  const clearLater = () => { timers.forEach(clearTimeout); timers = []; };
  const sfx = (n, o) => { try { if (typeof Snd !== 'undefined') Snd.sfx(n, o); } catch (e) { reportErr('dial:sfx', e); } };
  const haptic = (n) => { try { if (typeof Snd !== 'undefined') Snd.haptic(n); } catch (e) {} };
  const eng = (fn, ...a) => try1(typeof Engine !== 'undefined' ? Engine : null, fn, ...a);
  const engLeft = () => { const v = eng('left'); return typeof v === 'number' && isFinite(v) ? v : TIMER.left; };
  const engProgress = () => { const v = eng('progress'); return typeof v === 'number' && isFinite(v) ? clamp(v, 0, 1) : (TIMER.dur ? clamp(1 - TIMER.left / TIMER.dur, 0, 1) : 0); };
  const isBreak = (m = TIMER.mode) => m === 'short' || m === 'long';
  // idle, but wound away from the mode's default: Reset un-winds it
  const defSec = (m = TIMER.mode) => 60 * (((DB && DB.settings) || {})[m === 'short' ? 'shortMin' : m === 'long' ? 'longMin' : 'focusMin'] || 25);
  const wound = () => TIMER.state === 'idle' && Math.abs(TIMER.left - defSec()) > 0.5;
  const busy = () => { try { return typeof UI !== 'undefined' && UI.busy && UI.busy(); } catch (e) { return false; } };
  const canAnim = (el) => !!(el && el.animate);
  const f1 = (n) => String(Math.round(n * 10) / 10);
  const tx = (x) => `translate3d(${x.toFixed(2)}px,0,0)`;

  // ───────────────────────── art (built once, at init) ─────────────────────────
  // Catmull-Rom through points → a smooth closed cubic path
  function smoothClosed(p) {
    const n = p.length; let d = `M${f1(p[0][0])} ${f1(p[0][1])}`;
    for (let i = 0; i < n; i++) {
      const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n], e = p[(i + 2) % n];
      d += `C${f1(b[0] + (c[0] - a[0]) / 6)} ${f1(b[1] + (c[1] - a[1]) / 6)} ${f1(c[0] - (e[0] - b[0]) / 6)} ${f1(c[1] - (e[1] - b[1]) / 6)} ${f1(c[0])} ${f1(c[1])}`;
    }
    return d + 'Z';
  }
  // The silhouette: an oblate sphere, broad shoulders, five soft lobes strongest near the stem, a shallow
  // dimple at the top where the calyx sits, and a slightly flattened bottom (it rests on the desk).
  function bodyPath() {
    const N = 72, pts = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU, c = Math.cos(t), sn = Math.sin(t);
      const u = Math.atan2(Math.sin(t + Math.PI / 2), Math.cos(t + Math.PI / 2));   // angle from the top, −π..π (symmetric)
      const up = Math.max(0, -sn);
      // five lobes (one under the stem, two on each shoulder), strongest near the top
      let k = 1 + 0.024 * Math.cos(5 * u) * (0.25 + 0.75 * up * up);
      // broad shoulders, then the dimple where the calyx sits
      k += 0.035 * Math.pow(Math.sin(Math.min(Math.PI, Math.abs(u) * 1.6)), 2) * up;
      k -= 0.06 * Math.exp(-(u * u) / (2 * 0.15 * 0.15));
      const ry = TB.ry * (sn > 0 ? 1 - 0.015 * sn * sn * sn : 1);
      pts.push([TB.cx + c * TB.rx * k, TB.cy + sn * ry * k]);
    }
    return smoothClosed(pts);
  }
  const stops = (a) => a.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op != null ? ` stop-opacity="${op}"` : ''}/>`).join('');
  const radial = (id, a, cx = '.36', cy = '.3', r = '.82', extra = '') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"${extra}>${stops(a)}</radialGradient>`;
  const linear = (id, a, x1, y1, x2, y2, user) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${user ? ' gradientUnits="userSpaceOnUse"' : ''}>${stops(a)}</linearGradient>`;
  const svgBox = (inner) => `<svg viewBox="0 0 200 200" width="100%" height="100%" aria-hidden="true" focusable="false">${inner}</svg>`;
  let BODY = '';
  // lobe seams on the visible front: from the calyx out and down to the band
  const SEAMS = ['M96 56 C82 62 68 76 60 100', 'M104 56 C118 62 132 76 140 100', 'M98 58 C94 70 90 84 88 100', 'M102 58 C106 70 110 84 112 100', 'M93 55 C70 56 44 70 30 96', 'M107 55 C130 56 156 70 170 96'];

  function layerSVG(kind) {
    const G = {
      green: [[0, '#e9fbb4'], [0.28, '#acdf63'], [0.66, '#64ad37'], [1, '#356f1d']],
      orange: [[0, '#fff3be'], [0.28, '#ffc84e'], [0.66, '#f38d22'], [1, '#a5500e']],
      red: [[0, '#ffc0ae'], [0.26, '#ff6450'], [0.64, '#e3301f'], [1, '#93140c']],
    }[kind];
    let s = `<defs>${radial('dl-b-' + kind, G)}`;
    if (kind === 'green') s += linear('dl-b-gs', [[0, '#f2ffd0', 0.5], [1, '#f2ffd0', 0]], 0, 0, 0, 1);
    if (kind === 'orange') s += linear('dl-b-os', [[0, '#b9c23c', 0.85], [0.42, '#e0a63a', 0.35], [0.62, '#ffa040', 0]], 0, 0, 0, 1);
    if (kind === 'red') s += linear('dl-b-rs', [[0, '#ff8a3a', 0.55], [0.36, '#ff7a3a', 0.12], [0.5, '#ff7a3a', 0]], 0, 0, 0, 1);
    s += '</defs>';
    if (kind === 'green') {
      // the bottom layer carries the moonlit sticker outline (drawn under the fill: only its outer half shows)
      s += `<path d="${BODY}" fill="url(#dl-b-green)" stroke="#3d4c95" stroke-width="5.5" stroke-linejoin="round" paint-order="stroke"/>`;
      // unripe tomatoes have pale streaks down from the shoulders
      s += `<g clip-path="url(#dl-clip)" fill="none" stroke="url(#dl-b-gs)" stroke-width="7" stroke-linecap="round" opacity=".55">${SEAMS.map((d) => `<path d="${d}"/>`).join('')}</g>`;
    } else {
      s += `<path d="${BODY}" fill="url(#dl-b-${kind})"/>`;
      // ripening starts at the bottom: the shoulders stay greener for longest
      s += `<path d="${BODY}" fill="url(#dl-b-${kind === 'orange' ? 'os' : 'rs'})"/>`;
    }
    return svgBox(s);
  }
  // shading, lobes, gloss and rim light: colour-agnostic (black and white with alpha), shared by every ripeness
  function fxSVG() {
    let s = '<defs>';
    s += `<clipPath id="dl-clip"><path d="${BODY}"/></clipPath>`;
    s += radial('dl-f-shade', [[0, '#05030a', 0.5], [0.55, '#05030a', 0.16], [1, '#05030a', 0]], '.5', '.5', '.5');
    s += radial('dl-f-ao', [[0, '#000', 0.42], [1, '#000', 0]], '.5', '.5', '.5');
    s += radial('dl-f-cal', [[0, '#000', 0.38], [1, '#000', 0]], '.5', '.5', '.5');
    s += radial('dl-f-soft', [[0, '#fff', 0.5], [0.6, '#fff', 0.12], [1, '#fff', 0]], '.5', '.5', '.5');
    s += linear('dl-f-rim', [[0, '#a9bcff', 0.95], [0.3, '#a9bcff', 0.35], [0.46, '#a9bcff', 0]], 0, 0, 1, 1);
    s += linear('dl-f-warm', [[0.55, '#ffb35c', 0], [0.82, '#ffb35c', 0.35], [1, '#ffb35c', 0.6]], 0, 0, 1, 1);
    s += linear('dl-f-seam', [[0, '#000', 0.3], [0.7, '#000', 0.12], [1, '#000', 0]], 0, 0, 0, 1);
    s += linear('dl-f-bandsh', [[0, '#000', 0.4], [1, '#000', 0]], 0, 0, 0, 1);
    s += '</defs><g clip-path="url(#dl-clip)">';
    // Patch's mod: her </> sticker on the lower body (drawn first, so the shading falls across it)
    s += `<g transform="translate(139 152) rotate(-13)"><rect x="-14" y="-8.6" width="28" height="17.2" rx="5.5" fill="#13152a" stroke="#3d4c95" stroke-width="2.2"/><text x="0" y="3.6" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-weight="700" font-size="10.4" fill="#3dffc2" letter-spacing="-.4">&lt;/&gt;</text><path d="M-10.5 -5.4h7" stroke="#fff" stroke-opacity=".28" stroke-width="1.4" stroke-linecap="round"/></g>`;
    // the terminator: the lower right turns away from the window light
    s += `<ellipse cx="156" cy="170" rx="128" ry="112" fill="url(#dl-f-shade)"/>`;
    // contact occlusion at the bottom and the calyx's shadow on the crown
    s += `<ellipse cx="104" cy="191" rx="80" ry="19" fill="url(#dl-f-ao)"/>`;
    s += `<ellipse cx="100" cy="56" rx="46" ry="15" fill="url(#dl-f-cal)"/>`;
    // lobe seams: a dark crease with a lit lip beside it
    s += `<g fill="none" stroke-linecap="round">${SEAMS.slice(0, 4).map((d) => `<path d="${d}" stroke="url(#dl-f-seam)" stroke-width="3.2"/>`).join('')}`;
    s += SEAMS.slice(0, 4).map((d) => `<path d="${d}" stroke="#fff" stroke-opacity=".1" stroke-width="2" transform="translate(-2.4 .6)"/>`).join('') + '</g>';
    // the band casts a shadow onto the lower half
    s += `<rect x="0" y="${BAND.y + BAND.h - 1}" width="200" height="11" fill="url(#dl-f-bandsh)"/>`;
    // moon rim (upper left, from the window) and the warm desk-lamp bounce (lower right)
    s += `<path d="${BODY}" fill="none" stroke="url(#dl-f-rim)" stroke-width="7"/>`;
    s += `<path d="${BODY}" fill="none" stroke="url(#dl-f-warm)" stroke-width="6"/>`;
    // gloss: a broad soft sheen, then the window's reflection (four panes) and a spark
    s += `<ellipse cx="70" cy="76" rx="40" ry="26" transform="rotate(-28 70 76)" fill="url(#dl-f-soft)"/>`;
    s += `<ellipse cx="62" cy="68" rx="15" ry="11" transform="rotate(-26 62 68)" fill="url(#dl-f-soft)"/><g transform="translate(62 68) rotate(-24) skewX(-10)" fill="#fff" opacity=".8"><rect x="-6.4" y="-5.2" width="5.6" height="4.5" rx="1.7"/><rect x="0.7" y="-5.2" width="5.6" height="4.5" rx="1.7"/><rect x="-6.4" y="0.6" width="5.6" height="4.5" rx="1.7"/><rect x="0.7" y="0.6" width="5.6" height="4.5" rx="1.7"/></g>`;
    s += `<circle cx="77" cy="60" r="1.9" fill="#fff" opacity=".85"/><ellipse cx="148" cy="84" rx="7" ry="3.2" transform="rotate(38 148 84)" fill="#fff" opacity=".18"/>`;
    s += `<ellipse cx="58" cy="160" rx="18" ry="6" transform="rotate(24 58 160)" fill="#fff" opacity=".09"/>`;
    s += '</g>';
    return svgBox(s);
  }
  // the calyx: six long, thin sepals seen from a little above, splaying over the shoulders and curling at the
  // tips, around a short, stout, slightly bent stem
  function leavesSVG() {
    const cx = 100, cy = 50;
    const bez = (a, b, c, d, t) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; };
    const sep = [10, 62, 118, 170, 232, 300].map((deg, i) => ({ phi: (deg * Math.PI) / 180, len: [44, 36, 37, 45, 30, 31][i], w: [5.6, 6.2, 6.2, 5.6, 5, 5][i], curl: [1, 1, -1, -1, 1, -1][i] }));
    const leaf = (p, front) => {
      const dx = Math.cos(p.phi), dz = Math.sin(p.phi);
      // the midrib: out from the centre, a little up, then drooping over the shoulder; the tip curls back
      const sx = Math.abs(dx);
      const P0 = [cx + dx * 2, cy + dz * 1.5];
      const P1 = [cx + dx * p.len * 0.42, cy + dz * p.len * 0.22 - 6 * sx];
      const P2 = [cx + dx * p.len * 0.82, cy + dz * p.len * 0.42 + p.len * 0.12 * sx];
      const P3 = [cx + dx * p.len * 0.92 + p.curl * 2.5 * (1 - sx), cy + dz * p.len * 0.5 + p.len * (0.34 * sx + 0.12)];
      const M = 14, L = [], Rr = [], mid = [];
      for (let k = 0; k <= M; k++) {
        const t = k / M;
        mid.push([bez(P0[0], P1[0], P2[0], P3[0], t), bez(P0[1], P1[1], P2[1], P3[1], t)]);
      }
      for (let k = 0; k <= M; k++) {
        const t = k / M, a = mid[Math.max(0, k - 1)], b = mid[Math.min(M, k + 1)];
        let tx2 = b[0] - a[0], ty2 = b[1] - a[1]; const tl = Math.hypot(tx2, ty2) || 1; tx2 /= tl; ty2 /= tl;
        const hw = p.w * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.75) * (1 - 0.55 * t);
        L.push([mid[k][0] - ty2 * hw, mid[k][1] + tx2 * hw]); Rr.push([mid[k][0] + ty2 * hw, mid[k][1] - tx2 * hw]);
      }
      const pts = L.concat(Rr.reverse());
      const d = 'M' + pts.map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L') + 'Z';
      const rib = 'M' + mid.slice(0, M - 2).map((q) => f1(q[0]) + ' ' + f1(q[1])).join('L');
      return `<path d="${d}" fill="url(#${front ? 'dl-l-front' : 'dl-l-back'})" stroke="#3d4c95" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke"/><path d="${rib}" fill="none" stroke="#c9ffe0" stroke-opacity="${front ? 0.55 : 0.28}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
    };
    let s = '<defs>';
    s += linear('dl-l-front', [[0, '#8eecb4'], [0.4, '#33c477'], [1, '#156038']], 0, 0, 1, 1);
    s += linear('dl-l-back', [[0, '#3fae6d'], [1, '#114a2a']], 0, 0, 1, 1);
    s += linear('dl-l-stem', [[0, '#7fe0a2'], [0.45, '#2a9a5a'], [1, '#124d2b']], 0, 0, 1, 0);
    s += radial('dl-l-hub', [[0, '#2a8f55'], [1, '#155a33']], '.4', '.35', '.7');
    s += radial('dl-l-cut', [[0, '#e6ffd9'], [0.7, '#b4ecc4'], [1, '#8fd9a8']], '.42', '.4', '.7');
    s += '</defs>';
    const back = sep.filter((p) => Math.sin(p.phi) < 0), front = sep.filter((p) => Math.sin(p.phi) >= 0).sort((a, b) => Math.sin(a.phi) - Math.sin(b.phi));
    s += back.map((p) => leaf(p, false)).join('');
    // the hub where the sepals meet
    s += `<ellipse cx="${cx}" cy="${cy + 1}" rx="9" ry="5" fill="url(#dl-l-hub)" stroke="#3d4c95" stroke-width="2.2" paint-order="stroke"/>`;
    s += front.map((p) => leaf(p, true)).join('');
    // the stem: short and stout, a gentle bend, a fresh cut on top
    const st = 'M100 51 C99.4 45 100.4 40.5 103.6 36.4';
    s += `<path d="${st}" fill="none" stroke="#3d4c95" stroke-width="12.5" stroke-linecap="round"/><path d="${st}" fill="none" stroke="url(#dl-l-stem)" stroke-width="8.2" stroke-linecap="round"/>`;
    s += `<path d="M97.6 49 C97.3 45 98 42 100 39.4" fill="none" stroke="#d8ffe7" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`;
    s += `<ellipse cx="104" cy="35.8" rx="4.9" ry="2.9" transform="rotate(-30 104 35.8)" fill="url(#dl-l-cut)" stroke="#3d4c95" stroke-width="2.1"/>`;
    return svgBox(s);
  }
  // the contact shadow (the Scene adds the wide soft one on the desk)
  const shadowSVG = () => svgBox(`<defs>${radial('dl-sh', [[0, '#000', 0.55], [0.6, '#000', 0.18], [1, '#000', 0]], '.5', '.5', '.5')}</defs><ellipse cx="101" cy="186.5" rx="64" ry="8.5" fill="url(#dl-sh)"/>`);
  // the notch: Patch's 3D-printed pointer, clipped onto the band
  const notchSVG = () => `<svg viewBox="0 0 32 46" width="100%" height="100%" aria-hidden="true" focusable="false"><defs>${radial('dl-n-glow', [[0, 'currentColor', 0.5], [1, 'currentColor', 0]], '.5', '.5', '.5')}</defs><ellipse class="dl-nglow" cx="16" cy="11" rx="16" ry="12" fill="url(#dl-n-glow)"/><path d="M6.5 4.2Q6 2 8.4 2h15.2q2.4 0 1.9 2.2l-7.6 11.2q-1.9 2.4-3.8 0z" fill="currentColor" stroke="#3d4c95" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/><path d="M9.5 4.6h7" stroke="#fff" stroke-opacity=".75" stroke-width="1.5" stroke-linecap="round"/><path d="M16 19.5v24" stroke="currentColor" stroke-opacity=".6" stroke-width="1.2"/></svg>`;

  // the band strip: minute ticks, a bold number every five, built at the size it's shown (on layout)
  function stripSVG() {
    const w = (VMAX - VMIN) * ppm, h = BAND.h * S / 200;
    const xOf = (m) => ((m - VMIN) * ppm).toFixed(2);
    const t1 = h * 0.22, t5 = h * 0.38, fs = Math.max(9, h * 0.5);
    let minor = '', major = '', nums = '';
    for (let m = 0; m <= MAXMIN; m++) {
      if (m % 5 === 0) { major += `M${xOf(m)} 0v${t5.toFixed(2)}`; nums += `<text x="${xOf(m)}" y="${(h * 0.84).toFixed(2)}">${m}</text>`; }
      else minor += `M${xOf(m)} 0v${t1.toFixed(2)}`;
    }
    // past the ends: hatching, so the strip never looks broken
    const hx0 = (VMIN - VMIN) * ppm, hx1 = (0 - VMIN) * ppm, hx2 = (MAXMIN - VMIN) * ppm;
    const hatch = `<pattern id="dl-hatch" width="${(ppm * 1.2).toFixed(2)}" height="${h.toFixed(2)}" patternUnits="userSpaceOnUse" patternTransform="skewX(-28)"><rect width="${(ppm * 0.42).toFixed(2)}" height="${h.toFixed(2)}" fill="#1a1726" fill-opacity=".1"/></pattern>`;
    const sw1 = Math.max(1, ppm * 0.11), sw5 = Math.max(1.6, ppm * 0.2);
    return `<svg width="${w.toFixed(1)}" height="${h.toFixed(2)}" viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(2)}" aria-hidden="true" focusable="false"><defs>${hatch}</defs>` +
      `<rect x="${hx0}" y="0" width="${(hx1 - hx0 - ppm * 0.6).toFixed(2)}" height="${h.toFixed(2)}" fill="url(#dl-hatch)"/><rect x="${(hx2 + ppm * 0.6).toFixed(2)}" y="0" width="${(w - hx2).toFixed(2)}" height="${h.toFixed(2)}" fill="url(#dl-hatch)"/>` +
      `<path d="${minor}" stroke="#2a2433" stroke-width="${sw1.toFixed(2)}" stroke-opacity=".8"/><path d="${major}" stroke="#1a1726" stroke-width="${sw5.toFixed(2)}"/>` +
      `<g class="dl-nums" font-size="${fs.toFixed(1)}" text-anchor="middle" fill="#1a1726">${nums}</g></svg>`;
  }

  // ───────────────────────── CSS ─────────────────────────
  const css = () => `
#dial{position:fixed;inset:0;z-index:5}
#activity{position:fixed;inset:0;z-index:20}
.dl-tom{position:absolute;left:0;top:0;width:200px;height:200px;border-radius:50%;touch-action:none;cursor:grab;-webkit-tap-highlight-color:transparent}
.dl-tom:focus-visible{outline:none}
.dl-tom::after{content:"";position:absolute;left:5%;top:19%;width:90%;height:77.5%;border-radius:50%;box-shadow:0 0 0 2.5px var(--accent);opacity:0;transition:opacity var(--t-fast);pointer-events:none}
.dl-tom:focus-visible::after{opacity:1}
.dl-tom.dl-grab{cursor:grabbing}
.dl-fill{position:absolute;left:0;top:0;width:100%;height:100%}
.dl-shadow{transition:opacity var(--t-slow) var(--ease)}
.dl-lay svg,.dl-leaves svg{display:block;overflow:visible}
.dl-pop{transform-origin:50% 92%}
.dl-lift{transition:transform var(--t-med) var(--ease)}
.dl-wob{transform-origin:50% 92%}
.dl-o,.dl-r{opacity:0;will-change:opacity}
.dl-band{position:absolute;left:${BAND.x / 2}%;top:${BAND.y / 2}%;width:${BAND.w / 2}%;height:${BAND.h / 2}%;overflow:hidden;border-radius:7px/50%;
  background:linear-gradient(#fffbf2,#f8efd9 30%,#ecdcb8 76%,#d6c197);box-shadow:0 0 0 1.7px #3d4c95,0 2px 0 1px rgba(20,10,30,.2),inset 0 -2px 0 rgba(120,84,40,.22);transition:opacity var(--t-med) var(--ease)}
.dl-strip{position:absolute;left:0;top:0;will-change:transform}
.dl-strip svg{display:block}
.dl-nums{font-family:var(--mono);font-weight:700}
.dl-bandfx{position:absolute;inset:0;pointer-events:none;background:
  linear-gradient(90deg,rgba(64,30,18,.62),rgba(64,30,18,.22) 11%,rgba(64,30,18,0) 27%,rgba(255,255,255,.2) 35%,rgba(255,255,255,0) 44%,rgba(64,30,18,0) 70%,rgba(64,30,18,.24) 88%,rgba(64,30,18,.66)),
  linear-gradient(rgba(255,255,255,.55),rgba(255,255,255,0) 18%,rgba(0,0,0,0) 80%,rgba(60,30,10,.16))}
.dl-notch{position:absolute;left:calc(50% - 5.5%);top:${(BAND.y - 13) / 2}%;width:11%;height:15.8%;color:var(--mint);transition:color var(--t-slow) var(--ease)}
.dl-notch svg{display:block}
.dl-break .dl-notch{color:var(--amber)}
.dl-leaves{transform-origin:50% 26%;transition:transform .5s var(--ease-back)}
html[data-q="2"] .dl-nglow,html[data-q="3"] .dl-nglow{display:none}
.dl-bdim{position:absolute;inset:0;background:linear-gradient(rgba(14,12,30,.32),rgba(14,12,30,.46));opacity:0;transition:opacity var(--t-med) var(--ease);pointer-events:none}
#dial[data-state="paused"] .dl-bdim{opacity:1}
.dl-tom:active .dl-lift{transform:scale(.985)}
@media (hover:hover){.dl-tom:hover .dl-lift{transform:translateY(-3px)}}
.dl-halo{position:absolute;left:0;top:0;border-radius:50%;background:radial-gradient(closest-side,var(--bg),rgba(0,0,0,0));opacity:.5;pointer-events:none}
html[data-theme="day"] .dl-halo{opacity:.7}
.dl-time{position:absolute;left:0;top:0;width:100%;text-align:center;font:700 var(--dl-fr,56px)/1 var(--mono);font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:var(--text);
  text-shadow:0 2px 0 rgba(0,0,0,.28);contain:layout style;pointer-events:none;white-space:nowrap}
html[data-theme="day"] .dl-time{text-shadow:0 1px 0 rgba(255,255,255,.6)}
#dial[data-state="paused"] .dl-time{animation:dl-breathe 2.6s ease-in-out infinite}
#dial.dl-last .dl-time{color:var(--accent)}
#dial.dl-break.dl-last .dl-time{color:var(--break)}
@keyframes dl-breathe{0%,100%{opacity:1}50%{opacity:.38}}
.dl-status{position:absolute;left:0;top:0;width:100%;display:flex;align-items:center;justify-content:center;gap:10px;pointer-events:none}
#dial[data-lay="short"] .dl-status,#dial[data-lay="split"] .dl-status{flex-direction:column;gap:6px}
#dial[data-lay="short"] .dl-task,#dial[data-lay="split"] .dl-task{max-width:100%}
#dial[data-lay="split"] .dl-main{min-width:0;padding:0 18px}
#dial[data-lay="split"] .dl-ctrls{gap:10px}
.dl-mode{display:inline-flex;align-items:center;gap:8px;height:26px;padding:0 11px;border-radius:999px;background:var(--glass);font:700 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);white-space:nowrap}
.dl-break .dl-mode{color:var(--break)}
.dl-dots{display:inline-flex;gap:4px}
.dl-dots i{width:7px;height:7px;border-radius:50%;box-shadow:inset 0 0 0 1.5px currentColor;opacity:.75}
.dl-dots i.on{background:currentColor;opacity:1}
.dl-dots i.cur{opacity:1;background:radial-gradient(circle,currentColor 0 1.7px,transparent 2.2px)}
.dl-task{display:inline-flex;align-items:center;gap:7px;max-width:min(58vw,240px);height:30px;padding:0 12px 0 9px;border-radius:999px;background:var(--glass);box-shadow:inset 0 0 0 1px var(--border);
  font:600 13px/1 var(--body);color:var(--text);pointer-events:auto;position:relative}
.dl-task::before{content:"";position:absolute;inset:-7px -2px}
.dl-task .ic{width:15px;height:15px;color:var(--tomato)}
.dl-task b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.dl-task small{font:700 10px/1 var(--mono);color:var(--muted);letter-spacing:.06em}
.dl-task.dl-none{color:var(--muted);box-shadow:inset 0 0 0 1px var(--border);background:transparent}
.dl-task.dl-none .ic{color:var(--muted)}
@media (hover:hover){.dl-task:hover{box-shadow:inset 0 0 0 1px var(--accent)}}
.dl-break .dl-task{display:none}
.dl-ctrls{position:absolute;left:0;top:0;width:100%;display:flex;align-items:center;justify-content:center;gap:var(--dl-cg,18px)}
.dl-btn{width:var(--dl-cb,50px);height:var(--dl-cb,50px);border-radius:50%;display:grid;place-items:center;background:var(--surface-2);color:var(--text);box-shadow:inset 0 0 0 1px var(--border);
  transition:transform var(--t-fast) var(--ease),background var(--t-fast),opacity var(--t-med)}
.dl-btn .ic{width:20px;height:20px}
.dl-btn:disabled{opacity:.32;cursor:default}
.dl-btn:not(:disabled):active{transform:scale(.92)}
@media (hover:hover){.dl-btn:not(:disabled):hover{background:var(--surface-3)}}
.dl-btn.dl-armed{background:var(--rogue);color:#fff;box-shadow:none}
.dl-main{min-width:var(--dl-mw,144px);height:var(--dl-mh,54px);padding:0 26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;gap:9px;
  background:var(--accent);color:var(--on-accent);font:700 17px/1 var(--body);letter-spacing:.01em;box-shadow:0 6px 18px rgba(var(--mint-rgb),.22),inset 0 -3px 0 rgba(0,0,0,.14);
  transition:transform var(--t-fast) var(--ease),background var(--t-med) var(--ease),box-shadow var(--t-med)}
.dl-main .ic{width:19px;height:19px}
.dl-main:active{transform:scale(.95)}
@media (hover:hover){.dl-main:hover{transform:translateY(-1px)}.dl-pbtn:hover{background:var(--border)}.dl-pbtn.dl-pgo:hover{background:var(--break);transform:translateY(-1px)}}
.dl-break .dl-main{background:var(--break);color:var(--on-break);box-shadow:0 6px 18px rgba(255,179,92,.22),inset 0 -3px 0 rgba(0,0,0,.14)}
html[data-q="2"] .dl-main,html[data-q="3"] .dl-main{box-shadow:inset 0 -3px 0 rgba(0,0,0,.14)}
.dl-ctx{position:absolute;left:0;top:0;width:100%;display:flex;justify-content:center;align-items:center}
.dl-ctx>*{transition:opacity var(--t-med) var(--ease),transform var(--t-med) var(--ease)}
.dl-ctx>[hidden]{display:none}
.dl-chips{display:flex;gap:6px;padding:4px;border-radius:999px;background:var(--glass)}
.dl-chip{height:34px;padding:0 13px;border-radius:999px;font:700 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);position:relative}
.dl-chip::before{content:"";position:absolute;inset:-5px -1px}
.dl-chip[aria-pressed="true"]{background:var(--surface-3);color:var(--text)}
@media (hover:hover){.dl-chip:hover{color:var(--text)}}
.dl-dist{height:42px;padding:0 18px 0 14px;border-radius:999px;display:inline-flex;align-items:center;gap:8px;background:var(--glass);box-shadow:inset 0 0 0 1.5px rgba(255,35,64,.55);
  font:700 14px/1 var(--body);color:var(--text)}
.dl-dist .ic{width:18px;height:18px;color:var(--rogue)}
.dl-dist b{min-width:19px;height:19px;padding:0 5px;border-radius:999px;background:var(--rogue);color:#fff;font:700 11px/19px var(--mono);text-align:center}
.dl-dist b:empty{display:none}
@media (hover:hover){.dl-dist:hover{box-shadow:inset 0 0 0 1.5px var(--rogue)}}
.dl-brk{display:flex;gap:6px;padding:5px;border-radius:20px;background:var(--glass);box-shadow:inset 0 0 0 1px var(--border)}
.dl-act{width:var(--dl-aw,74px);height:var(--dl-ah,52px);border-radius:15px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;color:var(--text);position:relative;
  font:700 9.5px/1 var(--mono);letter-spacing:.1em;text-transform:uppercase}
.dl-act .ic{width:21px;height:21px;color:var(--break)}
.dl-act.dl-rev .ic{color:var(--rogue)}
.dl-act b{position:absolute;top:5px;right:calc(50% - 22px);min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--rogue);color:#fff;font:700 10px/16px var(--mono);letter-spacing:0}
@media (hover:hover){.dl-act:hover{background:var(--surface-3)}}
.dl-act:active{transform:scale(.95)}
.dl-hd{position:absolute;left:0;top:0;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;color:var(--muted);transition:opacity var(--t-med),color var(--t-fast)}
.dl-hd .ic{width:20px;height:20px}
@media (hover:hover){.dl-hd:hover{color:var(--text)}}
.dl-status{transition:opacity var(--t-fast) var(--ease)}
#dial.dl-hinting .dl-status{opacity:0}
.dl-hint{position:absolute;left:0;top:0;transform:translate(-50%,-50%);padding:7px 12px;border-radius:999px;background:var(--surface-3);color:var(--text);font:700 12px/1 var(--mono);letter-spacing:.04em;
  white-space:nowrap;opacity:0;transition:opacity var(--t-med) var(--ease);pointer-events:none;box-shadow:var(--shadow)}
.dl-hint.on{opacity:1}
.dl-pad{position:absolute;left:0;top:0;display:none}
html.heads-down .dl-chips,html.heads-down .dl-task{opacity:0;pointer-events:none}
html.heads-down .dl-ctrls,html.heads-down .dl-ctx,html.heads-down .dl-hd{opacity:.14;transition:opacity .8s var(--ease)}
html.heads-down .dl-mode{background:transparent}
html.heads-down #dial.dl-wake .dl-ctrls,html.heads-down #dial.dl-wake .dl-ctx,html.heads-down #dial.dl-wake .dl-hd{opacity:1;transition-duration:var(--t-med)}
html.heads-down #dial:not(.dl-wake) .dl-pad{display:block}
html.heads-down .dl-halo{opacity:.25}
#dial.dl-moment .dl-ctrls,#dial.dl-moment .dl-ctx{opacity:0;pointer-events:none;transition:opacity var(--t-fast) var(--ease)}
#dial.dl-acting .dl-tomwrap,#dial.dl-acting .dl-ui,#dial.dl-acting .dl-hd{opacity:0;pointer-events:none;visibility:hidden;transition:opacity var(--t-med) var(--ease),visibility 0s var(--t-med)}
.dl-tomwrap,.dl-ui{transition:opacity var(--t-med) var(--ease)}
.dl-ui{position:absolute;inset:0;pointer-events:none}
.dl-act[hidden]{display:none}
.dl-brk{max-width:calc(100% - 24px);box-sizing:border-box}
#dial[data-lay="split"] .dl-brk{max-width:100%}
#dial[data-lay="split"] .dl-act{font-size:0;gap:0}
.dl-act{flex:1 1 0;min-width:0;max-width:var(--dl-aw,76px)}
.dl-pwrap{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;padding:10px 14px;box-sizing:border-box;pointer-events:none}
.dl-panel{position:relative;width:100%;max-width:420px;max-height:100%;box-sizing:border-box;padding:12px 16px 14px;border-radius:24px;background:var(--glass);box-shadow:var(--shadow),inset 0 0 0 1px var(--border);
  display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:auto;color:var(--text);overflow:hidden}
.dl-panel:focus{outline:none}
.dl-phead{align-self:stretch;display:flex;align-items:center;justify-content:space-between;min-height:32px}
.dl-ph{display:flex;align-items:center;gap:8px;font:700 12px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--break)}
.dl-ph .ic{width:18px;height:18px}
.dl-px{width:44px;height:44px;margin:-8px -10px -8px 0;border-radius:50%;display:grid;place-items:center;color:var(--muted)}
@media (hover:hover){.dl-px:hover{color:var(--text)}}
.dl-pv{position:relative;width:var(--dl-ring,180px);height:var(--dl-ring,180px);flex:none}
.dl-pv.dl-pv-auto{height:auto;width:100%;display:flex;flex-direction:column;align-items:center;gap:12px}
.dl-pt{margin:0;text-align:center;font:600 16px/1.4 var(--body);max-width:30ch;min-height:1.4em;text-wrap:balance}
.dl-pt:empty{display:none}
.dl-pf{align-self:stretch;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:40px;font:700 11px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dl-pf .dl-pr{color:var(--text)}
.dl-pbtn{height:40px;padding:0 18px;border-radius:999px;background:var(--surface-3);color:var(--text);font:700 13px/1 var(--body);margin-left:auto;transition:transform var(--t-fast) var(--ease)}
.dl-pbtn:active{transform:scale(.95)}
.dl-pbtn.dl-pgo{background:var(--break);color:var(--on-break)}
.dl-ring{position:absolute;inset:0}
.dl-ring i{position:absolute;left:calc(50% - 5px);top:calc(50% - 5px);width:10px;height:10px;border-radius:50%;background:var(--break);transition:opacity .7s var(--ease)}
html[data-q="0"] .dl-ring i,html[data-q="1"] .dl-ring i{box-shadow:0 0 10px rgba(255,179,92,.55)}
.dl-ring i.off{opacity:.13}
.dl-pdone .dl-ring i{background:var(--accent)}
.dl-rc{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;pointer-events:none}
.dl-rn{font:700 calc(var(--dl-ring,180px) * .3)/1 var(--mono);font-variant-numeric:tabular-nums}
.dl-rl{font:700 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.dl-orbg{position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px var(--border)}
.dl-orb{position:absolute;inset:0;border-radius:50%;will-change:transform}
.dl-orbf{position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 50% 38%,rgba(var(--mint-rgb),.42),rgba(var(--mint-rgb),.1) 72%);box-shadow:inset 0 0 0 3px var(--accent)}
html[data-q="0"] .dl-orbf{box-shadow:inset 0 0 0 3px var(--accent),0 0 34px rgba(var(--mint-rgb),.25)}
.dl-ol{font:700 clamp(13px,calc(var(--dl-ring,180px) * .095),19px)/1.15 var(--body);max-width:84%;white-space:nowrap}
.dl-oc{font:700 calc(var(--dl-ring,180px) * .17)/1 var(--mono);color:var(--accent);font-variant-numeric:tabular-nums}
.dl-pdone .dl-orbf{background:rgba(var(--mint-rgb),.3)}
.dl-sbig{display:flex;align-items:baseline;gap:8px}
.dl-sic .ic{width:30px;height:30px;color:var(--break);vertical-align:-4px}
.dl-snum{font:700 54px/1 var(--mono)}
.dl-sdots{display:flex;gap:6px}
.dl-sdots i{width:22px;height:5px;border-radius:3px;background:var(--surface-3)}
.dl-sdots i.on{background:var(--break)}
.dl-sdots i.cur{background:var(--text)}
.dl-sprog{width:min(100%,260px);height:6px;border-radius:3px;background:var(--surface-3);overflow:hidden}
.dl-sbar{display:block;height:100%;background:var(--break);transform-origin:0 50%}
.dl-pdone .dl-sbar{background:var(--accent)}
.dl-hunt{position:fixed;inset:0;overflow:hidden;touch-action:none;outline:none}
.dl-hscrim{position:absolute;inset:0;background:var(--scrim)}
.dl-hfield{position:absolute;inset:0;overflow:hidden}
.dl-bug{position:absolute;left:0;top:0;display:grid;place-items:center;will-change:transform;cursor:crosshair}
.dl-bug img{display:block;pointer-events:none;object-fit:contain}
.dl-bug.dl-front img{filter:none}
.dl-splat{position:absolute;left:0;top:0;pointer-events:none}
.dl-hpatch{position:absolute;left:0;top:0;pointer-events:none;font:700 15px/1 var(--mono);color:var(--mint);text-shadow:0 0 8px rgba(var(--mint-rgb),.6),0 2px 0 rgba(0,0,0,.5);white-space:nowrap}
.dl-splat img{position:absolute;inset:0;width:100%;height:100%;display:block}
.dl-splat span{position:absolute;left:50%;top:-6px;transform:translate(-50%,0);font:700 17px/1 var(--mono);color:#c8ff6a;text-shadow:0 2px 0 rgba(0,0,0,.45);white-space:nowrap}
.dl-hhud{position:absolute;left:0;right:0;top:0;padding:calc(var(--sat) + 10px) 60px 10px;display:flex;align-items:center;justify-content:center;gap:10px;pointer-events:none}
.dl-hhud>div{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:70px;padding:8px 12px;border-radius:14px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--border),0 6px 16px rgba(0,0,0,.25)}
.dl-hhud small{font:700 9.5px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.dl-hhud b{font:700 22px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--text)}
.dl-hs b{color:var(--accent)}
.dl-hlast .dl-ht b{color:var(--rogue)}
.dl-hx{position:absolute;right:calc(var(--sar) + 10px);top:calc(var(--sat) + 12px);width:44px;height:44px;border-radius:50%;background:var(--surface);box-shadow:inset 0 0 0 1px var(--border);display:grid;place-items:center;color:var(--text)}
.dl-hx[hidden]{display:none}
.dl-hhelp{position:absolute;left:50%;bottom:calc(var(--sab) + 22px);transform:translateX(-50%);width:max-content;max-width:min(90vw,360px);padding:10px 16px;border-radius:14px;background:var(--glass);
  font:600 14px/1.35 var(--body);text-align:center;pointer-events:none;box-shadow:inset 0 0 0 1px var(--border)}
.dl-hflash{position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,rgba(var(--mint-rgb),.45),rgba(var(--mint-rgb),.12) 60%,rgba(var(--mint-rgb),0));opacity:0;pointer-events:none}
.dl-vial{position:absolute;left:0;top:0;width:64px;height:76px;display:grid;place-items:center;border-radius:20px}
.dl-vial[hidden]{display:none}
.dl-vial img{width:46px;height:62px;display:block;pointer-events:none;animation:dl-bob 1.3s ease-in-out infinite}
@keyframes dl-bob{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-7px) rotate(7deg)}}
.dl-hend{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(86vw,320px);box-sizing:border-box;padding:18px 20px 16px;border-radius:24px;background:var(--surface);
  box-shadow:var(--shadow),inset 0 0 0 1px var(--border);display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.dl-hend[hidden]{display:none}
.dl-hsc{font:700 64px/1 var(--mono);color:var(--accent);margin-top:6px}
.dl-hbest{margin:4px 0 8px;font:700 12px/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.dl-hbest.dl-new{color:var(--gold)}
.dl-hbtns{display:flex;gap:10px;align-self:stretch;justify-content:center}
.dl-hbtns .dl-pbtn{margin:0;flex:1}
`;
  // the ringing kitchen timer: a fast rattle that decays over ~1 s (Web Animations: compositor-only, no reflow to restart)
  const RING = (() => {
    const k = [], n = 26;
    for (let i = 0; i <= n; i++) {
      const t = i / n, amp = Math.pow(1 - t, 1.5), sg = i % 2 ? -1 : 1, end = i === 0 || i === n;
      const rot = end ? 0 : sg * 6.5 * amp, x = end ? 0 : sg * 2.2 * amp, y = end ? 0 : -3 * amp * (i % 4 === 1 ? 1 : 0.4);
      k.push({ transform: `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) rotate(${rot.toFixed(2)}deg)`, offset: t });
    }
    return k;
  })();
  const WOBBLE = [{ transform: 'none' }, { transform: 'scale(1.07,.9)', offset: 0.14 }, { transform: 'scale(.95,1.06) rotate(-2.4deg)', offset: 0.32 }, { transform: 'scale(1.02,.98) rotate(1.6deg)', offset: 0.5 }, { transform: 'scale(.995,1.01) rotate(-.8deg)', offset: 0.68 }, { transform: 'none' }];
  const BUMP = [{ transform: 'none' }, { transform: 'translateX(-4px)', offset: 0.35 }, { transform: 'translateX(3px)', offset: 0.7 }, { transform: 'none' }];

  // ───────────────────────── DOM ─────────────────────────
  function build() {
    root = $('dial');
    if (!root) return;
    BODY = bodyPath();
    const svgOf = (cls, s) => h('div', { class: cls, html: s });
    shadowEl = svgOf('dl-shadow dl-fill', shadowSVG());
    layO = svgOf('dl-lay dl-o dl-fill', layerSVG('orange'));
    layR = svgOf('dl-lay dl-r dl-fill', layerSVG('red'));
    stripEl = h('div', { class: 'dl-strip' });
    bandEl = h('div', { class: 'dl-band' }, stripEl, h('div', { class: 'dl-bandfx' }), h('div', { class: 'dl-bdim' }));
    notchEl = h('div', { class: 'dl-notch', html: notchSVG() });
    leavesEl = svgOf('dl-leaves dl-fill', leavesSVG());
    // the fx layer defines the body clip the colour layers use, so it goes in the DOM first (hidden order doesn't matter for url refs)
    const fx = svgOf('dl-lay dl-fx dl-fill', fxSVG());
    const g = svgOf('dl-lay dl-g dl-fill', layerSVG('green'));
    wobEl = h('div', { class: 'dl-wob dl-fill' }, g, layO, layR, fx, bandEl, notchEl, leavesEl);
    liftEl = h('div', { class: 'dl-lift dl-fill' }, wobEl);
    popEl = h('div', { class: 'dl-pop dl-fill' }, liftEl);
    tom = h('div', { class: 'dl-tom', role: 'slider', tabindex: '0', 'data-hit': '', 'aria-label': W.tomato, 'aria-valuemin': MINMIN, 'aria-valuemax': MAXMIN, 'aria-describedby': 'dl-help' },
      shadowEl, popEl);
    const help = h('span', { id: 'dl-help', class: 'sr' }, W.windHelp);
    // readout & controls
    haloEl = h('div', { class: 'dl-halo', 'aria-hidden': 'true' });
    timeEl = h('div', { class: 'dl-time', role: 'timer', 'aria-live': 'off' }, '25:00');
    modeEl = h('span', { class: 'dl-mode' });
    dotsEl = h('span', { class: 'dl-dots', role: 'img' });
    taskEl = h('button', { class: 'dl-task', onclick: () => SHEET.open('tasks') });
    statusEl = h('div', { class: 'dl-status' }, modeEl, taskEl);
    modeEl.append(h('span', { class: 'dl-ml' }), dotsEl);
    bReset = h('button', { class: 'dl-btn', 'aria-label': TEXT.ui.reset, title: TEXT.ui.reset + ' (R)', html: ICON('reset'), onclick: () => press('r', true) });
    bMain = h('button', { class: 'dl-main', onclick: () => { eng('toggle'); } });
    bSkip = h('button', { class: 'dl-btn', 'aria-label': TEXT.ui.skip, title: TEXT.ui.skip + ' (S)', html: ICON('skip'), onclick: () => press('s', true) });
    ctrlEl = h('div', { class: 'dl-ctrls' }, bReset, bMain, bSkip);
    chipsEl = h('div', { class: 'dl-chips', role: 'group', 'aria-label': 'Mode' },
      ['focus', 'short', 'long'].map((m) => h('button', { class: 'dl-chip', 'data-m': m, 'aria-pressed': 'false', onclick: () => { sfx('tap'); eng('setMode', m); } }, TEXT.modes[m].label.split(' ')[0])));
    distEl = h('button', { class: 'dl-dist', title: TEXT.ui.distracted + ' (D)', onclick: () => SHEET.open('capture') }, h('span', { html: ICON('glitch') }), TEXT.ui.distracted, h('b', { 'aria-hidden': 'true' }));
    breakEl = h('div', { class: 'dl-brk', role: 'group', 'aria-label': 'Break activities' });
    buildBreak();
    ctxEl = h('div', { class: 'dl-ctx' }, chipsEl, distEl, breakEl);
    hdBtn = h('button', { class: 'dl-hd', onclick: () => focusMode(!FOCUSMODE.on) });
    hintEl = h('div', { class: 'dl-hint', 'aria-hidden': 'true' });
    padEl = h('div', { class: 'dl-pad', 'data-hit': '', onpointerdown: (e) => { e.preventDefault(); wake(); } });
    const tomWrap = h('div', { class: 'dl-tomwrap' }, tom);
    const ui = h('div', { class: 'dl-ui' }, haloEl, timeEl, statusEl, ctrlEl, ctxEl, padEl, hintEl);
    root.append(tomWrap, ui, hdBtn, help);
    // input on the tomato
    tom.addEventListener('pointerdown', onDown);
    tom.addEventListener('pointermove', onMove);
    tom.addEventListener('pointerup', onUp);
    tom.addEventListener('pointercancel', onCancel);
    tom.addEventListener('lostpointercapture', (e) => { if (drag && e.pointerId === drag.id) onCancel(e); });
    tom.addEventListener('keydown', (e) => { if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !busy()) { e.preventDefault(); windBy((e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 300 : 60)); } });
    root.addEventListener('pointerdown', () => { if (FOCUSMODE.on) wake(); }, true);
    root.addEventListener('focusin', () => { if (FOCUSMODE.on) wake(); });
    built = true;
  }

  // ───────────────────────── layout ─────────────────────────
  // Positions are computed here (on resize only), never read back from the DOM.
  const place = (el, x, y, w, hh) => { const s = el.style; s.left = x + 'px'; s.top = y + 'px'; if (w != null) s.width = w + 'px'; if (hh != null) s.height = hh + 'px'; };
  function layout() {
    if (!built) return;
    const L = LAYOUT, vw = L.W;
    lay = L.wide ? (L.short ? 'short' : 'wide') : 'tall';
    // a phone on its side that core still lays out as portrait (narrower than 600 px): the strip under the desk is
    // too short to stack, so the readout goes left of the tomato and the controls right of it
    if (lay === 'tall' && L.dock.y - L.deskY < 260 && vw >= 480) lay = 'split';
    root.dataset.lay = lay;
    let r, cx, cy, fr, rows;
    const sz = (compact) => compact
      ? { time: 0, st: 28, cb: 44, mh: 46, mw: 124, cg: 14, ctx: 50, aw: 70, ah: 48, g: [6, 8, 10, 10] }
      : { time: 0, st: 30, cb: 50, mh: 54, mw: 144, cg: 18, ctx: 58, aw: 76, ah: 54, g: [8, 10, 16, 14] };
    if (lay === 'tall') {
      const top = L.deskY, bottom = L.dock.y, avail = bottom - top;
      const compact = avail < 380;
      const z = sz(compact);
      // the tomato sits on the desk in front of Patch (her hands and holo keyboard stay visible above its stem);
      // everything else stacks below it
      const rMax = Math.min(vw * 0.205, 96);
      const restOf = (rr) => { const f = clamp(Math.round(rr * (compact ? 0.66 : 0.68)), 36, 64); return { f, h: z.g[0] + f + z.g[1] + z.st + z.g[2] + z.mh + z.g[3] + z.ctx + 8 }; };
      r = rMax;
      while (r > 40 && 2 + 1.72 * r + restOf(r).h > avail) r -= 1;
      r = Math.round(r);
      const rest = restOf(r); fr = rest.f;
      let spare = avail - (2 + 1.72 * r + rest.h);
      let lift = 0;
      if (spare < 0) { lift = Math.min(-spare, r * 0.5); spare += lift; }
      // with room to spare, set it a little further forward on the desk (the stem then clears the desk edge)
      const drop = clamp(spare, 0, r * 0.15);
      spare -= drop;
      cx = Math.round(vw / 2); cy = Math.round(top + 2 + drop + 0.86 * r - lift);
      const pad = Math.max(0, Math.min(spare * 0.35, 18));
      let y = cy + 0.86 * r + z.g[0] + pad;
      rows = { time: y };
      y += fr + z.g[1] + Math.min(spare * 0.1, 8); rows.st = y;
      y += z.st + z.g[2] + Math.min(spare * 0.2, 14); rows.ctrl = y;
      y += z.mh + z.g[3] + Math.min(spare * 0.2, 14); rows.ctx = y;
      rows.x0 = 0; rows.w = vw; rows.z = z;
      rows.hd = { x: vw - 56 - L.safe.r, y: rows.time + fr / 2 - 22 };
    } else if (lay === 'wide') {
      const u = L.ui, z = sz(u.h < 560);
      r = Math.round(clamp(Math.min(u.w * 0.27, (u.h - 330) / 1.95), 56, 134));
      fr = clamp(Math.round(r * 0.56), 44, 78);
      const ctxH = Math.max(z.ctx, 58);
      const stack = 1.95 * r + z.g[0] + fr + z.g[1] + z.st + z.g[2] + 10 + z.mh + z.g[3] + 10 + ctxH;
      const y0 = u.y + Math.max(12, (u.h - stack) * 0.42);
      cx = Math.round(u.x + u.w / 2); cy = Math.round(y0 + 1.05 * r);
      let y = cy + 0.86 * r + z.g[0] + 6;
      rows = { time: y };
      y += fr + z.g[1] + 2; rows.st = y;
      y += z.st + z.g[2] + 10; rows.ctrl = y;
      y += z.mh + z.g[3] + 10; rows.ctx = y;
      rows.x0 = u.x; rows.w = u.w; rows.z = z;
      rows.hd = { x: u.x + u.w - 52, y: u.y + 6 };
    } else if (lay === 'split') {
      const top = L.deskY, avail = L.dock.y - top, z = sz(true);
      r = Math.round(clamp(Math.min((avail - 10) / 1.86, vw * 0.11), 34, 60));
      fr = clamp(Math.round(avail * 0.3), 30, 44);
      cx = Math.round(vw / 2); cy = Math.round(top + 2 + 0.86 * r);
      const half = Math.round(r * UNIT * 0.44) + 10;
      const lx = 8 + L.safe.l, lw = cx - half - lx, rx = cx + half, rw = vw - 8 - L.safe.r - rx;
      const stH = 26 + 6 + 30, blockL = fr + 8 + stH, blockR = z.mh + 8 + z.ctx;
      const yL = Math.round(top + Math.max(4, (avail - blockL) / 2)), yR = Math.round(top + Math.max(4, (avail - blockR) / 2));
      rows = { time: yL, st: yL + fr + 8, stH, ctrl: yR, ctx: yR + z.mh + 8, x0: rx, w: rw, rx0: lx, rw: lw, z };
      rows.hd = { x: lx - 2, y: yL + fr / 2 - 22 };
    } else {
      // phone on its side: the tomato beside the readout, controls and context underneath
      const u = L.ui, z = sz(true);
      const bottomH = z.mh + 8 + z.ctx + 6;
      const topH = u.h - bottomH - 12;
      r = Math.round(clamp(Math.min(topH / 1.98, u.w * 0.2), 40, 76));
      fr = clamp(Math.round(r * 0.72), 34, 52);
      const tomW = Math.round(r * UNIT);
      const leftW = Math.max(tomW * 0.86, 2.3 * r);
      cx = Math.round(u.x + 8 + leftW / 2); cy = Math.round(u.y + 6 + 1.05 * r);
      const rx0 = Math.round(u.x + 8 + leftW), rw = Math.round(u.w - leftW - 12);
      const stH = 26 + 6 + 30;
      const blockH = fr + 10 + stH;
      const ty = Math.round(cy - blockH / 2);
      rows = { time: ty, st: ty + fr + 10, stH, ctrl: u.y + topH + 10, ctx: u.y + topH + 10 + z.mh + 8, x0: u.x, w: u.w, rx0, rw, z };
      rows.hd = { x: u.x + u.w - 46, y: rows.ctrl + (z.mh - 44) / 2 };
    }
    S = Math.round(r * UNIT);
    ppm = (BAND.w / 200) * S / VIS; bandW = (BAND.w / 200) * S;
    // the tomato box
    const bx = Math.round(cx - S / 2), by = Math.round(cy - (TB.cy / 200) * S);
    place(tom, bx, by, S, S);
    // readout
    const z = rows.z;
    root.style.setProperty('--dl-fr', fr + 'px');
    root.style.setProperty('--dl-cb', z.cb + 'px'); root.style.setProperty('--dl-mh', z.mh + 'px'); root.style.setProperty('--dl-mw', z.mw + 'px'); root.style.setProperty('--dl-cg', z.cg + 'px');
    root.style.setProperty('--dl-aw', z.aw + 'px'); root.style.setProperty('--dl-ah', z.ah + 'px');
    const tx0 = lay === 'short' || lay === 'split' ? rows.rx0 : rows.x0, tw = lay === 'short' || lay === 'split' ? rows.rw : rows.w;
    place(timeEl, tx0, Math.round(rows.time), tw, fr + 4);
    place(statusEl, tx0, Math.round(rows.st), tw, rows.stH || z.st);
    place(ctrlEl, rows.x0, Math.round(rows.ctrl), rows.w, z.mh);
    place(ctxEl, rows.x0, Math.round(rows.ctx), rows.w, z.ctx);
    // the halo behind the digits
    const hw = Math.min(tw, fr * 4.6), hh = fr * 2.4;
    place(haloEl, Math.round(tx0 + tw / 2 - hw / 2), Math.round(rows.time + fr / 2 - hh / 2 + fr * 0.3), Math.round(hw), Math.round(hh));
    place(hdBtn, Math.round(rows.hd.x), Math.round(rows.hd.y));
    place(padEl, rows.x0, Math.round(rows.ctrl - 6), rows.w, Math.round(rows.ctx + z.ctx - rows.ctrl + 12));
    // the press-again hint takes the status row's place for its two seconds
    hintPos = { x: Math.round(tx0 + tw / 2), y: Math.round(rows.st + (lay === 'short' || lay === 'split' ? 13 : z.st / 2)) };
    // the band strip, at the size it's shown
    stripEl.innerHTML = stripSVG();
    // tell the Scene where the tomato really is (it draws the desk shadow there and flies the harvest from it)
    L.dial = { cx, cy, r };
    laidOut = true;
    actLayout();
    syncAll();
  }
  let hintPos = { x: 0, y: 0 };

  // ───────────────────────── the band (minutes left under the pointer) ─────────────────────────
  const bandX = (v) => -(v - VMIN) * ppm + bandW / 2;
  function cancelBand() { if (bandAnim) { try { bandAnim.cancel(); } catch (e) {} bandAnim = null; } bandDur = 0; }
  // where the band visually is right now (mid-glide it isn't where it started)
  function bandNow() { if (bandAnim && bandDur > 0) { const t = clamp((now() - bandT0) / bandDur, 0, 1); return bandFrom * (1 - t); } return bandV; }
  function setBand(v) { cancelBand(); bandV = v; stripEl.style.transform = tx(bandX(v)); }
  // how many real milliseconds until the session ends (the Engine's speed is already in endAt)
  function realMsLeft() {
    if (TIMER.state !== 'running') return 0;
    if (TIMER.endAt > 0) return Math.max(0, TIMER.endAt - Date.now());
    return engLeft() * 1000;
  }
  function glideBand() {
    if (!laidOut) return;
    const v0 = engLeft() / 60;
    if (TIMER.state !== 'running' || RM() || !canAnim(stripEl) || celebrating) { setBand(v0); return; }
    const ms = realMsLeft();
    if (ms < 60) { setBand(0); return; }
    setBand(v0);
    bandAnim = stripEl.animate([{ transform: tx(bandX(v0)) }, { transform: tx(bandX(0)) }], { duration: ms, easing: 'linear', fill: 'forwards' });
    bandFrom = v0; bandT0 = now(); bandDur = ms;
  }
  // a short tween for changes while idle or paused (wind keys, reset, a new mode)
  function tweenBand(v1, ms = 260, ease = 'cubic-bezier(.2,.8,.2,1)') {
    if (!laidOut) return;
    const v0 = bandNow();
    setBand(v1);
    if (RM() || !canAnim(stripEl) || Math.abs(v1 - v0) < 0.01 || document.hidden) return;
    bandAnim = stripEl.animate([{ transform: tx(bandX(v0)) }, { transform: tx(bandX(v1)) }], { duration: ms, easing: ease });
    bandAnim.onfinish = () => { bandAnim = null; };
  }
  function bandDrift() {
    if (!bandAnim || bandDur <= 0 || TIMER.state !== 'running') return false;
    const t = clamp((now() - bandT0) / bandDur, 0, 1), vAnim = bandFrom * (1 - t), vNow = engLeft() / 60;
    return Math.abs(vNow - vAnim) * ppm > 1.5;
  }

  // ───────────────────────── ripening (green → orange → red, cross-faded layers) ─────────────────────────
  const CURVE = { o: [[0, 0], [0.1, 0], [0.55, 1], [1, 1]], r: [[0, 0], [0.42, 0], [0.94, 1], [1, 1]] };
  function fAt(c, p) { for (let i = 1; i < c.length; i++) if (p <= c[i][0]) { const a = c[i - 1], b = c[i]; return a[1] + (b[1] - a[1]) * ((p - a[0]) / (b[0] - a[0] || 1)); } return c[c.length - 1][1]; }
  function cancelRipe() { for (const a of ripeAnims) try { a.cancel(); } catch (e) {} ripeAnims = []; }
  function setRipe(p) { cancelRipe(); layO.style.opacity = fAt(CURVE.o, p).toFixed(3); layR.style.opacity = fAt(CURVE.r, p).toFixed(3); }
  function ripeTarget() { return isBreak() ? 1 : TIMER.state === 'idle' ? 0 : engProgress(); }
  function glideRipe() {
    const p0 = ripeTarget();
    if (isBreak() || TIMER.state !== 'running' || RM() || !canAnim(layO) || celebrating) { setRipe(p0); return; }
    const ms = realMsLeft();
    setRipe(p0);
    if (ms < 60 || p0 >= 1) return;
    const keys = (c) => { const k = [{ opacity: fAt(c, p0), offset: 0 }]; for (const [p, v] of c) if (p > p0 && p < 1) k.push({ opacity: v, offset: (p - p0) / (1 - p0) }); k.push({ opacity: fAt(c, 1), offset: 1 }); return k; };
    ripeAnims = [layO.animate(keys(CURVE.o), { duration: ms, easing: 'linear', fill: 'forwards' }), layR.animate(keys(CURVE.r), { duration: ms, easing: 'linear', fill: 'forwards' })];
  }
  // a quick cross-fade to a new ripeness (reset, skip, a new mode)
  function fadeRipe(p1, ms = 420) {
    let o0 = +layO.style.opacity || 0, r0 = +layR.style.opacity || 0;
    if (ripeAnims.length) { try { o0 = +getComputedStyle(layO).opacity; r0 = +getComputedStyle(layR).opacity; } catch (e) {} }
    setRipe(p1);
    if (RM() && ms > 0) ms = 300;   // reduced motion: cross-fades are the point
    if (!canAnim(layO) || document.hidden) return;
    const o1 = fAt(CURVE.o, p1), r1 = fAt(CURVE.r, p1);
    if (Math.abs(o1 - o0) > 0.01) ripeAnims.push(layO.animate([{ opacity: o0 }, { opacity: o1 }], { duration: ms, easing: 'ease-out' }));
    if (Math.abs(r1 - r0) > 0.01) ripeAnims.push(layR.animate([{ opacity: r0 }, { opacity: r1 }], { duration: ms, easing: 'ease-out' }));
  }

  // ───────────────────────── readout, status, controls ─────────────────────────
  function renderTime(sec, force) {
    const s = Math.max(0, Math.ceil(sec - 1e-6));
    if (s === shownSec && !force) return;
    shownSec = s;
    timeEl.textContent = mmss(sec);
    root.classList.toggle('dl-last', TIMER.state !== 'idle' && s <= 60 && s > 0);
    const idle = TIMER.state === 'idle', m = idle ? Math.round(sec / 60) : Math.floor(sec / 60 + 1e-6);
    if (m !== shownMin || force) {
      shownMin = m;
      tom.setAttribute('aria-valuenow', String(clamp(idle ? m : Math.ceil(sec / 60 - 1e-6), MINMIN, MAXMIN)));
      tom.setAttribute('aria-valuetext', idle ? W.set(m) : W.left(m));
    }
  }
  function renderStatus() {
    const m = TIMER.mode, st = TIMER.state;
    root.classList.toggle('dl-break', isBreak(m));
    root.dataset.state = st; root.dataset.mode = m;
    modeEl.firstChild.textContent = TEXT.modes[m].label + (st === 'paused' ? ' · ' + W.paused : '');
    // cycle dots: filled = finished in this cycle; during a long break the cycle just closed, so all are filled
    const n = clamp((DB && DB.settings && DB.settings.longEvery) || 4, 1, 12);
    const done = m === 'long' ? n : clamp(TIMER.cycle || 0, 0, n);
    if (dotsEl.childNodes.length !== n) { dotsEl.textContent = ''; for (let i = 0; i < n; i++) dotsEl.appendChild(h('i')); }
    for (let i = 0; i < n; i++) { const d = dotsEl.childNodes[i]; d.className = i < done ? 'on' : i === done && m === 'focus' ? 'cur' : ''; }
    dotsEl.setAttribute('aria-label', W.cycle(Math.min(n, done + (m === 'focus' ? 1 : 0)), n));
    renderTask();
  }
  function renderTask() {
    const t = eng('activeTask');
    taskEl.textContent = '';
    taskEl.classList.toggle('dl-none', !t);
    taskEl.insertAdjacentHTML('afterbegin', ICON(t ? 'tomato' : 'tasks'));
    if (t) {
      taskEl.append(h('b', null, t.title), h('small', null, (t.done || 0) + '/' + (t.est || 1)));
      taskEl.setAttribute('aria-label', TEXT.ui.workingOn + ': ' + t.title + '. ' + TEXT.ui.tasks);
    } else { taskEl.append(h('b', null, TEXT.ui.noTask)); taskEl.setAttribute('aria-label', TEXT.ui.noTask); }
  }
  function renderControls() {
    const st = TIMER.state, m = TIMER.mode;
    const label = st === 'running' ? TEXT.ui.pause : st === 'paused' ? TEXT.ui.resume : TEXT.ui.start;
    bMain.innerHTML = ICON(st === 'running' ? 'pause' : 'play') + '<span>' + label + '</span>';
    bMain.setAttribute('aria-label', label + ' (Space)');
    bReset.disabled = st === 'idle' && !wound();
    disarm();
    // the context row: mode chips when idle in focus · Distracted? while focusing · the break card in a break
    const showChips = st === 'idle' && m === 'focus', showDist = m === 'focus' && st !== 'idle', showBreak = isBreak(m);
    chipsEl.hidden = !showChips; distEl.hidden = !showDist; breakEl.hidden = !showBreak;
    for (const c of chipsEl.childNodes) c.setAttribute('aria-pressed', String(c.dataset.m === m));
    distEl.lastChild.textContent = TIMER.rogues > 0 ? String(TIMER.rogues) : '';
    if (showBreak) renderBreak();
    hdBtn.innerHTML = ICON(FOCUSMODE.on ? 'collapse' : 'expand');
    hdBtn.setAttribute('aria-label', FOCUSMODE.on ? TEXT.ui.exitFocusMode : TEXT.ui.focusMode);
    hdBtn.setAttribute('aria-pressed', String(FOCUSMODE.on));
    hdBtn.title = (FOCUSMODE.on ? TEXT.ui.exitFocusMode : TEXT.ui.focusMode) + ' (F)';
  }
  function reviewCount() {
    let list = eng('openRogues');
    if (!Array.isArray(list)) list = [];
    const ids = new Set([lastFocusId, TIMER.sessionId].filter(Boolean));
    return list.filter((r) => r && r.note && ids.has(r.sessionId)).length;
  }
  let actBtns = {}, revBtn = null;
  function buildBreak() {
    for (const id of ['window', 'breathe', 'stretch', 'bughunt']) {
      const b = TEXT.breaks[id];
      actBtns[id] = h('button', { class: 'dl-act', 'data-a': id, 'aria-label': b.name, title: b.name, onclick: () => activity(id) }, h('span', { html: ICON(b.icon) }), W.acts[id]);
      breakEl.appendChild(actBtns[id]);
    }
    revBtn = h('button', { class: 'dl-act dl-rev', hidden: true, onclick: () => SHEET.open('tasks', { section: 'later' }) }, h('span', { html: ICON('glitch') }), W.review, h('b'));
    breakEl.appendChild(revBtn);
  }
  function renderBreak() {
    if (!revBtn) return;
    const n = reviewCount();
    revBtn.hidden = n <= 0;
    if (n > 0) { revBtn.lastChild.textContent = String(n); const t = `${W.review} ${n} ${W.later}`; revBtn.setAttribute('aria-label', t); revBtn.title = t; }
  }

  // everything from the Engine's current state (boot, layout, data import, visibility)
  function syncAll() {
    if (!built || !laidOut) return;
    renderStatus(); renderControls();
    if (celebrating) return;
    if (!readoutHold) renderTime(engLeft(), true);
    if (drag || fling || snapTw) return;
    glideBand(); glideRipe();
  }

  // ───────────────────────── winding: drag the band, detents, inertia, the clack ─────────────────────────
  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (celebrating || drag) return;
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: now(), active: false, hist: [[now(), e.clientX]], moved: 0 };
    try { tom.setPointerCapture(e.pointerId); } catch (err) {}
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const t = now(), dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    drag.hist.push([t, e.clientX]); if (drag.hist.length > 6) drag.hist.shift();
    drag.moved = Math.max(drag.moved, Math.abs(dx) + Math.abs(dy));
    if (!drag.active) {
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 0.8) return;
      beginWind(e.clientX);
    }
    const raw = drag.v0 - (e.clientX - drag.x0) / ppm;
    windTo(rubber(raw));
    // the leaves lean into the twist
    const h2 = drag.hist, a = h2[0], b = h2[h2.length - 1], vel = (b[1] - a[1]) / Math.max(8, b[0] - a[0]);
    leafTarget = clamp(vel * 24, -13, 13);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    tom.classList.remove('dl-grab');
    if (!d.active) {
      if (now() - d.t0 < 650 && d.moved < 12) tapTomato();
      return;
    }
    // release velocity, minutes per second (dragging left winds up)
    const hs = d.hist, a = hs[0], b = hs[hs.length - 1], dt = Math.max(1, b[0] - a[0]);
    let vel = -((b[1] - a[1]) / dt) * 1000 / ppm;
    if (now() - b[0] > 90) vel = 0;
    vel = clamp(vel, -140, 140);
    leafTarget = 0;
    if (Math.abs(vel) > 6 && !RM()) fling = { v: bandV, vel };
    else snapTo(Math.round(clamp(bandV, MINMIN, MAXMIN)));
  }
  function onCancel(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const wasActive = drag.active; drag = null;
    tom.classList.remove('dl-grab'); leafTarget = 0;
    if (wasActive) { readoutHold = false; syncAll(); }
  }
  function beginWind(x) {
    drag.active = true; drag.x0 = x;
    cancelBand(); stopFling();
    drag.v0 = TIMER.state === 'running' ? engLeft() / 60 : bandV;
    bandV = drag.v0;
    lastDet = Math.round(bandV);
    readoutHold = true;
    tom.classList.add('dl-grab');
  }
  // soft limits: past 1 or 120 minutes the band resists and springs back
  function rubber(v) {
    const k = 2.4;
    if (v < MINMIN) { const o = MINMIN - v; return MINMIN - k * (1 - 1 / (1 + o / k)); }
    if (v > MAXMIN) { const o = v - MAXMIN; return MAXMIN + k * (1 - 1 / (1 + o / k)); }
    return v;
  }
  function windTo(v) {
    bandV = v;
    stripEl.style.transform = tx(bandX(v));
    const m = Math.round(clamp(v, MINMIN, MAXMIN));
    if (m !== lastDet) {
      lastDet = m;
      const t = now();
      if (t - lastTickT > 32) {
        lastTickT = t; sfx('wind_tick'); haptic('tick');
        // the notch is the ratchet's pawl: it clicks down over each tooth
        if (!RM() && canAnim(notchEl)) notchEl.animate([{ transform: 'none' }, { transform: 'translateY(9%) scaleY(.9)', offset: 0.35 }, { transform: 'none' }], { duration: 110, easing: 'ease-out' });
      }
      timeEl.textContent = mmss(m * 60); shownSec = -1;
      tom.setAttribute('aria-valuenow', String(m)); tom.setAttribute('aria-valuetext', W.set(m));
    }
  }
  function stopFling() { fling = null; snapTw = null; }
  function snapTo(m) {
    snapTw = { from: bandV, to: m, t: 0, d: Math.abs(bandV - m) > 0.02 ? 0.2 : 0.001 };
  }
  function commitWind(m) {
    snapTw = null; fling = null;
    m = clamp(Math.round(m), MINMIN, MAXMIN);
    const st = TIMER.state;
    readoutHold = false;
    sfx('wind_release');
    if (st !== 'idle') haptic('tick');   // idle → start: Snd's start haptic follows
    eng('wind', m * 60);
    if (st === 'idle') eng('start');
    else syncAll();
    wobble();
  }
  function tapTomato() {
    if (celebrating) return;
    eng('toggle');
  }
  // keys and the slider's arrows: ±60 s (Shift ±300); idle snaps to whole minutes
  function windBy(delta) {
    if (celebrating) return;
    const left = engLeft();
    let s = left + delta;
    if (TIMER.state === 'idle') s = Math.round(s / 60) * 60;
    if (s < MINMIN * 60) { if (left <= MINMIN * 60 + 0.5) { bump(); return; } s = MINMIN * 60; }
    if (s > MAXMIN * 60) { if (left >= MAXMIN * 60 - 0.5) { bump(); return; } s = MAXMIN * 60; }
    sfx('wind_tick'); haptic('tick');
    eng('wind', s);
  }
  let wobAnim = null;
  function wob(keys, ms, easing) {
    if (wobAnim) { try { wobAnim.cancel(); } catch (e) {} wobAnim = null; }
    if (RM() || !canAnim(wobEl) || document.hidden) return;
    wobAnim = wobEl.animate(keys, { duration: ms, easing });
    wobAnim.onfinish = () => { wobAnim = null; };
  }
  function wobble() { if (!celebrating) wob(WOBBLE, 620, 'cubic-bezier(.2,.8,.2,1)'); }
  function bump() { wob(BUMP, 300, 'cubic-bezier(.2,.8,.2,1)'); haptic('error'); }

  // ───────────────────────── the big moment: ring, harvest, a fresh tomato ─────────────────────────
  function onDone(p) {
    const mode = p.mode || 'focus';
    if (mode === 'focus' && p.session && p.session.id) lastFocusId = p.session.id;
    if (act) abortActivity();
    if (drag || fling || snapTw) { drag = null; fling = null; snapTw = null; tom.classList.remove('dl-grab'); readoutHold = false; }
    ANNOUNCE(W.announceDone(mode, p.next));
    clearLater();
    if (p.away || document.hidden) { celebrating = false; readoutHold = false; root.classList.remove('dl-moment'); popEl.style.opacity = ''; shadowEl.style.opacity = ''; syncAll(); return; }
    celebrating = true; readoutHold = true;
    root.classList.add('dl-moment');
    setBand(0); if (mode === 'focus') setRipe(1);
    timeEl.textContent = '00:00'; shownSec = -1;
    root.classList.remove('dl-last');
    wob(RING, 1050, 'linear');
    later(1100, () => {
      if (mode === 'focus') {
        const L = LAYOUT.dial;
        BUS.emit('harvest', { x: L.cx, y: L.cy, r: L.r });
      }
      popOff(mode === 'focus');
    });
    later(1500, () => {
      celebrating = false; readoutHold = false;
      root.classList.remove('dl-moment');
      syncAll();
      growIn();
      // every new tomato starts green; a break's then ripens in a quick time-lapse ("ripe and relaxed")
      if (isBreak() && !RM() && canAnim(layO) && !document.hidden) { setRipe(0); later(320, () => { if (!celebrating && isBreak()) fadeRipe(1, 1150); }); }
    });
  }
  function popOff(harvest) {
    if (!canAnim(popEl) || RM()) { popEl.style.opacity = '0'; shadowEl.style.opacity = '0'; return; }
    popEl.style.opacity = '0'; shadowEl.style.opacity = '0';
    popEl.animate(harvest
      ? [{ transform: 'none', opacity: 1 }, { transform: 'translateY(-6px) scale(1.12)', opacity: 1, offset: 0.3 }, { transform: 'translateY(-26px) scale(.35)', opacity: 0 }]
      : [{ transform: 'none', opacity: 1 }, { transform: 'scale(.86)', opacity: 0 }], { duration: harvest ? 240 : 300, easing: 'cubic-bezier(.5,0,.75,0)' });
  }
  function growIn() {
    popEl.style.opacity = ''; shadowEl.style.opacity = '';
    if (!canAnim(popEl) || document.hidden) return;
    if (RM()) { popEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); return; }
    // a fresh tomato swells up from the desk, overshoots, and settles with a little squash
    const E1 = 'cubic-bezier(.2,.7,.3,1)', E2 = 'cubic-bezier(.45,0,.55,1)';
    popEl.animate([{ transform: 'scale(.1)', opacity: 0, easing: E1 }, { transform: 'scale(.28)', opacity: 1, offset: 0.1, easing: E1 }, { transform: 'scale(1.08,.94)', offset: 0.52, easing: E2 },
      { transform: 'scale(.96,1.04)', offset: 0.72, easing: E2 }, { transform: 'scale(1.015,.985)', offset: 0.88, easing: E2 }, { transform: 'none', opacity: 1 }], { duration: 760, easing: 'linear' });
    leavesEl.animate([{ transform: 'scale(.15) rotate(-35deg)', opacity: 0 }, { transform: 'scale(.15) rotate(-35deg)', opacity: 0, offset: 0.3, easing: E1 }, { transform: 'scale(1.14) rotate(7deg)', opacity: 1, offset: 0.72, easing: E2 },
      { transform: 'none', opacity: 1 }], { duration: 900, easing: 'linear' });
    shadowEl.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'ease-out' });
  }

  // ───────────────────────── reset / skip: press twice during a running focus ─────────────────────────
  function press(which, viaButton) {
    if (celebrating) return;
    const guarded = TIMER.mode === 'focus' && TIMER.state === 'running';
    if (guarded && armed !== which) {
      armed = which; armT = now();
      (which === 'r' ? bReset : bSkip).classList.add('dl-armed');
      hint(viaButton ? (which === 'r' ? W.again.tr : W.again.ts) : (which === 'r' ? W.again.r : W.again.s));
      haptic('tick');
      return;
    }
    disarm();
    if (which === 'r') eng('reset'); else eng('skip');
  }
  function disarm() { armed = null; if (bReset) bReset.classList.remove('dl-armed'); if (bSkip) bSkip.classList.remove('dl-armed'); hideHint(); }
  let hintT = 0;
  function hint(text) {
    hintEl.textContent = text;
    place(hintEl, hintPos.x, hintPos.y);
    hintEl.classList.add('on'); root.classList.add('dl-hinting');
    ANNOUNCE(text);
    clearTimeout(hintT); hintT = setTimeout(disarm, 2000);
  }
  function hideHint() { clearTimeout(hintT); if (hintEl) hintEl.classList.remove('on'); if (root) root.classList.remove('dl-hinting'); }

  // ───────────────────────── heads-down ─────────────────────────
  function focusMode(on) {
    on = !!on;
    if (FOCUSMODE.on === on) { if (hdBtn) renderControls(); return; }
    FOCUSMODE.on = on;
    document.documentElement.classList.toggle('heads-down', on);
    if (root) root.classList.remove('dl-wake');
    BUS.emit('focusmode', { on });
    if (built) renderControls();
    ANNOUNCE(on ? TEXT.ui.focusMode : TEXT.ui.exitFocusMode);
  }
  function wake() {
    if (!FOCUSMODE.on || !root) return;
    root.classList.add('dl-wake');
    clearTimeout(wakeT); wakeT = setTimeout(() => { if (root && !root.contains(document.activeElement)) root.classList.remove('dl-wake'); else wake(); }, 3200);
  }

  // ───────────────────────── keys (CONTRACT.md §6) ─────────────────────────
  function key(e) {
    if (!built || busy()) return false;
    const k = e.key;
    if (act) return actKey(e);
    if (k === 'Escape') { if (FOCUSMODE.on) { focusMode(false); return true; } return false; }
    if (k === ' ' || k === 'Spacebar' || k === 'Enter') {
      const a = document.activeElement;
      if (a && a !== document.body && a !== tom && a !== document.documentElement && a.closest && a.closest('button,a,input,textarea,select,[role="button"]')) return false;
      if (e.repeat) return true;
      if (!celebrating) eng('toggle');
      return true;
    }
    if (k === 'ArrowLeft' || k === '-' || k === '_') { windBy(-(e.shiftKey ? 300 : 60)); return true; }
    if (k === 'ArrowRight' || k === '+' || k === '=') { windBy(e.shiftKey ? 300 : 60); return true; }
    if (e.repeat) return false;
    const lk = k.length === 1 ? k.toLowerCase() : k;
    if (lk === 'r') { if (TIMER.state === 'idle' && !wound()) return false; press('r', false); return true; }
    if (lk === 's') { press('s', false); return true; }
    if (lk === 'd') { if (TIMER.mode === 'focus' && TIMER.state !== 'idle') { SHEET.open('capture'); return true; } return false; }
    if (lk === 'f') { focusMode(!FOCUSMODE.on); return true; }
    return false;
  }

  // ───────────────────────── update (every drawn frame; ≈ 0 when nothing moves) ─────────────────────────
  function update(dt) {
    if (!built) return;
    if (fling) {
      fling.v += fling.vel * dt;
      fling.vel *= Math.exp(-dt * 4.2);
      if (fling.v < MINMIN - 0.5 || fling.v > MAXMIN + 0.5) { fling.v = clamp(fling.v, MINMIN - 0.5, MAXMIN + 0.5); windTo(rubber(fling.v)); const t = Math.round(clamp(fling.v, MINMIN, MAXMIN)); fling = null; snapTo(t); }
      else { windTo(fling.v); if (Math.abs(fling.vel) < 3.5) { const t = Math.round(clamp(fling.v, MINMIN, MAXMIN)); fling = null; snapTo(t); } }
    } else if (snapTw) {
      snapTw.t += dt;
      const k = clamp(snapTw.t / snapTw.d, 0, 1), e = easeOutBack(k, 2.2);
      windTo(snapTw.from + (snapTw.to - snapTw.from) * e);
      if (k >= 1) { const m = snapTw.to; snapTw = null; windTo(m); commitWind(m); }
    }
    // leaves: lean while twisting, spring back after
    if (leafTilt !== leafTarget || leafTilt !== 0) {
      leafTilt += (leafTarget - leafTilt) * Math.min(1, dt * 14);
      if (!drag && Math.abs(leafTilt) < 0.05 && leafTarget === 0) { leafTilt = 0; leavesEl.style.transform = ''; }
      else leavesEl.style.transform = `rotate(${leafTilt.toFixed(2)}deg) skewX(${(-leafTilt * 0.4).toFixed(2)}deg)`;
    }
    if (armed && now() - armT > 2000) disarm();
    if (act) actUpdate(dt);
  }

  // ───────────────────────── BUS ─────────────────────────
  // One Engine call emits several events (reset → timer:mode, timer:state, timer:tick, timer:reset). Coalesce them
  // into one visual sync per call, after the Engine is done, so the look is computed once from the final state.
  let pend = null;
  const PRI = { state: 1, wind: 2, mode: 3, skip: 4, reset: 5 };
  function schedule(kind) {
    if (!pend) { pend = kind; queueMicrotask(flush); } else if (PRI[kind] > PRI[pend]) pend = kind;
  }
  function flush() {
    const kind = pend; pend = null;
    if (!built || !laidOut || celebrating) return;
    renderStatus(); renderControls();
    if (drag || fling || snapTw) return;
    if (!readoutHold) renderTime(engLeft(), true);
    if (kind === 'reset') { tweenBand(engLeft() / 60, 560, 'cubic-bezier(.34,1.45,.64,1)'); fadeRipe(ripeTarget(), 520); }
    else if (kind === 'skip') swapLook();
    else if (TIMER.state === 'running') { glideBand(); glideRipe(); }
    else if (kind === 'state') { setBand(engLeft() / 60); setRipe(ripeTarget()); }
    else { tweenBand(engLeft() / 60, kind === 'wind' ? 200 : 420); fadeRipe(ripeTarget(), kind === 'wind' ? 160 : 420); }
  }
  function bind() {
    BUS.on('timer:tick', (p) => {
      if (!built || celebrating) return;
      if (!readoutHold) renderTime(p && typeof p.left === 'number' ? p.left : engLeft());
      if (act) actTick();
      if (drag || fling || snapTw || pend || TIMER.state !== 'running') return;
      // reduced motion steps once a second; otherwise the compositor glides, and we only re-aim on drift
      if (RM() || !canAnim(stripEl)) { setBand(engLeft() / 60); setRipe(ripeTarget()); }
      else if (!bandAnim || bandDrift()) { glideBand(); glideRipe(); }
    });
    BUS.on('timer:state', () => schedule('state'));
    BUS.on('timer:start', (p) => { if (!built || celebrating) return; if (!(p && p.away)) { ANNOUNCE(W.started(TIMER.mode, Math.round(engLeft() / 60))); wobble(); } schedule('state'); });
    BUS.on('timer:pause', () => { if (!built || celebrating) return; ANNOUNCE(W.announcePause); schedule('state'); });
    BUS.on('timer:resume', () => { if (!built || celebrating) return; ANNOUNCE(W.announceResume); wobble(); schedule('state'); });
    BUS.on('timer:reset', () => { if (!built) return; ANNOUNCE(W.announceReset); if (act) abortActivity(); schedule('reset'); });
    BUS.on('timer:skip', () => { if (!built) return; if (act) abortActivity(); schedule('skip'); });
    BUS.on('timer:mode', () => { if (!built) return; if (act && TIMER.mode === 'focus' && !act.free) abortActivity(); schedule('mode'); });
    BUS.on('timer:wind', () => schedule('wind'));
    BUS.on('timer:done', (p) => { if (built) onDone(p || {}); });
    BUS.on('timer:milestone', (p) => {
      if (!built || RM() || !p || p.kind === 'half' || !canAnim(notchEl)) return;
      notchEl.animate([{ transform: 'none' }, { transform: 'translateY(-3px) scale(1.25)' }, { transform: 'none' }], { duration: 700, easing: 'ease-in-out' });
    });
    BUS.on('task:change', () => { if (built) renderTask(); });
    BUS.on('rogue:capture', () => { if (built) renderControls(); });
    BUS.on('rogue:change', () => { if (built && isBreak()) renderBreak(); });
    BUS.on('settings', (p) => { if (!built) return; if (!p || !p.key || p.key === 'motion') syncAll(); else if (p.key === 'longEvery') renderStatus(); });
    BUS.on('data', () => { if (built) syncAll(); });
    BUS.on('visible', () => { if (built && !celebrating) syncAll(); });
    BUS.on('ui:sheet', (p) => { if (p && p.id) disarm(); });
    // the band nudges once to show it's draggable: on ready, or after the first-run cards if they're showing
    BUS.on('ready', () => { if (built && !(DB && DB.meta && DB.meta.onboarded === false)) idleNudge(); });
    BUS.on('onboard:done', () => { if (built) idleNudge(); });
  }
  function swapLook() {
    if (!canAnim(popEl) || RM() || document.hidden) { syncAll(); return; }
    // a quick dip: the tomato sinks a little while its colour and band change
    popEl.animate([{ transform: 'none' }, { transform: 'scale(.94,.9)', offset: 0.4 }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    tweenBand(engLeft() / 60, 380); fadeRipe(ripeTarget(), 380);
    if (TIMER.state === 'running') later(400, () => { glideBand(); glideRipe(); });
  }
  // a first-run invitation: the band slides a couple of minutes and springs back, so it reads as draggable
  function idleNudge() {
    if (RM() || TIMER.state !== 'idle' || !canAnim(stripEl) || !laidOut) return;
    later(1400, () => {
      if (TIMER.state !== 'idle' || drag || fling || snapTw || celebrating || act || document.hidden) return;
      const v = bandV;
      cancelBand();
      bandAnim = stripEl.animate([{ transform: tx(bandX(v)) }, { transform: tx(bandX(v + 2.2)), offset: 0.38 }, { transform: tx(bandX(v - 0.35)), offset: 0.72 }, { transform: tx(bandX(v)) }],
        { duration: 1100, easing: 'ease-in-out' });
      bandAnim.onfinish = () => { bandAnim = null; };
      leavesEl.animate([{ transform: 'none' }, { transform: 'rotate(-5deg)', offset: 0.38 }, { transform: 'rotate(2deg)', offset: 0.72 }, { transform: 'none' }], { duration: 1100, easing: 'ease-in-out' });
    });
  }

  // ───────────────────────── break activities (in #activity): window · breathe · stretch · Bug Hunt ─────────────────────────
  // Each activity is built when it starts and removed when it ends. Panels sit over the dial's area so the room
  // (Patch demonstrating, the window) stays in view; Bug Hunt takes the whole screen.
  let actEl = null;
  const elapsed = (a) => (now() - a.t0) / 1000;
  function actArea() {
    const L = LAYOUT;
    if (!L.wide) return { x: 0, y: L.deskY, w: L.W, h: L.dock.y - L.deskY };
    return { x: L.ui.x, y: L.ui.y, w: L.ui.w, h: L.ui.h };
  }
  function activity(id) {
    if (!built) return;
    if (act) abortActivity();
    if (!id || !TEXT.breaks[id]) return;
    actEl = actEl || $('activity');
    if (!actEl) return;
    // an activity is how a break gets used: start (or resume) the break if it's waiting
    if (isBreak()) { if (TIMER.state === 'idle') eng('start'); else if (TIMER.state === 'paused') eng('resume'); }
    const opener = document.activeElement;
    act = id === 'bughunt' ? mkHunt() : mkPanel(id);
    act.id = id; act.t0 = now(); act.opener = opener; act.free = !isBreak();
    actEl.appendChild(act.el);
    if (id !== 'bughunt') root.classList.add('dl-acting');
    if (canAnim(act.el) && !document.hidden) act.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RM() ? 200 : 260, easing: 'ease-out' });
    disarm();
    BUS.emit('activity', { id, phase: 'start' });
    try { const f = act.el.matches('[data-focus]') ? act.el : act.el.querySelector('[data-focus]') || act.el.querySelector('button:not([hidden])'); if (f) f.focus({ preventScroll: true }); } catch (e) {}
    if (act.start) act.start();
  }
  // ends without finishing: Esc, the close button, the break ending, a skip or reset
  function abortActivity() { if (!act) return; if (act.quit) act.quit(); else closeActivity(false); }
  function closeActivity(done) {
    if (!act) return;
    const a = act; act = null;
    try { if (a.stop) a.stop(); } catch (e) { reportErr('dial:act.stop', e); }
    if (!a.ended) { a.ended = true; BUS.emit('activity', Object.assign({ id: a.id, phase: 'end', done: !!done }, a.id === 'bughunt' ? { score: a.score || 0 } : {})); }
    root.classList.remove('dl-acting');
    const el = a.el, gone = () => { if (el.parentNode) el.parentNode.removeChild(el); };
    if (canAnim(el) && !document.hidden) { el.style.pointerEvents = 'none'; const an = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease-in' }); an.onfinish = gone; setTimeout(gone, 600); } else gone();
    // focus goes back where it came from (a break-card tile); if nothing was focused, nothing is
    try { if (el.contains(document.activeElement)) { const o = a.opener; if (o && o !== document.body && o.isConnected && !o.closest('[hidden]') && o.focus) o.focus({ preventScroll: true }); else document.activeElement.blur(); } } catch (e) {}
    if (built) { renderControls(); if (!celebrating) syncAll(); }
  }
  // a panel activity finished on its own: record it, show the finished state for a moment, then close
  function complete(a, kind) {
    if (a.done) return;
    a.done = true;
    eng('recordBreak', kind);
    a.card.classList.add('dl-pdone');   // the chime comes from Snd on activity end
    a.ended = true;
    BUS.emit('activity', { id: a.id, phase: 'end', done: true });
    later(1700, () => { if (act === a) closeActivity(true); });
  }
  function actLayout() { if (act && act.layout) act.layout(); }
  function actUpdate(dt) { if (act && act.update) act.update(dt); }
  function actTick() { if (act && act.tick) act.tick(); }
  function actKey(e) {
    const k = e.key;
    if (k === 'Escape') { if (act.state === 'over') closeActivity(true); else abortActivity(); return true; }
    if (act.key) return act.key(e);
    return false;
  }

  // ── the panel shell: title, close, a visual, a line of text, the break's time left ──
  function mkPanel(id) {
    const def = TEXT.breaks[id];
    const a = { step: -1, done: false };
    const close = h('button', { class: 'dl-px', 'aria-label': W.end + ': ' + def.name, title: W.end + ' (Esc)', html: ICON('close'), onclick: () => closeActivity(false) });
    a.vis = h('div', { class: 'dl-pv' });
    a.txt = h('p', { class: 'dl-pt', 'aria-live': 'polite' });
    a.brk = h('span', { class: 'dl-pb' });
    a.foot = h('div', { class: 'dl-pf' }, a.brk);
    a.card = h('section', { class: 'dl-panel dl-p-' + id, role: 'dialog', tabindex: '-1', 'data-focus': '', 'aria-label': def.name },
      h('div', { class: 'dl-phead' }, h('div', { class: 'dl-ph' }, h('span', { html: ICON(def.icon) }), def.name), close), a.vis, a.txt, a.foot);
    a.el = h('div', { class: 'dl-pwrap' }, a.card);
    a.tick = () => { a.brk.textContent = isBreak() && TIMER.state !== 'idle' ? W.breakLeft + ' ' + mmss(engLeft()) : ''; };
    a.layout = () => {
      const r = actArea();
      place(a.el, r.x, r.y, r.w, r.h);
      // the visual gets whatever the header, text and footer leave (breathe has no text line)
      a.el.style.setProperty('--dl-ring', Math.round(clamp(Math.min(r.w - 72, r.h - (id === 'breathe' ? 150 : 196)), 96, 228)) + 'px');
    };
    if (id === 'window') setupWindow(a, def);
    else if (id === 'breathe') setupBreathe(a, def);
    else setupStretch(a, def);
    a.tick(); a.layout();
    return a;
  }
  const endBtn = (a) => h('button', { class: 'dl-pbtn', onclick: () => closeActivity(false) }, W.end);

  // ── look out the window: 20 seconds, one dot goes out per second ──
  function setupWindow(a, def) {
    const secs = def.secs || 20;
    const ring = h('div', { class: 'dl-ring' });
    for (let i = 0; i < secs; i++) ring.appendChild(h('i', { style: { transform: `rotate(${((i * 360) / secs).toFixed(1)}deg) translateY(calc(var(--dl-ring) * -.5 + 7px))` } }));
    const num = h('b', { class: 'dl-rn' }, String(secs));
    a.vis.append(ring, h('div', { class: 'dl-rc' }, num, h('small', { class: 'dl-rl' }, W.sec)));
    a.txt.textContent = (def.steps && def.steps[0] && def.steps[0].text) || '';
    a.foot.appendChild(endBtn(a));
    let shown = secs;
    a.update = () => {
      if (a.done) return;
      if (a.step < 0) { a.step = 0; BUS.emit('activity:step', { id: 'window', step: 0, pose: def.pose }); }
      const e = elapsed(a), left = Math.max(0, secs - Math.floor(e));
      if (left !== shown) {
        shown = left; num.textContent = String(left);
        for (let i = 0; i < secs; i++) ring.childNodes[i].classList.toggle('off', i < secs - left);
      }
      if (e >= secs) complete(a, 'window');
    };
  }

  // ── box breathing: in, hold, out, hold; the orb grows and shrinks with you ──
  function setupBreathe(a, def) {
    const rounds = def.rounds || 4, box = def.box || 4, PH = ['in', 'hold', 'out', 'rest'];
    const fill = h('i', { class: 'dl-orbf' });
    const orb = h('div', { class: 'dl-orb' }, fill);
    const lab = h('b', { class: 'dl-ol' }), cnt = h('span', { class: 'dl-oc' });
    const roundEl = h('span', { class: 'dl-pr' });
    a.vis.append(h('div', { class: 'dl-orbg' }), orb, h('div', { class: 'dl-rc' }, lab, cnt));
    a.foot.insertBefore(roundEl, a.brk);
    a.foot.appendChild(endBtn(a));
    let an = null, lastC = -1;
    const SMALL = 0.56;
    a.stop = () => { if (an) try { an.cancel(); } catch (e) {} };
    a.update = () => {
      if (a.done) return;
      const e = elapsed(a), idx = Math.floor(e / box);
      if (idx >= rounds * 4) { complete(a, 'breathe'); lab.textContent = W.done; cnt.textContent = ''; return; }
      if (idx !== a.step) {
        a.step = idx;
        const ph = PH[idx % 4];
        lab.textContent = (def.labels && def.labels[ph]) || ph;
        roundEl.textContent = W.round(Math.floor(idx / 4) + 1, rounds);
        BUS.emit('activity:step', { id: 'breathe', step: idx, breath: ph });
        if (an) { try { an.cancel(); } catch (err) {} an = null; }
        const big = ph === 'in' || ph === 'hold';
        if (RM()) {
          // reduced motion: the orb stays put and its light cross-fades instead
          orb.style.transform = 'none';
          fill.style.opacity = big ? '1' : '.35';
          if (canAnim(fill) && (ph === 'in' || ph === 'out')) an = fill.animate([{ opacity: big ? 0.35 : 1 }, { opacity: big ? 1 : 0.35 }], { duration: box * 1000, easing: 'ease-in-out' });
        } else {
          orb.style.transform = big ? 'none' : `scale(${SMALL})`;
          if (canAnim(orb) && (ph === 'in' || ph === 'out')) an = orb.animate([{ transform: `scale(${big ? SMALL : 1})` }, { transform: big ? 'none' : `scale(${SMALL})` }], { duration: box * 1000, easing: 'cubic-bezier(.45,0,.4,1)' });
        }
      }
      const c = box - Math.floor(e % box);
      if (c !== lastC) { lastC = c; cnt.textContent = String(c); }
    };
    a.start = () => { orb.style.transform = RM() ? 'none' : `scale(${SMALL})`; fill.style.opacity = RM() ? '.35' : ''; };
  }

  // ── stretch: four steps, Patch demonstrates each pose ──
  function setupStretch(a, def) {
    const steps = def.steps || [];
    const cum = [0];
    for (const st of steps) cum.push(cum[cum.length - 1] + (st.secs || 15));
    const num = h('b', { class: 'dl-snum' }, '1'), of = h('small', { class: 'dl-rl' }, '');
    const dots = h('div', { class: 'dl-sdots' }, steps.map(() => h('i')));
    const bar = h('i', { class: 'dl-sbar' });
    a.vis.classList.add('dl-pv-auto');
    a.vis.append(h('div', { class: 'dl-sbig' }, h('span', { class: 'dl-sic', html: ICON('stretch') }), num, of), dots, h('div', { class: 'dl-sprog' }, bar));
    const next = h('button', { class: 'dl-pbtn', onclick: () => { const i = Math.max(0, a.step); a.t0 = now() - cum[Math.min(steps.length, i + 1)] * 1000; } }, W.next);
    a.foot.appendChild(next);
    let an = null;
    a.stop = () => { if (an) try { an.cancel(); } catch (e) {} };
    a.update = () => {
      if (a.done) return;
      const e = elapsed(a);
      if (e >= cum[steps.length]) { complete(a, 'stretch'); bar.style.transform = 'none'; return; }
      let i = 0; while (i < steps.length - 1 && e >= cum[i + 1]) i++;
      if (i !== a.step) {
        a.step = i;
        const st = steps[i];
        num.textContent = String(i + 1); of.textContent = W.step(i + 1, steps.length).replace(/^\S+ \d+ /, '');
        a.txt.textContent = st.text;
        for (let k = 0; k < dots.childNodes.length; k++) dots.childNodes[k].className = k < i ? 'on' : k === i ? 'cur' : '';
        BUS.emit('activity:step', { id: 'stretch', step: i, pose: st.pose });
        if (an) { try { an.cancel(); } catch (err) {} an = null; }
        const dur = (cum[i + 1] - Math.max(e, cum[i])) * 1000, from = (Math.max(e, cum[i]) - cum[i]) / (st.secs || 15);
        bar.style.transform = 'none';
        if (canAnim(bar)) an = bar.animate([{ transform: `scaleX(${from.toFixed(3)})` }, { transform: 'none' }], { duration: Math.max(50, dur), easing: 'linear' });
        next.textContent = i === steps.length - 1 ? W.done : W.next;
      }
    };
  }

  // ───────────────────────── Bug Hunt: 45 s; Bagu splits when you hit it; only a written test clears the screen ─────────────────────────
  let ART = null;
  const BLOBS = new Map();
  // Sprites go in as short blob: URLs: assigning a long data: URL (Patch's baked PNG) costs a parse every time.
  function blobURL(src) {
    if (!src || src.slice(0, 5) !== 'data:' || typeof Blob === 'undefined' || !URL.createObjectURL) return src;
    if (BLOBS.has(src)) return BLOBS.get(src);
    let out = src;
    try {
      const i = src.indexOf(','), meta = src.slice(5, i), mime = meta.split(';')[0], body = src.slice(i + 1);
      let blob;
      if (/;base64/.test(meta)) { const raw = atob(body), u8 = new Uint8Array(raw.length); for (let k = 0; k < raw.length; k++) u8[k] = raw.charCodeAt(k); blob = new Blob([u8], { type: mime }); }
      else blob = new Blob([decodeURIComponent(body)], { type: mime });
      out = URL.createObjectURL(blob);
    } catch (e) { out = src; }
    BLOBS.set(src, out);
    return out;
  }
  const svgURL = (svg) => blobURL('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  function huntArt() {
    if (ART) return ART;
    const O = '#3d4c95';
    // Bagu from above (the fallback when Patch's baked rogue isn't ready): shell, eight crimson eyes, glowing antennae
    const bug = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="s" cx=".36" cy=".3" r=".85"><stop offset="0" stop-color="#86c991"/><stop offset=".45" stop-color="#3f7a50"/><stop offset="1" stop-color="#0d2418"/></radialGradient><radialGradient id="e" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff2340" stop-opacity=".75"/><stop offset="1" stop-color="#ff2340" stop-opacity="0"/></radialGradient></defs>` +
      `<g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 31 L11 25 L7 16 M20 39 L9 39 L4 45 M22 47 L13 54 L11 61 M43 31 L53 25 L57 16 M44 39 L55 39 L60 45 M42 47 L51 54 L53 61 M28 12 Q23 5 15 4 M36 12 Q41 5 49 4" stroke="${O}" stroke-width="5"/>` +
      `<path d="M21 31 L11 25 L7 16 M20 39 L9 39 L4 45 M22 47 L13 54 L11 61 M43 31 L53 25 L57 16 M44 39 L55 39 L60 45 M42 47 L51 54 L53 61 M28 12 Q23 5 15 4 M36 12 Q41 5 49 4" stroke="#24503a" stroke-width="2.4"/></g>` +
      `<circle cx="15" cy="4.5" r="3.2" fill="#7dff3a"/><circle cx="49" cy="4.5" r="3.2" fill="#7dff3a"/>` +
      `<ellipse cx="32" cy="39" rx="15.5" ry="18" fill="url(#s)" stroke="${O}" stroke-width="3"/><path d="M32 23 V56" stroke="#0b1f14" stroke-width="1.8" opacity=".65"/>` +
      `<path d="M19 43 Q32 48 45 43 M20.5 51 Q32 55 43.5 51" stroke="#7dff3a" stroke-width="1.3" opacity=".6" fill="none"/><ellipse cx="25" cy="32" rx="4.2" ry="2.6" fill="#c3f0c8" opacity=".35" transform="rotate(-32 25 32)"/>` +
      `<ellipse cx="32" cy="18" rx="10.5" ry="8.2" fill="#081410" stroke="${O}" stroke-width="3"/><path d="M27 11 Q25 6 28.5 4 M37 11 Q39 6 35.5 4" stroke="#e8dcb8" stroke-width="2.4" stroke-linecap="round" fill="none"/>` +
      `<circle cx="32" cy="17" r="10" fill="url(#e)"/><g fill="#ff2340"><circle cx="26.5" cy="17.5" r="2"/><circle cx="29.2" cy="14.4" r="1.8"/><circle cx="29.4" cy="20.4" r="1.5"/><circle cx="37.5" cy="17.5" r="2"/><circle cx="34.8" cy="14.4" r="1.8"/><circle cx="34.6" cy="20.4" r="1.5"/></g><circle cx="26" cy="16.7" r=".7" fill="#fff"/><circle cx="37" cy="16.7" r=".7" fill="#fff"/></svg>`;
    // a buglet (what Bagu splits into, as on the cast sheet): a round body, two clear wings, a crimson eye
    const buglet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="none" stroke-linecap="round"><path d="M13 21 L6 18 M12.5 26 L5 27 M14 31 L8 35 M27 21 L34 18 M27.5 26 L35 27 M26 31 L32 35" stroke="${O}" stroke-width="3.6"/><path d="M13 21 L6 18 M12.5 26 L5 27 M14 31 L8 35 M27 21 L34 18 M27.5 26 L35 27 M26 31 L32 35" stroke="#24503a" stroke-width="1.7"/></g>` +
      `<ellipse cx="12.5" cy="17" rx="7.5" ry="4.6" transform="rotate(-38 12.5 17)" fill="#fff" fill-opacity=".55" stroke="${O}" stroke-width="1.6"/><ellipse cx="27.5" cy="17" rx="7.5" ry="4.6" transform="rotate(38 27.5 17)" fill="#fff" fill-opacity=".55" stroke="${O}" stroke-width="1.6"/>` +
      `<ellipse cx="20" cy="26" rx="8.4" ry="9.6" fill="#2d6145" stroke="${O}" stroke-width="2.6"/><path d="M14 27 Q20 30 26 27" stroke="#7dff3a" stroke-width="1.1" opacity=".7" fill="none"/>` +
      `<circle cx="20" cy="14.5" r="5.6" fill="#081410" stroke="${O}" stroke-width="2.4"/><circle cx="18" cy="14" r="2.1" fill="#ff2340"/><circle cx="22.4" cy="14.6" r="1.6" fill="#ff2340"/><circle cx="17.5" cy="13.4" r=".6" fill="#fff"/></svg>`;
    // a splat in Bagu's neon
    let blob = 'M';
    for (let i = 0; i < 14; i++) { const t = (i / 14) * TAU, r = 19 + (i % 2 ? 6 : -1) + Math.sin(i * 2.7) * 2.5; blob += `${(32 + Math.cos(t) * r).toFixed(1)} ${(32 + Math.sin(t) * r).toFixed(1)}${i === 13 ? 'Z' : i % 2 ? ' ' : 'L'}`; }
    const splat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="${blob}" fill="#7dff3a" fill-opacity=".8" stroke="#2a6b16" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="32" r="9" fill="#2a6b16" opacity=".55"/><g fill="#7dff3a" fill-opacity=".8"><circle cx="7" cy="12" r="3"/><circle cx="57" cy="10" r="2.4"/><circle cx="56" cy="55" r="3.2"/><circle cx="8" cy="52" r="2.2"/></g></svg>`;
    // the test: a stoppered vial of mint with a check on it
    const vial = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 64"><defs><radialGradient id="g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#3dffc2" stop-opacity=".55"/><stop offset="1" stop-color="#3dffc2" stop-opacity="0"/></radialGradient></defs><ellipse cx="24" cy="36" rx="24" ry="28" fill="url(#g)"/>` +
      `<rect x="15" y="4" width="18" height="9" rx="3" fill="#c99d6d" stroke="${O}" stroke-width="2.5"/><path d="M14 13h20v33a10 10 0 0 1-20 0z" fill="#e9fffa" fill-opacity=".22" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>` +
      `<path d="M16.2 28h15.6v18a7.8 7.8 0 0 1-15.6 0z" fill="#3dffc2"/><path d="M18.6 39.5l4 4 7.2-9" stroke="#052a1f" stroke-width="3.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 16v9" stroke="#fff" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/></svg>`;
    ART = { bug: svgURL(bug), buglet: svgURL(buglet), splat: svgURL(splat), vial: svgURL(vial) };
    return ART;
  }
  function mkHunt() {
    const def = TEXT.breaks.bughunt, SECS = def.secs || 45, A = huntArt();
    const a = { score: 0, t: 0, state: 'play', bugs: [], pool: [], splats: [], si: 0, spawnT: 0, testAt: [], testOn: false, testOff: 0, shownLeft: -1 };
    let sc = 1, SZ = [], SP = [];
    const CAP = QL >= 2 ? 16 : 24, VAL = [0, 1, 2, 4];
    const bestNow = () => (DB && DB.counters && DB.counters.bugBest) || 0;
    let bagu = null;
    try { bagu = typeof Patch !== 'undefined' && Patch.rogueURL ? blobURL(Patch.rogueURL('bagu')) : null; } catch (e) { bagu = null; }
    // ── DOM ──
    const field = h('div', { class: 'dl-hfield' });
    const scoreN = h('b', null, '0'), timeN = h('b', null, String(SECS)), bestN = h('b', null, String(bestNow()));
    const hud = h('div', { class: 'dl-hhud' },
      h('div', { class: 'dl-hs' }, h('small', null, W.score), scoreN), h('div', { class: 'dl-ht' }, h('small', null, W.time), timeN), h('div', { class: 'dl-hb' }, h('small', null, W.best), bestN));
    const quitBtn = h('button', { class: 'dl-hx', 'aria-label': W.end + ': ' + def.name, title: W.end + ' (Esc)', html: ICON('close'), onclick: () => a.quit() });
    const help = h('div', { class: 'dl-hhelp' }, def.desc);
    const flash = h('div', { class: 'dl-hflash' });
    const vial = h('button', { class: 'dl-vial', 'aria-label': 'Test', hidden: true }, h('img', { src: A.vial, alt: '', draggable: 'false' }));
    const endCard = h('div', { class: 'dl-hend', hidden: true, role: 'group' });
    a.el = h('div', { class: 'dl-hunt', role: 'dialog', tabindex: '-1', 'data-focus': '', 'aria-label': def.name, 'aria-describedby': 'dl-hhelp', 'data-hit': '' }, h('div', { class: 'dl-hscrim' }), field, flash, vial, hud, quitBtn, help, endCard);
    help.id = 'dl-hhelp';
    for (let i = 0; i < CAP + 4; i++) {
      const img = h('img', { alt: '', draggable: 'false', decoding: 'async' });
      const el = h('div', { class: 'dl-bug', 'data-hit': '', 'data-i': String(i) }, img);
      el.style.display = 'none';
      field.appendChild(el);
      a.pool.push({ el, img, on: false, src: '' });
    }
    a.pool.forEach((p, i) => { p.src = i % 2 ? A.buglet : bagu || A.bug; p.img.src = p.src; });
    a.fx = []; a.fi = 0;
    for (let i = 0; i < 6; i++) { const el = h('span', { class: 'dl-hpatch' }, '</>'); el.style.display = 'none'; field.appendChild(el); a.fx.push(el); }
    for (let i = 0; i < 12; i++) {
      const t = h('span'), el = h('div', { class: 'dl-splat' }, h('img', { src: A.splat, alt: '', draggable: 'false', decoding: 'async' }), t);
      el.style.display = 'none';
      field.appendChild(el);
      a.splats.push({ el, t, img: el.firstChild });
    }
    a.layout = () => {
      a.fw = LAYOUT.W; a.fh = LAYOUT.H; a.top = LAYOUT.safe.t + 78; a.bot = a.fh - LAYOUT.safe.b - 8;
      sc = clamp(Math.min(a.fw, a.fh) / 420, 0.85, 1.4);
      SZ = [0, 34 * sc, 52 * sc, 76 * sc]; SP = [0, 104 * sc, 70 * sc, 44 * sc];
    };
    a.layout();
    // ── bugs ──
    function spawn(lvl, x, y, hd, entering) {
      if (!(lvl >= 1 && lvl <= 3)) return null;
      // prefer a free sprite that already shows the right picture (no image swap)
      const want = lvl === 1 ? A.buglet : bagu || A.bug;
      let b = null;
      for (let i = 0; i < a.pool.length; i++) { const p = a.pool[i]; if (!p.on) { if (p.src === want) { b = p; break; } if (!b) b = p; } }
      if (!b) return null;
      if (b.fade) { try { b.fade.cancel(); } catch (e) {} b.fade = null; }   // a slot reused while its old bug was still fading out
      b.on = true; b.lvl = lvl; b.x = x; b.y = y; b.h = hd; b.tgt = hd; b.turn = rnd(0.3, 0.9); b.pause = 0;
      b.sp = SP[lvl] * rnd(0.85, 1.15); b.ph = rnd(0, TAU); b.enter = !!entering;
      const sz = Math.round(SZ[lvl]), hit = Math.round(Math.max(48, sz + 10));
      b.half = hit / 2; b.front = lvl > 1 && !!bagu;
      if (b.src !== want) { b.src = want; b.img.src = want; }
      b.el.className = 'dl-bug dl-l' + lvl + (b.front ? ' dl-front' : '');
      b.el.style.width = b.el.style.height = hit + 'px';
      b.img.style.width = b.img.style.height = sz + 'px';
      b.el.style.display = '';
      a.bugs.push(b);
      move(b, 0);
      if (!RM() && canAnim(b.img)) b.img.animate([{ transform: 'scale(.35)' }, { transform: 'scale(1.18)', offset: 0.6 }, { transform: 'none' }], { duration: 240, easing: 'ease-out' });
      return b;
    }
    function spawnEdge() {
      const side = (Math.random() * 3) | 0, m = 46;
      let x, y;
      if (side === 0) { x = -m; y = rnd(a.top + 60, a.bot - 60); }
      else if (side === 1) { x = a.fw + m; y = rnd(a.top + 60, a.bot - 60); }
      else { x = rnd(60, a.fw - 60); y = a.fh + m; }
      spawn(3, x, y, Math.atan2(a.fh * 0.55 - y, a.fw / 2 - x) + rnd(-0.5, 0.5), true);
    }
    function kill(b) { b.on = false; b.el.style.display = 'none'; const i = a.bugs.indexOf(b); if (i >= 0) a.bugs.splice(i, 1); }
    let rmNow = false;   // RM() read once per frame, not once per bug
    function move(b, dt) {
      if (dt > 0) {
        b.turn -= dt;
        if (b.turn <= 0) { b.tgt = b.h + rnd(-1.4, 1.4); b.turn = rnd(0.35, 1.2); if (Math.random() < 0.15) b.pause = rnd(0.15, 0.5); }
        const m = 28, inside = b.x > m && b.x < a.fw - m && b.y > a.top + m && b.y < a.bot - m;
        if (inside) b.enter = false;
        else if (!b.enter) b.tgt = Math.atan2(a.fh * 0.55 - b.y, a.fw / 2 - b.x) + rnd(-0.4, 0.4);
        let d = b.tgt - b.h; d -= TAU * Math.round(d / TAU);   // wrap to −π..π (cheaper than atan2(sin, cos))
        b.h += clamp(d, -3.4 * dt, 3.4 * dt);
        let sp = b.sp;
        if (b.pause > 0) { b.pause -= dt; sp = 0; }
        b.x += Math.cos(b.h) * sp * dt; b.y += Math.sin(b.h) * sp * dt;
        b.moving = sp > 0;
      }
      const wob = b.moving && !rmNow ? Math.sin(a.t * 24 + b.ph) * 0.16 : 0;
      const X = Math.round((b.x - b.half) * 10) / 10, Y = Math.round((b.y - b.half) * 10) / 10;
      b.el.style.transform = b.front
        ? 'translate3d(' + X + 'px,' + Y + 'px,0) rotate(' + Math.round(wob * 700) / 1000 + 'rad) scaleX(' + (Math.cos(b.h) < 0 ? -1 : 1) + ')'
        : 'translate3d(' + X + 'px,' + Y + 'px,0) rotate(' + Math.round((b.h + 1.5707963 + wob) * 1000) / 1000 + 'rad)';
    }
    function hitBug(b) {
      if (a.state !== 'play' || !b.on) return;
      if (b.lvl > 1 && a.bugs.length < CAP) {
        // patch it and it splits in two, smaller and faster (read the parent first: its pool slot gets reused)
        const lvl = b.lvl - 1, x = b.x, y = b.y, h0 = b.h;
        kill(b);
        for (const sg of [-1, 1]) {
          const hd = h0 + sg * rnd(0.7, 1.25), c = spawn(lvl, x + Math.cos(hd) * 10, y + Math.sin(hd) * 10, hd, false);
          if (c) c.sp *= 1.2;
        }
        sfx('split'); haptic('tick');
        // Patch's patch flies off: that's what made it split
        const g = a.fx[a.fi++ % a.fx.length];
        g.style.display = ''; g.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
        if (canAnim(g) && !document.hidden) {
          const an = g.animate(RM() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(.6)`, opacity: 1 },
            { transform: `translate3d(${x.toFixed(1)}px,${(y - 30).toFixed(1)}px,0) translate(-50%,-50%) scale(1.15) rotate(-8deg)`, opacity: 0 }], { duration: 520, easing: 'ease-out' });
          an.onfinish = () => { g.style.display = 'none'; };
        } else setTimeout(() => { g.style.display = 'none'; }, 400);
      } else {
        kill(b); squash(b.x, b.y, 1, b.lvl);
        sfx('squash'); haptic('tick');
      }
    }
    function squash(x, y, pts, lvl) {
      a.score += pts; scoreN.textContent = String(a.score);
      const s = a.splats[a.si++ % a.splats.length], sz = Math.round((SZ[lvl] || 34) * 1.35);
      s.t.textContent = '+' + pts;
      s.el.style.display = ''; s.el.style.width = s.el.style.height = sz + 'px';
      s.el.style.transform = `translate3d(${(x - sz / 2).toFixed(1)}px,${(y - sz / 2).toFixed(1)}px,0)`;
      if (canAnim(s.img) && !document.hidden) {
        const an = s.img.animate(RM() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'scale(.3)', opacity: 1 }, { transform: 'scale(1.12)', opacity: 1, offset: 0.25 }, { transform: 'scale(1)', opacity: 0.85, offset: 0.6 }, { transform: 'scale(1)', opacity: 0 }], { duration: 760, easing: 'ease-out' });
        s.t.animate(RM() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: 'translate(-50%,-26px)', opacity: 0 }], { duration: 760, easing: 'ease-out' });
        an.onfinish = () => { s.el.style.display = 'none'; };
      } else setTimeout(() => { s.el.style.display = 'none'; }, 500);
    }
    // the test: rare, and it clears every bug on screen (each worth what it would have split into)
    function showTest() {
      const m = 70;
      const x = rnd(m, a.fw - m), y = rnd(a.top + m, a.bot - m);
      vial.style.transform = `translate3d(${(x - 32).toFixed(1)}px,${(y - 38).toFixed(1)}px,0)`;
      vial.hidden = false; a.testOn = true; a.testOff = a.t + 5.5;
      if (canAnim(vial) && !RM()) vial.animate([{ opacity: 0, transform: vial.style.transform + ' scale(.4)' }, { opacity: 1, transform: vial.style.transform }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    function hideTest() { vial.hidden = true; a.testOn = false; }
    function useTest() {
      if (a.state !== 'play' || !a.testOn) return;
      hideTest();
      for (const b of a.bugs.slice()) { const v = VAL[b.lvl]; kill(b); squash(b.x, b.y, v, b.lvl); }
      sfx('test'); haptic('done');
      BUS.emit('patch:say', { key: 'bughunt_test' });
      if (canAnim(flash)) flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: RM() ? 400 : 700, easing: 'ease-out' });
    }
    vial.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); useTest(); });
    vial.addEventListener('click', (e) => { if (e.detail === 0) useTest(); });   // keyboard
    a.el.addEventListener('pointerdown', (e) => {
      if (a.state !== 'play') return;
      const t = e.target && e.target.closest ? e.target.closest('.dl-bug') : null;
      if (!t) return;
      e.preventDefault();
      const b = a.pool[+t.dataset.i];
      if (b) hitBug(b);
    });
    // ── the round ──
    function reset() {
      for (const b of a.bugs.slice()) kill(b);
      a.score = 0; a.t = 0; a.state = 'play'; a.spawnT = 0.7; a.shownLeft = -1; a.ended = false;
      a.testAt = [rnd(9, 15), rnd(25, 33)];
      hideTest();
      scoreN.textContent = '0'; timeN.textContent = String(SECS); bestN.textContent = String(bestNow());
      endCard.hidden = true; endCard.textContent = '';
      quitBtn.hidden = false;
      spawnEdge(); spawnEdge(); spawnEdge();
      if (canAnim(help)) help.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 3400, fill: 'forwards' });
    }
    a.start = reset;
    a.update = (dt) => {
      if (a.state !== 'play') return;
      a.t += dt;
      const left = Math.max(0, Math.ceil(SECS - a.t));
      if (left !== a.shownLeft) { a.shownLeft = left; timeN.textContent = String(left); a.el.classList.toggle('dl-hlast', left <= 5); }
      if (a.t >= SECS) { over(); return; }
      a.spawnT -= dt;
      if (a.spawnT <= 0) { if (a.bugs.length <= CAP - 6) spawnEdge(); a.spawnT = lerp(2.4, 1.3, a.t / SECS) * rnd(0.8, 1.2); }
      if (!a.bugs.length && a.spawnT > 0.6) a.spawnT = 0.6;
      if (a.testAt.length && a.t >= a.testAt[0]) { a.testAt.shift(); showTest(); }
      if (a.testOn && a.t >= a.testOff) hideTest();
      rmNow = RM();
      for (let i = 0; i < a.bugs.length; i++) move(a.bugs[i], dt);
    };
    function over() {
      a.state = 'over';
      hideTest();
      // the survivors scatter: dead at once (so a quick "Play again" can reuse them), hidden when the fade ends
      for (const b of a.bugs.slice()) {
        kill(b);
        if (canAnim(b.el) && !RM() && !document.hidden) {
          b.el.style.display = '';
          const tr = b.el.style.transform;
          b.fade = b.el.animate([{ opacity: 1, transform: tr }, { opacity: 0, transform: tr + ' scale(.5)' }], { duration: 260 });
          b.fade.onfinish = () => { b.fade = null; if (!b.on) b.el.style.display = 'none'; };
        }
      }
      const best0 = bestNow();
      eng('recordGame', 'bughunt', a.score);
      a.ended = true;
      BUS.emit('activity', { id: 'bughunt', phase: 'end', done: true, score: a.score });
      const isBest = a.score > best0 && a.score > 0;
      bestN.textContent = String(Math.max(best0, a.score));
      const canAgain = isBreak() && TIMER.state === 'running' && engLeft() > 15;
      const again = h('button', { class: 'dl-pbtn dl-pgo', onclick: () => { a.t0 = now(); BUS.emit('activity', { id: 'bughunt', phase: 'start' }); reset(); a.el.focus({ preventScroll: true }); } }, W.again2);
      const done = h('button', { class: 'dl-pbtn' + (canAgain ? '' : ' dl-pgo'), onclick: () => closeActivity(true) }, W.done);
      endCard.textContent = '';
      endCard.append(h('div', { class: 'dl-ph' }, h('span', { html: ICON('bug') }), def.name), h('b', { class: 'dl-hsc' }, String(a.score)), h('small', { class: 'dl-rl' }, W.squashed),
        h('p', { class: 'dl-hbest' + (isBest ? ' dl-new' : '') }, isBest ? W.newBest : W.best + ': ' + Math.max(best0, a.score)), h('div', { class: 'dl-hbtns' }, canAgain ? again : null, done));
      endCard.hidden = false; quitBtn.hidden = true;
      if (canAnim(endCard) && !RM()) endCard.animate([{ opacity: 0, transform: 'translate(-50%,-46%) scale(.94)' }, { opacity: 1, transform: 'translate(-50%,-50%)' }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      try { (canAgain ? again : done).focus({ preventScroll: true }); } catch (e) {}
    }
    // quit early (Esc, the close button, the break ending): keep the score if there is one
    a.quit = () => {
      if (a.state === 'play' && a.score > 0) eng('recordGame', 'bughunt', a.score);
      closeActivity(a.state === 'over');
    };
    a.key = (e) => {
      const k = e.key;
      if (a.state === 'play' && (k === ' ' || k === 'Spacebar' || k === 'Enter') && !e.repeat) {
        const f = document.activeElement;
        if (f && f.closest && f.closest('button')) return false;
        if (a.testOn && Math.random() < 0.35) { useTest(); return true; }
        if (a.bugs.length) hitBug(a.bugs[(Math.random() * a.bugs.length) | 0]);
        return true;
      }
      return false;
    };
    a.stop = () => { for (const b of a.bugs.slice()) kill(b); };
    return a;
  }

  // ───────────────────────── hooks ─────────────────────────
  function init() {
    CSS('dial', css());
    build();
    if (!built) return;
    bind();
    if (DB && DB.timer && TIMER.sessionId) lastFocusId = TIMER.mode === 'focus' ? TIMER.sessionId : null;
  }
  function rect() {
    const d = LAYOUT.dial;
    return { x: d.cx - d.r, y: d.cy - d.r * 0.86, w: d.r * 2, h: d.r * 1.72 };
  }
  return { init, layout, update, key, rect, activity: (id) => activity(id), focusMode };
})();

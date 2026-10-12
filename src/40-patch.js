// ───────────────────────────── 40. Patch: the hacker herself, her speech bubble, the six rogues ─────────────────────────────
// Patch is drawn on the Neo Dojo cast sheet's own rig (Tools/neo-dojo-cast: Kiru's path data, the moonlit sticker
// outline, the shared helpers sp ln limb se el ci rim cheeks brows TORSO FULL FACE_SH …), ported from the Patch Notes
// cast module (Tools/patch-notes/src/35-cast.js). Every part is an SVG string rasterised once into a small layer per
// resolution bucket; a frame only blits those layers and strokes her two arms (~25 cheap calls), with no gradients,
// filters, string building or allocation in the hot path.
//
// Rig space is the cast sheet's 200-unit character box: x 0..200 (centre 100), the afro tops out near y −14, the soles
// sit on y 233 (FIG_H = 245 units of standing height). In this app she sits behind her desk: rig y = DESK lands on the
// desk's back edge, so the Scene's desk (drawn after her) hides everything below her belly. She faces us.
const Patch = (() => {
  // ── lines beyond TEXT (CONTRACT.md §1): two micro-reactions, in her voice ──
  const NEW_TEXT = {};   // her two micro-reactions (wake, sewn) now live in TEXT.lines
  const lastNew = {};
  function line(key, vars) {
    if (TEXT.lines[key]) return LINE(key, vars);
    const a = NEW_TEXT[key]; if (!a) return '';
    let i = (Math.random() * a.length) | 0; if (a.length > 1 && i === lastNew[key]) i = (i + 1) % a.length; lastNew[key] = i;
    return vars ? a[i].replace(/\{(\w+)\}/g, (m, n) => (vars[n] !== undefined ? vars[n] : m)) : a[i];
  }

  // ───────── the rig's shared vocabulary (Kiru's own numbers, copied from the cast sheet) ─────────
  const L = '#3d4c95', INK = '#13152a', RIM = '#a9bcff', BLUSH = '#f08a78', CR = '#ff2340', MINT = '#3dffc2';
  const WRAP = '#e4e7f0', WRAP_S = '#b6bccf';
  const HOOD = 'M26 90a74 66 0 1 0 148 0a74 66 0 1 0 -148 0Z';
  const FACE = 'M44 80 C70 68 130 68 156 80 C168 85 168 104 156 109 C130 121 70 121 44 109 C32 104 32 85 44 80 Z';
  const FACE_SH = 'M44 80 C70 68 130 68 156 80 C160 82 162 85 163 88 C130 77 70 77 37 88 C38 85 40 82 44 80 Z';
  const FULL = 'M44 80 C70 68 130 68 156 80 C168 86 168 112 152 130 C134 148 66 148 48 130 C32 112 32 86 44 80 Z';
  const TORSO = 'M64 158 Q66 146 82 143 L118 143 Q134 146 136 158 L133 199 Q100 205 67 199 Z';
  const TORSO_SH = 'M112 144 L118 143 Q134 146 136 158 L133 199 Q123 202 112 203 Z';
  const SHOE = 'M-14 8 q0 -10 12 -10 h8 q6 0 6 6 v4 z';
  const RIMP = 'M47 50 Q33 68 31 95';
  const n1 = (v) => Math.round(v * 10) / 10;
  const sp = (d, f, w = 6, x = '') => `<path d="${d}" fill="${f}" stroke="${L}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" paint-order="stroke" ${x}/>`;
  const se = (cx, cy, rx, ry, f, w = 6, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${L}" stroke-width="${w}" paint-order="stroke" ${x}/>`;
  const sr = (x, y, w, h, r, f, sw = 6, ex = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" stroke="${L}" stroke-width="${sw}" stroke-linejoin="round" paint-order="stroke" ${ex}/>`;
  const ln = (d, c, w, x = '') => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${x}/>`;
  const fl = (d, f, x = '') => `<path d="${d}" fill="${f}" ${x}/>`;
  const el = (cx, cy, rx, ry, f, x = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${x}/>`;
  const ci = (cx, cy, r, f, x = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${x}/>`;
  const G = (id) => `url(#${id})`;
  const rot = (deg, x, y) => `transform="rotate(${deg} ${x} ${y})"`;
  const GLOWF = '<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="3.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
  const GLOW = 'filter="url(#glow)"';
  function limb(sx, sy, hx, hy, bend, col, w = 15) {
    const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy) || 1;
    const mx = (sx + hx) / 2 - dy / d * bend, my = (sy + hy) / 2 + dx / d * bend;
    const p = `M${sx} ${sy}Q${n1(mx)} ${n1(my)} ${hx} ${hy}`;
    return ln(p, L, w + 7) + ln(p, col, w);
  }
  function leg(hx, hy, ax, ay, col, w = 18, knee = 3) {
    const p = `M${hx} ${hy}L${(hx + ax) / 2 - knee} ${(hy + ay) / 2}L${ax} ${ay}`;
    return ln(p, L, w + 6) + ln(p, col, w);
  }
  const shoe = (x, y, col = INK, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${sp(SHOE, col, 5)}</g>`;
  const fist = (x, y, col = WRAP, sh = WRAP_S, r = 9.5) => se(x, y, r, r, col, 4) + ln(`M${x - 6} ${y - 2.5}Q${x} ${y + 0.5} ${x + 6} ${y - 2.5}`, sh, 2);
  const rim = (op = 0.75, c = RIM) => ln(RIMP, c, 3.2, `opacity="${op}"`);
  const vrim = (c, d = 'M48 140 Q100 164 152 140') => ln(d, c, 3.4, `opacity=".85" ${GLOW}`);
  const cheeks = (op = 0.5, c = BLUSH, y = 107) => el(57, y, 7, 3.4, c, `opacity="${op}"`) + el(143, y, 7, 3.4, c, `opacity="${op}"`);
  const brows = (bo = 78, bi = 84, c = INK, w = 5, curve = 0) => { const bm = (bo + bi) / 2 + curve; return ln(`M61 ${bo}Q74 ${bm} 87 ${bi}M139 ${bo}Q126 ${bm} 113 ${bi}`, c, w); };
  function grad(id, stops, x1 = 48, y1 = 24, x2 = 152, y2 = 156) {
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
  }
  const clip = (id, d) => `<clipPath id="${id}"><path d="${d}"/></clipPath>`;
  const TG = (id, stops) => grad(id, stops, 64, 143, 136, 200);
  const shade = (cid, col = '#0f1430', op = 0.5) => `<g clip-path="url(#${cid})">${el(132, 128, 82, 62, col, `opacity="${op}"`)}${el(66, 40, 38, 15, '#fff', `opacity=".1" ${rot(-24, 66, 40)}`)}</g>`;
  // a scalloped crown (Patch's afro)
  function scallop(cx, cy, rx, ry, n, k, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2, close = 30) {
    const at = (a, kk) => `${n1(cx + Math.cos(a) * rx * kk)} ${n1(cy + Math.sin(a) * ry * kk)}`;
    let d = `M${at(a0, 1)}`;
    for (let i = 0; i < n; i++) { const b0 = a0 + (a1 - a0) * i / n, b1 = a0 + (a1 - a0) * (i + 1) / n; d += `Q${at((b0 + b1) / 2, k)} ${at(b1, 1)}`; }
    return d + `Q${cx} ${cy + close} ${at(a0, 1)}Z`;
  }
  // a document for one layer: viewBox = the layer's box in rig units, drawn at pw×ph device pixels
  const doc = (b, defs, body, pw, ph) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}" width="${pw}" height="${ph}"><defs>${GLOWF}${defs || ''}</defs>${body}</svg>`;

  // ───────── face parts (the Patch Notes set, with the pupils split out so her eyes can follow things) ─────────
  const EY = 95.5, EXL = 76, EXR = 124;
  // per eye style: the whites (rx, ry), the pupil radius, a gaze the style insists on, or `lines` (closed shapes)
  const EYES = {
    open: { w: 'n', pr: 8 }, wide: { w: 'w', pr: 6 }, up: { w: 'n', pr: 8, gx: -3, gy: -4.6 }, down: { w: 'n', pr: 8, gx: -1, gy: 4.4 },
    focus: { w: 'n', pr: 7 }, half: { w: 'n', pr: 8 }, smile: { w: 'n', pr: 8 }, sleepy: { w: 'n', pr: 8, gy: 2.6 },
    happy: { lines: 1 }, closed: { lines: 1 },
  };
  const WHITE = { n: [12.5, 14], w: [13.4, 16] };
  const P_SKIN = PAL.skin, P_SKIN_S = PAL.skinShade, P_HAIR = PAL.hair;
  const eyeWhiteSVG = (k) => el(EXL, EY, WHITE[k][0], WHITE[k][1], '#fff') + el(EXR, EY, WHITE[k][0], WHITE[k][1], '#fff');
  const pupilSVG = (pr) => [EXL, EXR].map((cx) => ci(cx, EY, pr, INK) + ci(cx + 3, EY - 4, n1(pr * 0.37), '#fff') + ci(cx - 3, EY + 4, n1(pr * 0.16), '#fff', 'opacity=".8"')).join('');
  function eyeTopSVG(st) {
    if (st === 'happy') return ln('M63 100 Q76 86 89 100', INK, 4.6) + ln('M111 100 Q124 86 137 100', INK, 4.6);
    if (st === 'closed') return ln('M63 96 Q76 104.5 89 96', INK, 4.4) + ln('M111 96 Q124 104.5 137 96', INK, 4.4) + ln('M63 96 L59 93 M137 96 L141 93', INK, 2.4);
    const rx = 12.5, ry = 14, skin = P_SKIN;
    let s = '';
    for (const cx of [EXL, EXR]) {
      const lower = (k, line) => fl(`M${cx - rx - 3} ${EY + ry * 0.75}Q${cx} ${n1(EY + ry * k - 3)} ${cx + rx + 3} ${EY + ry * 0.75}L${cx + rx + 3} ${EY + ry + 4}L${cx - rx - 3} ${EY + ry + 4}Z`, skin)
        + (line ? ln(`M${cx - rx + 1} ${n1(EY + ry * 0.62)}Q${cx} ${n1(EY + ry * k - 3)} ${cx + rx - 1} ${n1(EY + ry * 0.62)}`, P_SKIN_S, 2, 'opacity=".55"') : '');
      const upper = (yl, yc) => fl(`M${cx - rx - 3} ${yl}Q${cx} ${yc} ${cx + rx + 3} ${yl}L${cx + rx + 3} ${EY - ry - 4}L${cx - rx - 3} ${EY - ry - 4}Z`, skin) + ln(`M${cx - rx - 1} ${yl}Q${cx} ${yc} ${cx + rx + 1} ${yl}`, INK, 3.6);
      if (st === 'half') s += upper(EY - 1, EY - 7);
      if (st === 'sleepy') s += upper(EY + 3.5, EY - 0.5) + lower(0.5, false);
      if (st === 'smile') s += lower(0.15, true);
      if (st === 'focus') s += lower(0.62, false);
      if (st === 'down') { const o = cx < 100 ? -1 : 1; s += fl(`M${cx + o * (rx + 3)} ${EY - ry - 3}L${cx + o * (rx + 3)} ${EY + 2}Q${cx + o * 4} ${n1(EY - ry * 0.6)} ${cx - o * (rx + 1)} ${EY - ry - 3}Z`, skin); }
    }
    return s;
  }
  // brows: calm up knit worried quirk soft lift
  function browsSVG(style, col, w = 4.6) {
    switch (style) {
      case 'up': return brows(66, 69, col, w, -3);
      case 'knit': return brows(73, 82, col, w, 0.5);
      case 'worried': return brows(80, 71, col, w, -1);
      case 'quirk': return ln('M61 70Q74 63 87 70', col, w) + ln('M139 76Q126 74 113 79', col, w);
      case 'soft': return brows(74, 75, col, w, -3);
      case 'lift': return brows(70, 72, col, w, -3.5);
      default: return brows(75, 77, col, w, -1.5);
    }
  }
  // mouths (centre x 100, around y 130)
  function mouthSVG(style) {
    const lip = '#2a120a', lo = '#a3504a', dark = '#3a120c', tongue = '#c4574e';
    switch (style) {
      case 'smirk': return ln('M90 130Q102 134 111 124', lip, 3.5) + ln('M111 124 L113 122', lip, 2.6) + el(101, 134, 5, 1.6, lo, 'opacity=".4"');
      case 'think': return ln('M96 131Q102 128 108 131', lip, 3.4) + el(102, 134, 4, 1.4, lo, 'opacity=".35"');
      case 'sad': return ln('M91 134Q100 127 109 134', lip, 3.5);
      case 'o': return el(100, 131.5, 5.4, 6.4, dark, `stroke="${lip}" stroke-width="2.4"`) + el(100, 134.5, 3, 1.8, tongue);
      case 'oo': return el(100, 131, 3.6, 4.2, dark, `stroke="${lip}" stroke-width="2.2"`);
      case 'flat': return ln('M91 131Q100 132 109 129.5', lip, 3.5) + el(100, 134, 5, 1.5, lo, 'opacity=".35"');
      case 'laugh': return fl('M87 125Q100 128 113 125Q112 142 100 143Q88 142 87 125Z', dark, `stroke="${lip}" stroke-width="2.6" stroke-linejoin="round"`) + fl('M89.5 126.4Q100 129.4 110.5 126.4L110 129.6Q100 132.2 90 129.6Z', '#fff') + el(100, 139, 6.5, 3, tongue);
      case 'talk1': return fl('M92 127Q100 129 108 127Q107 135.5 100 136Q93 135.5 92 127Z', dark, `stroke="${lip}" stroke-width="2.4" stroke-linejoin="round"`) + el(100, 133.5, 4, 1.6, tongue);
      case 'talk2': return fl('M89.5 126Q100 128.5 110.5 126Q109.5 141 100 141.5Q90.5 141 89.5 126Z', dark, `stroke="${lip}" stroke-width="2.5" stroke-linejoin="round"`) + fl('M91.5 127.2Q100 129.6 108.5 127.2L108 130Q100 132 92 130Z', '#fff') + el(100, 137.5, 5.5, 2.6, tongue);
      case 'warm': return ln('M87 127Q100 138 113 127', lip, 3.5) + el(100, 135.5, 6, 1.8, lo, 'opacity=".4"');
      case 'hum': return ln('M94 129.5Q100 133 106 129.5', lip, 3.2) + el(100, 133, 4, 1.4, lo, 'opacity=".4"');
      default: return ln('M91 128Q100 134 109 128', lip, 3.5) + el(100, 132, 6, 2, lo, 'opacity=".45"');
    }
  }
  // expressions (the contract's eight, then the faces her poses wear)
  const EXPR = {
    neutral: { eyes: 'open', brows: 'calm', mouth: 'smile' },
    smirk: { eyes: 'half', brows: 'quirk', mouth: 'smirk' },
    think: { eyes: 'up', brows: 'quirk', mouth: 'think', rot: -0.035 },
    surprise: { eyes: 'wide', brows: 'up', mouth: 'o', dy: -1.5 },
    sad: { eyes: 'down', brows: 'worried', mouth: 'sad', rot: 0.03, dy: 1.5 },
    determined: { eyes: 'focus', brows: 'knit', mouth: 'flat' },
    laugh: { eyes: 'happy', brows: 'lift', mouth: 'laugh', rot: -0.05, open: true },
    sleepy: { eyes: 'sleepy', brows: 'soft', mouth: 'flat' },
    focus: { eyes: 'focus', brows: 'soft', mouth: 'hum' },
    calm: { eyes: 'closed', brows: 'soft', mouth: 'smile' },
    exhale: { eyes: 'closed', brows: 'soft', mouth: 'oo' },
    joy: { eyes: 'happy', brows: 'lift', mouth: 'warm' },
    yawn: { eyes: 'closed', brows: 'lift', mouth: 'o', open: true },
    warm: { eyes: 'smile', brows: 'soft', mouth: 'warm' },
    snooze: { eyes: 'closed', brows: 'soft', mouth: 'oo', open: true },
  };
  const EXPRS = ['neutral', 'smirk', 'think', 'surprise', 'sad', 'determined', 'laugh', 'sleepy'];
  const POSES = ['idle', 'type', 'think', 'sip', 'stretch_up', 'shoulders', 'neck', 'shake', 'breathe', 'cheer', 'wave', 'zap', 'doze', 'startle'];

  // ───────── Patch (ND-05), on the cast sheet's rig ─────────
  const AFRO = scallop(100, 80, 86, 80, 22, 1.12);
  const CURLS = [[48, 44], [80, 26], [118, 24], [150, 42], [36, 74], [166, 70], [60, 60], [140, 58], [100, 40]];
  const P_DEFS = grad('p-hair', ['#4a3024', '#24160f', '#120a06']) + clip('p-clip', AFRO) + TG('p-body', ['#565e7c', '#3b4058', '#262a3d']);
  function headSVG() {
    let s = sp(AFRO, G('p-hair')) + `<g clip-path="url(#p-clip)">${el(132, 128, 82, 62, '#050302', 'opacity=".45"')}${el(64, 38, 36, 14, '#fff', `opacity=".09" ${rot(-24, 64, 38)}`)}${CURLS.map(([x, y]) => ln(`M${x - 5} ${y + 2} Q${x} ${y - 4} ${x + 5} ${y + 2}`, '#5a3a2a', 2, 'opacity=".55"')).join('')}</g>`;
    s += ln('M24 100 Q20 2 100 -2 Q180 2 176 100', L, 11) + ln('M24 100 Q20 2 100 -2 Q180 2 176 100', '#262a3d', 6);
    s += se(24, 106, 13, 20, '#262a3d', 5) + se(176, 106, 13, 20, '#1d2030', 5) + el(24, 106, 5, 10, MINT, GLOW);
    s += ci(30, 134, 5.5, 'none', `stroke="${L}" stroke-width="4.5"`) + ci(30, 134, 5.5, 'none', 'stroke="#f5c542" stroke-width="2.2"') + ci(170, 134, 5.5, 'none', `stroke="${L}" stroke-width="4.5"`) + ci(170, 134, 5.5, 'none', 'stroke="#d9a72e" stroke-width="2.2"');
    s += fl(FULL, P_SKIN) + fl(FACE_SH, P_SKIN_S, 'opacity=".8"');
    s += fl('M44 80 C66 66 134 66 156 80 C146 74 128 72 100 74 C72 72 54 74 44 80 Z', P_HAIR);
    return s + rim(0.6) + cheeks(0.35, '#c0584a', 116);
  }
  const glassesSVG = (hi) => `<g ${GLOW}>${sr(56, 80, 40, 30, 9, MINT, 0, `fill-opacity="${hi ? 0.36 : 0.22}"`)}${sr(104, 80, 40, 30, 9, MINT, 0, `fill-opacity="${hi ? 0.36 : 0.22}"`)}</g>` + ln('M96 92 Q100 88 104 92', MINT, 3) + ln('M62 86 L72 86 M110 86 L116 86', '#fff', 2, `opacity="${hi ? 0.95 : 0.75}"`);
  const torsoSVG = () => {
    const logo = ln('M96.2 162.5 L92.4 166.8 L96.2 171.1 M103.8 162.5 L107.6 166.8 L103.8 171.1 M101.6 161.4 L98.4 172.2', MINT, 2.3);
    return sp(TORSO, G('p-body')) + fl(TORSO_SH, '#161927', 'opacity=".5"') + sp('M76 178 Q100 172 124 178 L126 196 Q100 201 74 196 Z', '#2f3449', 3)
      + logo + ln('M91 150 L87.5 170 M109 150 L112.5 170', '#c9d2e8', 2.2) + ci(87.5, 172, 2.6, MINT) + ci(112.5, 172, 2.6, MINT)
      + sp('M58 152 Q62 138 100 136 Q138 138 142 152 Q132 160 100 160 Q68 160 58 152 Z', '#4a5170', 4) + ln('M70 150 Q100 142 130 150', '#2f3449', 3);
  };
  // her holo keyboard: floats just above the desk's back edge, in front of her
  const DESK = 192;
  const KEYB = 'M57 172.5 L143 172.5 L153 190 L47 190 Z';
  function keyboardSVG() {
    // three rows of keys widening toward her (a little perspective), a space bar, a bright front edge
    let k = '';
    for (let r = 0; r < 3; r++) {
      const y = 176.2 + r * 4.3, x0 = 59.5 - r * 3, x1 = 140.5 + r * 3, n = 13 - r;
      for (let i = 0; i < n; i++) {
        const space = r === 2 && i >= 4 && i <= 6;
        if (r === 2 && (i === 5 || i === 6)) continue;
        const cw = (x1 - x0) / n, w = space ? cw * 3 - 1.6 : cw - 1.6, kx = x0 + cw * (space ? i + 1.5 : i + 0.5);
        k += `<rect x="${n1(kx - w / 2)}" y="${n1(y - 1.35)}" width="${n1(w)}" height="2.7" rx=".9" fill="${MINT}" opacity="${space ? 0.5 : 0.72}"/>`;
      }
    }
    return fl(KEYB, MINT, 'opacity=".16"') + `<g ${GLOW}>${ln(KEYB, MINT, 1.5)}</g>` + k + ln('M48.5 189.6 H151.5', '#e8fff8', 1.1, 'opacity=".8"');
  }
  // her tea: a cream mug with a mint band (centred on 0,0; the hand holds it from the left)
  const mugSVG = () => sp('M-9 -9 L9 -9 L8.2 8.6 Q0 11.6 -8.2 8.6 Z', '#f1ece2', 3.4) + ln('M9 -5.5 Q15.5 -5.5 15.5 0 Q15.5 5.5 8.4 5.5', L, 5.2) + ln('M9 -5.5 Q15.5 -5.5 15.5 0 Q15.5 5.5 8.4 5.5', '#f1ece2', 2.4)
    + el(0, -9, 8.6, 2.4, '#8a4a22') + el(-2, -9.4, 4, 0.9, '#c9834e', 'opacity=".7"') + fl('M-8.8 -1 L8.8 -1 L8.6 3 L-8.6 3 Z', MINT, 'opacity=".9"') + fl('M4.5 -8 L7.8 -8 L7 8 Q5.5 9 4 9 Z', '#000', 'opacity=".12"')
    + ln('M-3 -15 Q-5.6 -19 -3 -23 M3 -14 Q0.6 -18.5 3.2 -22.5', '#eef4ff', 1.5, 'opacity=".5"');
  const zSVG = () => ln('M-4.4 -4.6 H4.4 L-4.4 4.6 H4.4', L, 4.6) + ln('M-4.4 -4.6 H4.4 L-4.4 4.6 H4.4', '#d6e0ff', 2.2);
  const sparkSVG = () => `<g ${GLOW}>${fl('M0 -9 Q1.4 -1.4 9 0 Q1.4 1.4 0 9 Q-1.4 1.4 -9 0 Q-1.4 -1.4 0 -9 Z', '#e8fff8')}</g>`;

  // ───────── the layer cache: every part, rasterised per resolution bucket (device px per rig unit) ─────────
  // (the Patch Notes cache: request() queues a bake, pick() serves the exact bucket or the nearest one baked)
  const B = [0.16, 0.22, 0.3, 0.42, 0.58, 0.8, 1.1, 1.5, 2.1, 2.9, 4.0, 5.5];
  const NB = B.length;
  function bucket(ppu) { for (let i = 0; i < NB; i++) if (B[i] >= ppu * 0.9) return i; return NB - 1; }
  const LAYERS = [];
  function layer(x, y, w, h, body, defs) {
    const Ly = { box: { x, y, w, h }, body, defs: defs || '', canv: new Array(NB).fill(null), busy: new Uint8Array(NB), used: new Float64Array(NB), want0: new Float64Array(NB), want1: new Float64Array(NB), sil: null, wait: null, raw: null };
    LAYERS.push(Ly);
    return Ly;
  }
  let FRAME = 0, totalPx = 0;
  const PX_BUDGET = 5e6;   // ~20 MB of layer canvases, least-recently-used evicted past this
  const JOBS = [];
  let active = 0;
  function settle(Ly, bi, cv) {
    Ly.busy[bi] = 0;
    const ws = Ly.wait && Ly.wait[bi]; if (!ws) return;
    Ly.wait[bi] = null;
    for (const f of ws) f(cv);
  }
  function pump() {
    while (active < 3 && JOBS.length) {
      const j = JOBS.shift(), Ly = j.Ly, bi = j.bi;
      if (Ly.canv[bi]) { settle(Ly, bi, Ly.canv[bi]); continue; }
      active++;
      let p;
      try {
        const b = Ly.box, ppu = B[bi];
        const svg = Ly.raw ? Ly.raw(Math.ceil(b.w * ppu), Math.ceil(b.h * ppu)) : doc(b, Ly.defs, Ly.body(), Math.ceil(b.w * ppu), Math.ceil(b.h * ppu));
        p = svgCanvas(svg, b.w, b.h, ppu);
      } catch (e) { reportErr('Patch.bake', e); p = Promise.resolve(null); }
      p.then((cv) => {
        if (cv) { if (Ly.canv[bi]) totalPx -= Ly.canv[bi].width * Ly.canv[bi].height; Ly.canv[bi] = cv; Ly.used[bi] = FRAME; totalPx += cv.width * cv.height; if (Ly.sil) Ly.sil[bi] = null; }
        settle(Ly, bi, cv);
      }, () => settle(Ly, bi, null)).then(() => { active--; pump(); });
    }
  }
  // ask for a layer at a bucket; resolves with the canvas once it's baked (every caller waiting on it is told)
  function request(Ly, bi, urgent) {
    if (Ly.canv[bi]) return Promise.resolve(Ly.canv[bi]);
    return new Promise((res) => {
      const W = Ly.wait || (Ly.wait = new Array(NB).fill(null));
      (W[bi] || (W[bi] = [])).push(res);
      if (Ly.busy[bi]) {
        if (urgent) { const i = JOBS.findIndex((q) => q.Ly === Ly && q.bi === bi); if (i > 0) JOBS.unshift(JOBS.splice(i, 1)[0]); }
        return;
      }
      Ly.busy[bi] = 1;
      const j = { Ly, bi };
      if (urgent) JOBS.unshift(j); else JOBS.push(j);
      pump();
    });
  }
  // the best canvas for a layer right now: the exact bucket, else the nearest baked (preferring sharper). A missing
  // bucket is baked once it has been wanted for ~10 frames running (a resize sweeping sizes doesn't queue a bake per size).
  function pick(Ly, bi) {
    let cv = Ly.canv[bi];
    if (cv) { Ly.used[bi] = FRAME; return cv; }
    for (let k = 1; k < NB; k++) {
      if (bi + k < NB && (cv = Ly.canv[bi + k])) { Ly.used[bi + k] = FRAME; break; }
      if (bi - k >= 0 && (cv = Ly.canv[bi - k])) { Ly.used[bi - k] = FRAME; break; }
      cv = null;
    }
    if (!Ly.busy[bi]) {
      if (FRAME - Ly.want1[bi] > 2) Ly.want0[bi] = FRAME;
      Ly.want1[bi] = FRAME;
      if (!cv || FRAME - Ly.want0[bi] >= 10) request(Ly, bi, true);
    }
    return cv;
  }
  const has = (Ly) => { for (let i = 0; i < NB; i++) if (Ly.canv[i]) return true; return false; };
  function blit(c, Ly, bi, dx, dy) {
    const cv = pick(Ly, bi); if (!cv) return false;
    const b = Ly.box; c.drawImage(cv, b.x + dx, b.y + dy, b.w, b.h); return true;
  }
  // a layer squashed about a horizontal line (the cast sheet's blink is a scaleY(.08) on the eyes)
  function blitSquash(c, Ly, bi, dx, dy, k, cy) {
    const cv = pick(Ly, bi); if (!cv) return;
    const b = Ly.box; c.drawImage(cv, b.x + dx, cy + (b.y + dy - cy) * k, b.w, b.h * k);
  }
  // a layer's dark silhouette (heads-down dimming), derived once per bucket from the baked canvas
  function silhouette(Ly, bi) {
    const src = pick(Ly, bi); if (!src) return null;
    const i = Ly.canv.indexOf(src);
    if (!Ly.sil) Ly.sil = new Array(NB).fill(null);
    if (Ly.sil[i]) return Ly.sil[i];
    const s = makeCanvas(src.width, src.height), g = s.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#070918'; g.fillRect(0, 0, s.width, s.height);
    return (Ly.sil[i] = s);
  }
  function evict() {
    if (totalPx <= PX_BUDGET) return;
    const all = [];
    for (const Ly of LAYERS) for (let i = 0; i < NB; i++) if (Ly.canv[i]) all.push([Ly.used[i], Ly, i]);
    all.sort((a, b) => a[0] - b[0]);
    for (const [u, Ly, i] of all) {
      if (totalPx <= PX_BUDGET * 0.75 || FRAME - u < 180) break;
      const cv = Ly.canv[i]; totalPx -= cv.width * cv.height; Ly.canv[i] = null; if (Ly.sil) Ly.sil[i] = null;
    }
  }

  // ── her layers ──
  const HEAD = layer(-8, -18, 216, 174, headSVG, P_DEFS);
  const GLS = layer(42, 64, 116, 62, () => glassesSVG(false), '');
  const GLS_HI = layer(42, 64, 116, 62, () => glassesSVG(true), '');
  const TORSO_L = layer(48, 126, 104, 86, torsoSVG, P_DEFS);
  const KEYS = layer(36, 162, 128, 36, keyboardSVG, '');
  const MUG = layer(-18, -32, 42, 50, () => `<g transform="scale(1.32)">${mugSVG()}</g>`, '');
  const ZZZ = layer(-8, -8, 16, 16, zSVG, '');
  const SPARK = layer(-14, -14, 28, 28, sparkSVG, '');
  const HAND = layer(-11, -11, 22, 22, () => ci(0, 0, 8.5, P_SKIN, `stroke="${L}" stroke-width="4"`) + ci(-2.6, -2.8, 3, '#fff', 'opacity=".08"'), '');
  const WHITES = { n: layer(56, 70, 88, 50, () => eyeWhiteSVG('n'), ''), w: layer(56, 70, 88, 50, () => eyeWhiteSVG('w'), '') };
  const PUPILS = { 8: layer(56, 70, 88, 50, () => pupilSVG(8), ''), 7: layer(56, 70, 88, 50, () => pupilSVG(7), ''), 6: layer(56, 70, 88, 50, () => pupilSVG(6), '') };
  const LIDS = {};
  for (const st of ['half', 'sleepy', 'smile', 'focus', 'down', 'happy', 'closed']) LIDS[st] = layer(54, 70, 92, 52, () => eyeTopSVG(st), '');
  const BROWS = {};
  for (const st of ['calm', 'up', 'knit', 'worried', 'quirk', 'soft', 'lift']) BROWS[st] = layer(50, 56, 100, 36, () => browsSVG(st, '#1d0f0a', 4.5), '');
  const MOUTHS = {};
  for (const st of ['smile', 'smirk', 'think', 'sad', 'o', 'oo', 'flat', 'laugh', 'talk1', 'talk2', 'warm', 'hum']) MOUTHS[st] = layer(78, 114, 44, 34, () => mouthSVG(st), '');
  const CORE = [HEAD, GLS, TORSO_L, WHITES.n, PUPILS[8], BROWS.calm, MOUTHS.smile, HAND];

  // ── the hoodie: up to four embroidered patches (UI.badgeSVG), two on the chest, one on each sleeve ──
  const SLOTS = [{ x: 118.6, y: 163.5, r: 7.7 }, { x: 81.4, y: 163.5, r: 7.7 }, { arm: 'f', r: 7.2 }, { arm: 'b', r: 7.2 }];
  const BADGES = {};
  let hoodie = [];       // patch ids sewn on, oldest first (a copy of DB.hoodie)
  function badgeRaw(id) {
    return (pw, ph) => {
      let svg = '';
      try { if (typeof UI !== 'undefined' && typeof UI.badgeSVG === 'function') svg = String(UI.badgeSVG(id) || ''); } catch (e) { svg = ''; }
      let inner;
      if (svg.indexOf('<svg') >= 0) {
        // nest the UI's own badge (viewBox 0 0 100 100) in a document of the size this bucket wants
        inner = svg.slice(svg.indexOf('<svg')).replace(/<svg([^>]*)>/, (m, a) => '<svg' + a.replace(/\s(width|height|x|y)="[^"]*"/g, '') + ' x="0" y="0" width="100" height="100">');
        if (inner.indexOf('xmlns=') < 0) inner = inner.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
      } else {
        // no UI yet: a stitched circle in the patch's own colour
        const p = PATCHDEF(id), col = p ? p.color : '#9aa3cf';
        inner = ci(50, 50, 45, col, `stroke="${L}" stroke-width="6"`) + ci(50, 50, 36, 'none', 'stroke="#fff" stroke-width="4" stroke-dasharray="7 6" opacity=".85"') + ci(50, 50, 14, '#fff', 'opacity=".9"');
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108" width="${pw}" height="${ph}">${ci(50, 50, 50.5, L)}${inner}</svg>`;
    };
  }
  function badge(id) {
    let Ly = BADGES[id];
    if (!Ly) { Ly = BADGES[id] = layer(-4, -4, 108, 108, null, ''); Ly.raw = badgeRaw(id); }
    return Ly;
  }
  let hoodVer = 0;      // bumped whenever the sewn-on set changes
  function readHoodie() {
    const ids = DB && Array.isArray(DB.hoodie) ? DB.hoodie.filter((id) => !!PATCHDEF(id)).slice(0, 4) : [];
    const added = ids.filter((id) => hoodie.indexOf(id) < 0);
    if (ids.join() !== hoodie.join()) hoodVer++;
    hoodie = ids;
    return added;
  }
  // the torso with its two chest patches, composed once per size and hoodie: one blit a frame instead of three
  const TC = { bi: -1, ver: -1, cv: null, sil: null };
  function torsoCanvas(bi, bs) {
    const base = TORSO_L.canv[bi]; if (!base) return null;
    TORSO_L.used[bi] = FRAME;
    if (TC.cv && TC.bi === bi && TC.ver === hoodVer) return TC.cv;
    const parts = [];
    for (let i = 0; i < 2; i++) {
      const id = hoodie[i]; if (!id) continue;
      const sl = SLOTS[i], Ly = badge(id), bb = bucket(bs * sl.r * 2 / 108 * 1.08), cv = Ly.canv[bb];
      if (!cv) { if (!Ly.busy[bb]) request(Ly, bb, true); return null; }
      parts.push(sl, cv);
    }
    const out = TC.cv && TC.cv.width === base.width && TC.cv.height === base.height ? TC.cv : makeCanvas(base.width, base.height), g = out.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, out.width, out.height); g.drawImage(base, 0, 0);
    const b = TORSO_L.box, k = base.width / b.w;
    for (let i = 0; i < parts.length; i += 2) { const sl = parts[i], r = sl.r * 1.08; g.drawImage(parts[i + 1], (sl.x - r - b.x) * k, (sl.y - r - b.y) * k, r * 2 * k, r * 2 * k); }
    TC.cv = out; TC.bi = bi; TC.ver = hoodVer; TC.sil = null;
    return out;
  }
  // bake the patches now sewn on at the size she's drawn (the old ones keep drawing until the new ones land)
  function rebakeHoodie() {
    if (!(lastS > 0)) return;
    const bs = lastDev * lastS;
    hoodie.forEach((id, i) => request(badge(id), bucket(bs * SLOTS[i].r * 2 / 108 * 1.08), true));
  }

  // ───────── poses: joint targets in rig space ─────────
  // One flat record of every animated number, so a pose change eases from one record to the next (no pops).
  //   bx by lean breath: the upper body (offset, lean about the desk point, torso stretch about the desk line)
  //   hx hy hr: the head on the body · f*/b*: the front (screen-left) and back (screen-right) arm: shoulder,
  //   hand target (rig world), elbow bend side, bone length, and its layer (0 behind the torso, 1 over the torso,
  //   2 over the head too: raised arms)
  //   kb mug mugr glove zz hi ear spark: props and glows (0..1)
  const KJ = ['bx', 'by', 'lean', 'breath', 'hx', 'hy', 'hr', 'fsx', 'fsy', 'fhx', 'fhy', 'fbend', 'flen', 'ffront', 'bsx', 'bsy', 'bhx', 'bhy', 'bbend', 'blen', 'bfront', 'kb', 'mug', 'mugr', 'glove', 'zz', 'hi', 'ear'];
  const NJ = KJ.length;
  const mkJ = () => { const o = {}; for (let i = 0; i < NJ; i++) o[KJ[i]] = 0; return o; };
  // what a pose needs beyond time: the beat, the typing hands, the zap aim, the breathing phase
  // (desk: 1 while she's working: her keyboard and lit glasses stay up through a one-shot like a zap or a think)
  const mkP = () => ({ nd: 0, fx: 0, fp: 0, bx: 0, bp: 0, zdir: -1, zel: -0.35, breath: '', bt: 0, amp: 1, sip: 0, calm: false, desk: 0 });
  // how long a one-shot runs (s) and how fast it blends in
  const SHOT = { cheer: [2.6, 0.16], wave: [2.2, 0.24], zap: [1.5, 0.12], startle: [0.95, 0.06], phones: [1.0, 0.22], adjust: [0.9, 0.2], admire: [1.9, 0.3], pump: [1.15, 0.14], boop: [0.6, 0.06], yawn: [1.6, 0.3], think: [2.4, 0.3], shake: [2.4, 0.2] };
  const sm = smooth;
  const ZAP_REACH = 51;   // how far the zapping hand reaches from the shoulder (rig units)
  const plateau = (u, edge) => (u < edge ? sm(u / edge) : u > 1 - edge ? sm((1 - u) / edge) : 1);   // 0→1, hold, →0 over u 0..1
  // writes the pose into o, returns the face it wears this frame
  function poseOf(name, pt, t, o, P) {
    const A = P.amp, nd = P.nd;
    const br = Math.sin(t * TAU / 3.6);
    // the seated rest every pose starts from: forearms on the desk, a slow breath, a small nod to her own lo-fi
    o.bx = 0; o.by = 0; o.lean = 0; o.breath = 1 + 0.012 * br; o.hx = 0; o.hy = nd * 0.9 * A; o.hr = Math.sin(t * 0.43) * 0.016 + nd * 0.006 * A;
    o.fsx = 73; o.fsy = 156; o.fhx = 63; o.fhy = 186 + br * 0.3; o.fbend = 1; o.flen = 20.4; o.ffront = 2;
    o.bsx = 127; o.bsy = 156; o.bhx = 137; o.bhy = 186 + br * 0.3; o.bbend = -1; o.blen = 20.4; o.bfront = 1;
    o.kb = P.desk; o.mug = 0; o.mugr = 0; o.glove = 0; o.zz = 0; o.hi = P.desk; o.ear = 0.3 + 0.25 * P.desk;
    switch (name) {
      case 'idle': {
        // fingers drum on the desk now and then (the back hand)
        const ph = (t % 7.3) / 7.3;
        if (ph > 0.78) { const d = Math.max(0, Math.sin((ph - 0.78) / 0.22 * Math.PI * 7)); o.bhy -= d * 1.8 * A; o.bhx += Math.floor(ph * 40) % 3 - 1; }
        return 'neutral';
      }
      case 'type': {
        o.by = 1.4; o.kb = 1; o.hi = 1; o.ear = 0.55 + 0.45 * nd;
        o.hy = 0.6 + nd * 2.1 * A; o.hr = nd * 0.016 * A + Math.sin(t * 0.37) * 0.008;
        o.fhx = 80 + P.fx; o.fhy = 181 + P.fp * 2; o.bhx = 120 + P.bx; o.bhy = 181 + P.bp * 2;
        return 'focus';
      }
      case 'think': {
        o.hr = -0.06 + Math.sin(t * 0.8) * 0.012; o.hy = 0.5; o.lean = -0.012;
        o.fhx = 86 + Math.sin(t * 1.6) * 0.8; o.fhy = 147 + Math.sin(t * 3.1) * 0.5; o.flen = 22;
        o.bhx = 96; o.bhy = 182; o.blen = 21;
        return 'think';
      }
      case 'sip': {
        // a slow cycle: warm hands round the mug, raise it, sip with her eyes closed, lower it
        const per = 8.5, u = ((pt + P.sip) % per) / per;
        const up = u < 0.42 ? 0 : u < 0.5 ? sm((u - 0.42) / 0.08) : u < 0.7 ? 1 : u < 0.78 ? 1 - sm((u - 0.7) / 0.08) : 0;
        o.mug = 1; o.mugr = 0.5 * up;
        o.fhx = lerp(84, 82, up); o.fhy = lerp(177, 146, up) + br * 0.4; o.flen = lerp(20.4, 23, up); o.fbend = 1;
        o.bhx = lerp(110, 126, up); o.bhy = lerp(179, 184, up); o.blen = 20.4;
        o.hr = lerp(0, -0.05, up) + Math.sin(t * 0.43) * 0.012; o.hy = lerp(nd * 0.6 * A, -0.8, up);
        o.ear = 0.3;
        return up > 0.6 ? 'calm' : 'warm';
      }
      case 'stretch_up': {
        // reach up, tall as the antenna on her building: rise, arms high, sway
        const k = sm(Math.min(1, pt / 1.2)), sway = Math.sin(pt * 1.1) * 0.05 * A;
        o.by = -5 * k; o.breath = 1 + 0.035 * k; o.hy = -2 * k; o.hr = sway; o.bx = sway * 30;
        o.fsy = 156 - 3 * k; o.bsy = 156 - 3 * k;
        o.fhx = lerp(70, 22, k) + sway * 40; o.fhy = lerp(186, 66, k); o.flen = lerp(20.4, 42, k); o.fbend = -1;
        o.bhx = lerp(130, 178, k) + sway * 40; o.bhy = lerp(186, 66, k); o.blen = lerp(20.4, 42, k); o.bbend = 1; o.bfront = 2;
        return pt < 2.6 ? 'yawn' : 'joy';
      }
      case 'shoulders': {
        // roll them back, five slow ones
        const r = pt * TAU / 3, up = 0.5 - 0.5 * Math.cos(r), back = Math.sin(r);
        o.fsy = 156 - 4.2 * up; o.bsy = 156 - 4.2 * up; o.fsx = 73 - 1.6 * back; o.bsx = 127 + 1.6 * back;
        o.by = -1.6 * up; o.hy = 1.4 * up; o.breath = 1 + 0.02 * up;
        o.fhx = 70; o.bhx = 130;
        return 'calm';
      }
      case 'neck': {
        // ear to shoulder: left, hold, right, hold
        const s = Math.sin(pt * TAU / 7.5), tilt = Math.sign(s) * Math.pow(Math.abs(s), 0.45);
        o.hr = 0.27 * tilt * Math.min(1, pt / 0.8); o.hx = o.hr * 18; o.hy = Math.abs(o.hr) * 6;
        return 'calm';
      }
      case 'shake': {
        // shake out the hands, like drying them without a towel
        const f = Math.sin(t * 23) * A, g = Math.sin(t * 23 + 1.9) * A;
        o.fhx = 58 + f * 3.2; o.fhy = 164 + g * 2.2; o.flen = 21; o.fbend = 1;
        o.bhx = 142 - g * 3.2; o.bhy = 164 + f * 2.2; o.blen = 21; o.bbend = -1;
        o.bx = f * 0.5; o.hr = g * 0.01;
        return 'joy';
      }
      case 'breathe': {
        // box breathing: P.breath is the phase ('in' 'hold' 'out' 'rest'), P.bt the seconds since it began
        let r;
        if (P.breath === 'in') r = sm(P.bt / 4); else if (P.breath === 'hold') r = 1; else if (P.breath === 'out') r = 1 - sm(P.bt / 4); else if (P.breath === 'rest') r = 0;
        else { const u = (pt % 16) / 16; r = u < 0.25 ? sm(u * 4) : u < 0.5 ? 1 : u < 0.75 ? 1 - sm((u - 0.5) * 4) : 0; }
        o.by = -3.2 * r; o.breath = 1 + 0.035 * r; o.fsy = 156 - 2.6 * r; o.bsy = 156 - 2.6 * r; o.hy = -0.6 * r; o.hr = 0;
        o.fhx = 74; o.bhx = 126; o.fhy = 186 + r; o.bhy = 186 + r;
        return P.breath === 'out' ? 'exhale' : 'calm';
      }
      case 'cheer': {
        const hop = Math.abs(Math.sin(pt * Math.PI * 1.35)) * A * (P.calm ? 0.45 : 1);
        o.by = -6 * hop; o.hy = 0; o.hr = Math.sin(pt * Math.PI * 1.35) * 0.04 * A; o.ear = 0.9;
        o.fhx = 36 - hop * 3; o.fhy = 102 - hop * 6; o.flen = 33; o.fbend = -1;
        o.bhx = 164 + hop * 3; o.bhy = 102 - hop * 6; o.blen = 33; o.bbend = 1; o.bfront = 2;
        return 'laugh';
      }
      case 'wave': {
        const w = Math.sin(pt * 8) * (A > 0.5 ? 1 : 0.4), k = sm(Math.min(1, pt / 0.3));
        o.fhx = lerp(70, 34 + w * 6, k); o.fhy = lerp(186, 112 - Math.abs(w) * 3, k); o.flen = 31; o.fbend = -1;
        o.hr = -0.04 * k; o.hx = -1.5 * k;
        return 'warm';
      }
      case 'zap': {
        // point the holo-glove: a quick wind-up, then the arm straight at the target, glowing
        const d = P.zdir, k = sm(Math.min(1, pt / 0.16)), el2 = P.zel, kick = pt < 0.1 ? -4 * Math.sin(Math.PI * pt / 0.1) : 0;
        const sx = d < 0 ? 73 : 127, sy = 154, reach = ZAP_REACH + kick;
        const tx = sx + d * Math.cos(el2) * reach + d * 2, ty = sy + Math.sin(el2) * reach;
        o.lean = d * 0.06 * k; o.bx = d * 2.5 * k; o.hr = d * 0.035 * k; o.by = -1 * k;
        if (d < 0) { o.fhx = tx; o.fhy = ty; o.flen = 27; o.fbend = -1; } else { o.bhx = tx; o.bhy = ty; o.blen = 27; o.bbend = 1; o.bfront = 2; }
        o.glove = k * (pt < 1.1 ? 1 : Math.max(0, 1 - (pt - 1.1) / 0.4));
        return 'determined';
      }
      case 'doze': {
        // nodding off: the head sinks over a few seconds, jerks back up, sinks again
        const per = 5.2, u = (pt % per) / per, sink = u < 0.86 ? sm(u / 0.86) : 1 - sm((u - 0.86) / 0.14);
        o.by = 1.8; o.lean = 0.012; o.breath = 1 + 0.02 * Math.sin(t * TAU / 5);
        o.hy = 2 + sink * 6 * A; o.hr = 0.06 + sink * 0.1 * A; o.hx = sink * 2;
        o.fhx = 74; o.bhx = 126; o.zz = 1; o.ear = 0.15;
        return 'snooze';
      }
      case 'startle': {
        const j = pt < 0.42 ? Math.sin(Math.PI * pt / 0.42) : 0, sh = Math.max(0, 1 - pt / 0.7) * Math.sin(pt * 40) * A;
        o.by = -7 * j * A; o.hy = -2 * j; o.hr = sh * 0.03;
        o.fhx = 50; o.fhy = 150 - 6 * j; o.flen = 22; o.bhx = 150; o.bhy = 150 - 6 * j; o.blen = 22; o.bfront = 2;
        return 'surprise';
      }
      // ── her own little gestures (not in the contract's list; the behaviour plays them) ──
      case 'phones': {
        // both hands to the ear cups: headphones on, lo-fi up
        const k = plateau(Math.min(1, pt / 1.0), 0.3);
        o.fhx = lerp(70, 27, k); o.fhy = lerp(186, 112, k); o.flen = lerp(20.4, 34, k); o.fbend = -1;
        o.bhx = lerp(130, 173, k); o.bhy = lerp(186, 112, k); o.blen = lerp(20.4, 34, k); o.bbend = 1; o.bfront = 2;
        o.hy = nd * 1.5 * A; o.ear = 0.3 + 0.7 * k; o.hr = Math.sin(pt * 6) * 0.02 * k * A;
        return 'smirk';
      }
      case 'adjust': {
        // push the glasses up the bridge of her nose
        const k = plateau(Math.min(1, pt / 0.9), 0.35);
        o.fhx = lerp(70, 99, k); o.fhy = lerp(186, 99, k); o.flen = lerp(20.4, 32, k); o.fbend = 1;
        o.hy = -0.8 * k; o.hr = -0.02 * k;
        return 'neutral';
      }
      case 'admire': {
        // looks down at her hoodie: a new patch
        const k = plateau(Math.min(1, pt / 1.9), 0.25);
        o.hy = 3 * k; o.hr = 0.05 * k; o.by = 0.8 * k; o.bhx = lerp(130, 116, k); o.bhy = lerp(186, 176, k);
        return 'warm';
      }
      case 'pump': {
        // a small fist pump (a task shipped)
        const u = Math.min(1, pt / 1.15), k = plateau(u, 0.2), pm = Math.abs(Math.sin(u * Math.PI * 3)) * A;
        o.bhx = lerp(130, 150, k); o.bhy = lerp(186, 132 - pm * 8, k); o.blen = lerp(20.4, 26, k); o.bbend = 1; o.bfront = 2;
        o.by = -1.5 * k * pm; o.hr = 0.03 * k;
        return 'joy';
      }
      case 'boop': {
        // tapped: a little flinch, then a look
        const j = Math.sin(Math.PI * Math.min(1, pt / 0.35));
        o.by = -2.2 * j * A; o.hy = -1.2 * j; o.hr = 0.04 * j * A;
        return pt < 0.16 ? 'surprise' : 'smirk';
      }
      case 'yawn': {
        // waking up gently: a small stretch and a yawn
        const k = plateau(Math.min(1, pt / 1.6), 0.35);
        o.by = -2.5 * k; o.breath = 1 + 0.025 * k; o.hr = -0.04 * k;
        o.fhx = lerp(70, 42, k); o.fhy = lerp(186, 118, k); o.flen = lerp(20.4, 32, k); o.fbend = -1;
        o.bhx = lerp(130, 158, k); o.bhy = lerp(186, 118, k); o.blen = lerp(20.4, 32, k); o.bbend = 1; o.bfront = 2;
        return 'yawn';
      }
      default: return 'neutral';
    }
  }

  // ───────── the live state (update fills it, draw reads it) ─────────
  let T = 0;                                   // her clock (s): advances only while frames run
  let rmNow = false;                           // reduced motion, read once a frame
  let G32 = null, G64 = null, G64b = null;     // the mint glow sprites (core's glowOf builds a key string per call)
  const J = mkJ(), J0 = mkJ(), JT = mkJ();     // blended, blend-from, target
  let JS = JT;                                 // the record shown this frame (JT itself unless a blend is running)
  const PL = mkP();                            // pose params for the live figure
  let cur = 'idle', poseT0 = 0, blendK = 1, blendDur = 0.3;
  let shot = null, shotUntil = 0, shotHold = false;   // a one-shot pose over the base pose
  let poseFace = 'neutral', face = 'neutral', faceWant = 'neutral', faceSwapAt = 0, faceOver = '', faceOverUntil = 0;
  let blinkAt = -9;                            // a forced blink (on a change of face)
  let talkUntil = 0;                           // her mouth flaps while a line types out
  let gx = 1, gy = 2, gtx = 1, gty = 2, gNext = 0, gHoldUntil = 0, look = 0;
  let ND = 0, BP = 0;                          // the nod (0..1) and the beat phase this frame
  let act = { id: null, pose: null, breath: '', bt0: 0 };
  let dozing = false, lastInput = 0, idleSaid = false, wakeAt = 0;
  // typing: two hands on the holo keyboard, in bursts, keys flashing under the fingers
  const TY = { burst: 1, bt: 1.6, fn: 0.1, bn: 0.2, ftx: 0, btx: 0, kfx: 0, kfy: 0, kfa: 0, kbx: 0, kby: 0, kba: 0 };
  let spark = 0, sparkSlot = 0;                // a glint on a freshly sewn patch
  const ROWY = [176.2, 180.5, 184.8];

  function focusRunning() { return TIMER.state === 'running' && TIMER.mode === 'focus'; }
  function basePose() {
    if (act.id && act.pose) return act.pose;
    if (dozing) return 'doze';
    if (TIMER.state === 'running') return TIMER.mode === 'focus' ? 'type' : 'sip';
    return 'idle';
  }
  // play a pose: a one-shot (returns to the base pose after its time), `hold: true` keeps it until the next call,
  // `hold: seconds` keeps it that long
  function setPose(name, o) {
    o = o || {};
    if (!name || name === 'base') { shot = null; shotHold = false; return; }
    const spec = SHOT[name];
    shot = name; shotHold = o.hold === true;
    shotUntil = T + (typeof o.hold === 'number' ? o.hold : spec ? spec[0] : 3);
    if (name === cur) poseT0 = T;   // replay it
  }
  function switchTo(name) {
    for (let i = 0; i < NJ; i++) J0[KJ[i]] = JS[KJ[i]];
    const spec = SHOT[name];
    blendDur = rmNow ? 0.45 : spec ? spec[1] : name === 'doze' ? 0.9 : 0.34;
    cur = name; poseT0 = T; blendK = 0;
  }
  function blendStep(dt) {
    if (blendK >= 1) { JS = JT; return; }
    blendK = Math.min(1, blendK + dt / blendDur);
    const e = easeInOut(blendK);
    for (let i = 0; i < NJ; i++) { const k = KJ[i]; J[k] = J0[k] + (JT[k] - J0[k]) * e; }
    JS = J;
  }

  // ── the beat: Snd.beat() when her lo-fi is actually playing, else her own 80 BPM (her headphones never stop).
  //    Polled ~6×/s and advanced locally in between (the phase only needs to stay in step, not be re-read each frame).
  let beatNext = 0, beatBpm = 80, beatLive = false;
  function beatTick(dt) {
    BP = (BP + dt * beatBpm / 60) % 1;
    if (T >= beatNext) {
      beatNext = T + 0.16;
      let live = false;
      try { if (typeof Snd !== 'undefined' && Snd.beat) { const b = Snd.beat(); if (b && b.playing) { live = true; BP = b.phase % 1; if (b.bpm > 30 && b.bpm < 240) beatBpm = b.bpm; } } } catch (e) {}
      if (!live && beatLive) beatBpm = 80;
      beatLive = live;
    }
    const c = 0.5 + 0.5 * Math.cos(TAU * (BP - 0.1));   // dips just after the downbeat
    ND = c * c;
  }

  // ── the typing hands ──
  function typeTick(dt) {
    TY.kfa = Math.max(0, TY.kfa - dt * 5); TY.kba = Math.max(0, TY.kba - dt * 5);
    PL.fp = Math.max(0, PL.fp - dt * 10); PL.bp = Math.max(0, PL.bp - dt * 10);
    PL.fx += (TY.ftx - PL.fx) * Math.min(1, dt * 16); PL.bx += (TY.btx - PL.bx) * Math.min(1, dt * 16);
    if (cur !== 'type') return;
    TY.bt -= dt;
    if (TY.bt <= 0) { TY.burst = TY.burst ? 0 : 1; TY.bt = TY.burst ? rnd(1.2, 3.6) : rnd(0.4, 1.3); if (!TY.burst) { TY.ftx = -1; TY.btx = 1; } }
    if (!TY.burst) return;
    TY.fn -= dt; TY.bn -= dt;
    if (TY.fn <= 0) { TY.fn = rnd(0.1, 0.26); PL.fp = 1; TY.ftx = rnd(-7, 4); TY.kfx = 80 + TY.ftx + rnd(-3, 3); TY.kfy = ROWY[(Math.random() * 3) | 0]; TY.kfa = 1; }
    if (TY.bn <= 0) { TY.bn = rnd(0.1, 0.26); PL.bp = 1; TY.btx = rnd(-4, 7); TY.kbx = 120 + TY.btx + rnd(-3, 3); TY.kby = ROWY[(Math.random() * 3) | 0]; TY.kba = 1; }
  }

  // ── where she looks: pupils (rig units inside the eye) and a small head turn that follows them ──
  function lookRig(x, y, hold) { gtx = clamp(x, -4, 4); gty = clamp(y, -4.6, 4.6); gHoldUntil = T + (hold || 1.2); }
  // the gaze toward a point on screen (CSS px), into GX/GY
  let GX = 0, GY = 0;
  function aimAt(x, y) {
    const hx = lastX + JS.bx * lastS, hy = lastY + (80 - DESK + JS.by + JS.hy) * lastS;
    const dx = x - hx, dy = y - hy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / (60 * lastS));
    GX = clamp(dx / d * 4 * k, -4, 4); GY = clamp(dy / d * 4.4 * k, -4.6, 4.6);
  }
  function lookAt(x, y, hold) { if (!(lastS > 0)) return; aimAt(x, y); lookRig(GX, GY, hold); }
  // the pointer: on a desktop her eyes follow it while she's free; on a phone she watches your finger while it drags
  const PTR = { x: 0, y: 0, t: -9, down: false };
  function onPtrMove(e) { if (TOUCH && !PTR.down) return; PTR.x = e.clientX; PTR.y = e.clientY; PTR.t = T; }
  function gazeTick(dt) {
    const E = EXPR[face] || EXPR.neutral, st = EYES[E.eyes];
    const free = cur === 'idle' || cur === 'sip' || cur === 'think' || cur === 'wave' || cur === 'boop';
    if (st && (st.gx !== undefined || st.gy !== undefined)) { gtx = st.gx !== undefined ? st.gx : gtx; gty = st.gy !== undefined ? st.gy : gty; }
    else if (free && T - PTR.t < 2.5 && T > gHoldUntil && lastS > 0) { aimAt(PTR.x, PTR.y); gtx = GX; gty = GY; gNext = T + rnd(0.8, 2); }
    else if (T > gHoldUntil && T > gNext) {
      const r = Math.random();
      if (cur === 'type') { if (r < 0.3) { gtx = rnd(-1, 1); gty = 4; } else if (r < 0.65) { gtx = -3.7; gty = -0.6; } else { gtx = 3.7; gty = -0.6; } gNext = T + rnd(0.8, 3); }
      else if (cur === 'sip' && act.id === 'window') { gtx = -3.2; gty = -3.6; gNext = T + rnd(2, 5); }
      else if (cur === 'idle' || cur === 'sip') {
        if (r < 0.42) { gtx = 0.3; gty = 0.6; } else if (r < 0.6) { gtx = 0; gty = 4.2; } else if (r < 0.72) { gtx = -3.6; gty = 0.4; } else if (r < 0.84) { gtx = 3.6; gty = 0.4; } else { gtx = 1.6; gty = -3.4; }
        gNext = T + rnd(1.4, 4.2);
      } else if (cur === 'cheer') { gtx = rnd(-3, 3); gty = rnd(-1, 3); gNext = T + rnd(0.5, 1.2); }
      else { gtx = 1; gty = 2; gNext = T + 2; }
    }
    const k = Math.min(1, dt * 24);
    gx += (gtx - gx) * k; gy += (gty - gy) * k;
    look += (gx / 4 - look) * Math.min(1, dt * 5);
  }

  // ── the face: expression changes ride a blink (a cartoon's oldest trick), the mouth flaps while she talks ──
  function faceTick() {
    let want = poseFace;
    if (faceOver && T < faceOverUntil) want = faceOver; else faceOver = '';
    if (want !== faceWant) {
      faceWant = want;
      const E0 = EXPR[face], E1 = EXPR[want];
      if (!E0 || !E1 || E0.eyes === E1.eyes || want === 'surprise' || rmNow) { face = want; faceSwapAt = 0; }
      else { blinkAt = T; faceSwapAt = T + 0.07; }
    }
    if (faceSwapAt && T >= faceSwapAt) { face = faceWant; faceSwapAt = 0; }
  }
  function setFace(name, sec) { if (!EXPR[name]) return; faceOver = name; faceOverUntil = T + (sec || 1.5); }
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  // eyelid openness 1 → 0.08 in a blink. Every ~3–6 s, now and then a double.
  function blinkK(t, seed) {
    const P = 4.6, u = t + seed * 7.3, n = Math.floor(u / P), f = u - n * P, at = 0.4 + hash(n + seed) * 3.2;
    let d = f - at;
    if (d > 0.2 && hash(n * 3.1 + seed) > 0.72) d -= 0.26;
    let k = d < 0 || d > 0.15 ? 1 : 1 - 0.92 * Math.sin(Math.PI * d / 0.15);
    const fb = t - blinkAt;
    if (fb >= 0 && fb < 0.15) k = Math.min(k, 1 - 0.92 * Math.sin(Math.PI * fb / 0.15));
    return k;
  }
  function mouthNow(E) {
    if (T < talkUntil && !E.open) { const q = Math.floor(T * 11), h = hash(q * 1.7); return h < 0.32 ? E.mouth : h < 0.7 ? 'talk1' : 'talk2'; }
    return E.mouth;
  }

  // ───────── drawing ─────────
  // one scratch record per arm: shoulder, elbow, hand (rig world), reused every frame
  const AF = { sx: 0, sy: 0, ex: 0, ey: 0, hx: 0, hy: 0 }, AB = { sx: 0, sy: 0, ex: 0, ey: 0, hx: 0, hy: 0 };
  let UX = 0, UY = 0, CS = 1, SN = 0;
  // upper-body space → rig world: breath stretches about the desk line, then the lean about the desk point, then the offset
  function up(x, y, Jn) { const yy = DESK + (y - DESK) * Jn.breath, dx = x - 100, dy = yy - DESK; UX = 100 + dx * CS - dy * SN + Jn.bx; UY = DESK + dx * SN + dy * CS + Jn.by; }
  function solveArm(A, sx, sy, hx, hy, len, bend, Jn) {
    up(sx, sy, Jn); A.sx = UX; A.sy = UY;
    let dx = hx - UX, dy = hy - UY; const d = Math.hypot(dx, dy) || 0.001, max = len * 2 - 0.5;
    if (d > max) { hx = UX + dx * max / d; hy = UY + dy * max / d; dx = hx - UX; dy = hy - UY; }
    const dc = clamp(Math.min(d, max), 0.01, len * 2 - 0.01), ang = Math.atan2(dy, dx), A2 = Math.acos(clamp(dc / (2 * len), -1, 1)) * bend;
    A.ex = UX + Math.cos(ang + A2) * len; A.ey = UY + Math.sin(ang + A2) * len; A.hx = hx; A.hy = hy;
  }
  const SLEEVE = { f: '#3b4058', b: '#2f3449' };
  function drawArm(c, A, col, dim, bi, A0) {
    const cx = 2 * A.ex - (A.sx + A.hx) / 2, cy = 2 * A.ey - (A.sy + A.hy) / 2;
    c.beginPath(); c.moveTo(A.sx, A.sy); c.quadraticCurveTo(cx, cy, A.hx, A.hy);
    c.strokeStyle = L; c.lineWidth = 23; c.stroke();
    c.strokeStyle = col; c.lineWidth = 16; c.stroke();
    if (dim > 0.01) { c.globalAlpha = A0 * dim * 0.55; c.strokeStyle = '#070918'; c.stroke(); c.globalAlpha = A0; }
    const hcv = pick(HAND, bi);
    if (hcv) c.drawImage(hcv, A.hx - 11, A.hy - 11, 22, 22);
    else { c.beginPath(); c.arc(A.hx, A.hy, 8.5, 0, TAU); c.lineWidth = 4; c.strokeStyle = L; c.stroke(); c.fillStyle = P_SKIN; c.fill(); }
    if (dim > 0.01) { c.globalAlpha = A0 * dim * 0.55; c.fillStyle = '#070918'; c.beginPath(); c.arc(A.hx, A.hy, 10.5, 0, TAU); c.fill(); c.globalAlpha = A0; }
  }
  // a sleeve patch rides the upper arm, 45% of the way from the shoulder to the elbow
  function drawSleevePatch(c, A, slot, bs) {
    const id = hoodie[slot]; if (!id) return;
    const Ly = badge(id), r = SLOTS[slot].r, bi = bucket(bs * r * 2 / 108 * 1.08);
    const cv = pick(Ly, bi); if (!cv) return;
    const u = 0.45, x = A.sx + (A.ex - A.sx) * u, y = A.sy + (A.ey - A.sy) * u;
    c.drawImage(cv, x - r * 1.08, y - r * 1.08, r * 2.16, r * 2.16);
  }
  let lastX = 0, lastY = 0, lastS = 0, lastBi = -1, lastDev = 1;
  let anyHead = false;
  // ── a 2D affine in six numbers: one setTransform per part, no save/restore, no DOMMatrix ──
  let MA = 1, MB = 0, MC = 0, MD = 1, ME = 0, MF = 0;
  const RIGM = new Float64Array(6);   // this paint's rig transform, to come back to after each part
  function mTranslate(x, y) { ME += MA * x + MC * y; MF += MB * x + MD * y; }
  function mScale(sx, sy) { MA *= sx; MB *= sx; MC *= sy; MD *= sy; }
  function mRotate(r) { if (!r) return; const cs = Math.cos(r), sn = Math.sin(r), a = MA * cs + MC * sn, b = MB * cs + MD * sn; MC = MC * cs - MA * sn; MD = MD * cs - MB * sn; MA = a; MB = b; }
  function mRig(c) { MA = RIGM[0]; MB = RIGM[1]; MC = RIGM[2]; MD = RIGM[3]; ME = RIGM[4]; MF = RIGM[5]; c.setTransform(MA, MB, MC, MD, ME, MF); }
  const mApply = (c) => c.setTransform(MA, MB, MC, MD, ME, MF);
  // the whole figure in rig space. dev = device px per CSS px; S = { J, face, gx, gy, look, blink, mouth, t, zdir };
  // bm = the canvas's own transform [a b c d e f] when it isn't a plain (dev, 0, 0, dev, 0, 0)
  function paint(c, x, y, s, dev, S, dim, bm) {
    const Jn = S.J, bs = dev * s, bi = bucket(bs);
    if (!anyHead) { if (!has(HEAD)) { request(HEAD, bi, true); return false; } anyHead = true; }
    CS = Math.cos(Jn.lean); SN = Math.sin(Jn.lean);
    solveArm(AF, Jn.fsx, Jn.fsy, Jn.fhx, Jn.fhy, Jn.flen, Jn.fbend >= 0 ? 1 : -1, Jn);
    solveArm(AB, Jn.bsx, Jn.bsy, Jn.bhx, Jn.bhy, Jn.blen, Jn.bbend >= 0 ? 1 : -1, Jn);
    const fx = QUALITY[QL].fx, A0 = c.globalAlpha, cap = c.lineCap, join = c.lineJoin;
    if (bm) { MA = bm[0]; MB = bm[1]; MC = bm[2]; MD = bm[3]; ME = bm[4]; MF = bm[5]; } else { MA = dev; MB = 0; MC = 0; MD = dev; ME = 0; MF = 0; }
    mTranslate(x, y); mScale(s, s); mTranslate(-100, -DESK);
    RIGM[0] = MA; RIGM[1] = MB; RIGM[2] = MC; RIGM[3] = MD; RIGM[4] = ME; RIGM[5] = MF; mApply(c);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (Jn.bfront < 0.5) { drawArm(c, AB, SLEEVE.b, dim, bi, A0); drawSleevePatch(c, AB, 3, bs); }
    // the torso (and the chest patches on it): offset, lean about the desk point, breath about the desk line
    mTranslate(100 + Jn.bx, DESK + Jn.by); mRotate(Jn.lean); mScale(1, Jn.breath); mTranslate(-100, -DESK); mApply(c);
    const tb = TORSO_L.box, tcv = torsoCanvas(bi, bs);
    if (tcv) c.drawImage(tcv, tb.x, tb.y, tb.w, tb.h);
    else {
      blit(c, TORSO_L, bi, 0, 0);
      for (let i = 0; i < 2; i++) {
        const id = hoodie[i]; if (!id) continue;
        const sl = SLOTS[i], Ly = badge(id), bb = bucket(bs * sl.r * 2 / 108 * 1.08), cv = pick(Ly, bb);
        if (cv) c.drawImage(cv, sl.x - sl.r * 1.08, sl.y - sl.r * 1.08, sl.r * 2.16, sl.r * 2.16);
      }
    }
    if (dim > 0.01) {
      let sil = null;
      if (tcv) { if (!TC.sil) { const sc = makeCanvas(tcv.width, tcv.height), g = sc.getContext('2d'); g.drawImage(tcv, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#070918'; g.fillRect(0, 0, sc.width, sc.height); TC.sil = sc; } sil = TC.sil; }
      else sil = silhouette(TORSO_L, bi);
      if (sil) { c.globalAlpha = A0 * dim * 0.55; c.drawImage(sil, tb.x, tb.y, tb.w, tb.h); c.globalAlpha = A0; }
    }
    mRig(c);
    // the holo keyboard, floating over the desk edge, keys lighting under her fingers
    if (Jn.kb > 0.01) {
      c.globalAlpha = A0 * Jn.kb * (1 - 0.5 * dim); blit(c, KEYS, bi, 0, 0);
      if (fx >= 0.45 && S === LIVE && (TY.kfa > 0.02 || TY.kba > 0.02)) {
        c.globalCompositeOperation = 'lighter';
        if (TY.kfa > 0.02) { c.globalAlpha = A0 * TY.kfa * Jn.kb * 0.9; c.drawImage(G32, TY.kfx - 5, TY.kfy - 3.5, 10, 7); }
        if (TY.kba > 0.02) { c.globalAlpha = A0 * TY.kba * Jn.kb * 0.9; c.drawImage(G32, TY.kbx - 5, TY.kby - 3.5, 10, 7); }
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = A0;
    }
    if (Jn.bfront >= 0.5 && Jn.bfront < 1.5) { drawArm(c, AB, SLEEVE.b, dim, bi, A0); drawSleevePatch(c, AB, 3, bs); }
    if (Jn.ffront < 1.5) { drawArm(c, AF, SLEEVE.f, dim, bi, A0); drawSleevePatch(c, AF, 2, bs); }
    // the head rides the body and nods to the beat
    up(100, 146, Jn);
    mTranslate(UX + Jn.hx, UY + Jn.hy); mRotate(Jn.hr + Jn.lean * 0.5); mTranslate(-100, -146); mApply(c);
    drawFace(c, S, bi, Jn, fx, dim, A0);
    mRig(c);
    // the mug sits in her front hand (drawn under the hand)
    if (Jn.mug > 0.01) { c.globalAlpha = A0 * Jn.mug; mTranslate(AF.hx + 10, AF.hy - 5); mRotate(Jn.mugr); mApply(c); blit(c, MUG, bi, 0, 0); mRig(c); c.globalAlpha = A0; }
    if (Jn.ffront >= 1.5) { drawArm(c, AF, SLEEVE.f, dim, bi, A0); drawSleevePatch(c, AF, 2, bs); }
    if (Jn.bfront >= 1.5) { drawArm(c, AB, SLEEVE.b, dim, bi, A0); drawSleevePatch(c, AB, 3, bs); }
    // the holo-glove (zap): a mint shell on her hand, a glow, a ring that breathes, two sparks off the fingertips
    if (Jn.glove > 0.01) {
      const A = S.zdir < 0 ? AF : AB, pulse = 0.8 + 0.2 * Math.sin(S.t * 30);
      c.globalAlpha = A0 * Jn.glove; c.beginPath(); c.arc(A.hx, A.hy, 8.6, 0, TAU); c.fillStyle = '#9ff7dc'; c.fill();
      c.globalAlpha = A0 * Jn.glove * 0.85; c.beginPath(); c.arc(A.hx - 2, A.hy - 2.4, 3.2, 0, TAU); c.fillStyle = '#ffffff'; c.fill();
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * Jn.glove * pulse;
      c.drawImage(G64, A.hx - 26, A.hy - 26, 52, 52);
      c.globalAlpha = A0 * Jn.glove * 0.9; c.lineWidth = 2.2; c.strokeStyle = MINT; c.beginPath(); c.arc(A.hx, A.hy, 12 + 3 * Math.sin(S.t * 18), 0, TAU); c.stroke();
      const dd = S.zdir < 0 ? -1 : 1, sk = (S.t * 3) % 1;
      c.globalAlpha = A0 * Jn.glove * (1 - sk); c.fillStyle = '#e8fff8';
      c.fillRect(A.hx + dd * (12 + sk * 14) - 1.4, A.hy - 6 - sk * 6, 2.8, 2.8); c.fillRect(A.hx + dd * (14 + sk * 10) - 1, A.hy + 5 + sk * 4, 2, 2);
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0;
    }
    // a glint on a freshly sewn patch
    if (S === LIVE && spark > 0.01) {
      let sx2 = 0, sy2 = 0; const sl = SLOTS[sparkSlot];
      if (sl.arm) { const A = sl.arm === 'f' ? AF : AB; sx2 = A.sx + (A.ex - A.sx) * 0.45; sy2 = A.sy + (A.ey - A.sy) * 0.45; } else { up(sl.x, sl.y, Jn); sx2 = UX; sy2 = UY; }
      const k = Math.sin(Math.PI * Math.min(1, 1 - spark)), sz = 10 + 14 * k;
      c.globalAlpha = A0 * Math.min(1, spark * 2); mTranslate(sx2 + 4, sy2 - 5); mRotate(S.t * 2); mApply(c); blit(c, SPARK, bi, 0, 0); mRig(c);
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * spark * 0.6; c.drawImage(G32, sx2 - sz / 2, sy2 - sz / 2, sz, sz); c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0;
    }
    // doze: three small z's drift up from her head
    if (Jn.zz > 0.01) {
      up(100, 146, Jn);
      const ox = UX + Jn.hx + 52, oy = UY + Jn.hy - 120;
      for (let i = 0; i < 3; i++) {
        const u = ((S.t * 0.32) + i / 3) % 1, sc = 0.6 + 0.6 * u;
        c.globalAlpha = A0 * Jn.zz * Math.sin(Math.PI * u); mTranslate(ox + u * 16 + Math.sin(u * 6 + i) * 3, oy - u * 34); mScale(sc, sc); mApply(c); blit(c, ZZZ, bi, 0, 0); mRig(c);
      }
      c.globalAlpha = A0;
    }
    // hand the canvas back as we found it
    if (bm) c.setTransform(bm[0], bm[1], bm[2], bm[3], bm[4], bm[5]); else c.setTransform(dev, 0, 0, dev, 0, 0);
    c.lineCap = cap; c.lineJoin = join; c.globalAlpha = A0;
    return true;
  }
  // the face in head space: the head layer turns a quarter as far as the features (a cheap 2.5D head turn).
  // (Drawn straight onto the scene each frame: composing it into a cached canvas was tried and is slower, because
  // a canvas used as an image source has to be rasterised on the main thread every time it changes.)
  function composeFace(c, S, bi, Jn, dim) {
    const E = EXPR[S.face] || EXPR.neutral, dx = S.look * 3.2;
    blit(c, HEAD, bi, dx * 0.25, 0);
    const st = EYES[E.eyes] || EYES.open, k = st.lines ? 1 : S.blink;
    let exact = !!HEAD.canv[bi];
    if (!st.lines) {
      const W = WHITES[st.w], Pp = PUPILS[st.pr];
      if (k > 0.999) { blit(c, W, bi, dx, 0); blit(c, Pp, bi, dx + S.gx, S.gy); }
      else { blitSquash(c, W, bi, dx, 0, k, EY); blitSquash(c, Pp, bi, dx + S.gx, S.gy, k, EY); }
      exact = exact && !!W.canv[bi] && !!Pp.canv[bi];
    }
    const lid = LIDS[E.eyes];
    if (lid) { if (k > 0.999) blit(c, lid, bi, dx, 0); else blitSquash(c, lid, bi, dx, 0, k, EY); exact = exact && !!lid.canv[bi]; }
    // the holo-glasses: a lit pair while her screens are up
    const hiA = Jn.hi * (1 - 0.6 * dim), a0 = c.globalAlpha;
    if (hiA < 0.985) { blit(c, GLS, bi, dx, 0); exact = exact && !!GLS.canv[bi]; }
    if (hiA > 0.01) { c.globalAlpha = a0 * Math.min(1, hiA); blit(c, GLS_HI, bi, dx, 0); c.globalAlpha = a0; exact = exact && !!GLS_HI.canv[bi]; }
    const br = BROWS[E.brows]; if (br) { blit(c, br, bi, dx, 0); exact = exact && !!br.canv[bi]; }
    const m = MOUTHS[S.mouth] || MOUTHS[E.mouth]; if (m) { blit(c, m, bi, dx, 0); exact = exact && !!m.canv[bi]; }
    return exact;
  }
  function drawFace(c, S, bi, Jn, fx, dim, A0) {
    const E = EXPR[S.face] || EXPR.neutral, dx = S.look * 3.2, r = E.rot || 0, ey = E.dy || 0;
    if (r || ey) { mTranslate(100, 150); mRotate(r); mTranslate(-100, -150 + ey); mApply(c); }
    composeFace(c, S, bi, Jn, dim);
    // ear cup: her lo-fi, pulsing with the beat
    if (fx >= 0.45 && Jn.ear > 0.01) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * Math.min(1, Jn.ear) * (0.45 + 0.35 * ND) * (1 - 0.6 * dim);
      c.drawImage(G32, 24 + dx * 0.25 - 13, 106 - 19, 26, 38); c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0;
    }
    // her face, lit by her screens while she types; three terminals scrolling in her lenses
    if (fx >= 0.9 && Jn.kb > 0.01) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = A0 * Jn.kb * 0.13 * (1 - 0.6 * dim);
      c.drawImage(G64b, 34 + dx * 0.25, 96, 132, 76);
      if (S === LIVE && Jn.hi > 0.01) {
        c.fillStyle = MINT;
        for (let i = 0; i < 6; i++) {
          const lens = i < 3 ? 60 : 108, u = (S.t * 0.55 + i * 0.37) % 1, yy = 106 - u * 22, w = 8 + ((i * 7) % 5) * 3.5;
          c.globalAlpha = A0 * Jn.hi * 0.45 * Math.sin(Math.PI * u); c.fillRect(lens + dx, yy, w, 1.4);
        }
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = A0;
    }
    if (dim > 0.01) { const sil = silhouette(HEAD, bi); if (sil) { c.globalAlpha = A0 * dim * 0.5; c.drawImage(sil, HEAD.box.x + dx * 0.25, HEAD.box.y, HEAD.box.w, HEAD.box.h); c.globalAlpha = A0; } }
  }
  // what the live figure shows this frame
  const LIVE = { J, face: 'neutral', gx: 1, gy: 2, look: 0, blink: 1, mouth: '', t: 0, zdir: 1 };

  // ───────── the speech bubble (#bubble): her holo-HUD, a dark glass card with a mint hairline ─────────
  let bubEl = null, cardEl = null, txtEl = null, shapeEl = null;
  let bubOn = false, bubUntil = 0, bubItem = null, bubGapUntil = 0, bubPlacedAt = { x: -1, y: -1 };
  const BQ = [];
  const CSS_TEXT = `
#bubble{position:fixed;left:0;top:0;width:0;height:0;z-index:12;pointer-events:none}
.pt-bub{position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;will-change:transform}
.pt-bub.pt-on{visibility:visible;pointer-events:auto;cursor:pointer}
.pt-card{position:relative;box-sizing:border-box;width:max-content;max-width:var(--pt-max,272px);padding:9px 14px 9px;color:var(--text);font:600 14px/1.4 var(--body);letter-spacing:.003em;text-wrap:pretty;opacity:0}
.pt-on .pt-card{animation:pt-rise .34s var(--ease-back) both}
.pt-bub.pt-out .pt-card{animation:pt-fall .2s var(--ease-in) both}
@keyframes pt-rise{0%{opacity:0;transform:translateY(7px) scale(.92)}100%{opacity:1;transform:none}}
@keyframes pt-fall{0%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-3px) scale(.97)}}
.pt-shape{position:absolute;left:-14px;top:-14px;overflow:visible;pointer-events:none;filter:drop-shadow(0 6px 12px rgba(0,0,0,.3))}
.pt-shape path{fill:var(--glass);stroke:var(--accent);stroke-opacity:.6;stroke-width:1.1}
.pt-shape .pt-hud{fill:none;stroke:var(--accent);stroke-opacity:1;stroke-width:2;stroke-linecap:round}
.pt-tag{position:relative;display:flex;align-items:center;gap:6px;margin:0 0 3px;font:700 9.5px/1 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
.pt-tag i{width:5px;height:5px;border-radius:50%;background:var(--accent);box-shadow:0 0 6px var(--accent);animation:pt-led 1.4s steps(2,jump-none) infinite}
@keyframes pt-led{50%{opacity:.35}}
.pt-txt{position:relative;margin:0}
.pt-w{animation:pt-word .26s var(--ease) both}
@keyframes pt-word{0%{opacity:0}100%{opacity:1}}
html[data-q="2"] .pt-shape,html[data-q="3"] .pt-shape{filter:none}
html[data-q="3"] .pt-tag i{animation:none}
html.rm .pt-on .pt-card,html.rm .pt-bub.pt-out .pt-card{animation:none;opacity:1}
html.rm .pt-bub.pt-out{visibility:hidden}
html.short .pt-card{font-size:13px;padding:7px 12px 9px}
`;
  function buildBubble() {
    const host = $('bubble'); if (!host) return;
    host.textContent = '';
    bubEl = h('div', { class: 'pt-bub', 'data-hit': '', 'aria-hidden': 'true' });
    cardEl = h('div', { class: 'pt-card' });
    shapeEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    shapeEl.setAttribute('class', 'pt-shape');
    txtEl = h('p', { class: 'pt-txt' });
    cardEl.append(shapeEl, h('div', { class: 'pt-tag' }, h('i'), 'Patch'), txtEl);
    bubEl.appendChild(cardEl);
    bubEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); hideBubble(true); });
    host.appendChild(bubEl);
  }
  // a rounded card with a tail, one path (no seams on the glass)
  function shapePath(w, h, side, at, tip) {
    const r = Math.min(14, h / 2), O = 14;   // the svg sits 14px up-left of the card
    const X = (v) => n1(v + O), Y = (v) => n1(v + O);
    let d = `M${X(r)} ${Y(0)}`;
    if (side === 'up') d += `L${X(at - 8)} ${Y(0)}L${X(at + tip)} ${Y(-9)}L${X(at + 8)} ${Y(0)}`;
    d += `L${X(w - r)} ${Y(0)}Q${X(w)} ${Y(0)} ${X(w)} ${Y(r)}`;
    if (side === 'right') d += `L${X(w)} ${Y(at - 8)}L${X(w + 9)} ${Y(at + tip)}L${X(w)} ${Y(at + 8)}`;
    d += `L${X(w)} ${Y(h - r)}Q${X(w)} ${Y(h)} ${X(w - r)} ${Y(h)}`;
    if (side === 'down') d += `L${X(at + 8)} ${Y(h)}L${X(at + tip)} ${Y(h + 10)}L${X(at - 8)} ${Y(h)}`;
    d += `L${X(r)} ${Y(h)}Q${X(0)} ${Y(h)} ${X(0)} ${Y(h - r)}`;
    if (side === 'left') d += `L${X(0)} ${Y(at + 8)}L${X(-9)} ${Y(at + tip)}L${X(0)} ${Y(at - 8)}`;
    d += `L${X(0)} ${Y(r)}Q${X(0)} ${Y(0)} ${X(r)} ${Y(0)}Z`;
    return d;
  }
  // where the bubble goes: above her head if it fits under the top bar, else beside it, else over the crown of her
  // afro; always on screen, inside the room (the stage in the wide layout), clear of the tomato
  function headBox() {
    const s = lastS || 1, cx = lastX + (JS.bx + JS.hx) * s, top = lastY + (-12 - DESK + JS.by + JS.hy) * s;
    return { cx, top, half: 86 * s, mid: lastY + (84 - DESK + JS.by + JS.hy) * s };
  }
  let bubW = 0, bubH = 0, bubX0 = 0, bubX1 = 0;
  // the card's width cap and the room it may use (CSS px)
  function bubbleRoom() {
    const st = LAYOUT.wide ? LAYOUT.stage : { x: 0, w: LAYOUT.W }, M = 10;
    bubX0 = st.x + M + (LAYOUT.safe.l || 0); bubX1 = st.x + st.w - M - (LAYOUT.wide ? 0 : LAYOUT.safe.r || 0);
    cardEl.style.setProperty('--pt-max', Math.round(Math.min(272, bubX1 - bubX0)) + 'px');
  }
  // the one layout read per line
  function measureBubble() { bubW = cardEl.offsetWidth; bubH = cardEl.offsetHeight; }
  function placeBubble(remeasure) {
    if (!bubEl || !bubOn || !(lastS > 0)) return;
    if (remeasure) { bubbleRoom(); measureBubble(); }
    const H = headBox(), topMin = LAYOUT.top.y + LAYOUT.top.h + 8, d = LAYOUT.dial;
    const clearDial = (bx, by, w, hh) => { if (LAYOUT.wide) return true; const nx = clamp(d.cx, bx, bx + w), ny = clamp(d.cy, by, by + hh); return (nx - d.cx) * (nx - d.cx) + (ny - d.cy) * (ny - d.cy) > (d.r + 8) * (d.r + 8); };
    let side = '', w = bubW, hh = bubH, bx = clamp(H.cx - w / 2, bubX0, bubX1 - w), by = H.top - hh - 12;
    // 1. above her head
    if (by >= topMin && clearDial(bx, by, w, hh)) side = 'down';
    // 2. beside her head, as wide as the room there allows (a short landscape screen)
    if (!side) {
      const hr = H.cx + H.half * 0.92 + 12, hl = H.cx - H.half * 0.92 - 12, roomR = bubX1 - hr, roomL = hl - bubX0, room = Math.max(roomR, roomL);
      if (room >= 150) {
        const right = roomR >= roomL;
        if (room < w) { cardEl.style.setProperty('--pt-max', Math.round(Math.min(272, room)) + 'px'); measureBubble(); w = bubW; hh = bubH; }
        const sy = clamp(H.mid - hh * 0.75, topMin, LAYOUT.deskY - hh - 6), sx = right ? hr : hl - w;
        if (sy + hh <= LAYOUT.deskY + 4 && sy >= topMin && clearDial(sx, sy, w, hh)) { side = right ? 'left' : 'right'; bx = sx; by = sy; }
        else if (room < bubX1 - bubX0) { bubbleRoom(); measureBubble(); w = bubW; hh = bubH; }
      }
    }
    // 3. over the crown of her afro, just under the top bar
    if (!side) { side = 'down'; by = topMin; bx = clamp(H.cx - w / 2, bubX0, bubX1 - w); }
    bx = Math.round(bx); by = Math.round(by);
    let at, tip;
    if (side === 'down') { at = clamp(H.cx - bx, 22, w - 22); tip = clamp((H.cx - bx - at) * 0.4, -6, 6); }
    else { at = clamp(H.mid - by, 18, hh - 18); tip = 2; }
    shapeEl.setAttribute('width', w + 28); shapeEl.setAttribute('height', hh + 28);
    // two HUD brackets: the top-left and bottom-right corners of the card, lit
    const r = Math.min(14, hh / 2), O = 14, hud = `M${O} ${O + r + 7}V${O + r}Q${O} ${O} ${O + r} ${O}H${O + r + 7}M${O + w} ${O + hh - r - 7}V${O + hh - r}Q${O + w} ${O + hh} ${O + w - r} ${O + hh}H${O + w - r - 7}`;
    shapeEl.innerHTML = `<path d="${shapePath(w, hh, side, at, tip)}"/><path class="pt-hud" d="${hud}"/>`;
    cardEl.style.transformOrigin = side === 'down' ? `${at}px ${hh + 10}px` : side === 'left' ? `-9px ${at}px` : `${w + 9}px ${at}px`;
    bubEl.style.transform = `translate3d(${bx}px,${by}px,0)`;
    bubPlacedAt.x = lastX; bubPlacedAt.y = lastY;
  }
  function wordsHTML(text) {
    const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (RM() || QL >= 3) return esc(text);
    return text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) || !w ? w : `<span class="pt-w" style="animation-delay:${Math.round(i * 0.5 * 42 + 90)}ms">${esc(w)}</span>`)).join('');
  }
  function showItem(it) {
    if (!bubEl) buildBubble();
    if (!bubEl) return;
    bubItem = it;
    bubEl.classList.remove('pt-on', 'pt-out');
    txtEl.innerHTML = wordsHTML(it.text);
    bubbleRoom(); measureBubble();   // (also restarts the rise animation: the card was laid out without .pt-on)
    bubOn = true;
    placeBubble(false);
    bubEl.classList.add('pt-on');
    const words = it.text.split(/\s+/).length;
    bubUntil = T + (it.ms ? it.ms / 1000 : clamp(2.0 + it.text.length * 0.05, 2.8, 7));
    talkUntil = T + clamp(0.25 + words * 0.21, 0.6, 3.2);
    try { ANNOUNCE('Patch: ' + it.text); } catch (e) {}
  }
  function hideBubble(tapped) {
    if (!bubOn) return;
    bubOn = false; bubItem = null; talkUntil = 0;
    if (bubEl) { bubEl.classList.add('pt-out'); setTimeout(() => { if (!bubOn && bubEl) bubEl.classList.remove('pt-on', 'pt-out'); }, 220); }
    bubGapUntil = T + (tapped ? 0.18 : 0.45);
  }
  // may she speak right now? (Patch talks setting; never during a running focus unless it's a reply to a tap or a capture)
  const mayTalk = (it) => it.force || (PREFS.talk && (it.react || !focusRunning()));
  function say(text, o) {
    o = o || {};
    text = String(text == null ? '' : text).trim();
    // a line goes stale: chatter after ~7 s in the queue, important ones after ~14 s, replies after ~3 s
    const it = { text, ms: o.ms || 0, force: !!o.force, react: !!o.react, hi: !!o.hi, exp: T + (o.react ? 3 : o.hi ? 14 : 7) };
    if (!text || !mayTalk(it)) return false;
    if (it.react) {
      // a reply to you jumps the queue and cuts off chatter (another reply, or anything she's half-way through)
      for (let i = BQ.length - 1; i >= 0; i--) if (BQ[i].react) BQ.splice(i, 1);
      if (bubOn && bubItem) { if (bubItem.hi && T < bubUntil - 1.2) BQ.unshift(bubItem); hideBubble(true); bubGapUntil = T + 0.12; }
      BQ.unshift(it);
    } else {
      if (BQ.length >= 4) { const i = BQ.findIndex((q) => !q.hi); BQ.splice(i >= 0 ? i : 0, 1); }
      BQ.push(it);
    }
    return true;
  }
  const sayLine = (key, vars, o) => say(line(key, vars), o);
  // a new line's DOM work runs in its own task, between frames (never inside a frame's budget)
  let bubPending = false;
  function nextLine() {
    bubPending = false; if (bubOn) return;
    let it = BQ.shift();
    while (it && (T > it.exp || !mayTalk(it))) it = BQ.shift();
    if (it) showItem(it);
  }
  function bubbleTick() {
    if (bubOn) {
      if (T >= bubUntil || (bubItem && !mayTalk(bubItem))) hideBubble(false);
      else if (Math.abs(bubPlacedAt.x - lastX) > 6 || Math.abs(bubPlacedAt.y - lastY) > 6) placeBubble(false);
    } else if (BQ.length && T >= bubGapUntil && !bubPending) { bubPending = true; setTimeout(nextLine, 0); }
  }
  function clearTalk() { BQ.length = 0; hideBubble(true); }

  // ───────── behaviour: she drives herself from the bus (CONTRACT.md §7, DESIGN.md §6–7) ─────────
  const LATER = [];
  function later(sec, fn) { LATER.push({ at: T + sec, fn }); }
  function laterTick() {
    for (let i = 0; i < LATER.length; i++) {
      if (T < LATER[i].at) continue;
      const f = LATER[i].fn; LATER.splice(i--, 1);
      try { f(); } catch (e) { reportErr('Patch.later', e); }
    }
  }
  let celebrating = 0, taps = [], deferred = [], windT = 0, windLeft = 0, pauseT = 0, lastDoneAt = -9;
  const statsSafe = () => { try { return typeof Engine !== 'undefined' && Engine.stats ? Engine.stats() : null; } catch (e) { return null; } };
  const short = (s, n = 30) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
  function greetKey() {
    // three days or more since the last tomato: welcome back; otherwise by the time of day
    const ss = DB && DB.sessions ? DB.sessions : [];
    for (let i = ss.length - 1; i >= 0; i--) if (ss[i].kind === 'focus' && ss[i].ok !== false) { if (dayDiff(ss[i].end, Date.now()) >= 3) return 'greet_return'; break; }
    const hr = DAY.hour();
    return hr >= 5 && hr < 12 ? 'greet_morning' : hr >= 12 && hr < 17 ? 'greet_afternoon' : hr >= 17 && hr < 21 ? 'greet_evening' : 'greet_night';
  }
  function migratedLine() {
    const m = DB && DB.meta;
    if (!m || !m.migratedV1 || !(m.v1Sessions > 0) || store.get('patch:migSaid', false)) return;
    if (sayLine('migrated', { n: m.v1Sessions }, { hi: true, force: false })) store.set('patch:migSaid', true);
  }
  function onReady() {
    if (!DB || !DB.meta || !DB.meta.onboarded || focusRunning()) return;
    later(0.5, () => { setPose('wave'); later(0.35, () => { sayLine(greetKey(), null, { hi: true }); migratedLine(); }); });
  }
  function onDone(p) {
    if (p.mode === 'focus') {
      lastDoneAt = T;
      const st = statsSafe(), today = dateKey();
      const n = st && st.today && st.today.tomatoes > 0 ? st.today.tomatoes : DB && DB.sessions ? DB.sessions.filter((x) => x.kind === 'focus' && x.ok !== false && dateKey(x.end) === today).length || 1 : 1;
      const goal = st && st.today ? st.today.goal : DB && DB.settings ? DB.settings.dailyGoal : 0, streak = st && st.streak ? st.streak.current : 0;
      const key = goal && n === goal ? 'done_focus_goal' : n === 1 && streak >= 2 ? 'done_focus_streak' : 'done_focus';
      const vars = { n, streak };
      if (p.away) { setFace('smirk', 2); later(0.6, () => sayLine(key, vars, { hi: true })); }
      else {
        celebrating = T + 2.6;
        setPose('cheer'); lookRig(0, 4, 0.9);
        later(1.8, () => sayLine(key, vars, { hi: true }));
      }
      // rogues quarantined this round with a note: offer to deal with them on the break
      const s = p.session, nr = s && DB && DB.rogues ? DB.rogues.filter((r) => r.sessionId === s.id && r.note && !r.done).length : 0;
      if (nr > 0) later(p.away ? 1.2 : 2.4, () => sayLine('rogue_review', { n: nr }));
      flushDeferred(p.away ? 1.4 : 2.6);
    } else later(0.4, () => sayLine('done_break'));
  }
  function flushDeferred(at) { const d = deferred.splice(0); d.forEach((f, i) => later(at + i * 0.1, f)); }
  function onStart(p) {
    if (p.mode === 'focus') { if (!act.id) setPose('phones'); return; }
    // a break begins: a line for it, unless it chained straight on from the finish (that line already said it)
    if (T - lastDoneAt < 6) return;
    later(0.3, () => sayLine(p.mode === 'long' ? 'start_break_long' : 'start_break'));
  }
  function onCapture(p) {
    const r = p.rogue || {}, kind = r.kind;
    const tgt = zapTarget();
    aimZap(tgt);
    setPose('zap');
    if (tgt) lookAt(tgt.x, tgt.y, 1.2); else lookRig(PL.zdir * 3.6, -1.4, 1.2);
    later(0.35, () => { if (!sayLine(TEXT.lines['rogue_' + kind] ? 'rogue_' + kind : 'rogue', null, { react: true })) setFace('determined', 1.2); });
  }
  // the zap's aim: Scene.zapTarget() / Scene.jar() when the Scene has them (CSS px), else up and to her right
  function zapTarget() {
    try {
      if (typeof Scene !== 'undefined') {
        if (typeof Scene.zapTarget === 'function') { const t = Scene.zapTarget(); if (t) return t; }
        if (typeof Scene.jar === 'function') { const t = Scene.jar(); if (t) return t; }
      }
    } catch (e) {}
    return null;
  }
  function aimZap(t) {
    // no target from the Scene: up and to her left-hand side (screen right), where the Scene pops a rogue in
    if (!t || !(lastS > 0)) { PL.zdir = 1; PL.zel = -0.9; return; }
    const rx = 100 + (t.x - lastX) / lastS, ry = DESK + (t.y - lastY) / lastS;
    PL.zdir = rx < 100 ? -1 : 1;
    const sx = PL.zdir < 0 ? 73 : 127;
    PL.zel = clamp(Math.atan2(ry - 154, Math.abs(rx - sx) || 1), -1.05, 0.55);
  }
  function onActivity(p) {
    const b = TEXT.breaks[p.id];
    if (p.phase === 'start') {
      act.id = p.id; act.pose = b && b.pose ? b.pose : 'idle'; act.breath = ''; act.bt0 = T;
      PL.calm = p.id === 'bughunt';
      if (TEXT.lines[p.id + '_start']) later(0.25, () => sayLine(p.id + '_start', null, { react: true }));
    } else if (p.phase === 'end') {
      const was = act.id; act.id = null; act.pose = null; act.breath = ''; PL.calm = false;
      if (was === 'bughunt' || p.id === 'bughunt') { if (p.done !== false) { setPose('cheer', { hold: 1.4 }); later(0.3, () => sayLine('bughunt_end', { score: p.score || 0 }, { react: true })); } }
      else if (p.done !== false && TEXT.lines[p.id + '_end']) later(0.3, () => sayLine(p.id + '_end', null, { react: true }));
    }
  }
  function onStep(p) {
    if (!act.id || (p.id && p.id !== act.id)) { act.id = p.id || act.id; }
    if (p.pose && POSES.indexOf(p.pose) >= 0) act.pose = p.pose;
    if (p.breath) { act.breath = p.breath; act.bt0 = T; act.pose = act.pose || 'breathe'; }
  }
  function onTap(p) {
    if (p.id !== 'patch') { if (p.x != null) lookAt(p.x, p.y, 1.4); if (p.id === 'mug' && !focusRunning()) setFace('warm', 1.4); return; }
    lastInput = T; idleSaid = false;
    if (dozing || cur === 'doze') {
      dozing = false; wakeAt = 0;
      setPose('startle'); lookRig(0, 0.4, 2);
      later(0.75, () => sayLine('wake', null, { react: true }));
      return;
    }
    taps = taps.filter((t) => T - t < 4); taps.push(T);
    lookRig(0, 0.3, 1.8);
    const key = taps.length >= 4 ? 'tap_spam' : focusRunning() ? 'tap_focus' : TIMER.state === 'running' ? 'tap_break' : 'tap';
    if (!act.id) {
      if (focusRunning()) setFace('smirk', 1.6);
      else { const r = Math.random(); setPose(taps.length >= 4 ? 'startle' : r < 0.45 ? 'boop' : r < 0.7 ? 'adjust' : r < 0.85 ? 'wave' : 'think'); }
    } else setFace('smirk', 1.4);
    sayLine(key, null, { react: true });
  }
  function onTask(p) {
    if (p.op !== 'done' || !p.task) return;
    const t = p.task, est = +t.est || 0, dn = +t.done || 0;
    if (!act.id && cur !== 'zap') setPose('pump');
    if (focusRunning()) return;
    if (dn >= 1 && dn <= est) later(0.3, () => sayLine('task_done_estimate'));
    else later(0.3, () => sayLine('task_done', { task: short(t.title) }));
  }
  // unlocks come in bursts (a finished tomato can earn three; the boot catch-up more): one line for the lot,
  // naming the first, and a look down at the hoodie
  let unlockBurst = null;
  function onUnlock(p) {
    if (!PATCHDEF(p.id)) return;
    if (unlockBurst) { unlockBurst.push(p.id); return; }
    unlockBurst = [p.id];
    const fn = () => {
      const ids = unlockBurst || [p.id]; unlockBurst = null;
      const def = PATCHDEF(ids[0]);
      const said = def && (ids.length > 1 ? sayLine('patch_unlock_many', { n: ids.length, patch: def.name }, { hi: true }) : sayLine('patch_unlock', { patch: def.name }, { hi: true }));
      if (said && !shot && !act.id && !focusRunning()) setPose('admire');
    };
    if (focusRunning()) { deferred.push(fn); return; }
    later(T < celebrating || T - lastDoneAt < 0.5 ? 2.4 : 1.4, fn);
  }
  function onRated(p) {
    const r = p.session && p.session.rating; if (!r) return;
    setFace(r <= 2 ? 'warm' : r >= 4 ? 'joy' : 'smirk', 1.8);
    later(0.35, () => sayLine(r <= 2 ? 'reflect_low' : r >= 4 ? 'reflect_high' : 'reflect_mid'));
  }
  function onWind(p) { windT = T + 0.8; windLeft = p.left; }
  function windTick() {
    if (!windT || T < windT) return;
    windT = 0;
    if (TIMER.mode !== 'focus' || !DB || !DB.settings) return;
    const min = Math.round(windLeft / 60), def = DB.settings.focusMin;
    if (!min || min === def) return;
    // a reply to the wind you just did (allowed even once the timer has started)
    sayLine(min >= 45 ? 'wind_long' : min <= 10 ? 'wind_short' : 'wind_custom', { min }, { react: true });
  }
  function onHoodie() {
    const added = readHoodie();
    rebakeHoodie();
    if (added.length) {
      const id = added[added.length - 1];
      sparkSlot = Math.max(0, hoodie.indexOf(id)); spark = 1;
      if (!act.id && !focusRunning()) { setPose('admire'); later(0.6, () => sayLine('sewn')); }
    }
  }
  // dozing: three minutes with no input while nothing's running; any input wakes her (a tap on her startles her).
  // (?dev=1&patchdoze=S shortens it for testing; idle_long comes at 45% of it)
  const DOZE = DEV && +QS.get('patchdoze') > 0 ? +QS.get('patchdoze') : 180;
  function idleTick() {
    if (TIMER.state === 'running' || act.id) { lastInput = T; idleSaid = false; if (dozing) dozing = false; return; }
    const idle = T - lastInput;
    if (!idleSaid && idle > DOZE * 0.45 && TIMER.state === 'idle' && !bubOn && !(typeof UI !== 'undefined' && UI.isOpen && UI.isOpen())) { idleSaid = true; sayLine('idle_long'); }
    if (!dozing && idle > DOZE) { dozing = true; clearTalk(); }
    if (dozing && wakeAt && T >= wakeAt) { dozing = false; wakeAt = 0; setPose('yawn'); }
  }
  function onInput() { lastInput = T; idleSaid = false; if (dozing && !wakeAt) wakeAt = T + 0.6; }
  // little things she does on her own: idle, now and then; during focus, rarely and quietly (no talking, no bouncing)
  let fidgetAt = 14;
  function fidgetTick() {
    if (T < fidgetAt) return;
    const r = Math.random();
    if (cur === 'type') {
      fidgetAt = T + rnd(35, 80);
      if (shot || act.id) return;
      if (r < 0.45) setPose('adjust'); else if (r < 0.8) setPose('think', { hold: 2.2 }); else setFace('smirk', 1.4);
      return;
    }
    fidgetAt = T + rnd(13, 30);
    if (cur !== 'idle' || shot || bubOn || act.id || dozing || T - lastInput < 2.5) return;
    if (r < 0.26) setPose('adjust');
    else if (r < 0.5) setPose('sip', { hold: 3.6 });
    else if (r < 0.66) setPose('think');
    else if (r < 0.74) setPose('yawn');
    else setFace(r < 0.88 ? 'warm' : 'smirk', 1.8);
  }

  // ───────── the six rogues (cast sheet RG-01…RG-06): small crisp sprites, their own neon, crimson eyes ─────────
  const CLOUD = 'M46 132 Q14 130 16 100 Q18 74 44 70 Q44 36 78 32 Q96 8 124 22 Q154 14 164 44 Q192 50 188 80 Q204 102 184 122 Q176 134 154 132 Z';
  function chain(x1, y1, x2, y2, n) {
    let s = ''; const a = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = n1(x1 + (x2 - x1) * t), y = n1(y1 + (y2 - y1) * t), r = Math.round(a + (i % 2 ? 0 : 90));
      s += el(x, y, 6, 3.6, 'none', `stroke="${L}" stroke-width="5" ${rot(r, x, y)}`) + el(x, y, 6, 3.6, 'none', `stroke="#c9d2e8" stroke-width="2.4" ${rot(r, x, y)}`);
    }
    return s;
  }
  const BLOB = 'M100 30 C150 30 174 66 172 104 C170 138 160 164 166 192 C170 208 188 214 192 226 L8 226 C12 214 30 208 34 192 C40 164 30 138 28 104 C26 66 50 30 100 30 Z';
  const STAR = 'M0 -7 Q1.1 -1.1 7 0 Q1.1 1.1 0 7 Q-1.1 1.1 -7 0 Q-1.1 -1.1 0 -7 Z';
  function sixFingers(x, y) {
    let d = ''; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 - 0.95 + i * 0.38; d += `M${x} ${y}L${n1(x + Math.cos(a) * 17)} ${n1(y + Math.sin(a) * 17)}`; }
    return ln(d, L, 8) + ln(d, '#e8b0c4', 4) + se(x, y, 9, 9, '#e8b0c4', 4);
  }
  const HELM = 'M32 98 Q30 44 62 28 L100 16 L138 28 Q170 44 168 98 L154 138 Q100 154 46 138 Z';
  const gl = (c) => `filter="url(#glow)" style="color:${c}"`;
  // box = the crop in rig units [x, y, w, h]; the far-flung props (Bazu's AGI SOON sign, Zatsu's headline, Bagu's
  // buglets, Kemuri's smoke) are left off so each sprite reads at 32 px
  const ROGUE_ART = {
    bazu: { box: [-24, -14, 222, 248], defs: grad('bz-head', ['#fff4b0', '#e8c24a', '#9a7414']) + TG('bz-body', ['#4a2f66', '#2e1b44', '#1a0f2a']) + clip('bz-clip', HOOD),
      body: () => `${sp('M124 36 L150 8 Q163 10 167 23 L142 46 Z', '#e6ff3d', 5)}${ln('M170 0 Q180 10 177 22 M180 -10 Q196 8 190 32', '#e6ff3d', 3, GLOW)}
      ${limb(127, 156, 150, 190, -9, '#2e1b44')}${fist(150, 191, '#e8c24a', '#9a7414')}
      ${leg(110, 196, 115, 223.5, '#1a0f2a')}${leg(90, 196, 85, 223.5, '#2e1b44')}${shoe(115, 223.5, '#e8c24a')}${shoe(85, 223.5, '#e8c24a')}
      ${sp(TORSO, G('bz-body'))}${fl(TORSO_SH, '#0d0716', 'opacity=".5"')}
      ${fl('M86 145 L100 170 L114 145 Z', '#e6ff3d')}${sp('M82 144 L100 174 L90 186 L72 152 Z', '#3d2658', 2.5)}${sp('M118 144 L100 174 L110 186 L128 152 Z', '#33204c', 2.5)}
      ${ln('M80 150 Q100 184 120 150', '#e8c24a', 3, 'stroke-dasharray="3 2"')}${sp('M100 176 l5 8 l-2 6 h-6 l-2 -6 z', '#e6ff3d', 2)}
      ${sp(HOOD, G('bz-head'))}${shade('bz-clip', '#6a4a00', 0.35)}
      ${sp('M38 80 Q100 64 162 80 L158 100 Q134 114 110 102 L100 94 L90 102 Q66 114 42 100 Z', INK, 4)}
      <g ${gl(CR)}>${fl('M58 92 L84 88 L82 95 L60 98 Z', CR)}${fl('M142 92 L116 88 L118 95 L140 98 Z', CR)}</g>
      ${fl('M48 84 Q70 76 92 80 L88 86 Q68 82 52 91 Z', '#fff', 'opacity=".3"')}
      ${ln('M50 70 L88 79 M150 70 L112 79', INK, 6)}
      ${sp('M64 116 Q100 112 136 116 Q130 141 100 143 Q70 141 64 116 Z', '#1a0f2a', 4)}${ln('M72 122 H128 M76 129 H124 M84 136 H116', '#e6ff3d', 2.5, GLOW)}
      ${rim(0.5)}${vrim('#e6ff3d')}
      ${ln('M28 126 L18 100', L, 7)}${ln('M28 126 L18 100', '#9a7414', 3.5)}
      <g ${gl('#e6ff3d')}>${sr(-20, 74, 54, 30, 6, '#e6ff3d', 0, 'fill-opacity=".16"')}${ln('M-20 74 h54 v30 h-54 z', '#e6ff3d', 2)}</g>
      <text x="7" y="96" text-anchor="middle" font-family="Dela Gothic One, Arial Black, Impact, sans-serif" font-weight="900" font-size="18" fill="#e6ff3d">10×</text>
      ${limb(73, 156, 30, 128, -6, '#4a2f66')}${fist(30, 128, '#e8c24a', '#9a7414')}` },
    fukusei: { box: [6, 18, 162, 216], defs: grad('fk-cloak', ['#3a3150', '#1e1830', '#0c0916'], 60, 140, 140, 232) + grad('fk-hood', ['#3a3150', '#1e1830', '#0c0916']) + clip('fk-clip', HOOD),
      body: () => `${sp('M62 150 Q66 140 82 140 L118 140 Q134 140 138 150 L156 222 L144 216 L134 228 L122 218 L110 230 L100 220 L90 230 L78 218 L66 228 L56 216 L44 222 Z', G('fk-cloak'))}
      ${fl('M112 141 L118 140 Q134 140 138 150 L156 222 L144 216 L134 228 L122 218 L112 228 Z', '#05040a', 'opacity=".45"')}
      ${sp(HOOD, G('fk-hood'))}${shade('fk-clip', '#05040a', 0.5)}
      ${el(95, 100, 51, 51, 'none', 'stroke="#5ff6ff" stroke-width="3" opacity=".55"')}${el(105, 100, 51, 51, 'none', `stroke="${CR}" stroke-width="3" opacity=".55"`)}
      ${sp('M100 50 C134 50 150 74 150 100 C150 130 128 150 100 150 C72 150 50 130 50 100 C50 74 66 50 100 50 Z', '#f4f1ea', 5)}
      ${fl('M100 50 C134 50 150 74 150 100 C150 130 128 150 100 150 Z', '#c9c4dc', 'opacity=".55"')}
      ${ln('M100 52 L94 70 L104 82 L98 100', '#6d6680', 2)}
      ${el(77, 97, 11, 12, '#fff', `stroke="${L}" stroke-width="2"`)}${ci(75, 99, 7, INK)}${ci(78, 95, 2.6, '#fff')}
      ${ln('M64 82 Q77 77 90 82', INK, 4)}
      <g ${gl(CR)}>${fl('M110 98 L138 90 L136 99 L112 104 Z', CR)}</g>${ln('M108 86 L138 76', INK, 4.5)}
      ${ln('M68 122 Q100 142 132 122', INK, 3.5)}${ln('M68 122 L63 117 M132 122 L137 117', INK, 3)}
      <rect x="146" y="90" width="18" height="4" fill="#5ff6ff"/><rect x="140" y="110" width="22" height="3" fill="${CR}"/><rect x="34" y="118" width="14" height="3" fill="#5ff6ff"/><rect x="40" y="76" width="10" height="3" fill="${CR}"/>
      ${rim(0.5)}${vrim('#5ff6ff', 'M58 146 Q100 166 142 146')}
      ${limb(78, 156, 46, 184, 8, '#2a2340', 14)}${se(46, 186, 8, 8, '#f4f1ea', 4)}
      <g transform="rotate(-16 26 200)">${se(26, 200, 15, 17, '#f4f1ea', 4)}${ci(20, 196, 2.6, INK)}${ci(32, 196, 2.6, INK)}${ln('M18 205 Q26 212 34 205', INK, 2.5)}${el(16, 203, 3, 1.6, BLUSH, 'opacity=".7"')}${el(36, 203, 3, 1.6, BLUSH, 'opacity=".7"')}</g>` },
    bagu: { box: [8, -12, 184, 246], defs: grad('bg-shell', ['#5c9a68', '#24503a', '#0d2418']) + TG('bg-body', ['#3d6e4c', '#24503a', '#0d2418']) + clip('bg-clip', HOOD),
      body: () => `${ln('M72 30 Q58 4 32 -4 Q22 -6 18 4', L, 8)}${ln('M72 30 Q58 4 32 -4 Q22 -6 18 4', '#24503a', 4)}${ln('M128 30 Q142 4 168 -4 Q178 -6 182 4', L, 8)}${ln('M128 30 Q142 4 168 -4 Q178 -6 182 4', '#183424', 4)}
      ${ci(18, 6, 5, '#7dff3a', GLOW)}${ci(182, 6, 5, '#7dff3a', GLOW)}
      ${['M132 170 L158 176 L168 194', 'M130 186 L152 198 L158 216'].map((d) => ln(d, L, 9) + ln(d, '#183424', 4.5)).join('')}
      ${limb(127, 158, 150, 188, -8, '#183424', 11)}${ln('M150 188 L160 184 M150 188 L156 198', L, 7)}${ln('M150 188 L160 184 M150 188 L156 198', '#e8dcb8', 3)}
      ${leg(110, 198, 116, 224, '#183424', 10, 4)}${leg(90, 198, 84, 224, '#24503a', 10, 4)}${shoe(116, 224, INK, 0.9)}${shoe(84, 224, INK, 0.9)}
      ${sp('M70 158 Q72 146 86 144 L114 144 Q128 146 130 158 L128 200 Q100 206 72 200 Z', G('bg-body'))}
      ${ln('M72 168 Q100 175 128 168 M71 183 Q100 190 129 183', '#7dff3a', 1.8, 'opacity=".55"')}${ci(100, 158, 5, CR, GLOW)}
      ${['M68 170 L42 176 L32 194', 'M70 186 L48 198 L42 216'].map((d) => ln(d, L, 9) + ln(d, '#24503a', 4.5)).join('')}
      ${sp(HOOD, G('bg-shell'))}${shade('bg-clip', '#04100a', 0.45)}
      ${ln('M100 24 V72', L, 3)}${el(70, 46, 7, 4, '#7ab884', 'opacity=".5"')}${el(134, 42, 5, 3, '#7ab884', 'opacity=".5"')}
      ${fl(FACE, '#081410')}
      <g ${gl(CR)}>${[[66, 94], [77, 88], [76, 101], [87, 95], [134, 94], [123, 88], [124, 101], [113, 95]].map(([x, y]) => ci(x, y, 5.6, CR)).join('')}</g>
      ${[[64, 92], [75, 86], [121, 86], [132, 92]].map(([x, y]) => ci(x, y, 1.6, '#fff')).join('')}
      ${ln('M58 76 L90 86 M142 76 L110 86', '#7dff3a', 3, 'opacity=".8"')}
      ${sp('M80 110 Q68 132 84 142 Q82 128 91 117 Z', '#e8dcb8', 3)}${sp('M120 110 Q132 132 116 142 Q118 128 109 117 Z', '#d4c79f', 3)}
      ${rim(0.5)}${vrim('#7dff3a')}
      ${limb(73, 158, 44, 182, 8, '#24503a', 11)}${ln('M44 182 L32 178 M44 182 L36 194', L, 7)}${ln('M44 182 L32 178 M44 182 L36 194', '#e8dcb8', 3)}` },
    kusarigumo: { box: [8, -2, 202, 236], defs: grad('kg-cloud', ['#9aa3c8', '#4c557d', '#232a4a'], 30, 20, 170, 136) + TG('kg-body', ['#3a4268', '#252c4c', '#141a33']) + clip('kg-clip', CLOUD),
      body: () => `${limb(127, 158, 150, 190, -9, '#141a33')}${fist(150, 191, '#8a93b8', '#4c557d')}
      ${leg(110, 196, 115, 223.5, '#141a33')}${leg(90, 196, 85, 223.5, '#252c4c')}${shoe(115, 223.5)}${shoe(85, 223.5)}
      ${sp(TORSO, G('kg-body'))}${fl(TORSO_SH, '#0a0d1e', 'opacity=".5"')}
      ${fl('M86 145 L100 162 L114 145 Z', '#e4e7f0')}${sp('M96 148 L104 148 L106 172 L100 180 L94 172 Z', '#3d7bff', 2)}
      ${chain(66, 146, 134, 198, 10)}
      ${sp(CLOUD, G('kg-cloud'))}
      <g clip-path="url(#kg-clip)">${el(140, 130, 80, 44, '#0f1430', 'opacity=".45"')}${el(70, 44, 30, 11, '#fff', `opacity=".14" ${rot(-20, 70, 44)}`)}</g>
      <g ${gl('#3d7bff')}>${sp('M72 32 L78 6 L91 24 L100 2 L109 24 L122 6 L128 32 Z', '#3d7bff', 4)}</g>${ci(100, 22, 3.5, '#fff')}
      ${el(78, 92, 12.5, 12.5, '#fff')}${el(122, 92, 12.5, 12.5, '#fff')}
      <g ${gl(CR)}>${ci(81, 96, 6.5, CR)}${ci(119, 96, 6.5, CR)}</g>${ci(83, 94, 2, '#fff')}${ci(121, 94, 2, '#fff')}
      ${fl('M63 76 L93 76 L93 95 L63 88 Z', '#626b94')}${fl('M107 76 L137 76 L137 88 L107 95 Z', '#56608a')}${ln('M63 88 L93 95 M137 88 L107 95', INK, 3.5)}
      ${ln('M60 74 L92 82 M140 74 L108 82', INK, 5)}
      ${ln('M82 116 Q102 124 120 108', INK, 4)}${fl('M103 119 l3 7 l3 -7 z', '#fff')}
      ${rim(0.5)}${vrim('#3d7bff', 'M50 128 Q100 142 150 128')}
      ${limb(73, 158, 44, 180, 8, '#252c4c')}
      ${ln('M32 198 V188 Q32 176 44 176 Q56 176 56 188 V198', L, 9)}${ln('M32 198 V188 Q32 176 44 176 Q56 176 56 188 V198', '#c9d2e8', 4.5)}
      ${sr(24, 194, 40, 32, 7, '#3d7bff', 4)}${ci(44, 207, 4.5, INK)}${fl('M41.5 209 h5 l1.5 9 h-8 z', INK)}
      ${fist(44, 178, '#8a93b8', '#4c557d')}` },
    zatsu: { box: [-8, 22, 218, 218], defs: grad('zt-blob', ['#f6d0dc', '#c98aa6', '#7a4566'], 40, 30, 170, 230) + clip('zt-clip', BLOB),
      body: () => `${se(100, 228, 98, 8, '#a8668a', 4)}
      <g ${gl('#ff3d9a')}><g transform="translate(184 40) scale(1.4)">${fl(STAR, '#ff3d9a')}</g><g transform="translate(200 66) scale(.8)">${fl(STAR, '#ff9ccb')}</g><g transform="translate(176 72) scale(.6)">${fl(STAR, '#ff3d9a')}</g></g>
      ${limb(150, 150, 178, 180, -10, '#b77796', 14)}${se(178, 182, 9, 9, '#b77796', 4)}
      ${sp(BLOB, G('zt-blob'))}
      <g clip-path="url(#zt-clip)">${el(150, 170, 70, 80, '#4a2040', 'opacity=".35"')}${el(64, 56, 30, 12, '#fff', `opacity=".35" ${rot(-26, 64, 56)}`)}${el(60, 170, 26, 40, '#7fe8ff', 'opacity=".12"')}${el(130, 120, 20, 30, '#ffe066', 'opacity=".1"')}
      ${fl('M56 150 q4 14 0 26 q-4 -12 0 -26 z M138 168 q5 16 0 30 q-5 -14 0 -30 z M98 190 q4 12 0 22 q-4 -10 0 -22 z', '#7a4566', 'opacity=".5"')}</g>
      ${ci(72, 88, 16, '#fff', `stroke="${L}" stroke-width="3"`)}${ci(128, 80, 9.5, '#fff', `stroke="${L}" stroke-width="3"`)}${ci(116, 110, 6, '#fff', `stroke="${L}" stroke-width="2.5"`)}
      <g ${gl(CR)}>${ci(75, 91, 8, CR)}${ci(126, 82, 4.6, CR)}${ci(119, 112, 3, CR)}</g>${ci(78, 86, 3, '#fff')}${ci(128, 79, 1.6, '#fff')}
      ${ln('M52 64 L90 72', INK, 5)}${ln('M118 66 L142 60', INK, 4)}
      ${sp('M52 124 Q100 156 152 118 Q100 138 52 124 Z', '#3a1030', 3)}${ln('M60 128 Q100 146 144 123', '#fff', 4, 'stroke-dasharray="4 2.5"')}
      ${rim(0.5)}${vrim('#ff3d9a', 'M40 196 Q100 214 160 196')}
      ${limb(46, 142, 14, 112, -10, '#e8b0c4', 14)}${sixFingers(12, 108)}` },
    kemuri: { box: [-2, -18, 204, 258], defs: grad('ek-helm', ['#4e2c58', '#25122c', '#0c0510']) + TG('ek-body', ['#3a2040', '#1f0f26', '#0c0510']) + grad('ek-cape', ['#8a1a2e', '#3e0812', '#1a0207'], 40, 140, 160, 236) + clip('ek-clip', HELM),
      body: () => `${sp('M50 150 Q22 196 2 234 L198 234 Q178 196 150 150 Z', G('ek-cape'))}${ln('M6 231 L194 231', CR, 2.2, GLOW)}
      ${sp('M46 54 Q10 42 2 -14 Q30 16 62 34 Z', '#d9b26a', 5)}${sp('M154 54 Q190 42 198 -14 Q170 16 138 34 Z', '#b8913f', 5)}
      ${limb(130, 158, 152, 194, -9, '#1f0f26', 16)}${fist(152, 195, '#3a2040', '#1f0f26', 10.5)}
      ${leg(110, 198, 115, 222, '#1f0f26', 19)}${leg(90, 198, 85, 222, '#2e1736', 19)}${shoe(115, 223, INK, 1.2)}${shoe(85, 223, INK, 1.2)}
      ${sp('M60 160 Q62 146 80 142 L120 142 Q138 146 140 160 L136 202 Q100 210 64 202 Z', G('ek-body'))}${fl('M114 143 L120 142 Q138 146 140 160 L136 202 Q126 206 114 207 Z', '#05020a', 'opacity=".5"')}
      ${ln('M64 192 Q100 200 136 192', '#d9b26a', 3)}${ln('M80 146 L84 186 M120 146 L116 186', '#d9b26a', 1.6, 'opacity=".7"')}
      ${se(100, 170, 12, 12, '#1a0207', 4)}<g ${gl(CR)}>${ci(100, 170, 8, 'none', `stroke="${CR}" stroke-width="3"`)}${ln('M93 177 L107 163', CR, 3)}</g>
      ${sp('M40 158 L60 140 L86 148 L80 168 L50 170 Z', '#2e1736', 4)}${sp('M48 148 L32 126 L60 142 Z', '#d9b26a', 3)}${sp('M160 158 L140 140 L114 148 L120 168 L150 170 Z', '#25122c', 4)}${sp('M152 148 L168 126 L140 142 Z', '#b8913f', 3)}
      ${sp(HELM, G('ek-helm'))}${shade('ek-clip', '#05020a', 0.45)}
      ${ln('M44 62 Q100 40 156 62', '#d9b26a', 2)}
      <g ${gl(CR)}>${sp('M100 26 L108 40 L100 54 L92 40 Z', CR, 3)}</g>${ci(98, 36, 2, '#fff')}
      ${sp('M48 82 Q100 72 152 82 L146 128 Q100 144 54 128 Z', '#160a1a', 4)}
      <g ${gl(CR)}>${fl('M54 94 L146 94 L138 107 L62 107 Z', CR)}</g>${ln('M64 98 H136', '#fff', 1.5, 'opacity=".7"')}
      ${ln('M56 90 L90 96 M144 90 L110 96', '#d9b26a', 2.5)}${ln('M86 120 H114 M90 127 H110', '#d9b26a', 2.4)}
      ${rim(0.45)}${vrim(CR, 'M50 138 Q100 158 150 138')}
      ${ln('M36 238 L20 98', L, 10)}${ln('M36 238 L20 98', '#d9b26a', 5)}
      ${ln('M8 100 Q0 84 10 70 M30 98 Q38 84 30 70', L, 7)}${ln('M8 100 Q0 84 10 70 M30 98 Q38 84 30 70', '#d9b26a', 3)}
      ${se(19, 84, 12, 12, '#1a0207', 4)}<g ${gl(CR)}>${ci(19, 84, 7.5, 'none', `stroke="${CR}" stroke-width="3"`)}${ln('M13 90 L25 78', CR, 3)}</g>
      ${limb(70, 158, 30, 182, 8, '#3a2040', 16)}${fist(30, 182, '#3a2040', '#1f0f26', 10.5)}` },
  };
  const KINDS = ['bazu', 'fukusei', 'bagu', 'kusarigumo', 'zatsu', 'kemuri'];
  // sizes baked (CSS px); device px = × the screen's pixel ratio (≤ 2). The big one feeds rogueURL().
  const RSIZE = [48, 128];
  const RG = {};
  let rogueState = 0;   // 0 not started · 1 baking · 2 done
  const domDPR = () => clamp(window.devicePixelRatio || 1, 1, 2);
  // each sprite carries a faint halo in its own neon, so a dark rogue still reads on a dark sheet at 32 px
  function rogueSVG(kind, px) {
    const A = ROGUE_ART[kind], b = A.box, side = Math.max(b[2], b[3]) / 0.9, sig = (ROGUE(kind) || {}).sig || '#ff2340';
    const vb = { x: n1(b[0] + b[2] / 2 - side / 2), y: n1(b[1] + b[3] / 2 - side / 2), w: n1(side), h: n1(side) };
    const halo = `<filter id="halo" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="3" result="d"/><feGaussianBlur in="d" stdDeviation="6" result="b"/><feFlood flood-color="${sig}" flood-opacity=".5"/><feComposite in2="b" operator="in"/></filter>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${px}" height="${px}"><defs>${GLOWF}${halo}${A.defs}<g id="rg">${A.body()}</g></defs><use xlink:href="#rg" filter="url(#halo)"/><use xlink:href="#rg"/></svg>`;
    return { svg, side: vb.w };
  }
  function bakeRogues() {
    if (rogueState) return;
    rogueState = 1;
    const jobs = [];
    for (const kind of KINDS) for (const cs of RSIZE) jobs.push([kind, cs]);
    let left = jobs.length;
    // two decodes at a time, each pair started in an idle slot
    const one = () => {
      const j = jobs.shift(); if (!j) return;
      const [kind, cs] = j, px = Math.round(cs * domDPR());
      const fin = () => { if (--left === 0) { rogueState = 2; BUS.emit('rogues:ready', { kinds: KINDS.slice() }); idle(urls); } else idle(one); };
      let r;
      try { r = rogueSVG(kind, px); } catch (e) { reportErr('Patch.rogue:' + kind, e); fin(); return; }
      svgCanvas(r.svg, r.side, r.side, px / r.side).then((cv) => { (RG[kind] || (RG[kind] = { c: {}, url: null })).c[cs] = cv; fin(); });
    };
    one(); idle(one);
  }
  // the data URLs, one per idle slot (toDataURL is synchronous and not free on an old phone)
  function urls() { const k = KINDS.find((x) => RG[x] && !RG[x].url); if (!k) return; rogueURL(k); idle(urls); }
  const idle = (fn) => { if (window.requestIdleCallback) requestIdleCallback(() => fn(), { timeout: 600 }); else setTimeout(fn, 40); };
  function rogue(kind, cssPx) {
    const R = RG[kind]; if (!R) { if (!rogueState && ROGUE_ART[kind]) bakeRogues(); return null; }
    if (cssPx && cssPx <= RSIZE[0] && R.c[RSIZE[0]]) return R.c[RSIZE[0]];
    return R.c[RSIZE[1]] || R.c[RSIZE[0]] || null;
  }
  function rogueURL(kind) {
    const R = RG[kind]; if (!R) { if (!rogueState && ROGUE_ART[kind]) bakeRogues(); return null; }
    if (R.url) return R.url;
    const cv = R.c[RSIZE[1]] || R.c[RSIZE[0]]; if (!cv) return null;
    try { R.url = cv.toDataURL('image/png'); } catch (e) { reportErr('Patch.rogueURL', e); }
    return R.url;
  }

  // ───────── boot: bake what the first frames need at the size the Scene draws her ─────────
  let ready = false, wantBi = -1, bakeWait = null;
  function coreAt(bi) { return Promise.all(CORE.map((Ly) => request(Ly, bi, true))); }
  function warm(bi) {
    // after the core: every face part, the props and the hoodie at this size, quietly
    const all = [GLS_HI, KEYS, MUG, ZZZ, SPARK, WHITES.w, PUPILS[7], PUPILS[6]].concat(Object.values(LIDS), Object.values(BROWS), Object.values(MOUTHS));
    for (const Ly of all) request(Ly, bi, false);
    for (const id of hoodie) { const sl = SLOTS[hoodie.indexOf(id)]; request(badge(id), bucket(B[bi] * sl.r * 2 / 108 * 1.08), false); }
  }
  // the size she'll be drawn at: the Scene tells us on its first draw; until then, a guess from the layout
  function guessBi() {
    const room = Math.max(120, LAYOUT.deskY - LAYOUT.top.h);
    const size = LAYOUT.wide ? Math.min(560, room * 0.82) : Math.min(260, room * 0.9);
    return bucket(DPR * size / 245);
  }
  function bake() {
    wantBi = -1;
    return new Promise((res) => {
      let done = false;
      const go = (bi) => { if (done) return; done = true; bakeWait = null; wantBi = bi; coreAt(bi).then(() => { ready = true; res(); setTimeout(() => warm(bi), 30); }); };
      bakeWait = go;
      setTimeout(() => go(guessBi()), 250);   // no draw yet (the Scene still baking): go with the guess
    });
  }

  // ───────── dev views: ?dev=1&patchsheet=1 (every pose and face, the rogues) · =2 (rogues at 32–128 px) ─────────
  const SHEET_MODE = DEV ? +(QS.get('patchsheet') || 0) : 0;
  let devCv = null, devT = 0;
  const DEVS = { J: mkJ(), face: 'neutral', gx: 1, gy: 2, look: 0, blink: 1, mouth: '', t: 0, zdir: -1 };
  const DEVP = mkP();
  function devDraw(dt) {
    devT += dt;
    if (!devCv) {
      devCv = h('canvas', { style: { position: 'fixed', left: '0', top: '0', zIndex: '99', pointerEvents: 'none' } });
      document.body.appendChild(devCv);
    }
    const dpr = clamp(window.devicePixelRatio || 1, 1, 2), W = innerWidth, H = innerHeight;
    if (devCv.width !== Math.round(W * dpr) || devCv.height !== Math.round(H * dpr)) { devCv.width = Math.round(W * dpr); devCv.height = Math.round(H * dpr); devCv.style.width = W + 'px'; devCv.style.height = H + 'px'; }
    const c = devCv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#0c0f22'; c.fillRect(0, 0, W, H);
    c.font = `700 ${W > 900 ? 12 : 10}px ${FONT.mono}`; c.textBaseline = 'top';
    if (SHEET_MODE === 2) return devRogues(c, W, H, dpr);
    // &only=type,cheer,face:smirk,rogue:bagu picks cells; &cols=N sets the grid
    const only = (QS.get('only') || '').split(',').filter(Boolean);
    let cells = POSES.map((p) => ['pose', p]).concat(EXPRS.map((e) => ['expr', e]), KINDS.map((k) => ['rogue', k]));
    if (only.length) cells = only.map((o) => (o.indexOf('face:') === 0 ? ['expr', o.slice(5)] : o.indexOf('rogue:') === 0 ? ['rogue', o.slice(6)] : ['pose', o]));
    const cols = +QS.get('cols') || (W > 1000 ? 7 : W > 700 ? 6 : 4), rows = Math.ceil(cells.length / cols), cw = W / cols, ch = (H - 8) / rows;
    cells.forEach(([kind, name], i) => {
      const x = (i % cols) * cw, y = 8 + Math.floor(i / cols) * ch;
      c.fillStyle = kind === 'rogue' ? '#1a1428' : '#151a35'; c.fillRect(x + 2, y + 2, cw - 4, ch - 4);
      if (kind === 'rogue') {
        const cv = rogue(name), sz = Math.min(cw, ch) * 0.78;
        if (cv) c.drawImage(cv, x + cw / 2 - sz / 2, y + ch / 2 - sz / 2 + 4, sz, sz);
      } else {
        const deskY = y + ch * 0.86, size = Math.min(ch * 0.82 * 245 / 206, cw * 1.05 * 245 / 200);
        const pose = kind === 'pose' ? name : 'idle';
        DEVP.nd = ND; DEVP.zdir = -1; DEVP.zel = -0.4; DEVP.fx = Math.sin(devT * 9) * 3; DEVP.fp = Math.max(0, Math.sin(devT * 13)); DEVP.bx = Math.cos(devT * 8) * 3; DEVP.bp = Math.max(0, Math.sin(devT * 11 + 1));
        DEVP.amp = 1; DEVP.calm = false; DEVP.breath = ''; DEVP.sip = 0; DEVP.desk = 0;
        const f = poseOf(pose, SHOT[pose] ? 0.05 + devT % SHOT[pose][0] : 0.6 + (devT % 6), devT, DEVS.J, DEVP);
        DEVS.face = kind === 'expr' ? name : f;
        const E = EXPR[DEVS.face], st = EYES[E.eyes];
        DEVS.gx = st && st.gx !== undefined ? st.gx : 1; DEVS.gy = st && st.gy !== undefined ? st.gy : 2; DEVS.look = 0; DEVS.blink = blinkK(devT + i * 0.7, i * 0.37); DEVS.mouth = ''; DEVS.t = devT;
        c.save(); c.beginPath(); c.rect(x + 2, y + 2, cw - 4, ch - 4); c.clip();
        paint(c, x + cw / 2, deskY, size / 245, dpr, DEVS, 0);
        c.fillStyle = '#5b3a2c'; c.fillRect(x + 2, deskY, cw - 4, y + ch - deskY);
        c.fillStyle = '#7a5038'; c.fillRect(x + 2, deskY, cw - 4, 3);
        c.restore();
      }
      c.fillStyle = kind === 'rogue' ? '#ff6b7f' : kind === 'expr' ? '#ffb35c' : '#3dffc2';
      c.fillText((kind === 'expr' ? 'face ' : kind === 'rogue' ? 'rogue ' : '') + name, x + 8, y + 7);
    });
  }
  function devRogues(c, W, H) {
    // two bands side by side (the night sheet, the day sheet); each row: 32 48 64 96 128 px
    const sizes = [32, 48, 64, 96, 128], half = W / 2, rh = (H - 16) / 6, k = Math.min(1, rh / 136, (half - 20) / 420);
    for (let band = 0; band < 2; band++) {
      c.fillStyle = band ? '#f4efe6' : '#151a35'; c.fillRect(band * half, 0, half, H);
      KINDS.forEach((kind, r) => {
        let x = band * half + 10; const y = 8 + r * rh;
        for (const s0 of sizes) { const s = s0 * k, cv = rogue(kind, s); if (cv) c.drawImage(cv, x, y + (rh - s) / 2, s, s); x += s + 8; }
        c.fillStyle = band ? '#1a1b2e' : '#9aa3cf'; c.fillText(kind, band * half + 10, y);
      });
    }
  }

  // ───────── the hooks ─────────
  function init() {
    CSS('patch', CSS_TEXT);
    G32 = glowOf(PAL.mintRGB, 32, 0.6); G64 = glowOf(PAL.mintRGB, 64, 0.55); G64b = glowOf(PAL.mintRGB, 64, 0.5);
    buildBubble();
    readHoodie();
    // any input resets the doze clock (and wakes her, gently)
    addEventListener('pointerdown', (e) => { onInput(); PTR.down = true; onPtrMove(e); }, { capture: true, passive: true });
    addEventListener('pointerup', () => { PTR.down = false; }, { capture: true, passive: true });
    addEventListener('pointercancel', () => { PTR.down = false; }, { capture: true, passive: true });
    addEventListener('pointermove', onPtrMove, { capture: true, passive: true });
    addEventListener('keydown', onInput, { capture: true, passive: true });
    BUS.on('ready', () => { onReady(); setTimeout(() => idle(bakeRogues), 400); });
    BUS.on('onboard:done', () => { setPose('wave'); later(0.3, () => { sayLine('greet_first', null, { hi: true }); migratedLine(); }); });
    BUS.on('timer:start', onStart);
    BUS.on('timer:pause', () => { if (TIMER.mode !== 'focus') return; pauseT = T; later(1.6, () => { if (TIMER.state === 'paused' && pauseT && T - pauseT >= 1.5) sayLine('pause'); }); });
    BUS.on('timer:resume', () => { pauseT = 0; });
    BUS.on('timer:reset', (p) => { pauseT = 0; if (p.abandoned) { setFace('warm', 2); later(0.3, () => sayLine('reset')); } flushDeferred(2); });
    BUS.on('timer:skip', (p) => { if (p.from !== 'focus' && p.to === 'focus') later(0.3, () => sayLine('skip_break')); flushDeferred(1.5); });
    BUS.on('timer:done', onDone);
    BUS.on('timer:wind', onWind);
    // the harvest: mid-cheer she opens her eyes to watch the ripe tomato fly to her plant
    BUS.on('harvest', (p) => {
      try {
        const pl = typeof Scene !== 'undefined' && Scene.plant ? Scene.plant() : null;
        if (p && p.x != null) lookAt(p.x, p.y, 0.3);
        if (pl) later(0.18, () => { setFace('warm', 1.1); lookAt(pl.x, pl.y, 1.1); });
      } catch (e) {}
    });
    BUS.on('rogue:capture', onCapture);
    BUS.on('activity', onActivity);
    BUS.on('activity:step', onStep);
    BUS.on('scene:tap', onTap);
    BUS.on('task:change', onTask);
    BUS.on('patch:unlock', onUnlock);
    BUS.on('session:rated', onRated);
    BUS.on('focusmode', (p) => { if (p.on) sayLine('focusmode_on', null, { react: true }); });
    // a line on request; during a break activity it's part of the game you're playing, so it comes at once
    BUS.on('patch:say', (p) => { if (!p) return; const o = { ms: p.ms, force: !!p.force, react: p.react !== undefined ? !!p.react : !!act.id }; if (p.text) say(p.text, o); else if (p.key) sayLine(p.key, p.vars, o); });
    BUS.on('hoodie', onHoodie);
    BUS.on('data', () => { readHoodie(); rebakeHoodie(); rmNow = RM(); });
    rmNow = RM();
    try { RMQ.addEventListener('change', () => { rmNow = RM(); }); } catch (e) {}
    BUS.on('settings', (p) => { if ((p.key === 'talk' || !p.key) && !PREFS.talk) clearTalk(); if (p.key === 'motion' || !p.key) rmNow = RM(); });
    BUS.on('ui:sheet', (p) => { if (p.id === 'capture') { lookRig(0, 0.3, 2); setFace('think', 1.6); } else if (p.id === 'patches') lookRig(0.5, 4.4, 1.6); });
    BUS.on('layout', () => { if (bubOn) placeBubble(true); });
  }
  function update(dt) {
    T += dt; FRAME++;
    if ((FRAME & 127) === 0) evict();
    laterTick();
    windTick();
    idleTick();
    fidgetTick();
    beatTick(dt);
    PL.amp = rmNow ? 0.2 : 1; PL.sip = shot === 'sip' ? 3.3 : 0; PL.desk = focusRunning() && !act.id ? 1 : 0;
    if (act.breath) { PL.breath = act.breath; PL.bt = T - act.bt0; } else { PL.breath = ''; }
    // the pose: a one-shot over the base pose, eased from wherever she was
    if (shot && !shotHold && T >= shotUntil) shot = null;
    const want = shot || basePose();
    if (want !== cur) switchTo(want);
    typeTick(dt);
    poseFace = poseOf(cur, T - poseT0, T, JT, PL);
    if (FRAME === 1) { blendK = 1; face = faceWant = poseFace; }   // the first frame: no blend from an empty record
    blendStep(dt);
    faceTick();
    gazeTick(dt);
    if (spark > 0) spark = Math.max(0, spark - dt / 1.8);
    LIVE.J = JS; LIVE.face = face; LIVE.gx = gx; LIVE.gy = gy; LIVE.look = look; LIVE.blink = blinkK(T, 0.3); LIVE.t = T; LIVE.zdir = PL.zdir;
    const E = EXPR[face] || EXPR.neutral;
    LIVE.mouth = mouthNow(E);
    bubbleTick();
    if (SHEET_MODE) devDraw(dt);
  }
  // draw Patch: (x, y) = the desk's back edge under her centre (CSS px), size = her full standing height (CSS px)
  // the contract says the Scene hands us (DPR, 0, 0, DPR, 0, 0); check that now and then (getTransform allocates),
  // and if it ever isn't so, read it every frame and draw under it
  const BM = new Float64Array(6);
  let bmMode = false, bmCheck = 0;
  function draw(c, x, y, size, opts) {
    if (!(size > 1)) return;
    const s = size / 245;
    let dev = DPR, bm = null;
    if (c !== ctx || bmMode || (++bmCheck % 30) === 1) {
      try {
        const m = c.getTransform(), plain = Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6 && Math.abs(m.a - m.d) < 1e-6 && Math.abs(m.e) < 1e-6 && Math.abs(m.f) < 1e-6;
        if (c === ctx) bmMode = !plain || Math.abs(m.a - DPR) > 1e-6;
        dev = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || DPR;
        if (!plain) { BM[0] = m.a; BM[1] = m.b; BM[2] = m.c; BM[3] = m.d; BM[4] = m.e; BM[5] = m.f; bm = BM; }
      } catch (e) { dev = DPR; }
    }
    lastX = x; lastY = y; lastS = s; lastDev = dev; lastBi = bucket(dev * s);
    if (bakeWait) bakeWait(lastBi);
    else if (wantBi !== lastBi) { wantBi = lastBi; coreAt(lastBi).then(() => warm(lastBi)); }
    const dim = opts && opts.dim ? (opts.dim === true ? 1 : clamp(+opts.dim || 0, 0, 1)) : 0;
    try { paint(c, x, y, s, dev, LIVE, dim, bm); } catch (e) { reportErr('Patch.draw', e); }
  }
  // screen points (CSS px) from the last draw
  function toScreen(rx, ry) { return { x: lastX + (rx - 100) * lastS, y: lastY + (ry - DESK) * lastS }; }
  function anchor() { const H = headBox(); return { x: Math.round(H.cx), y: Math.round(H.top - 4) }; }
  function hand() {
    // the zapping hand while she zaps (its target, so a beam started on the capture event aims right), else her front hand
    if (cur === 'zap' || shot === 'zap') {
      const d = PL.zdir, sx = d < 0 ? 73 : 127, rx = sx + d * Math.cos(PL.zel) * ZAP_REACH + d * 2 + d * 4.5, ry = 154 + Math.sin(PL.zel) * ZAP_REACH - 1 + d * 1.5;
      return toScreen(rx, ry);
    }
    return toScreen(AF.hx, AF.hy);
  }
  function hit(x, y) {
    if (!(lastS > 0)) return false;
    const s = lastS, hx = lastX + (JS.bx + JS.hx) * s, hy = lastY + (78 - DESK + JS.by + JS.hy) * s;
    const dx = (x - hx) / (90 * s), dy = (y - hy) / (86 * s);
    if (dx * dx + dy * dy <= 1) return true;
    return x >= lastX + (62 - 100 + JS.bx) * s && x <= lastX + (138 - 100 + JS.bx) * s && y >= lastY + (138 - DESK + JS.by) * s && y <= lastY;
  }

  return {
    get ready() { return ready; },
    init, bake, update, draw,
    layout() { if (bubOn) placeBubble(true); },
    say: (text, o) => say(text, o),
    sayLine: (key, vars, o) => sayLine(key, vars, o),
    pose: (name, o) => setPose(name, o),
    face: (name, o) => setFace(name, o && o.ms ? o.ms / 1000 : 1.5),
    lookAt: (x, y, o) => lookAt(x, y, o && o.ms ? o.ms / 1000 : 1.2),
    anchor, hand, hit, rogue, rogueURL,
    get kinds() { return KINDS.slice(); },
    get state() { return { pose: cur, base: basePose(), face, talking: bubOn, dozing, ready }; },
    get bakes() { let n = 0; for (const Ly of LAYERS) for (let i = 0; i < NB; i++) if (Ly.canv[i]) n++; return { canvases: n, px: totalPx, mb: +(totalPx * 4 / 1048576).toFixed(1), rogues: rogueState === 2 }; },
  };
})();

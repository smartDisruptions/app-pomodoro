// ───────────────────────────── 45. Scene: Patch's room above the Neo Dojo city ─────────────────────────────
// The whole #scene canvas, every frame (CONTRACT.md §8.4; the look: DESIGN.md §2–5). Back to front: the city through
// a steel loft window (a sky that follows the real clock, a layered skyline with neon, the Neo Dojo pagoda, rooftop
// tanks, an elevated line; rain on the glass), the room (wall, sill with the tomato plant and the quarantine jar),
// Patch's three holo-terminals, Patch herself (clipped at the desk line), the desk (lamp pool, mint spill, the
// tomato's contact shadow) with its props (lamp, radio, mug), and the moments (confetti, the harvest flight, the
// capture, sparkles, lightning).
//
// How it stays inside 2 ms a frame on an old phone: everything static is painted once per bake() at the canvas DPR.
// CITY (the skyline on a clear sky) + the sky make OUTSIDE; ROOM is the wall, window frame, sill, pot and desk with all
// their light, the glass left clear; FIN = OUTSIDE under ROOM, one opaque canvas blitted 1:1 each frame. A frame then
// draws only what moves, all from baked sprites: the city's lights, rain and drops (clipped to the panes), the
// garland, the plant (one sheared blit), the jar and its blobs, three screens (baked text, scrolled), Patch, the
// props, and pooled particles in typed arrays. No gradients, text, filters, allocations or closures per frame. The sky
// drifts with the clock: OUTSIDE is repainted off-frame every couple of minutes and stitched into FIN's window.
const Scene = (() => {
  // ═════════════════════════════ tools (bake time) ═════════════════════════════
  const MINT = PAL.mint, OUTL = PAL.line;
  const JP = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", Meiryo, ' + FONT.body;
  const yieldF = () => new Promise((r) => setTimeout(r, 0));
  const hexc = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a === undefined ? 1 : +(+a).toFixed(3)})`;
  const mixh = (a, b, t, al) => css(mixc(hexc(a), hexc(b), t), al);

  function lin(g, x0, y0, x1, y1, st) { const gr = g.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i < st.length; i += 2) gr.addColorStop(clamp(st[i], 0, 1), st[i + 1]); return gr; }
  function rad(g, x, y, r0, r1, st) { const gr = g.createRadialGradient(x, y, r0, x, y, Math.max(r0 + 0.01, r1)); for (let i = 0; i < st.length; i += 2) gr.addColorStop(clamp(st[i], 0, 1), st[i + 1]); return gr; }
  function rrp(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
  function frr(g, x, y, w, h, r, f) { rrp(g, x, y, w, h, r); g.fillStyle = f; g.fill(); }
  function srr(g, x, y, w, h, r, s, lw) { rrp(g, x, y, w, h, r); g.strokeStyle = s; g.lineWidth = lw; g.stroke(); }
  function fr(g, x, y, w, h, f) { g.fillStyle = f; g.fillRect(x, y, w, h); }
  function fe(g, x, y, rx, ry, f, rot) { g.beginPath(); g.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU); g.fillStyle = f; g.fill(); }
  function fc(g, x, y, r, f) { fe(g, x, y, r, r, f); }
  function fp(g, p, f) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.closePath(); g.fillStyle = f; g.fill(); }
  function sp(g, p, s, lw) { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.strokeStyle = s; g.lineWidth = lw; g.stroke(); }
  function glow(g, x, y, rx, ry, rgb, a, core) { const s = glowOf(rgb, 64, core === undefined ? 0.45 : core), o = g.globalCompositeOperation, a0 = g.globalAlpha; g.globalCompositeOperation = 'lighter'; g.globalAlpha = a0 * a; g.drawImage(s, x - rx, y - ry, rx * 2, ry * 2); g.globalCompositeOperation = o; g.globalAlpha = a0; }
  // the font size at which s fits in maxW (never bigger than size)
  function fitSize(g, s, maxW, size, font, weight) { g.font = `${weight || 700} ${size}px ${font}`; const w = g.measureText(s).width; return w > maxW ? size * maxW / w : size; }
  function txt(g, s, x, y, size, font, f, align, base, weight) { g.font = `${weight || 700} ${size}px ${font}`; g.textAlign = align || 'left'; g.textBaseline = base || 'middle'; g.fillStyle = f; g.fillText(s, x, y); }
  // an elliptical soft shadow (radial gradient squashed vertically)
  function shadowE(g, x, y, rx, ry, a) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rad(g, 0, 0, 0, rx, [0, `rgba(0,0,0,${a})`, 0.55, `rgba(0,0,0,${a * 0.55})`, 1, 'rgba(0,0,0,0)']); g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore(); }
  // a canvas covering the CSS rect (x, y, w, h) at the canvas DPR; its context paints in CSS px (absolute coords)
  function layer(x, y, w, h, dpr) {
    dpr = dpr || DPR;
    const x0 = Math.floor(x * dpr) / dpr, y0 = Math.floor(y * dpr) / dpr;
    const c = makeCanvas(Math.ceil((x + w - x0) * dpr) + 1, Math.ceil((y + h - y0) * dpr) + 1), g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr); g.lineCap = 'round'; g.lineJoin = 'round';
    return { c, g, x: x0, y: y0, w: c.width / dpr, h: c.height / dpr };
  }
  const blit = (c, L) => c.drawImage(L.c, L.x, L.y, L.w, L.h);
  // a dark silhouette of a sprite (heads-down dims a prop by drawing this over it)
  function twin(L, col) { const c = makeCanvas(L.c.width, L.c.height), g = c.getContext('2d'); g.drawImage(L.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col || '#04050e'; g.fillRect(0, 0, c.width, c.height); return { c, x: L.x, y: L.y, w: L.w, h: L.h }; }
  // shade a finished prop by the room's light: warm from the lamp on one side, cool shadow on the other
  function lightProp(L, prt, lampLeft) {
    const g = L.g, x0 = L.x, x1 = L.x + L.w, night = prt !== 'day';
    g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = lin(g, lampLeft ? x0 : x1, 0, lampLeft ? x1 : x0, 0, night ? [0, 'rgba(255,170,90,0.10)', 0.45, 'rgba(255,170,90,0)', 0.6, 'rgba(10,12,40,0)', 1, 'rgba(10,12,40,0.38)'] : [0, 'rgba(255,240,220,0.06)', 0.6, 'rgba(30,40,80,0)', 1, 'rgba(30,40,80,0.16)']);
    g.fillRect(L.x, L.y, L.w, L.h);
    if (prt === 'night' || prt === 'dusk') { g.fillStyle = 'rgba(20,22,60,0.14)'; g.fillRect(L.x, L.y, L.w, L.h); }
    g.restore();
  }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ═════════════════════════════ the day's light ═════════════════════════════
  // sky stops, top → horizon (spread over the visible glass so the warm band shows above the skyline)
  const SKY = {
    night: ['#050816', '#0d1442', '#271e5a', '#4c2a6a'],
    dawn: ['#223068', '#655aa0', '#e5849a', '#ffc694'],
    day: ['#3a80d4', '#5fa6e4', '#a2cdf0', '#d6ebf7'],
    dusk: ['#16184c', '#523689', '#d85b77', '#ffa25f'],
  };
  const SKY_RAIN = {
    night: ['#080b1c', '#121935', '#1d2242', '#2a2a4a'],
    dawn: ['#2b3152', '#4f5276', '#776d88', '#928599'],
    day: ['#5d6f8f', '#7586a3', '#94a2ba', '#aab5c8'],
    dusk: ['#1d1e40', '#383356', '#58465f', '#715568'],
  };
  const SKY_KEYS = [[0, 'night'], [4.6, 'night'], [6.2, 'dawn'], [8.4, 'day'], [16.6, 'day'], [19.0, 'dusk'], [21.3, 'night'], [24, 'night']];
  function skyAt(hr, rain) {
    let i = 0; while (i < SKY_KEYS.length - 2 && hr >= SKY_KEYS[i + 1][0]) i++;
    const [h0, a] = SKY_KEYS[i], [h1, b] = SKY_KEYS[i + 1], t = smooth((hr - h0) / (h1 - h0 || 1));
    const S = rain ? SKY_RAIN : SKY, A = S[a], Bc = S[b];
    return A.map((c, j) => mixc(hexc(c), hexc(Bc[j]), t));
  }
  // what the sky holds at this hour: stars, moon, the sun's path across the window (sp 0..1, el = elevation)
  function skyVis(hr) {
    const stars = hr < 4.6 ? 1 : hr < 6.6 ? 1 - smooth((hr - 4.6) / 2) : hr < 18.8 ? 0 : hr < 21 ? smooth((hr - 18.8) / 2.2) : 1;
    const moon = hr < 5.4 ? 1 : hr < 7 ? 1 - smooth((hr - 5.4) / 1.6) : hr < 18.4 ? 0 : hr < 20 ? smooth((hr - 18.4) / 1.6) : 1;
    const s = (hr - 5.5) / (19.9 - 5.5), sun = s <= 0 || s >= 1 ? 0 : Math.min(1, Math.sin(s * Math.PI) * 4);
    return { stars, moon, sun, sp: clamp(s, 0, 1), el: Math.max(0, Math.sin(clamp(s, 0, 1) * Math.PI)) };
  }
  // the city: silhouettes, rim light, how many windows are lit, how bright the neon is
  const CITYP = {
    night: { far: '#1a1e4c', far2: '#262c66', mid: '#11143a', mid2: '#1d2254', near: '#080a1c', near2: '#131834', rim: 'rgba(169,188,255,0.32)', win: 0.3, winA: 0.95, unlit: '#1b2050', neon: 1, haze: [255, 80, 170], hazeA: 0.24, tank: '#1a1d3e' },
    dawn: { far: '#6a5c98', far2: '#857ab0', mid: '#41386c', mid2: '#56508a', near: '#221c40', near2: '#332c58', rim: 'rgba(255,214,190,0.5)', win: 0.1, winA: 0.7, unlit: '#4a4478', neon: 0.5, haze: [255, 170, 150], hazeA: 0.26, tank: '#3d3462' },
    day: { far: '#9cb3d6', far2: '#b3c6e2', mid: '#6f84ae', mid2: '#8a9dc2', near: '#46557e', near2: '#5b6b95', rim: 'rgba(255,255,255,0.55)', win: 0, winA: 0, unlit: '#a8c6e8', neon: 0.12, haze: [235, 245, 255], hazeA: 0.34, tank: '#6b6f8e' },
    dusk: { far: '#4b346f', far2: '#5e4486', mid: '#2d2251', mid2: '#3b2e66', near: '#160e2e', near2: '#231a42', rim: 'rgba(255,170,130,0.5)', win: 0.24, winA: 0.95, unlit: '#382d5e', neon: 1, haze: [255, 120, 110], hazeA: 0.26, tank: '#2c2148' },
  };
  // the room: wall, steel frame, sill; how strong the lamp reads; the window's light colour
  const ROOMP = {
    night: { wall: ['#1c2150', '#121534'], frame: '#0a0d22', frame2: '#151a3a', hi: 'rgba(169,188,255,0.5)', sill: ['#3b3054', '#221a34'], lamp: 1, cool: [169, 188, 255], glaze: 0.05 },
    dawn: { wall: ['#33315f', '#1f1f44'], frame: '#121434', frame2: '#1c1f48', hi: 'rgba(255,205,190,0.55)', sill: ['#4b3e60', '#2a2240'], lamp: 0.75, cool: [255, 200, 190], glaze: 0.06 },
    day: { wall: ['#58659a', '#3d4874'], frame: '#1a2049', frame2: '#273062', hi: 'rgba(255,255,255,0.6)', sill: ['#6c5c72', '#43384f'], lamp: 0.45, cool: [230, 240, 255], glaze: 0.08 },
    dusk: { wall: ['#2d2556', '#1a1638'], frame: '#0e0c26', frame2: '#1a1640', hi: 'rgba(255,175,140,0.55)', sill: ['#44355b', '#251c38'], lamp: 0.95, cool: [255, 170, 140], glaze: 0.05 },
  };
  // the desk follows the chrome theme, so the Dial's text always reads on it
  const DESKP = {
    night: { wood: ['#33264a', '#1f172f', '#130e1f'], seam: 'rgba(4,3,10,0.5)', seamHi: 'rgba(255,220,180,0.05)', grain: 'rgba(255,214,180,0.045)', mat: ['#1d2250', '#141838'], matEdge: 'rgba(169,188,255,0.18)', stitch: 'rgba(169,188,255,0.26)', edgeHi: 'rgba(169,188,255,0.5)', pool: 0.28, vign: 0.5, col: ['#151a3c', '#0b0e25'], slat: 'rgba(0,0,0,0.28)', slatHi: 'rgba(169,188,255,0.05)' },
    day: { wood: ['#e7d5b6', '#d6bf99', '#c3a67d'], seam: 'rgba(90,60,30,0.22)', seamHi: 'rgba(255,255,255,0.25)', grain: 'rgba(120,80,40,0.07)', mat: ['#f3ebde', '#e8ddcb'], matEdge: 'rgba(120,96,70,0.22)', stitch: 'rgba(120,100,80,0.32)', edgeHi: 'rgba(255,255,255,0.75)', pool: 0.12, vign: 0.12, col: ['#f0e8db', '#e2d8c7'], slat: 'rgba(120,100,70,0.12)', slatHi: 'rgba(255,255,255,0.4)' },
  };
  // the city's neon (never mint: that's Patch's)
  const NEONS = [[255, 95, 168], [95, 230, 255], [255, 179, 92], [157, 123, 255], [255, 84, 72]];
  const SIGNS = ['ラーメン', '珈琲', 'カラオケ', '電脳', '居酒屋', '書店'];
  const WINC = ['#ffd08a', '#ffc070', '#ffe6b8', '#cfe0ff', '#8fe0ff'];
  const winCol = (R) => { const r = R(); return r < 0.45 ? WINC[0] : r < 0.65 ? WINC[1] : r < 0.8 ? WINC[2] : r < 0.93 ? WINC[3] : WINC[4]; };
  const themeName = () => (document.documentElement.dataset.theme === 'day' ? 'day' : 'night');

  // ═════════════════════════════ geometry (CSS px), from LAYOUT ═════════════════════════════
  function computeGeom() {
    const Lx = LAYOUT, W = VW, H = VH, wide = !!Lx.wide, short = !!Lx.short, dpr = DPR;
    const snap = (v) => Math.round(v * dpr) / dpr;
    const st = Lx.stage, topH = Lx.top.h, deskY = snap(Lx.deskY);
    const R = { x: st.x, y: topH, w: st.w, h: Math.max(60, deskY - topH) };
    const u = clamp(Math.min(R.h / 300, R.w / 330), 0.6, 2.1);
    const g = { W, H, wide, short, R, u, deskY, topH, dpr, dial: Object.assign({}, Lx.dial), ui: Object.assign({}, Lx.ui) };
    // the window: a steel loft window; panes in columns with a transom near the top
    let wx0, wx1, wy0, sill;
    if (!wide) { wx0 = R.x + 7; wx1 = R.x + R.w - 7; wy0 = -20; sill = R.y + R.h * 0.78; }
    else if (short) { wx0 = R.x + 12; wx1 = R.x + R.w - 10; wy0 = -20; sill = R.y + R.h * 0.76; }
    else { wx0 = R.x + R.w * 0.05; wx1 = R.x + R.w * 0.95; wy0 = R.y + R.h * 0.05; sill = R.y + R.h * 0.76; }
    const ft = Math.round(4 + 3.2 * u), mw = Math.max(3, Math.round(1.2 + 2.2 * u));
    const WF = g.WF = { x: snap(wx0), y: snap(wy0), w: snap(wx1 - wx0), h: snap(sill) - snap(wy0) };
    g.sill = snap(sill); g.ft = ft; g.mw = mw;
    const GL = g.GL = { x: WF.x + ft, y: WF.y + ft, w: WF.w - 2 * ft, h: g.sill - WF.y - ft };
    g.vt = Math.max(GL.y, topH); g.vh = g.sill - g.vt;
    const nc = wide && !short ? 4 : 3, trY = snap(g.vt + g.vh * (wide && !short ? 0.2 : 0.15));
    g.trY = trY; g.bars = []; g.panes = [];
    const xs = [GL.x]; for (let i = 1; i < nc; i++) xs.push(snap(GL.x + GL.w * i / nc)); xs.push(GL.x + GL.w);
    for (let i = 1; i < nc; i++) g.bars.push({ x: xs[i] - mw / 2, y: GL.y, w: mw, h: GL.h });
    g.bars.push({ x: GL.x, y: trY - mw / 2, w: GL.w, h: mw });
    for (let i = 0; i < nc; i++) {
      const x0 = i ? xs[i] + mw / 2 : xs[i], x1 = i < nc - 1 ? xs[i + 1] - mw / 2 : xs[i + 1];
      g.panes.push({ x: x0, y: GL.y, w: x1 - x0, h: trY - mw / 2 - GL.y });
      g.panes.push({ x: x0, y: trY + mw / 2, w: x1 - x0, h: GL.y + GL.h - trY - mw / 2 });
    }
    // Patch: centred in the stage, as big as the room allows with her head clear of the top bar
    const px = snap(R.x + R.w / 2);
    let size = !wide ? R.h * 0.87 : short ? R.h * 0.97 : R.h * 0.88;
    size = Math.min(size, (deskY - topH - 8) / 0.88, R.w * 0.95);
    g.patch = { x: px, y: deskY, size };
    const S = size;
    // her three holo-terminals: the editor left of her head, status + a mini clock stacked on the right
    const ed = { w: S * 0.35, h: S * 0.25, sk: 0.07 }; ed.x = px - S * 0.27 - ed.w; ed.y = deskY - S * 0.9;
    if (ed.x < GL.x + 5) { ed.w -= GL.x + 5 - ed.x; ed.x = GL.x + 5; }
    const sc = { w: S * 0.33, h: S * 0.16, sk: -0.06 }; sc.x = px + S * 0.27; sc.y = deskY - S * 0.93;
    if (sc.x + sc.w > GL.x + GL.w - 5) sc.w = GL.x + GL.w - 5 - sc.x;
    const mi = { w: sc.w * 0.74, h: S * 0.11, sk: -0.06 }; mi.x = sc.x + sc.w * 0.14; mi.y = sc.y + sc.h + S * 0.03;
    for (const s of [ed, sc, mi]) { s.x = snap(s.x); s.y = snap(s.y); s.w = Math.round(s.w); s.h = Math.round(s.h); }
    g.scr = { ed, st: sc, mi };
    g.fs = clamp(S * 0.027, 6.2, 12.5);   // the screens' text size
    // the sill: plant left, jar right; the desk: lamp and mug left, radio right
    g.plant = { x: snap(GL.x + GL.w * (wide && !short ? 0.12 : 0.15)), y: g.sill };
    g.potH = Math.round(20 * u); g.potW = Math.round(28 * u);
    const pTop = (g.plant.x + 32 * u > ed.x && g.plant.x - 32 * u < ed.x + ed.w) ? ed.y + ed.h + 5 : g.sill - R.h * 0.44;
    g.plantH = clamp(g.sill - g.potH - pTop, 34 * u, 130 * u);
    g.stem = { x: g.plant.x, y: g.sill - g.potH + 1 };
    g.jar = { x: snap(GL.x + GL.w * (wide && !short ? 0.885 : 0.85)), y: g.sill, w: Math.round(40 * u), h: Math.round(54 * u) };
    g.lamp = { x: snap(R.x + R.w * (wide ? 0.085 : 0.075)), y: snap(deskY + 22 * u) };
    g.radio = { x: snap(R.x + R.w * (wide ? 0.87 : 0.85)), y: snap(deskY + 30 * u) };
    g.mug = { x: snap(R.x + R.w * (wide ? 0.215 : 0.2)), y: snap(deskY + (wide ? 74 : 60) * u) };
    if (!wide) { const d = g.dial; if (g.mug.x + 16 * u > d.cx - d.r * 0.95) g.mug.x = snap(d.cx - d.r * 0.95 - 16 * u); }
    g.duck = wide ? { x: snap(R.x + R.w * 0.7), y: snap(deskY + (short ? 34 : 52) * u) } : null;
    g.book = wide && !short ? { x: snap(R.x + R.w * 0.32), y: snap(deskY + 66 * u) } : null;
    g.rad = { x0: g.WF.x + 12 * u, x1: g.WF.x + g.WF.w - 12 * u, y0: g.sill + 16 * u, y1: Math.min(deskY + 4, g.sill + 16 * u + 74 * u) };
    // the garland of warm lights across the top of the window
    const gy = wide && !short ? GL.y + 6 * u : Math.max(GL.y, topH) + 5 * u;
    g.garland = { x0: GL.x + 2, x1: GL.x + GL.w - 2, y: gy, sag: (wide && !short ? 16 : 12) * u };
    // hotspots, small things first (≥ 44 px)
    const hit = (cx, cy, w, h) => { w = Math.max(44, w); h = Math.max(44, h); return { x: cx - w / 2, y: cy - h / 2, w, h }; };
    g.hits = [
      ['mug', hit(g.mug.x, g.mug.y - 16 * u, 36 * u, 40 * u)],
      ...(g.duck ? [['duck', hit(g.duck.x, g.duck.y - 9 * u, 30 * u, 26 * u)]] : []),
      ['radio', hit(g.radio.x, g.radio.y - 24 * u, 76 * u, 52 * u)],
      ['jar', hit(g.jar.x, g.jar.y - g.jar.h / 2, g.jar.w + 8 * u, g.jar.h + 6 * u)],
      ['plant', hit(g.plant.x, g.sill - (g.potH + g.plantH) / 2, g.plantH * 0.75 + 16 * u, g.potH + g.plantH)],
      ['screens', { x: ed.x - 4, y: ed.y - 4, w: ed.w + 8, h: ed.h + 8 }],
      ['screens', { x: sc.x - 4, y: sc.y - 4, w: sc.w + 8, h: mi.y + mi.h - sc.y + 8 }],
    ];
    g.key = `${W}x${H}@${dpr.toFixed(3)}|${deskY}|${g.dial.cx},${g.dial.cy},${g.dial.r}|${g.ui.x}|${QL}`;
    return g;
  }

  // ═════════════════════════════ state ═════════════════════════════
  let G = null;          // geometry of the latest layout
  let B = null;          // the current bake: { g, part, theme, rain, hour, fin, roomWin, out, city, spr, scr, plant }
  let XF = null, xfK = 1, xfDur = 1.6;   // the previous FIN, fading out
  let bakeGen = 0, T = 0, fontsP = null;
  let dimK = 0;                          // heads-down (0..1)
  let breath = 0, breathT = 0;           // the room breathes with the breathing activity
  let hoverR = null, duckT = 0, jarPulse = 0;
  let tshT = -1;                         // seconds since timer:done while the Dial's tomato pops off and grows back (-1: idle)
  const PO = { dim: 0 };                 // options passed to Patch.draw (reused)
  let nToday = 0, goal = 8, pendH = 0, pendT = 0;   // today's tomatoes; one waiting for its harvest flight
  const BNC = { on: false, t: 0, slot: -1 };       // the newest tomato bouncing onto the vine
  let wig = 0, wigV = 0;                 // plant wiggle (px at the top)
  let kinds = [], pendR = 0;             // today's quarantined rogue kinds; one in flight to the jar
  let lastDay = '', lastMin = -1, tick = 0, skyTick = 0;

  // ═════════════════════════════ small sprites ═════════════════════════════
  const GLYPHS = ['</>', '{}', ';', '()', '=>', '#'];
  const TILTS = [-0.5, -0.18, 0.18, 0.5];
  function bakeGlyphs(u) {
    const cs = Math.round(clamp(17 * u, 13, 30)), cols = 8, n = GLYPHS.length * 2 * TILTS.length, rows = Math.ceil(n / cols);
    const L = layer(0, 0, cols * cs, rows * cs), g = L.g, sx = new Float32Array(n), sy = new Float32Array(n);
    for (let gi = 0; gi < GLYPHS.length; gi++) for (let ci = 0; ci < 2; ci++) for (let ti = 0; ti < TILTS.length; ti++) {
      const i = (gi * 2 + ci) * TILTS.length + ti, cx = (i % cols) * cs, cy = ((i / cols) | 0) * cs;
      sx[i] = cx * DPR; sy[i] = cy * DPR;
      g.save(); g.translate(cx + cs / 2, cy + cs / 2); g.rotate(TILTS[ti]);
      g.font = `700 ${Math.round(cs * (GLYPHS[gi].length > 2 ? 0.42 : 0.56))}px ${FONT.mono}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const col = ci ? '#f5c542' : MINT;
      g.lineWidth = cs * 0.14; g.strokeStyle = ci ? 'rgba(245,197,66,0.28)' : 'rgba(61,255,194,0.28)'; g.strokeText(GLYPHS[gi], 0, 0);
      g.fillStyle = col; g.fillText(GLYPHS[gi], 0, 0);
      g.restore();
    }
    return { L, cs, sx, sy, sw: cs * DPR, n };
  }
  function bakeSparkle() {
    const s = 24, L = layer(-s / 2, -s / 2, s, s), g = L.g;
    glow(g, 0, 0, s * 0.42, s * 0.42, '255,236,170', 0.8, 0.5);
    g.fillStyle = '#fffbe8';
    g.beginPath(); g.moveTo(0, -s * 0.48); g.quadraticCurveTo(s * 0.05, -s * 0.05, s * 0.48, 0); g.quadraticCurveTo(s * 0.05, s * 0.05, 0, s * 0.48); g.quadraticCurveTo(-s * 0.05, s * 0.05, -s * 0.48, 0); g.quadraticCurveTo(-s * 0.05, -s * 0.05, 0, -s * 0.48); g.fill();
    return L;
  }
  function bakeDrop() {
    const s = 32, c = makeCanvas(s, s), g = c.getContext('2d');
    g.fillStyle = rad(g, 16, 17, 3, 15, [0, 'rgba(25,30,70,0.0)', 0.62, 'rgba(25,30,70,0.18)', 0.86, 'rgba(210,225,255,0.28)', 1, 'rgba(210,225,255,0)']); g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(235,242,255,0.34)'; g.beginPath(); g.ellipse(16, 23, 7, 3.2, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(12.5, 12, 1.6, 0, TAU); g.fill();
    return c;
  }
  function bakeWisp() {
    const c = makeCanvas(24, 48), g = c.getContext('2d');
    g.translate(12, 24); g.scale(1, 2);
    g.fillStyle = rad(g, 0, 0, 0, 12, [0, 'rgba(255,255,255,0.55)', 0.5, 'rgba(255,255,255,0.18)', 1, 'rgba(255,255,255,0)']); g.fillRect(-12, -12, 24, 24);
    return c;
  }
  // music notes for the radio: a single and a pair, per channel colour
  function bakeNotes(u) {
    const out = {};
    for (const [ch, col] of [['lofi', MINT], ['rain', '#8fc8ff'], ['city', '#ff9a5c']]) {
      out[ch] = [0, 1].map((two) => {
        const s = 7 * u, L = layer(-s * 1.2, -s * 1.6, s * 2.6, s * 2.2), g = L.g;
        g.fillStyle = col; g.strokeStyle = col; g.lineWidth = Math.max(0.8, s * 0.16);
        fe(g, -s * 0.35, s * 0.3, s * 0.36, s * 0.27, col, -0.4); sp(g, [-s * 0.03, s * 0.25, -s * 0.03, -s * 1.1], col, g.lineWidth);
        if (two) { fe(g, s * 0.75, s * 0.15, s * 0.36, s * 0.27, col, -0.4); sp(g, [s * 1.07, s * 0.1, s * 1.07, -s * 1.25], col, g.lineWidth); sp(g, [-s * 0.03, -s * 1.1, s * 1.07, -s * 1.25], col, g.lineWidth * 1.6); }
        else { g.beginPath(); g.moveTo(-s * 0.03, -s * 1.1); g.quadraticCurveTo(s * 0.5, -s * 0.75, s * 0.42, -s * 0.2); g.stroke(); }
        return L;
      });
    }
    return out;
  }
  function bakeLeafBit(u) {
    const s = 10 * u, L = layer(-s, -s, s * 2, s * 2), g = L.g;
    g.beginPath(); g.moveTo(-s * 0.7, 0); g.quadraticCurveTo(0, -s * 0.5, s * 0.7, 0); g.quadraticCurveTo(0, s * 0.5, -s * 0.7, 0); g.fillStyle = PAL.leaf; g.fill();
    sp(g, [-s * 0.5, 0, s * 0.5, 0], PAL.leafDeep, 0.6);
    return L;
  }
  // a ripe tomato (for the harvest flight and the bounce): a unit sprite, drawn at any radius
  function paintTomato(g, x, y, r, ripe) {
    if (ripe) {
      g.fillStyle = rad(g, x - r * 0.38, y - r * 0.4, r * 0.08, r * 1.25, [0, '#ffb7a6', 0.22, PAL.tomatoHi, 0.48, PAL.tomato, 1, PAL.tomatoDeep]);
      g.beginPath(); g.ellipse(x, y, r * 1.06, r, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(140,20,14,0.35)'; g.lineWidth = Math.max(0.5, r * 0.08);
      g.beginPath(); g.moveTo(x - r * 0.15, y - r * 0.85); g.quadraticCurveTo(x - r * 0.5, y, x - r * 0.2, y + r * 0.85); g.stroke();
      fe(g, x - r * 0.42, y - r * 0.42, r * 0.3, r * 0.16, 'rgba(255,255,255,0.78)', -0.65);
      calyx(g, x, y - r * 0.82, r * 0.72, PAL.leafDeep, PAL.leaf);
    } else {
      g.fillStyle = rad(g, x - r * 0.35, y - r * 0.4, r * 0.05, r * 1.2, [0, '#d2f59a', 0.4, PAL.unripe, 1, PAL.unripeDeep]);
      g.beginPath(); g.ellipse(x, y, r, r * 0.94, 0, 0, TAU); g.fill();
      fe(g, x - r * 0.35, y - r * 0.38, r * 0.24, r * 0.13, 'rgba(255,255,255,0.55)', -0.65);
      calyx(g, x, y - r * 0.8, r * 0.75, '#1f6b3a', '#3fae5f');
    }
  }
  function calyx(g, x, y, s, c1, c2) {
    g.fillStyle = c1;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI + i * Math.PI / 4, ex = x + Math.cos(a) * s, ey = y + Math.sin(a) * s * 0.32 + s * 0.14;
      const nx = -Math.sin(a) * s * 0.17, ny = Math.cos(a) * s * 0.06;
      g.beginPath(); g.moveTo(x + nx, y + ny); g.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny, ex, ey); g.quadraticCurveTo((x + ex) / 2 - nx, (y + ey) / 2 - ny, x - nx, y - ny); g.closePath(); g.fill();
    }
    sp(g, [x, y, x + s * 0.1, y - s * 0.42], c2, Math.max(0.6, s * 0.16));
  }
  function bakeTomato(r) {
    const L = layer(-r * 1.25, -r * 1.25, r * 2.5, r * 2.5); paintTomato(L.g, 0, 0, r, true); L.r = r; return L;
  }
  // today's rogues in the jar: tiny blobs in their signature neon, crimson eyes
  const KIND_IDS = ['bazu', 'fukusei', 'bagu', 'kusarigumo', 'zatsu', 'kemuri'];
  function paintBlob(g, kind, s) {
    const R0 = ROGUE(kind), sig = R0 ? R0.sig : '#ff3d9a', L = Math.max(0.6, s * 0.08);
    const body = (path, f) => { path(); g.lineWidth = L * 2; g.strokeStyle = OUTL; g.stroke(); g.fillStyle = f; g.fill(); };
    const eyes = (y, dx) => { fc(g, -dx, y, s * 0.1, PAL.rogue); fc(g, dx, y, s * 0.1, PAL.rogue); fc(g, -dx + s * 0.035, y - s * 0.035, s * 0.035, '#fff'); fc(g, dx + s * 0.035, y - s * 0.035, s * 0.035, '#fff'); };
    if (kind === 'bazu') {
      body(() => { g.beginPath(); g.ellipse(0, 0, s * 0.42, s * 0.38, 0, 0, TAU); }, lin(g, -s * 0.4, -s * 0.4, s * 0.4, s * 0.4, [0, '#fff6a8', 1, '#c9b42a']));
      fp(g, [-s * 0.05, -s * 0.36, s * 0.2, -s * 0.72, s * 0.08, -s * 0.5, s * 0.22, -s * 0.52, -s * 0.1, -s * 0.2], sig);
      eyes(-s * 0.02, s * 0.15);
    } else if (kind === 'fukusei') {
      body(() => { g.beginPath(); g.ellipse(0, 0, s * 0.34, s * 0.42, 0, 0, TAU); }, '#f4f1ea');
      g.save(); g.beginPath(); g.ellipse(0, 0, s * 0.34, s * 0.42, 0, 0, TAU); g.clip(); fr(g, 0, -s, s, s * 2, '#c9c4dc'); g.restore();
      eyes(-s * 0.04, s * 0.13);
    } else if (kind === 'bagu') {
      sp(g, [-s * 0.12, -s * 0.28, -s * 0.3, -s * 0.58], OUTL, L * 2); sp(g, [s * 0.12, -s * 0.28, s * 0.3, -s * 0.58], OUTL, L * 2);
      fc(g, -s * 0.3, -s * 0.58, s * 0.07, sig); fc(g, s * 0.3, -s * 0.58, s * 0.07, sig);
      body(() => { g.beginPath(); g.ellipse(0, 0, s * 0.4, s * 0.34, 0, 0, TAU); }, lin(g, 0, -s * 0.4, 0, s * 0.4, [0, '#5c9a68', 1, '#173826']));
      sp(g, [0, -s * 0.3, 0, s * 0.3], 'rgba(125,255,58,0.6)', L);
      eyes(-s * 0.04, s * 0.15);
    } else if (kind === 'kusarigumo') {
      body(() => { g.beginPath(); g.arc(-s * 0.2, s * 0.04, s * 0.24, 0, TAU); g.moveTo(s * 0.44, s * 0.04); g.arc(s * 0.2, s * 0.04, s * 0.24, 0, TAU); g.moveTo(s * 0.28, -s * 0.12); g.arc(0, -s * 0.12, s * 0.28, 0, TAU); }, lin(g, 0, -s * 0.4, 0, s * 0.3, [0, '#b3bbe0', 1, '#4c557d']));
      fp(g, [-s * 0.18, -s * 0.38, -s * 0.1, -s * 0.56, 0, -s * 0.4, s * 0.1, -s * 0.56, s * 0.18, -s * 0.38], sig);
      eyes(-s * 0.02, s * 0.14);
    } else if (kind === 'zatsu') {
      body(() => { g.beginPath(); g.moveTo(-s * 0.38, s * 0.3); g.quadraticCurveTo(-s * 0.46, -s * 0.42, 0, -s * 0.42); g.quadraticCurveTo(s * 0.46, -s * 0.42, s * 0.38, s * 0.3); g.quadraticCurveTo(s * 0.2, s * 0.2, s * 0.12, s * 0.42); g.quadraticCurveTo(0, s * 0.25, -s * 0.12, s * 0.36); g.quadraticCurveTo(-s * 0.25, s * 0.22, -s * 0.38, s * 0.3); g.closePath(); }, lin(g, -s * 0.3, -s * 0.4, s * 0.3, s * 0.4, [0, '#f6d0dc', 1, '#a8668a']));
      fc(g, -s * 0.14, -s * 0.06, s * 0.13, '#fff'); fc(g, s * 0.14, -s * 0.1, s * 0.08, '#fff');
      fc(g, -s * 0.13, -s * 0.05, s * 0.08, PAL.rogue); fc(g, s * 0.14, -s * 0.09, s * 0.05, PAL.rogue);
    } else {
      body(() => { g.beginPath(); g.moveTo(-s * 0.36, s * 0.32); g.lineTo(-s * 0.4, -s * 0.12); g.quadraticCurveTo(-s * 0.32, -s * 0.44, 0, -s * 0.48); g.quadraticCurveTo(s * 0.32, -s * 0.44, s * 0.4, -s * 0.12); g.lineTo(s * 0.36, s * 0.32); g.closePath(); }, lin(g, 0, -s * 0.5, 0, s * 0.4, [0, '#4e2c58', 1, '#160a1a']));
      fr(g, -s * 0.3, -s * 0.08, s * 0.6, s * 0.14, sig);
      fr(g, -s * 0.22, -s * 0.05, s * 0.44, s * 0.04, '#ffd0d6');
    }
  }
  function bakeBlobs(s) {
    const out = {};
    KIND_IDS.forEach((k, i) => { const L = layer(-s * 1.1, -s * 1.1, s * 2.2, s * 2.2); glow(L.g, 0, 0, s * 1.05, s * 1.05, SIGRGB[i], 0.42, 0.45); paintBlob(L.g, k, s); out[k] = L; });
    return out;
  }
  const blobBig = {};
  function bigBlob(kind, s) {
    const key = kind + '|' + Math.round(s) + '|' + DPR;
    if (!blobBig[key]) { const L = layer(-s * 0.75, -s * 0.85, s * 1.5, s * 1.6); paintBlob(L.g, kind, s); blobBig[key] = L; }
    return blobBig[key];
  }
  // a jagged bolt of lightning, top to bottom of the window
  function bakeBolt(h, u) {
    const w = h * 0.45, L = layer(-w / 2, 0, w, h), g = L.g, R = mulberry(3);
    const pts = [0, 0]; let x = 0;
    for (let y = h * 0.08; y < h; y += h * (0.06 + R() * 0.07)) { x += (R() - 0.5) * w * 0.32; x = clamp(x, -w * 0.4, w * 0.4); pts.push(x, y); }
    const branch = [pts[6], pts[7]]; let bx = pts[6];
    for (let y = pts[7] + h * 0.05; y < pts[7] + h * 0.32; y += h * 0.06) { bx += w * (0.05 + R() * 0.07); branch.push(bx, y); }
    for (const [lw, col] of [[7 * u, 'rgba(160,190,255,0.16)'], [3.4 * u, 'rgba(190,210,255,0.5)'], [1.3 * u, '#ffffff']]) { sp(g, pts, col, lw); sp(g, branch, col, lw * 0.7); }
    return L;
  }

  // ═════════════════════════════ props (local coords: origin = the base, on its surface) ═════════════════════════════
  function paintLamp(g, u) {
    const s = u;
    shadowE(g, 3 * s, 0, 22 * s, 5 * s, 0.4);
    fe(g, 0, -2.2 * s, 15 * s, 4.6 * s, lin(g, -15 * s, 0, 15 * s, 0, [0, '#f0c978', 0.45, '#b78a3e', 1, '#4e3712']));
    fe(g, -3 * s, -3.6 * s, 8 * s, 1.8 * s, 'rgba(255,240,200,0.4)');
    fr(g, -1.6 * s, -46 * s, 3.2 * s, 44 * s, lin(g, -1.6 * s, 0, 1.6 * s, 0, [0, '#f6d58e', 1, '#6e5020']));
    // the dome shade, lit from inside
    g.beginPath(); g.ellipse(0, -45 * s, 20 * s, 16 * s, 0, Math.PI, TAU); g.closePath();
    g.lineWidth = 2.2 * s; g.strokeStyle = OUTL; g.stroke();
    g.fillStyle = lin(g, -20 * s, -61 * s, 20 * s, -45 * s, [0, '#4a5ca8', 0.45, '#2c3a7a', 1, '#161d48']); g.fill();
    fe(g, 0, -45 * s, 20 * s, 3.6 * s, lin(g, -20 * s, 0, 20 * s, 0, [0, '#ffcf7a', 0.5, '#fff4d2', 1, '#ffad55']));
    g.beginPath(); g.ellipse(-7 * s, -54 * s, 8.5 * s, 3 * s, -0.4, 0, TAU); g.fillStyle = 'rgba(169,188,255,0.45)'; g.fill();
    fc(g, 0, -61 * s, 2.4 * s, '#d9a441');
    glow(g, 0, -44 * s, 17 * s, 5.5 * s, '255,236,200', 0.8, 0.6);
  }
  function paintRadio(g, u) {
    const s = u, w = 70 * s, h = 42 * s, x = -w / 2, y = -h;
    shadowE(g, 4 * s, 0, 42 * s, 6 * s, 0.42);
    // handle and antenna
    g.beginPath(); g.moveTo(x + 13 * s, y + 3 * s); g.quadraticCurveTo(x + 13 * s, y - 9 * s, x + 23 * s, y - 9 * s); g.lineTo(x + w - 23 * s, y - 9 * s); g.quadraticCurveTo(x + w - 13 * s, y - 9 * s, x + w - 13 * s, y + 3 * s);
    g.strokeStyle = OUTL; g.lineWidth = 5 * s; g.stroke(); g.strokeStyle = '#2a2f55'; g.lineWidth = 2.8 * s; g.stroke();
    sp(g, [x + w - 7 * s, y + 3 * s, x + w + 7 * s, y - 18 * s], '#9aa6c4', 1.5 * s); fc(g, x + w + 7 * s, y - 18 * s, 1.8 * s, '#e9eefc');
    // body
    srr(g, x, y, w, h, 7 * s, OUTL, 2.6 * s);
    frr(g, x, y, w, h, 7 * s, lin(g, 0, y, 0, 0, [0, '#f4ead4', 0.55, '#e3d4b6', 1, '#b9a37e']));
    fr(g, x + 3 * s, y + 1.2 * s, w - 6 * s, 1.2 * s, 'rgba(255,255,255,0.6)');
    // speaker grille
    frr(g, x + 5 * s, y + 7 * s, 31 * s, h - 13 * s, 5 * s, '#262438');
    for (let yy = y + 11 * s; yy < -8 * s; yy += 4 * s) for (let xx = x + 9 * s; xx < x + 33 * s; xx += 4 * s) fc(g, xx, yy, 1.05 * s, '#3c3a56');
    // display window (the EQ lives here) + the channel label strip under it
    frr(g, x + 40 * s, y + 6 * s, 25 * s, 15 * s, 3 * s, '#070a18');
    srr(g, x + 40 * s, y + 6 * s, 25 * s, 15 * s, 3 * s, 'rgba(169,188,255,0.35)', 0.8 * s);
    frr(g, x + 40 * s, y + 23 * s, 25 * s, 6.5 * s, 2 * s, '#2a2840');
    // knobs
    fc(g, x + 46 * s, y + 35 * s, 3.8 * s, '#3a3550'); fc(g, x + 46 * s, y + 35 * s, 1.2 * s, '#8a86a8');
    fc(g, x + 59 * s, y + 35 * s, 3.8 * s, '#d9a441'); fc(g, x + 58 * s, y + 34 * s, 1.3 * s, '#ffe6a6');
    fr(g, x + 7 * s, -1.2 * s, 8 * s, 2.2 * s, '#2a2840'); fr(g, x + w - 15 * s, -1.2 * s, 8 * s, 2.2 * s, '#2a2840');
    // a mint </> sticker
    g.save(); g.translate(x + 20 * s, y + 3.4 * s); g.rotate(-0.08); frr(g, -6 * s, -2.6 * s, 12 * s, 5.2 * s, 1.4 * s, '#14182e'); txt(g, '</>', 0, 0.2 * s, 4.4 * s, FONT.mono, MINT, 'center'); g.restore();
    return { eq: { x: x + 42 * s, y: y + 8 * s, w: 21 * s, h: 11 * s }, lab: { x: x + 52.5 * s, y: y + 26.3 * s }, led: { x: x + 62 * s, y: y + 34 * s } };
  }
  function paintMug(g, u) {
    const s = u, w = 22 * s, h = 22 * s;
    shadowE(g, 3 * s, 0, 15 * s, 4 * s, 0.42);
    g.beginPath(); g.ellipse(w / 2 + 1.5 * s, -h * 0.52, 5.6 * s, 6.6 * s, 0, 0, TAU); g.strokeStyle = OUTL; g.lineWidth = 5 * s; g.stroke(); g.strokeStyle = '#d8cfc0'; g.lineWidth = 2.8 * s; g.stroke();
    g.beginPath(); g.moveTo(-w / 2, -h); g.lineTo(w / 2, -h); g.lineTo(w / 2 - 1.2 * s, -2 * s); g.quadraticCurveTo(w / 2 - 1.6 * s, 0, w / 2 - 4.5 * s, 0); g.lineTo(-w / 2 + 4.5 * s, 0); g.quadraticCurveTo(-w / 2 + 1.6 * s, 0, -w / 2 + 1.2 * s, -2 * s); g.closePath();
    g.lineWidth = 2.2 * s; g.strokeStyle = OUTL; g.stroke();
    g.fillStyle = lin(g, -w / 2, 0, w / 2, 0, [0, '#fffaf2', 0.5, '#ebe3d6', 1, '#b4a996']); g.fill();
    fe(g, 0, -h, w / 2, 3.3 * s, '#f3ece0'); fe(g, 0, -h + 0.5 * s, w / 2 - 1.8 * s, 2.3 * s, lin(g, -w / 2, 0, w / 2, 0, [0, '#b46c2c', 1, '#5e3412']));
    fe(g, -2 * s, -h + 0.1 * s, 3 * s, 0.7 * s, 'rgba(255,220,170,0.6)');
    // a tomato decal
    paintTomato(g, -1.5 * s, -h * 0.44, 4.6 * s, true);
  }
  function paintJarBack(g, u, w, h) {
    const bh = h - 12 * u;
    shadowE(g, 3 * u, 0, w * 0.6, 3.4 * u, 0.4);
    frr(g, -w / 2, -bh, w, bh, 8 * u, 'rgba(120,150,230,0.16)');
    frr(g, -w / 2 + 2 * u, -bh + 2 * u, w - 4 * u, bh - 4 * u, 6 * u, lin(g, 0, -bh, 0, 0, [0, 'rgba(8,10,28,0.62)', 1, 'rgba(14,18,44,0.78)']));
    fe(g, 0, -2.2 * u, w * 0.42, 2 * u, 'rgba(169,188,255,0.16)');
  }
  function paintJarFront(g, u, w, h) {
    const bh = h - 12 * u, nw = w - 7 * u;
    // glass edges and highlights
    srr(g, -w / 2, -bh, w, bh, 8 * u, OUTL, 2.6 * u);
    srr(g, -w / 2, -bh, w, bh, 8 * u, 'rgba(200,218,255,0.7)', 1.1 * u);
    frr(g, -w / 2 + 3.5 * u, -bh + 6 * u, 3 * u, bh - 14 * u, 1.5 * u, 'rgba(255,255,255,0.32)');
    frr(g, w / 2 - 5 * u, -bh + 9 * u, 1.4 * u, bh - 20 * u, 0.7 * u, 'rgba(255,255,255,0.18)');
    g.beginPath(); g.ellipse(0, -2.4 * u, w * 0.44, 2.2 * u, 0, 0.15, Math.PI - 0.15); g.strokeStyle = 'rgba(210,225,255,0.35)'; g.lineWidth = 1 * u; g.stroke();
    // neck and lid; a mint containment strip
    frr(g, -nw / 2, -bh - 3 * u, nw, 4 * u, 1.5 * u, 'rgba(190,210,255,0.25)');
    srr(g, -nw / 2 - 1.5 * u, -h, nw + 3 * u, 8 * u, 2.4 * u, OUTL, 2 * u);
    frr(g, -nw / 2 - 1.5 * u, -h, nw + 3 * u, 8 * u, 2.4 * u, lin(g, 0, -h, 0, -h + 8 * u, [0, '#5a6290', 1, '#262a48']));
    for (let x = -nw / 2 + 1 * u; x < nw / 2; x += 2.6 * u) fr(g, x, -h + 1 * u, 0.8 * u, 6 * u, 'rgba(0,0,0,0.22)');
    fr(g, -nw / 2 + 1 * u, -h + 5.6 * u, nw - 2 * u, 1.4 * u, MINT);
    // the label: 隔離 (quarantine)
    g.save(); g.translate(0, -bh * 0.36); g.rotate(-0.04);
    frr(g, -w * 0.3, -4.6 * u, w * 0.6, 9.2 * u, 1.2 * u, '#efe6d2');
    txt(g, '隔離', 0, 0.3 * u, 6.2 * u, JP, '#d8233a', 'center', 'middle', 700);
    g.restore();
  }
  function bakeGarland(g0, prt) {
    const G0 = g0.garland, u = g0.u, box = [G0.x0 - 10 * u, G0.y - 10 * u, G0.x1 - G0.x0 + 20 * u, G0.sag + 24 * u];
    const L = layer(box[0], box[1], box[2], box[3]), g = L.g, R = mulberry(5), odd = layer(box[0], box[1], box[2], box[3]), even = layer(box[0], box[1], box[2], box[3]);
    const n = Math.max(8, Math.round((G0.x1 - G0.x0) / (22 * u))), pts = [];
    g.beginPath();
    for (let i = 0; i <= 40; i++) { const t = i / 40, x = lerp(G0.x0, G0.x1, t), y = G0.y + Math.sin(t * Math.PI) * G0.sag; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = 'rgba(10,10,24,0.85)'; g.lineWidth = 1.1 * u; g.stroke();
    const lit = prt !== 'day';
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = lerp(G0.x0, G0.x1, t), y = G0.y + Math.sin(t * Math.PI) * G0.sag + 2.8 * u;
      const col = R() < 0.25 ? [255, 214, 140] : [255, 186, 110];
      if (lit) { glow(g, x, y, 7 * u, 7 * u, `${col[0]},${col[1]},${col[2]}`, 0.5, 0.5); glow((i % 2 ? odd : even).g, x, y, 9 * u, 9 * u, `${col[0]},${col[1]},${col[2]}`, 0.6, 0.5); }
      fe(g, x, y, 1.6 * u, 2.2 * u, lit ? css(mixc(col, [255, 255, 255], 0.45)) : '#f3e2c4');
      fr(g, x - 0.8 * u, y - 3.4 * u, 1.6 * u, 1.4 * u, '#2a2a36');
      pts.push(x, y);
    }
    return { L, pts, odd, even };
  }
  // the holo panel: glass, glow, header, brackets, scanlines (local coords)
  function paintPanel(g, w, h, u, hdr) {
    const r = 4.5 * u;
    for (let i = 4; i >= 1; i--) srr(g, 0, 0, w, h, r, `rgba(61,255,194,${(0.05 * (5 - i) / 4).toFixed(3)})`, i * 2.6 * u);
    frr(g, 0, 0, w, h, r, lin(g, 0, 0, 0, h, [0, 'rgba(61,255,194,0.15)', 0.3, 'rgba(61,255,194,0.07)', 1, 'rgba(61,255,194,0.045)']));
    for (let y = hdr + 2; y < h - 1; y += 2.6 * u) fr(g, 1.5, y, w - 3, 0.55 * u, 'rgba(61,255,194,0.04)');
    frr(g, 2 * u, 2 * u, w - 4 * u, hdr - 2 * u, 2.6 * u, 'rgba(61,255,194,0.11)');
    for (let i = 0; i < 3; i++) fc(g, 6 * u + i * 4.6 * u, hdr / 2 + 1 * u, 1.3 * u, i === 0 ? 'rgba(255,120,150,0.75)' : i === 1 ? 'rgba(255,200,120,0.7)' : 'rgba(61,255,194,0.8)');
    srr(g, 0.5, 0.5, w - 1, h - 1, r, 'rgba(61,255,194,0.7)', 1.05 * u);
    const b = 5 * u;
    g.strokeStyle = 'rgba(200,255,238,0.95)'; g.lineWidth = 1.5 * u;
    g.beginPath(); g.moveTo(0, b + r); g.lineTo(0, r * 0.6); g.quadraticCurveTo(0, 0, r * 0.6, 0); g.lineTo(b + r, 0);
    g.moveTo(w - b - r, h); g.lineTo(w - r * 0.6, h); g.quadraticCurveTo(w, h, w, h - r * 0.6); g.lineTo(w, h - b - r); g.stroke();
  }

  // ═════════════════════════════ the city (painted once per daypart) ═════════════════════════════
  function farTower(g, x, w, top, base, k, P, R, rec, lit) {
    g.fillStyle = lin(g, 0, top, 0, base, [0, P.far, 1, P.far2]);
    g.fillRect(x, top, w, base - top);
    const st = R();
    let tt = top;
    if (st < 0.28) { const w2 = w * (0.45 + R() * 0.3), h2 = (5 + R() * 10) * k; g.fillRect(x + (w - w2) / 2, top - h2, w2, h2 + 1); tt = top - h2; if (R() < 0.5) { const w3 = w2 * 0.5, h3 = (3 + R() * 6) * k; g.fillRect(x + (w - w3) / 2, tt - h3, w3, h3 + 1); tt -= h3; } }
    else if (st < 0.42) { g.beginPath(); g.moveTo(x, top + 0.5); g.lineTo(x + w, top + 0.5); g.lineTo(R() < 0.5 ? x + w : x, top - w * 0.45); g.closePath(); g.fill(); }
    if (R() < 0.5) { const ax = x + w * (0.35 + R() * 0.3), ah = (5 + R() * 13) * k; sp(g, [ax, tt, ax, tt - ah], P.far, Math.max(0.8, 1.1 * k)); if (lit) rec.blink.push(ax, tt - ah, R() * 6); }
    fr(g, x, tt, Math.max(0.7, 0.8 * k), base - tt, P.rim);
    if (lit) {
      const v = R();
      if (v < 0.12) { g.globalAlpha = 0.75; fr(g, x, top, w, 1.2 * k, css(NEONS[(R() * NEONS.length) | 0], 0.9)); glow(g, x + w / 2, top, w * 0.7, 4 * k, '255,180,220', 0.12, 0.4); g.globalAlpha = 1; }
      else if (v < 0.22) { const sx = x + w * (0.2 + R() * 0.6); g.globalAlpha = 0.6; fr(g, sx, top + 4 * k, 0.9 * k, (base - top) * 0.7, css(NEONS[(R() * NEONS.length) | 0], 0.85)); g.globalAlpha = 1; }
      else if (v < 0.4) { for (let f = 0; f < 3; f++) { const fy = top + (base - top) * (0.15 + R() * 0.6); g.globalAlpha = 0.35 + R() * 0.3; fr(g, x + 1.5 * k, fy, w - 3 * k, 1.4 * k, R() < 0.7 ? '#ffd08a' : '#cfe0ff'); } g.globalAlpha = 1; }
    }
    if (P.win > 0) for (let yy = top + 3 * k; yy < base - 2 * k; yy += 4.4 * k) for (let xx = x + 2.2 * k; xx < x + w - 2.2 * k; xx += 3.4 * k) if (R() < P.win * 0.42) { g.globalAlpha = (0.35 + R() * 0.55) * P.winA; fr(g, xx, yy, 1.3 * k, 1.7 * k, winCol(R)); }
    else if (!lit && R() < 0.05) { g.globalAlpha = 0.25; fr(g, xx, yy, 1.3 * k, 1.7 * k, P.unlit); }
    g.globalAlpha = 1;
  }
  function neonText(g, s, x, y, size, rgb, k, a, vertical, font) {
    g.font = `700 ${size}px ${font || JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = vertical ? Array.from(s) : [s];
    for (const [lw, al] of [[5.5 * k, 0.12], [3 * k, 0.28], [1.6 * k, 0.75]]) {
      g.lineWidth = lw; g.strokeStyle = css(rgb, al * a);
      chars.forEach((ch, i) => g.strokeText(ch, x, y + (vertical ? i * size * 1.06 : 0)));
    }
    g.fillStyle = css(mixc(rgb, [255, 255, 255], 0.65), Math.min(1, a * 1.1));
    chars.forEach((ch, i) => g.fillText(ch, x, y + (vertical ? i * size * 1.06 : 0)));
  }
  function verticalSign(g, x, y, text, rgb, k, P, lit) {
    const n = Array.from(text).length, cs = 6.6 * k, w = 10 * k, h = n * cs * 1.06 + 5 * k;
    frr(g, x - w / 2, y, w, h, 1.6 * k, '#0b0a18');
    srr(g, x - w / 2, y, w, h, 1.6 * k, lit ? css(rgb, 0.85 * P.neon) : 'rgba(140,140,170,0.5)', 0.9 * k);
    if (lit) { glow(g, x, y + h / 2, w * 1.6, h * 0.75, `${rgb[0]},${rgb[1]},${rgb[2]}`, 0.28 * P.neon, 0.4); neonText(g, text, x, y + 2.5 * k + cs * 0.53, cs, rgb, k, P.neon, true); }
    else { g.font = `700 ${cs}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(220,215,235,0.55)'; Array.from(text).forEach((ch, i) => g.fillText(ch, x, y + 2.5 * k + cs * 0.53 + i * cs * 1.06)); }
    fr(g, x - 0.5 * k, y - 3 * k, 1 * k, 3 * k, '#0b0a18');
    return { x: x - w / 2, y, w, h };
  }
  function waterTank(g, x, base, w, k, col, rim) {
    const h = w * 0.95, lh = w * 0.42;
    sp(g, [x - w * 0.36, base, x - w * 0.3, base - lh], col, 1 * k); sp(g, [x + w * 0.36, base, x + w * 0.3, base - lh], col, 1 * k); sp(g, [x - w * 0.33, base - lh * 0.45, x + w * 0.33, base - lh * 0.45], col, 0.7 * k);
    fr(g, x - w / 2, base - lh - h, w, h, col);
    for (let i = 1; i < 4; i++) fr(g, x - w / 2, base - lh - h * i / 4, w, 0.6 * k, 'rgba(0,0,0,0.25)');
    fp(g, [x - w / 2 - 1 * k, base - lh - h, x + w / 2 + 1 * k, base - lh - h, x, base - lh - h - w * 0.45], col);
    fr(g, x - w / 2, base - lh - h, 0.8 * k, h, rim);
    sp(g, [x - w / 2 - 1 * k, base - lh - h, x, base - lh - h - w * 0.45], rim, 0.6 * k);
  }
  function midBuilding(g, x, w, top, base, k, P, R, rec, lit, sign) {
    g.fillStyle = lin(g, 0, top, 0, base, [0, P.mid2, 1, P.mid]); g.fillRect(x, top, w, base - top);
    const sf = w * 0.16; fr(g, x + w - sf, top, sf, base - top, 'rgba(0,0,0,0.24)');
    fr(g, x - 0.8 * k, top - 1.5 * k, w + 1.6 * k, 1.8 * k, P.mid2);
    fr(g, x - 0.8 * k, top - 1.5 * k, w + 1.6 * k, 0.7 * k, P.rim);
    fr(g, x, top, 0.9 * k, base - top, P.rim);
    const cw = 6.2 * k, ch = 7.8 * k, ww = 3.2 * k, wh = 4.3 * k;
    for (let yy = top + 5 * k; yy < base - wh; yy += ch) for (let xx = x + 3 * k; xx < x + w - sf - ww; xx += cw) {
      if (R() < P.win) { g.globalAlpha = P.winA * (0.6 + R() * 0.4); fr(g, xx, yy, ww, wh, winCol(R)); g.globalAlpha = 1; }
      else { g.globalAlpha = lit ? 0.7 : 0.55; fr(g, xx, yy, ww, wh, P.unlit); g.globalAlpha = 1; if (lit && rec.tog.length < 40 && R() < 0.07) rec.tog.push(xx, yy, ww, wh); }
    }
    // rooftop gear
    const gear = R();
    if (gear < 0.55) waterTank(g, x + w * (0.25 + R() * 0.45), top - 1.5 * k, (7 + R() * 4) * k, k, P.tank, P.rim);
    if (gear > 0.35) { fr(g, x + w * 0.1, top - 4.5 * k, 6 * k, 3.2 * k, P.mid2); fr(g, x + w * 0.1, top - 4.5 * k, 6 * k, 0.6 * k, P.rim); }
    if (R() < 0.45) { const ax = x + w * (0.6 + R() * 0.3), ah = (8 + R() * 10) * k; sp(g, [ax, top - 1.5 * k, ax, top - ah], P.mid2, 0.9 * k); sp(g, [ax - 2.5 * k, top - ah * 0.7, ax + 2.5 * k, top - ah * 0.7], P.mid2, 0.7 * k); if (lit) rec.blink.push(ax, top - ah, R() * 6); }
    if (sign) {
      const sx = R() < 0.5 ? x + 4 * k : x + w - sf - 4 * k, sy = top + 8 * k;
      const box = verticalSign(g, sx, sy, sign.text, sign.rgb, k, P, lit && !sign.live);
      if (sign.live && lit) {
        const n = Array.from(sign.text).length, cs = 6.6 * k, Lz = layer(box.x - 8 * k, box.y - 6 * k, box.w + 16 * k, box.h + 12 * k);
        glow(Lz.g, sx, box.y + box.h / 2, box.w * 1.6, box.h * 0.75, `${sign.rgb[0]},${sign.rgb[1]},${sign.rgb[2]}`, 0.32, 0.4);
        neonText(Lz.g, sign.text, sx, sy + 2.5 * k + cs * 0.53, cs, sign.rgb, k, 1, true);
        srr(Lz.g, box.x, box.y, box.w, box.h, 1.6 * k, css(sign.rgb, 0.85), 0.9 * k);
        rec.flick.push({ L: Lz, n, t: 0, ph: R() * 10 });
      }
    }
  }
  function pagoda(g, cx, top, base, k, P, prt, rec) {
    const lit = prt !== 'day', H = base - top, spire = H * 0.15, y0 = top + spire, n = 6;
    const edge = lit ? [255, 92, 64] : [176, 58, 44], roofC = lit ? '#0d0f2a' : '#4a5274', bodyA = P.far2, bodyB = P.far;
    // the spire: a mast with rings (the sorin), its light at the tip
    sp(g, [cx, y0 + 2 * k, cx, top], roofC, 1.6 * k);
    for (let i = 0; i < 6; i++) fe(g, cx, top + spire * (0.3 + i * 0.1), (2.6 - i * 0.22) * k, 0.65 * k, lit ? (i % 2 ? 'rgba(255,170,130,0.9)' : 'rgba(255,120,90,0.9)') : '#8a6a5a');
    fc(g, cx, top + spire * 0.18, 1.3 * k, lit ? '#ffd0b0' : '#9a7a6a');
    rec.blink.push(cx, top, 1.5);
    const tierH = (base - y0) / (n + 0.6);
    for (let i = 0; i < n; i++) {
      const ty = y0 + i * tierH, w = (9 + i * 3.4) * k, ew = w + (8 + i * 1.2) * k, rh = tierH * 0.42;
      // the body of the tier: a band of warm windows
      g.fillStyle = lin(g, cx - w / 2, 0, cx + w / 2, 0, [0, bodyA, 1, bodyB]); g.fillRect(cx - w / 2, ty + rh * 0.6, w, tierH - rh * 0.6 + 1);
      fr(g, cx - w / 2, ty + rh * 0.6, 0.8 * k, tierH - rh * 0.6, P.rim);
      if (lit) { g.globalAlpha = 0.85; for (let xx = cx - w / 2 + 1.6 * k; xx < cx + w / 2 - 1.8 * k; xx += 2.4 * k) fr(g, xx, ty + rh + tierH * 0.12, 1.4 * k, tierH * 0.3, (xx * 7 | 0) % 3 ? '#ffcf8a' : '#ffa868'); g.globalAlpha = 1; }
      // the roof: sloped, eaves turned up at the ends
      const ry = ty + rh;
      g.beginPath();
      g.moveTo(cx - w * 0.32, ty); g.lineTo(cx + w * 0.32, ty);
      g.quadraticCurveTo(cx + ew * 0.42, ry - rh * 0.2, cx + ew / 2, ry - rh * 0.55);
      g.lineTo(cx + ew / 2 - 1.4 * k, ry + 0.6 * k); g.lineTo(cx - ew / 2 + 1.4 * k, ry + 0.6 * k); g.lineTo(cx - ew / 2, ry - rh * 0.55);
      g.quadraticCurveTo(cx - ew * 0.42, ry - rh * 0.2, cx - w * 0.32, ty); g.closePath();
      g.fillStyle = roofC; g.fill();
      const line = [cx - ew / 2, ry - rh * 0.55, cx - ew / 2 + 1.4 * k, ry + 0.6 * k, cx + ew / 2 - 1.4 * k, ry + 0.6 * k, cx + ew / 2, ry - rh * 0.55];
      if (lit) { sp(g, line, css(edge, 0.16), 3.6 * k); sp(g, line, css(edge, 0.42), 1.9 * k); }
      sp(g, line, css(mixc(edge, [255, 232, 214], lit ? 0.5 : 0), lit ? 0.95 : 0.85), 0.85 * k);
      // little lanterns hanging off the eave ends
      if (lit) { fc(g, cx - ew / 2 + 0.6 * k, ry + 1.6 * k, 0.9 * k, '#ffb070'); fc(g, cx + ew / 2 - 0.6 * k, ry + 1.6 * k, 0.9 * k, '#ffb070'); }
    }
    if (lit) glow(g, cx, base - H * 0.4, 34 * k, H * 0.6, '255,92,64', 0.13, 0.3);
  }
  function billboard(g, x, y, w, h, k, prt) {
    const lit = prt !== 'day', ye = [230, 255, 61];
    fr(g, x + w * 0.3, y + h, 1.4 * k, 6 * k, '#0d0c1c'); fr(g, x + w * 0.7, y + h, 1.4 * k, 6 * k, '#0d0c1c');
    if (lit) {
      glow(g, x + w / 2, y + h / 2, w * 0.9, h * 1.3, '230,255,61', 0.22, 0.35);
      frr(g, x, y, w, h, 1.5 * k, 'rgba(18,20,8,0.92)');
      srr(g, x, y, w, h, 1.5 * k, css(ye, 0.3), 3 * k); srr(g, x, y, w, h, 1.5 * k, css(ye, 0.95), 0.9 * k);
      neonText(g, 'AGI SOON', x + w / 2, y + h * 0.42, h * 0.38, ye, k * 0.8, 1, false, FONT.display);
      txt(g, 'バズ · 10×', x + w / 2, y + h * 0.8, h * 0.2, JP, 'rgba(230,255,61,0.75)', 'center');
    } else {
      frr(g, x, y, w, h, 1.5 * k, '#e6e86a'); srr(g, x, y, w, h, 1.5 * k, '#4a4a30', 0.9 * k);
      txt(g, 'AGI SOON', x + w / 2, y + h * 0.42, h * 0.38, FONT.display, '#2a2a16', 'center', 'middle', 400);
      txt(g, 'バズ · 10×', x + w / 2, y + h * 0.8, h * 0.2, JP, '#4a4a30', 'center');
    }
  }
  function paintCity(g, gm, P, prt, rec) {
    const GL = gm.GL, X0 = GL.x - 4, X1 = GL.x + GL.w + 4, vt = gm.vt, sb = gm.sill, vh = sb - vt;
    const k = clamp(vh / 230, 0.55, 2.4), R = mulberry(2026), lit = prt === 'night' || prt === 'dusk' || prt === 'dawn';
    const hz = sb - vh * 0.26, cx = gm.patch.x;
    rec.k = k;
    // 1. the far wall of towers, tallest toward the sides
    let x = X0 - R() * 12 * k;
    while (x < X1) {
      const w = (11 + R() * 19) * k, edge = Math.min(1, Math.abs(x + w / 2 - cx) / (GL.w * 0.5));
      const h = vh * (0.12 + R() * 0.22 + edge * (0.12 + R() * 0.22));
      farTower(g, x, w, hz - h, sb, k, P, R, rec, lit);
      x += w + (0.4 + R() * 3.5) * k;
    }
    // the city's own glow on the horizon
    g.fillStyle = lin(g, 0, hz - vh * 0.34, 0, sb, [0, css(P.haze, 0), 0.55, css(P.haze, P.hazeA * 0.8), 1, css(P.haze, P.hazeA)]);
    g.fillRect(X0, hz - vh * 0.34, X1 - X0, sb - hz + vh * 0.34);
    // 2. the Neo Dojo pagoda, right behind Patch: its crown clears her head
    pagoda(g, cx + 3 * k, vt + vh * 0.05, hz + 6 * k, k, P, prt, rec);
    // 3. Bazu's billboard on a tower to the right
    const bx = GL.x + GL.w * 0.8, bw = 40 * k, bh = 16 * k, btop = Math.max(vt + 4 * k, Math.min(hz - vh * 0.5, gm.scr.st.y - bh - 14 * k));
    farTower(g, bx - 9 * k, 22 * k, btop + bh + 5 * k, sb, k, P, mulberry(77), rec, lit);
    billboard(g, bx - bw / 2 + 2 * k, btop, bw, bh, k, prt);
    // 4. mid buildings, neon signs on the ones at the sides
    const signs = SIGNS.slice(); let si = 0, live = 0;
    x = X0 - R() * 20 * k;
    while (x < X1) {
      const w = (30 + R() * 40) * k, side = Math.abs(x + w / 2 - cx) > GL.w * 0.2;
      const top = sb - vh * (0.12 + R() * 0.2 + (side ? R() * 0.12 : 0));
      const sign = side && R() < 0.7 && si < signs.length ? { text: signs[si++], rgb: NEONS[(si + 1) % NEONS.length], live: lit && live < 2 && R() < 0.6 && QUALITY[QL].amb >= 0.5 } : null;
      if (sign && sign.live) live++;
      midBuilding(g, x, w, top, sb, k, P, R, rec, lit, sign);
      x += w + (2 + R() * 9) * k;
    }
    // 5. the elevated line (a train comes by now and then)
    const ty = sb - vh * 0.1, th = 2.6 * k;
    for (let px = X0 + 12 * k; px < X1; px += 48 * k) { fr(g, px, ty + th, 3.2 * k, sb - ty, P.near2); fr(g, px, ty + th, 0.7 * k, sb - ty, P.rim); }
    fr(g, X0, ty, X1 - X0, th, P.near2); fr(g, X0, ty, X1 - X0, 0.7 * k, P.rim);
    for (let px = X0; px < X1; px += 9 * k) sp(g, [px, ty + th, px + 4.5 * k, ty + th + 2.4 * k, px + 9 * k, ty + th], P.near2, 0.6 * k);
    rec.track = { y: ty, x0: X0, x1: X1, h: 8 * k };
    // 6. near rooftops, just below the window
    x = X0 - 10 * k;
    while (x < X1) {
      const w = (40 + R() * 60) * k, top = sb - vh * (0.015 + R() * 0.055);
      g.fillStyle = lin(g, 0, top, 0, sb, [0, P.near2, 1, P.near]); g.fillRect(x, top, w, sb - top + 2);
      fr(g, x, top, w, 0.8 * k, P.rim);
      if (R() < 0.6) waterTank(g, x + w * (0.2 + R() * 0.6), top, (9 + R() * 5) * k, k, P.near2, P.rim);
      if (R() < 0.5) { const ax = x + w * R(), ah = (10 + R() * 14) * k; sp(g, [ax, top, ax, top - ah], P.near2, 1 * k); sp(g, [ax - 3 * k, top - ah * 0.75, ax + 3 * k, top - ah * 0.75], P.near2, 0.8 * k); sp(g, [ax - 2 * k, top - ah * 0.55, ax + 2 * k, top - ah * 0.55], P.near2, 0.8 * k); }
      x += w + (4 + R() * 16) * k;
    }
    // 7. wires
    for (let i = 0; i < 2; i++) { const y0 = sb - vh * (0.2 + i * 0.07), sag = vh * 0.05; g.beginPath(); for (let j = 0; j <= 30; j++) { const t = j / 30; const yy = y0 + Math.sin(t * Math.PI) * sag + (i ? -t * vh * 0.04 : t * vh * 0.03); j ? g.lineTo(lerp(X0, X1, t), yy) : g.moveTo(X0, yy); } g.strokeStyle = 'rgba(6,6,16,0.75)'; g.lineWidth = Math.max(0.6, 0.7 * k); g.stroke(); }
    // where the drone, the plane and the birds fly
    rec.sky = { x0: X0, x1: X1, y0: vt + vh * 0.08, y1: hz - vh * 0.2 };
  }
  function bakeCity(gm, prt) {
    const GL = gm.GL, L = layer(GL.x, GL.y, GL.w, GL.h), rec = { blink: [], flick: [], tog: [], track: null, sky: null, k: 1 };
    paintCity(L.g, gm, CITYP[prt], prt, rec);
    { const b = rec.blink, idx = []; for (let i = 0; i < b.length; i += 3) idx.push(i); idx.sort((p, q) => b[p + 1] - b[q + 1]); rec.blink = idx.flatMap((i) => [b[i], b[i + 1], b[i + 2]]); }
    // the train: a sprite, lit windows after dark
    const k = rec.k, lit = prt !== 'day', cars = 5, cw = 34 * k, chh = 7.5 * k, T0 = layer(0, -chh - 2 * k, cars * (cw + 1.6 * k), chh + 4 * k), tg = T0.g;
    for (let i = 0; i < cars; i++) {
      const x0 = i * (cw + 1.6 * k);
      frr(tg, x0, -chh, cw, chh, i === 0 ? 3 * k : 1 * k, lit ? '#262b52' : '#d8dde8');
      fr(tg, x0, -chh, cw, 0.8 * k, lit ? 'rgba(169,188,255,0.5)' : '#ffffff');
      for (let w = x0 + 2.5 * k; w < x0 + cw - 3 * k; w += 4.6 * k) fr(tg, w, -chh + 2 * k, 3 * k, 2.6 * k, lit ? (i * 7 + w) % 3 < 2 ? '#ffd9a0' : '#cfe0ff' : '#5b6b95');
      fr(tg, x0, -2.2 * k, cw, 1.2 * k, lit ? '#ff5fa8' : '#3a7bd5');
    }
    rec.train = T0;
    return { L, rec };
  }

  // ═════════════════════════════ the sky (repainted as the hours pass) ═════════════════════════════
  function cloud(g, cx, cy, w, s, c1, c2, c3) {
    const R = mulberry(cx | 0);
    for (let i = 0; i < 8; i++) {
      const x = cx + (R() - 0.5) * w, y = cy + (R() - 0.5) * 8 * s, rx = (14 + R() * 26) * s, ry = (5 + R() * 6) * s;
      fe(g, x, y + 2 * s, rx, ry, c1); fe(g, x, y, rx * 0.92, ry * 0.85, c2); fe(g, x - rx * 0.2, y - ry * 0.4, rx * 0.55, ry * 0.36, c3);
    }
  }
  function paintSky(g, gm, hr, rain, prt) {
    const GL = gm.GL, x0 = GL.x, w = GL.w, vt = gm.vt, vh = gm.vh, sb = gm.sill, u = gm.u;
    const st = skyAt(hr, rain), V = skyVis(hr), k = clamp(vh / 230, 0.55, 2.4);
    g.fillStyle = lin(g, 0, vt, 0, sb, [0, css(st[0]), 0.3, css(st[1]), 0.56, css(st[2]), 0.8, css(st[3]), 1, css(mixc(st[3], st[2], 0.4))]);
    g.fillRect(x0, GL.y, w, sb - GL.y);
    if (rain) {
      // a low ceiling of cloud
      for (let i = 0; i < 6; i++) cloud(g, x0 + w * (i + 0.3) / 5.5, vt + vh * (0.06 + (i % 2) * 0.07), w * 0.4, k * 1.3, 'rgba(5,6,16,0.22)', css(mixc(st[1], [120, 130, 160], 0.25), 0.55), css(mixc(st[0], [200, 210, 230], 0.2), 0.28));
      return;
    }
    if (V.stars > 0.02) {
      const R = mulberry(11), n = Math.round(w * vh / 650);
      for (let i = 0; i < n; i++) { const x = x0 + R() * w, y = vt + Math.pow(R(), 1.6) * vh * 0.72, r = (0.35 + R() * 0.75) * Math.min(1.4, u), a = (0.25 + R() * 0.75) * V.stars; g.globalAlpha = a; fc(g, x, y, r, R() < 0.15 ? '#ffe9c4' : '#e8ecff'); if (r > 0.95 && R() < 0.4) { g.globalAlpha = a * 0.5; fr(g, x - r * 3, y - 0.25, r * 6, 0.5, '#e8ecff'); fr(g, x - 0.25, y - r * 3, 0.5, r * 6, '#e8ecff'); } }
      g.globalAlpha = 1;
    }
    if (V.moon > 0.02) {
      const ed = gm.scr.ed, mr = 10 * k, mx = ed.x + ed.w * 0.32, my = Math.max(vt + mr * 1.6, Math.min(gm.trY + vh * 0.13, ed.y - mr * 1.7));
      g.globalAlpha = V.moon;
      g.fillStyle = rad(g, mx, my, mr, mr * 6, [0, 'rgba(169,188,255,0.35)', 0.3, 'rgba(169,188,255,0.12)', 1, 'rgba(169,188,255,0)']); g.fillRect(mx - mr * 6, my - mr * 6, mr * 12, mr * 12);
      fc(g, mx, my, mr, rad(g, mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mr * 1.1, [0, '#ffffff', 0.6, '#e6eaff', 1, '#bfc8f2']));
      for (const [dx, dy, r] of [[0.3, 0.2, 0.22], [-0.25, 0.35, 0.14], [0.05, -0.35, 0.17], [-0.4, -0.1, 0.1]]) fc(g, mx + dx * mr, my + dy * mr, r * mr, 'rgba(150,160,210,0.35)');
      g.globalAlpha = 1;
    }
    if (V.sun > 0.02) {
      const sr = 13 * k, low = 1 - V.el, high = V.el > 0.55;
      const sx = high ? x0 + w * 0.86 : x0 + w * (0.24 + 0.52 * V.sp), sy = high ? vt - sr : sb - vh * 0.34 - V.el * vh * 1.1;
      const core = mixc([255, 250, 235], [255, 190, 120], low), halo = mixc([255, 250, 230], [255, 150, 90], low);
      g.globalAlpha = V.sun;
      g.fillStyle = rad(g, sx, sy, sr * 0.8, sr * (high ? 9 : 8 + low * 8), [0, css(halo, 0.6), 0.25, css(halo, 0.24), 1, css(halo, 0)]); g.fillRect(sx - sr * 16, sy - sr * 16, sr * 32, sr * 32);
      if (!high) fc(g, sx, sy, sr, css(core));
      g.globalAlpha = 1;
    }
    // clouds: fluffy by day, lit from below at dawn and dusk, faint wisps at night
    const R = mulberry(31), n = prt === 'day' ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (0.1 + R() * 0.8), cy = vt + vh * (0.12 + R() * 0.28), cw = w * (0.25 + R() * 0.2);
      if (prt === 'day') cloud(g, cx, cy, cw, k, 'rgba(150,175,215,0.35)', 'rgba(255,255,255,0.75)', 'rgba(255,255,255,0.9)');
      else if (prt === 'dawn') cloud(g, cx, cy, cw * 1.3, k * 0.6, 'rgba(120,80,140,0.3)', 'rgba(255,170,170,0.45)', 'rgba(255,225,200,0.55)');
      else if (prt === 'dusk') cloud(g, cx, cy, cw * 1.3, k * 0.6, 'rgba(60,30,90,0.35)', 'rgba(255,120,120,0.4)', 'rgba(255,200,150,0.5)');
      else { const ww = cw * 1.4, hh = 2.2 * k; for (let j = 0; j < 3; j++) { const yy = cy + j * 3 * k, xx = cx + (j - 1) * ww * 0.12; fe(g, xx, yy, ww * (0.5 - j * 0.1), hh * (1 - j * 0.2), 'rgba(40,40,90,0.28)'); fe(g, xx - ww * 0.05, yy - hh * 0.4, ww * (0.42 - j * 0.1), hh * 0.35, 'rgba(169,188,255,0.1)'); } }
    }
  }
  function bakeOutside(gm, city, hr, rain, prt) {
    const GL = gm.GL, L = layer(GL.x, GL.y, GL.w, GL.h), g = L.g;
    paintSky(g, gm, hr, rain, prt);
    blit(g, city.L);
    if (rain) {
      g.fillStyle = lin(g, 0, gm.vt, 0, gm.sill, [0, 'rgba(70,80,110,0.10)', 0.6, 'rgba(80,90,120,0.22)', 1, 'rgba(90,100,130,0.3)']); g.fillRect(GL.x, GL.y, GL.w, GL.h);
      if (QUALITY[QL].rain === 0) { const R = mulberry(4), d = SPR0.drop; for (let i = 0; i < Math.round(GL.w * gm.vh / 1400); i++) { const r = (1 + R() * 2.4) * gm.u; g.drawImage(d, GL.x + R() * GL.w - r * 1.3, gm.vt + R() * gm.vh - r * 1.3, r * 2.6, r * 2.6); } }
    }
    return L;
  }

  // ═════════════════════════════ the room (wall, window, sill, desk; their light) ═════════════════════════════
  function paintWall(g, gm, P, prt) {
    const W = gm.wide ? gm.ui.x : gm.W, top = gm.deskY, u = gm.u;
    g.fillStyle = lin(g, 0, 0, 0, top, [0, P.wall[0], 1, P.wall[1]]); g.fillRect(0, 0, W, top + 2);
    const R = mulberry(8);
    for (let i = 0; i < W * top / 90; i++) { g.globalAlpha = 0.04 + R() * 0.05; fr(g, R() * W, R() * top, 1 + R() * 2, 1 + R() * 2, R() < 0.5 ? '#000' : '#fff'); }
    g.globalAlpha = 1;
    // warm light from the lamp, mint from the screens, a cool spill around the window
    glow(g, gm.lamp.x + 10 * u, gm.lamp.y - 50 * u, 150 * u, 120 * u, PAL.amberRGB, 0.2 * P.lamp, 0.25);
    const ed = gm.scr.ed, sc = gm.scr.st;
    glow(g, ed.x + ed.w / 2, ed.y + ed.h / 2, ed.w * 1.4, ed.h * 1.6, PAL.mintRGB, 0.07, 0.3);
    glow(g, sc.x + sc.w / 2, sc.y + sc.h, sc.w * 1.4, sc.h * 2.4, PAL.mintRGB, 0.06, 0.3);
    if (gm.wide && !gm.short) {
      // the room's corners fall into shadow
      g.fillStyle = lin(g, 0, 0, W * 0.12, 0, [0, 'rgba(0,0,0,0.35)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, W * 0.12, top);
      g.fillStyle = lin(g, 0, 0, 0, gm.WF.y, [0, 'rgba(0,0,0,0.3)', 1, 'rgba(0,0,0,0)']); g.fillRect(0, 0, W, gm.WF.y);
      // her </> neon on the wall, left of the window
      const nx = gm.WF.x * 0.5, ny = gm.WF.y + gm.WF.h * 0.42, s = Math.min(gm.WF.x * 0.55, 34 * u);
      if (s > 16) { glow(g, nx, ny, s * 1.8, s * 1.2, PAL.mintRGB, prt === 'day' ? 0.12 : 0.3, 0.35); neonText(g, '</>', nx, ny, s * 0.62, [61, 255, 194], u * 0.7, prt === 'day' ? 0.6 : 1, false, FONT.mono); }
    }
  }
  function paintWindow(g, gm, P, prt) {
    const WF = gm.WF, GL = gm.GL, u = gm.u, ft = gm.ft;
    // the frame's shadow on the wall, the frame, the glass
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(WF.x - 3 * u, WF.y - 2 * u, WF.w + 6 * u, gm.sill - WF.y + 4 * u);
    g.fillStyle = lin(g, WF.x, 0, WF.x + WF.w, 0, [0, P.frame2, 0.5, P.frame, 1, P.frame2]); g.fillRect(WF.x, WF.y, WF.w, gm.sill - WF.y);
    g.globalCompositeOperation = 'destination-out';
    for (const p of gm.panes) g.fillRect(p.x, p.y, p.w, p.h);
    g.globalCompositeOperation = 'source-over';
    // rim light on the frame and the bars (moon side), a shadow on the far edges
    fr(g, WF.x, WF.y, 1.2, gm.sill - WF.y, P.hi); fr(g, WF.x, WF.y, WF.w, 1.2, P.hi);
    fr(g, GL.x + GL.w, GL.y, 1, GL.h, P.hi);
    for (const b of gm.bars) { fr(g, b.x, b.y, b.w > b.h ? b.w : 1, b.w > b.h ? 1 : b.h, P.hi); fr(g, b.w > b.h ? b.x : b.x + b.w - 1, b.w > b.h ? b.y + b.h - 1 : b.y, b.w > b.h ? b.w : 1, b.w > b.h ? 1 : b.h, 'rgba(0,0,0,0.45)'); }
    for (const p of gm.panes) { fr(g, p.x, p.y, p.w, 1.2 * u, 'rgba(0,0,0,0.35)'); fr(g, p.x, p.y, 1.2 * u, p.h, 'rgba(0,0,0,0.25)'); }
    // rivets at the bar crossings
    for (const b of gm.bars) if (b.w < b.h) fc(g, b.x + b.w / 2, gm.trY, gm.mw * 0.42, P.frame2);
    // the glass: a faint sheen, the lamp's reflection
    for (const p of gm.panes) {
      g.fillStyle = lin(g, 0, p.y, 0, p.y + p.h, [0, `rgba(255,255,255,${P.glaze})`, 0.35, 'rgba(255,255,255,0)', 1, 'rgba(255,255,255,0)']); g.fillRect(p.x, p.y, p.w, p.h);
      g.save(); g.beginPath(); g.rect(p.x, p.y, p.w, p.h); g.clip();
      g.fillStyle = `rgba(255,255,255,${(P.glaze * 0.55).toFixed(3)})`;
      const sx = p.x + p.w * 0.55; g.beginPath(); g.moveTo(sx, p.y); g.lineTo(sx + p.w * 0.16, p.y); g.lineTo(sx - p.h * 0.5 + p.w * 0.16, p.y + p.h); g.lineTo(sx - p.h * 0.5, p.y + p.h); g.closePath(); g.fill();
      g.restore();
    }
    if (prt !== 'day') glow(g, gm.lamp.x + 30 * u, gm.sill - 34 * u, 40 * u, 30 * u, PAL.amberRGB, 0.14, 0.4);
  }
  function paintSill(g, gm, P) {
    const u = gm.u, y = gm.sill, x0 = gm.WF.x - 6 * u, w = gm.WF.w + 12 * u, th = 4 * u, fh = 6 * u;
    fr(g, x0, y + th + fh, w, 7 * u, lin(g, 0, y + th + fh, 0, y + th + fh + 7 * u, [0, 'rgba(0,0,0,0.4)', 1, 'rgba(0,0,0,0)']));
    fr(g, x0, y - 0.5, w, th + 0.5, lin(g, 0, y, 0, y + th, [0, mixh(P.sill[0], '#ffffff', 0.12), 1, P.sill[0]]));
    fr(g, x0, y + th, w, fh, lin(g, 0, y + th, 0, y + th + fh, [0, P.sill[1], 1, mixh(P.sill[1], '#000000', 0.35)]));
    fr(g, x0, y - 0.5, w, 1, P.hi); fr(g, x0, y + th, w, 0.8, 'rgba(255,255,255,0.08)');
  }
  // a cast-iron radiator under the window (the wall between the sill and the desk)
  function paintRadiator(g, gm, P, prt) {
    const r = gm.rad, u = gm.u; if (r.y1 - r.y0 < 14 * u) return;
    const h = r.y1 - r.y0, n = Math.floor((r.x1 - r.x0) / (9 * u)), fw = (r.x1 - r.x0) / n, night = prt !== 'day';
    const c0 = night ? '#2a3366' : '#56649a', c1 = night ? '#161b3c' : '#323d6a', hi = night ? 'rgba(169,188,255,0.35)' : 'rgba(255,255,255,0.45)';
    fr(g, r.x0 - 2 * u, r.y0 + 4 * u, r.x1 - r.x0 + 4 * u, h, 'rgba(0,0,0,0.3)');
    fr(g, r.x0, r.y0 + 5 * u, r.x1 - r.x0, 3.2 * u, c1); fr(g, r.x0, r.y1 - 9 * u, r.x1 - r.x0, 3.2 * u, c1);
    for (let i = 0; i < n; i++) {
      const x = r.x0 + i * fw + fw * 0.12, w = fw * 0.76;
      frr(g, x, r.y0, w, h, w * 0.45, lin(g, x, 0, x + w, 0, [0, c0, 0.55, c1, 1, mixh(c1, '#000000', 0.3)]));
      fr(g, x + w * 0.18, r.y0 + w * 0.4, Math.max(0.8, w * 0.14), h - w, hi);
    }
    sp(g, [r.x1 - 4 * u, r.y1 - 6 * u, r.x1 + 6 * u, r.y1 - 6 * u, r.x1 + 6 * u, r.y1 + 20 * u], c1, 3.4 * u);
    fc(g, r.x1 + 6 * u, r.y1 - 6 * u, 3 * u, '#c9a24a');
    if (night) glow(g, gm.lamp.x + 30 * u, (r.y0 + r.y1) / 2, 90 * u, 40 * u, PAL.amberRGB, 0.16, 0.3);
  }
  function paintDuck(g, u) {
    shadowE(g, 2 * u, 0, 13 * u, 3 * u, 0.4);
    g.lineWidth = 2.2 * u; g.strokeStyle = OUTL;
    g.beginPath(); g.ellipse(0, -6 * u, 11 * u, 6.5 * u, 0, 0, TAU); g.stroke(); g.fillStyle = lin(g, 0, -13 * u, 0, 0, [0, '#ffe066', 1, '#e8a91c']); g.fill();
    g.beginPath(); g.moveTo(8 * u, -9 * u); g.quadraticCurveTo(15 * u, -12 * u, 12 * u, -5 * u); g.closePath(); g.fillStyle = '#e8a91c'; g.fill();
    g.beginPath(); g.arc(-4 * u, -14 * u, 6 * u, 0, TAU); g.stroke(); g.fillStyle = lin(g, 0, -20 * u, 0, -8 * u, [0, '#fff08a', 1, '#f2c12e']); g.fill();
    fe(g, -10.5 * u, -13 * u, 3.6 * u, 1.8 * u, '#ff8a3d', 0.1);
    fc(g, -5.5 * u, -15.5 * u, 1.2 * u, '#13152a'); fc(g, -5.9 * u, -15.9 * u, 0.4 * u, '#fff');
    fe(g, 2 * u, -8 * u, 5 * u, 2.6 * u, 'rgba(255,255,255,0.35)', -0.3);
    // mint glasses: it's Patch's duck
    g.strokeStyle = MINT; g.lineWidth = 0.9 * u; g.beginPath(); g.rect(-8 * u, -17 * u, 4.6 * u, 3.2 * u); g.rect(-3 * u, -17 * u, 4.6 * u, 3.2 * u); g.stroke();
  }
  // a closed notebook lying on the desk, a pen beside it (seen from above and in front, turned a little)
  function paintBook(g, u) {
    const w = 46 * u, d = 30 * u, back = 0.9, th = 3.2 * u;
    g.save(); g.rotate(-0.12);
    shadowE(g, 3 * u, 1.5 * u, w * 0.62, 7 * u, 0.38);
    const bx0 = -w * back / 2, bx1 = w * back / 2, fx0 = -w / 2, fx1 = w / 2;
    // pages (front and right edges), then the cover
    fp(g, [fx0, 0, fx1, 0, fx1, th, fx0, th], '#e7dfcc');
    for (let i = 1; i < 4; i++) fr(g, fx0 + 1 * u, i * th / 4, w - 2 * u, 0.35 * u, 'rgba(110,90,60,0.35)');
    fp(g, [fx1, 0, bx1, -d, bx1, -d + th, fx1, th], '#d6ccb6');
    fp(g, [fx0, 0, fx1, 0, bx1, -d, bx0, -d], lin(g, 0, -d, 0, 0, [0, '#2f6475', 1, '#1c3d4c']));
    sp(g, [fx0, 0, fx1, 0, bx1, -d, bx0, -d, fx0, 0], 'rgba(10,16,30,0.6)', 0.9 * u);
    fp(g, [fx0, 0, fx0 + 6 * u, 0, bx0 + 5.4 * u, -d, bx0, -d], 'rgba(10,20,36,0.35)');
    // the elastic band and a </> sticker
    const ex = w * 0.3; sp(g, [ex, 0.5 * u, ex * back, -d - 0.5 * u], '#151f3a', 1.8 * u);
    g.save(); g.translate(-3 * u, -d * 0.5); g.transform(1, 0, 0.04, 1, 0, 0); frr(g, -9 * u, -4.5 * u, 18 * u, 9 * u, 1.6 * u, '#14182e'); txt(g, '</>', 0, 0.2 * u, 5.4 * u, FONT.mono, MINT, 'center'); g.restore();
    g.restore();
    // the pen
    g.save(); g.translate(w * 0.62, -d * 0.2); g.rotate(-1.15);
    frr(g, -14 * u, -1.3 * u, 28 * u, 2.6 * u, 1.3 * u, '#f5c542'); fr(g, -14 * u, -1.3 * u, 5 * u, 2.6 * u, '#2a2f55'); fp(g, [14 * u, -1.3 * u, 18 * u, 0, 14 * u, 1.3 * u], '#e9dcc0');
    fr(g, -8 * u, -1.3 * u, 18 * u, 0.7 * u, 'rgba(255,255,255,0.5)');
    g.restore();
  }
  function paintPot(g, gm, prt) {
    const u = gm.u, cx = gm.plant.x, by = gm.sill, pw = gm.potW, ph = gm.potH;
    shadowE(g, cx + 2 * u, by + 0.5 * u, pw * 0.65, 2.6 * u, 0.45);
    g.beginPath(); g.moveTo(cx - pw / 2, by - ph + 4 * u); g.lineTo(cx + pw / 2, by - ph + 4 * u); g.lineTo(cx + pw * 0.38, by); g.lineTo(cx - pw * 0.38, by); g.closePath();
    g.lineWidth = 2 * u; g.strokeStyle = OUTL; g.stroke();
    g.fillStyle = lin(g, cx - pw / 2, 0, cx + pw / 2, 0, [0, '#e8936a', 0.45, '#c4683f', 1, '#7a3a22']); g.fill();
    fr(g, cx - pw * 0.42, by - ph * 0.45, pw * 0.84, 2.2 * u, MINT);
    srr(g, cx - pw / 2 - 1.5 * u, by - ph, pw + 3 * u, 5 * u, 1.5 * u, OUTL, 2 * u);
    frr(g, cx - pw / 2 - 1.5 * u, by - ph, pw + 3 * u, 5 * u, 1.5 * u, lin(g, cx - pw / 2, 0, cx + pw / 2, 0, [0, '#f2a679', 0.5, '#d27a4e', 1, '#8a4126']));
    fe(g, cx, by - ph + 0.8 * u, pw / 2 - 0.5 * u, 1.5 * u, '#3a2418');
    if (prt !== 'day') { g.fillStyle = lin(g, cx - pw / 2, 0, cx + pw / 2, 0, [0, 'rgba(255,170,90,0.08)', 0.5, 'rgba(10,12,40,0)', 1, 'rgba(10,12,40,0.3)']); g.fillRect(cx - pw / 2 - 2 * u, by - ph, pw + 4 * u, ph); }
  }
  function paintDesk(g, gm, P, D, prt) {
    const top = gm.deskY, W = gm.wide ? gm.ui.x : gm.W, H = gm.H, u = gm.u, R = mulberry(77);
    g.fillStyle = lin(g, 0, top, 0, H, [0, D.wood[0], 0.4, D.wood[1], 1, D.wood[2]]); g.fillRect(0, top, W, H - top);
    // planks running away from us
    const vpx = gm.patch.x, vpy = top - Math.max(W, H - top) * 1.6, spread = (H - vpy) / (top - vpy), pw = 44 * u;
    for (let sx = vpx - Math.ceil((vpx + pw) / pw) * pw; sx < W + pw * 2; sx += pw) {
      const ex = vpx + (sx - vpx) * spread;
      sp(g, [sx, top, ex, H], D.seam, 1.3); sp(g, [sx + 1.3, top, ex + 1.3 * spread, H], D.seamHi, 1);
      for (let j = 0; j < 4; j++) {
        const f = 0.15 + R() * 0.7, t0 = R() * 0.6, t1 = t0 + 0.15 + R() * 0.4;
        const ax = sx + pw * f, bx = vpx + (ax - vpx) * spread;
        g.beginPath(); g.moveTo(lerp(ax, bx, t0), lerp(top, H, t0)); g.quadraticCurveTo(lerp(ax, bx, (t0 + t1) / 2) + (R() - 0.5) * 3 * u, lerp(top, H, (t0 + t1) / 2), lerp(ax, bx, Math.min(1, t1)), lerp(top, H, Math.min(1, t1)));
        g.strokeStyle = D.grain; g.lineWidth = 0.8 + R() * 1.2; g.stroke();
      }
    }
    // the desk mat under the timer (phones in portrait)
    if (!gm.wide) {
      const mat = (inset) => {
        const my = top + 12 * u + inset, m0 = 14 * u + inset, m1 = W - 14 * u - inset, r = 14 * u - inset * 0.5, yb = H + 30;
        const at = (x0, y) => vpx + (x0 - vpx) * (y - vpy) / (my - vpy);
        g.beginPath(); g.moveTo(m0 + r, my); g.lineTo(m1 - r, my); g.quadraticCurveTo(m1, my, at(m1, my + r), my + r); g.lineTo(at(m1, yb), yb); g.lineTo(at(m0, yb), yb); g.lineTo(at(m0, my + r), my + r); g.quadraticCurveTo(m0, my, m0 + r, my); g.closePath();
        return my;
      };
      g.save();
      const my = mat(0);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.translate(0, 2 * u); g.fill(); g.translate(0, -2 * u);
      g.fillStyle = lin(g, 0, my, 0, H, [0, D.mat[0], 1, D.mat[1]]); g.fill();
      g.strokeStyle = D.matEdge; g.lineWidth = 1.2; g.stroke();
      g.clip();
      mat(6 * u);
      g.setLineDash([3 * u, 2.4 * u]); g.strokeStyle = D.stitch; g.lineWidth = 1 * u; g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 260; i++) { g.globalAlpha = 0.05; fr(g, R() * W, my + R() * (H - my), 1, 1, R() < 0.5 ? '#000' : '#fff'); }
      g.globalAlpha = 1;
      g.restore();
    }
    // light: the lamp pool, a cool line from the window, mint from the screens; vignette
    const lx = gm.lamp.x + 34 * u, ly = top + 46 * u, pr = Math.max(W * 0.95, 300 * u);
    g.save(); g.globalCompositeOperation = D === DESKP.day ? 'source-over' : 'lighter';
    g.fillStyle = rad(g, lx, ly, 0, pr, [0, `rgba(255,190,110,${D.pool * P.lamp})`, 0.35, `rgba(255,170,90,${D.pool * P.lamp * 0.45})`, 1, 'rgba(255,170,90,0)']); g.fillRect(0, top, W, H - top);
    g.fillStyle = lin(g, 0, top, 0, top + 34 * u, [0, css(P.cool, 0.16), 1, css(P.cool, 0)]); g.fillRect(0, top, W, 34 * u);
    if (prt !== 'day') for (const s of [gm.scr.ed, gm.scr.st]) { g.fillStyle = rad(g, s.x + s.w / 2, top, 0, s.w * 1.2, [0, 'rgba(61,255,194,0.11)', 1, 'rgba(61,255,194,0)']); g.fillRect(s.x - s.w, top, s.w * 3, s.w * 1.3); }
    g.restore();
    g.fillStyle = rad(g, W / 2, top, Math.min(W, H) * 0.35, Math.max(W, H - top) * 1.05, [0, 'rgba(0,0,0,0)', 1, `rgba(0,0,0,${D.vign})`]); g.fillRect(0, top, W, H - top);
    // (the tomato's wide soft shadow is a sprite, S.tsh, drawn per frame so it can leave with the tomato)
    // the back edge
    fr(g, 0, top - 1, W, 2.2, 'rgba(3,3,10,0.6)');
    fr(g, 0, top + 1.2, W, 1, D.edgeHi);
  }
  function paintColumn(g, gm, P, D) {
    const ux = gm.ui.x, W = gm.W, H = gm.H, u = gm.u, d = gm.dial, day = D === DESKP.day;
    g.fillStyle = lin(g, 0, 0, 0, H, [0, D.col[0], 1, D.col[1]]); g.fillRect(ux, 0, W - ux, H);
    for (let sx = ux + 14 * u; sx < W; sx += 14 * u) { fr(g, sx, 0, 1, H, D.slat); fr(g, sx + 1, 0, 1, H, D.slatHi); }
    // a soft spot of light over the tomato
    g.save(); g.globalCompositeOperation = day ? 'source-over' : 'lighter';
    g.fillStyle = rad(g, d.cx, d.cy - d.r * 0.4, 0, d.r * 2.6, day ? [0, 'rgba(255,255,255,0.4)', 1, 'rgba(255,255,255,0)'] : [0, 'rgba(255,190,120,0.13)', 0.5, 'rgba(255,170,100,0.05)', 1, 'rgba(255,170,100,0)']);
    g.fillRect(ux, d.cy - d.r * 3, W - ux, d.r * 6);
    g.restore();
    // the timer floats a little off the wall: a soft shadow below and behind it
    shadowE(g, d.cx + 4 * u, d.cy + d.r * 0.55, d.r * 1.05, d.r * 0.42, day ? 0.16 : 0.42);
    // the pillar between the room and the column
    g.fillStyle = lin(g, ux - 6 * u, 0, ux + 3 * u, 0, day ? [0, '#d9cbb4', 1, '#cbbba2'] : [0, '#1a1f46', 1, '#0d1028']); g.fillRect(ux - 6 * u, 0, 9 * u, H);
    fr(g, ux - 6 * u, 0, 1.2, H, day ? 'rgba(255,255,255,0.7)' : P.hi);
    fr(g, ux + 3 * u, 0, 6 * u, H, lin(g, ux + 3 * u, 0, ux + 9 * u, 0, [0, day ? 'rgba(80,60,30,0.18)' : 'rgba(0,0,0,0.4)', 1, 'rgba(0,0,0,0)']));
  }
  function bakeRoom(gm, prt, th, S) {
    const L = layer(0, 0, gm.W, gm.H), g = L.g, P = ROOMP[prt], D = DESKP[th];
    paintWall(g, gm, P, prt);
    paintWindow(g, gm, P, prt);
    paintRadiator(g, gm, P, prt);
    paintSill(g, gm, P);
    paintPot(g, gm, prt);
    paintDesk(g, gm, P, D, prt);
    if (gm.book) { g.save(); g.translate(gm.book.x, gm.book.y); paintBook(g, gm.u); g.restore(); }
    if (gm.wide) paintColumn(g, gm, P, D);
    // the desk props that never move: Patch is cut off at the desk line and never reaches the sides, so they can
    // live in the background (heads-down dims them with the rest of the room)
    if (S) {
      const at = (Lz, x, y) => g.drawImage(Lz.c, x + Lz.x, y + Lz.y, Lz.w, Lz.h);
      at(S.lamp, gm.lamp.x, gm.lamp.y);
      glow(g, gm.lamp.x, gm.lamp.y - 38 * gm.u, 48 * gm.u, 26 * gm.u, PAL.amberRGB, 0.6 * P.lamp, 0.5);
      at(S.radio, gm.radio.x, gm.radio.y);
      at(S.mug, gm.mug.x, gm.mug.y);
    }
    return L;
  }
  function compose(gm, out, room) {
    const c = makeCanvas(Math.round(gm.W * gm.dpr), Math.round(gm.H * gm.dpr)), x = c.getContext('2d');
    x.setTransform(gm.dpr, 0, 0, gm.dpr, 0, 0);
    x.fillStyle = '#0c0f22'; x.fillRect(0, 0, gm.W, gm.H);
    blit(x, out); blit(x, room);
    return { c, x };
  }
  function cropWin(gm, room) {
    const y0 = Math.max(0, gm.WF.y - 2), L = layer(gm.WF.x - 2, y0, gm.WF.w + 4, gm.sill + 2 - y0);
    blit(L.g, room);
    return L;
  }

  // ═════════════════════════════ the screens' content (re-baked on state changes, never per frame) ═════════════════════════════
  const CODE = [
    "import { ship } from 'patch'",
    '',
    'const TOMATO = 25',
    '',
    'async function focus(task) {',
    '  lofi.play()',
    '  while (timer.on) {',
    '    const t = await next()',
    '    if (t.rogue) {',
    '      jar.add(t)',
    '      continue',
    '    }',
    '    task.do(t)',
    '  }',
    '  return ship(task)',
    '}',
    '',
    '// one thing at a time',
    'for (const r of jar) {',
    '  r.later()',
    '}',
    '',
    'tea.sip()',
    "git commit -m 'tomato'",
    '',
  ];
  const KW = /^(import|from|const|let|async|function|await|while|if|return|continue|for|of|new)\b/;
  const CODE_COL = ['rgba(61,255,194,0.95)', '#a9bcff', '#ffb35c', 'rgba(61,255,194,0.42)', '#f5c542', 'rgba(210,255,240,0.75)'];
  function tokens(line) {
    const out = []; let i = 0;
    while (i < line.length) {
      const rest = line.slice(i);
      if (rest.startsWith('//')) { out.push([rest, 3]); break; }
      let m = rest.match(/^'[^']*'/) || rest.match(/^"[^"]*"/); if (m) { out.push([m[0], 2]); i += m[0].length; continue; }
      m = rest.match(KW); if (m) { out.push([m[0], 1]); i += m[0].length; continue; }
      m = rest.match(/^\d+/); if (m) { out.push([m[0], 4]); i += m[0].length; continue; }
      m = rest.match(/^[A-Za-z_$][\w$.]*/); if (m) { out.push([m[0], 0]); i += m[0].length; continue; }
      out.push([rest[0], 5]); i++;
    }
    return out;
  }
  function codeLine(g, line, x, y, cw) { let cx = x; for (const [s, c] of tokens(line)) { g.fillStyle = CODE_COL[c]; g.fillText(s, cx, y); cx += s.length * cw; } }
  // a screen's content area, in screen-local coords
  const scrHdr = (s, u) => Math.round(Math.max(7, s.h * 0.15, 6.5 * u));
  function bakeCodeStrip(s, fs) {
    const lh = Math.round(fs * 1.32 * 10) / 10, L = layer(0, 0, s.w, CODE.length * lh + 2), g = L.g;
    g.font = `700 ${fs}px ${FONT.mono}`; g.textBaseline = 'middle'; g.textAlign = 'left';
    const cw = g.measureText('M').width;
    CODE.forEach((ln, i) => codeLine(g, ln, 0, i * lh + lh / 2, cw));
    return { L, lh, cw, rows: CODE.length };
  }
  function check(g, x, y, s, col) { g.beginPath(); g.moveTo(x - s * 0.5, y); g.lineTo(x - s * 0.15, y + s * 0.38); g.lineTo(x + s * 0.55, y - s * 0.42); g.strokeStyle = col; g.lineWidth = s * 0.22; g.stroke(); }
  function pips(g, x, y, n, done, r, gap, maxW) {
    const k = Math.min(1, maxW / Math.max(1, n * (r * 2 + gap)));
    for (let i = 0; i < n; i++) { const cx = x + i * (r * 2 + gap) * k + r * k; if (i < done) { fc(g, cx, y, r * k, PAL.tomato); fc(g, cx - r * k * 0.3, y - r * k * 0.3, r * k * 0.3, 'rgba(255,255,255,0.7)'); } else { g.beginPath(); g.arc(cx, y, r * k * 0.82, 0, TAU); g.strokeStyle = 'rgba(61,255,194,0.6)'; g.lineWidth = Math.max(0.6, r * k * 0.3); g.stroke(); } }
  }
  function todaySessions() { const t0 = dayStart(), out = []; if (DB) for (const s of DB.sessions) if (s.kind === 'focus' && s.ok !== false && s.end >= t0) out.push(s); return out; }
  // The screens tuck behind Patch's head on their inner side (depth), so their words keep clear of it:
  // the editor's text stops short of its right edge (XR), the status and clock start in from their left (XL).
  function paintScreen(id, mode, s, u, fs, extra) {
    const L = layer(0, 0, s.w, s.h), g = L.g, hdr = scrHdr(s, u), pad = Math.max(3, 3 * u), W = s.w, H = s.h;
    const XR = id === 'ed' ? W - pad - Math.round(W * 0.18) : W - pad, XL = pad + (id === 'st' ? Math.round(W * 0.14) : id === 'mi' ? Math.round(W * 0.12) : 0);
    const font = (px, w) => `${w || 700} ${px}px ${FONT.mono}`;
    g.textBaseline = 'middle';
    const title = (t) => txt(g, t, W - pad - 1, hdr / 2 + 1, Math.max(5, hdr * 0.5), FONT.mono, 'rgba(61,255,194,0.7)', 'right');
    if (id === 'ed') {
      if (mode === 'idle') {
        title('~/dojo');
        const tf = fitSize(g, '$ git log --today', XR - pad, fs, FONT.mono);
        g.textAlign = 'left'; g.font = font(tf); const lh = tf * 1.32, cw = g.measureText('M').width; let y = hdr + pad + lh / 2;
        const ss = todaySessions().slice(-Math.max(1, Math.floor((H - hdr - pad * 2) / lh) - 3)).reverse();
        codeLine(g, '$ git log --today', pad, y, cw); y += lh;
        if (!ss.length) { g.fillStyle = CODE_COL[3]; g.fillText('(nothing yet)', pad, y); y += lh; }
        for (const x of ss) { const d = new Date(x.end); g.fillStyle = CODE_COL[4]; g.fillText('*', pad, y); g.fillStyle = CODE_COL[0]; g.fillText(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, pad + cw * 2, y); g.fillStyle = CODE_COL[2]; g.fillText(`${Math.max(1, Math.round(x.actual / 60))}m`, pad + cw * 8, y); y += lh; }
        codeLine(g, '$', pad, y, cw);
        L.cur = { x: pad + cw * 2, y: y - lh * 0.42, w: cw * 0.9, h: lh * 0.84 };
      } else if (mode === 'brk') {
        title('afk');
        const mx = (pad + XR) / 2;
        txt(g, 'BREAK', mx, hdr + (H - hdr) * 0.36, fitSize(g, 'BREAK', XR - pad, Math.min(fs * 2.2, (H - hdr) * 0.3), FONT.display, 400), FONT.display, 'rgba(255,179,92,0.95)', 'center', 'middle', 400);
        txt(g, 'eyes off the screen', mx, H - pad - fs * 0.6, fitSize(g, 'eyes off the screen', XR - pad, fs * 0.92, FONT.mono), FONT.mono, 'rgba(255,200,140,0.65)', 'center');
      } else if (mode === 'done') {
        title('build');
        const cy = hdr + (H - hdr) * 0.3, bs = Math.min(fs * 1.9, (H - hdr) * 0.3);
        check(g, pad + bs * 0.45, cy, bs * 0.8, MINT);
        const tx = pad + bs * 1.05, ts = fitSize(g, 'BUILD PASSED', XR - tx, bs * 0.62, FONT.display, 400);
        txt(g, 'BUILD', tx, cy, ts, FONT.display, '#eafff7', 'left', 'middle', 400);
        const bw = g.measureText('BUILD ').width;
        txt(g, 'PASSED', tx + bw, cy, ts, FONT.display, MINT, 'left', 'middle', 400);
        const n = extra && extra.n || nToday, r = extra && extra.rogues || 0;
        const l1 = `tomato #${n} shipped`, l2 = r ? `0 errors · ${r} quarantined` : '0 errors · 0 warnings';
        txt(g, l1, pad, hdr + (H - hdr) * 0.62, fitSize(g, l1, XR - pad, fs * 0.92, FONT.mono), FONT.mono, CODE_COL[0]);
        txt(g, l2, pad, hdr + (H - hdr) * 0.85, fitSize(g, l2, XR - pad, fs * 0.85, FONT.mono), FONT.mono, CODE_COL[3]);
      } else if (mode === 'today') {
        title('today');
        const ss = todaySessions(), sec = ss.reduce((a, x) => a + (x.actual || 0), 0);
        txt(g, String(ss.length), pad, hdr + (H - hdr) * 0.4, Math.min(fs * 3.4, (H - hdr) * 0.52), FONT.display, '#ff7a6a', 'left', 'middle', 400);
        g.font = `400 ${Math.min(fs * 3.4, (H - hdr) * 0.52)}px ${FONT.display}`; const nw = g.measureText(String(ss.length)).width;
        txt(g, ss.length === 1 ? 'tomato' : 'tomatoes', pad + nw + fs * 0.6, hdr + (H - hdr) * 0.36, fs, FONT.mono, CODE_COL[0]);
        txt(g, 'today', pad + nw + fs * 0.6, hdr + (H - hdr) * 0.36 + fs * 1.2, fs * 0.9, FONT.mono, CODE_COL[3]);
        const l3 = `focus ${hm(sec)} · rogues ${kinds.length}`;
        txt(g, l3, pad, H - pad - fs * 0.7, fitSize(g, l3, XR - pad, fs * 0.9, FONT.mono), FONT.mono, CODE_COL[2]);
      } else if (mode === 'pause') {
        frr(g, 0, H * 0.38, W, H * 0.3, 0, 'rgba(5,10,20,0.82)');
        fr(g, 0, H * 0.38, W, 1, 'rgba(61,255,194,0.6)'); fr(g, 0, H * 0.68 - 1, W, 1, 'rgba(61,255,194,0.6)');
        const bs = H * 0.13, mx = (pad + XR) / 2; fr(g, mx - bs * 2.4, H * 0.53 - bs * 0.6, bs * 0.38, bs * 1.2, MINT); fr(g, mx - bs * 1.8, H * 0.53 - bs * 0.6, bs * 0.38, bs * 1.2, MINT);
        txt(g, 'PAUSED', mx - bs * 1.1, H * 0.535, fitSize(g, 'PAUSED', XR - (mx - bs * 1.1), bs * 0.95, FONT.mono), FONT.mono, MINT, 'left');
      } else if (mode === 'code') { title('focus.ts'); }
    } else if (id === 'st') {
      const n = nToday, gl = goal;
      const lab = { idle: ['READY', MINT], focus: ['FOCUS', MINT], pause: ['PAUSED', 'rgba(61,255,194,0.75)'], brk: ['BREAK', '#ffb35c'], long: ['LONG BREAK', '#ffb35c'], done: ['SHIPPED', '#eafff7'] }[mode] || ['READY', MINT];
      txt(g, lab[0], W - pad - 1, hdr / 2 + 1, Math.max(5, hdr * 0.56), FONT.mono, lab[1], 'right');
      const body = H - hdr, by = hdr + body * 0.4, big = Math.min(body * 0.48, fs * 2.2);
      txt(g, String(n), XL, by, big, FONT.display, mode === 'done' ? '#ff7a6a' : '#eafff7', 'left', 'middle', 400);
      g.font = `400 ${big}px ${FONT.display}`; const nw = g.measureText(String(n)).width;
      txt(g, `/${gl}`, XL + nw + 1, by + big * 0.14, big * 0.5, FONT.mono, 'rgba(61,255,194,0.7)');
      g.font = `700 ${big * 0.5}px ${FONT.mono}`; const sw2 = g.measureText(`/${gl}`).width, tx2 = XL + nw + sw2 + big * 0.35;
      if (tx2 + big * 1.2 < XR) txt(g, 'today', tx2, by + big * 0.14, big * 0.38, FONT.mono, 'rgba(61,255,194,0.45)');
      const py = hdr + body * 0.74, pw = XR - XL, pr = Math.max(1.4, Math.min(body * 0.09, pw / Math.max(8, gl) * 0.34));
      pips(g, XL, py, Math.min(gl, 16), n, pr, pr * 0.9, pw);
      L.bar = { x: XL, y: H - Math.max(2, body * 0.07) - 2, w: pw, h: Math.max(1.5, body * 0.07) };
    } else if (id === 'mi') {
      const hr = DAY.hour(), hh = pad2(Math.floor(hr)), mm = pad2(Math.floor((hr % 1) * 60 + 1e-6));
      const big = fitSize(g, '00:00', (XR - XL) * 0.7, Math.min(H * 0.56, fs * 1.9), FONT.mono);
      txt(g, hh + ':' + mm, XL, H * 0.5, big, FONT.mono, '#eafff7');
      g.font = font(big); const tw = g.measureText('00:00').width;
      const wx = XL + tw + (XR - XL - tw) / 2, wy = H * 0.42, ws = Math.min(H * 0.32, (XR - XL - tw) * 0.4);
      if (B && B.rain) { for (let i = 0; i < 3; i++) sp(g, [wx - ws * 0.5 + i * ws * 0.5, wy + ws * 0.1, wx - ws * 0.65 + i * ws * 0.5, wy + ws * 0.6], '#8fe0ff', Math.max(0.8, ws * 0.12)); fe(g, wx, wy - ws * 0.15, ws * 0.62, ws * 0.32, 'rgba(169,188,255,0.9)'); }
      else if (B && (B.part === 'night' || B.part === 'dusk')) { fc(g, wx, wy, ws * 0.5, '#e6eaff'); fc(g, wx + ws * 0.22, wy - ws * 0.14, ws * 0.42, 'rgba(10,20,30,1)'); }
      else { fc(g, wx, wy, ws * 0.32, '#ffd27a'); for (let i = 0; i < 8; i++) { const a = i * TAU / 8; sp(g, [wx + Math.cos(a) * ws * 0.44, wy + Math.sin(a) * ws * 0.44, wx + Math.cos(a) * ws * 0.6, wy + Math.sin(a) * ws * 0.6], '#ffd27a', Math.max(0.6, ws * 0.08)); } }
      txt(g, B && B.rain ? 'RAIN' : 'CLEAR', wx, H - Math.max(2, H * 0.14), Math.max(4.5, H * 0.17), FONT.mono, 'rgba(61,255,194,0.7)', 'center');
    }
    return L;
  }
  function bakeScreens(gm) {
    const u = gm.u, fs = gm.fs, out = {};
    for (const id of ['ed', 'st', 'mi']) {
      const s = gm.scr[id], pad = 7 * u, hdr = scrHdr(s, u);
      const P = layer(-pad, -pad, s.w + pad * 2, s.h + pad * 2); paintPanel(P.g, s.w, s.h, u, hdr);
      const K = layer(-1, -1, s.w + 2, s.h + 2); frr(K.g, 0, 0, s.w, s.h, 4.5 * u, 'rgba(6,10,24,1)');
      out[id] = { panel: P, back: K, hdr, c: {} };
    }
    out.ed.code = bakeCodeStrip(gm.scr.ed, fs);
    return out;
  }
  // a screen as one sprite: dark glass (more of it by day), the glowing panel, the content
  function screenContent(id, mode, extra) {
    if (!B || !B.scr) return null;
    const S = B.scr[id];
    if (!S.c[mode] || extra) {
      const s = B.g.scr[id], L = paintScreen(id, mode, s, B.g.u, B.g.fs, extra), P = S.panel, out = layer(P.x, P.y, P.w, P.h), g = out.g;
      g.globalAlpha = B.part === 'day' ? 0.74 : B.part === 'dawn' ? 0.66 : 0.58; blit(g, S.back);
      g.globalAlpha = 1; g.globalCompositeOperation = 'lighter'; blit(g, P); blit(g, L);
      out.cur = L.cur; out.bar = L.bar;
      S.c[mode] = out;
    }
    return S.c[mode];
  }
  function screenOverlay(id, mode) {
    if (!B || !B.scr) return null;
    const S = B.scr[id], k = 'o:' + mode;
    if (!S.c[k]) S.c[k] = paintScreen(id, mode, B.g.scr[id], B.g.u, B.g.fs);
    return S.c[k];
  }
  let warmT = 0;
  function prewarm() {
    clearTimeout(warmT);
    const todo = [['st', 'idle'], ['st', 'focus'], ['ed', 'code'], ['ed', 'idle'], ['mi', 'clock'], ['st', 'brk'], ['ed', 'brk'], ['st', 'pause'], ['st', 'long'], ['st', 'done'], ['ed', 'today']];
    const step = () => {
      if (!B || !B.scr) return;
      while (todo.length) { const [id, m] = todo.shift(); if (!B.scr[id].c[m]) { try { screenContent(id, m); } catch (e) { reportErr('Scene.warm', e); } warmT = setTimeout(step, 40); return; } }
      try { if (!B.scr.ed.c['o:pause']) screenOverlay('ed', 'pause'); } catch (e) {}
    };
    warmT = setTimeout(step, 60);
  }
  function invalidateScreens(which) { if (!B || !B.scr) return; for (const id of which || ['ed', 'st', 'mi']) B.scr[id].c = {}; prewarm(); }

  // ═════════════════════════════ the plant (re-baked when today's count changes) ═════════════════════════════
  function plantSlots(n, ph, u) {
    const out = [], tiers = Math.ceil(n / 2), rf = clamp(ph * 0.085 * Math.sqrt(8 / Math.max(8, n)), 2.6 * u, 9.5 * u);
    for (let i = 0; i < n; i++) {
      const tier = Math.floor(i / 2), side = (i + tier) % 2 ? 1 : -1, tt = tiers > 1 ? tier / (tiers - 1) : 0.4;
      const by = -ph * lerp(0.16, 0.8, tt) - (side > 0 ? ph * 0.035 : 0), reach = ph * (0.3 - 0.14 * tt) + rf * 0.6;
      out.push({ x: side * reach, y: by + rf * 1.45, r: rf, bx: side * reach * 0.82, by, side });
    }
    return out;
  }
  function leaf(g, x, y, ang, len, wid, c1, c2) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.4, -wid, len, 0); g.quadraticCurveTo(len * 0.4, wid, 0, 0); g.closePath();
    g.fillStyle = lin(g, 0, -wid, 0, wid, [0, c1, 1, c2]); g.fill();
    sp(g, [len * 0.08, 0, len * 0.8, 0], 'rgba(10,50,25,0.4)', Math.max(0.5, wid * 0.14));
    g.restore();
  }
  function leafCluster(g, x, y, ang, s, R, prt) {
    const night = prt !== 'day', v = R() * 0.3;
    const c1 = mixh(night ? '#3cc274' : '#5ad98e', '#9be36a', v), c2 = night ? '#11502d' : '#1f7a45';
    // a tomato leaf: a few leaflets along a rachis, a bigger one at the tip
    const ex = x + Math.cos(ang) * s, ey = y + Math.sin(ang) * s;
    sp(g, [x, y, ex, ey], '#22703d', Math.max(0.6, s * 0.06));
    for (let i = 1; i <= 2; i++) { const f = i * 0.34, px = lerp(x, ex, f), py = lerp(y, ey, f); leaf(g, px, py, ang - 0.95, s * 0.42, s * 0.15, c1, c2); leaf(g, px, py, ang + 0.95, s * 0.42, s * 0.15, c1, c2); }
    leaf(g, lerp(x, ex, 0.62), lerp(y, ey, 0.62), ang + (R() - 0.5) * 0.25, s * 0.5, s * 0.2, c1, c2);
  }
  function bakePlant() {
    if (!B) return;
    const gm = B.g, u = gm.u, ph = gm.plantH, prt = B.part;
    const total = Math.min(24, Math.max(goal, nToday)), pw = ph * 0.8 + 24 * u;
    const ripe = clamp(nToday - pendH, 0, total);
    let P = B.plant;
    if (!P || P.total !== total || P.ph !== ph) P = B.plant = bakeFoliage(gm, total, pw, prt);
    // the fruit: ripe ones first (bottom up), green buds for the rest of the goal
    const F = layer(-pw / 2, -ph - 10 * u, pw, ph + 12 * u), g = F.g;
    P.slots.forEach((s, i) => { if (i < ripe) { fc(g, s.x + s.r * 0.2, s.y + s.r * 0.3, s.r, 'rgba(0,0,0,0.2)'); paintTomato(g, s.x, s.y, s.r, true); } else paintTomato(g, s.x, s.y, s.r * 0.62, false); });
    lightProp(F, prt, true);
    P.F = F; P.FT = twin(F);
  }
  function bakeFoliage(gm, total, pw, prt) {
    const u = gm.u, ph = gm.plantH, slots = plantSlots(total, ph, u);
    const L = layer(-pw / 2, -ph - 10 * u, pw, ph + 12 * u), g = L.g, R = mulberry(41);
    // stake and stem
    sp(g, [3 * u, 1, 3 * u, -ph * 0.97], '#c9a96a', 1.8 * u); for (let y = -ph * 0.2; y > -ph * 0.95; y -= ph * 0.22) fr(g, 2 * u, y, 2 * u, 1.2 * u, '#9a7a44');
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-5 * u, -ph * 0.3, 7 * u, -ph * 0.6, 1 * u, -ph * 0.98);
    g.strokeStyle = OUTL; g.lineWidth = 3.6 * u; g.stroke(); g.strokeStyle = '#2f8f4f'; g.lineWidth = 2.2 * u; g.stroke();
    const stemX = (yy) => { const t = clamp(-yy / ph, 0, 1); return (1 - t) * (1 - t) * (1 - t) * 0 + 3 * (1 - t) * (1 - t) * t * -5 * u + 3 * (1 - t) * t * t * 7 * u + t * t * t * u; };
    // branches with leaves behind the fruit
    for (const s of slots) {
      const sx = stemX(s.by);
      g.beginPath(); g.moveTo(sx, s.by + 3 * u); g.quadraticCurveTo((sx + s.bx) / 2, s.by - 3 * u, s.bx, s.by);
      g.strokeStyle = '#2a7d46'; g.lineWidth = 1.5 * u; g.stroke();
      leafCluster(g, s.bx, s.by, s.side > 0 ? -0.45 : Math.PI + 0.45, Math.max(10 * u, s.r * 3.2), R, prt);
      sp(g, [s.bx, s.by, s.x, s.y - s.r * 0.8], '#2a7d46', 1 * u);
    }
    // leaves along the stem and a crown
    for (let i = 0; i < 7; i++) { const yy = -ph * (0.08 + i * 0.135); leafCluster(g, stemX(yy), yy, (i % 2 ? -0.25 : Math.PI + 0.25) + (R() - 0.5) * 0.4, ph * 0.2 + 6 * u, R, prt); }
    leafCluster(g, stemX(-ph * 0.97), -ph * 0.97, -Math.PI / 2 - 0.4, ph * 0.18 + 5 * u, R, prt);
    leafCluster(g, stemX(-ph * 0.97), -ph * 0.97, -Math.PI / 2 + 0.5, ph * 0.16 + 5 * u, R, prt);
    // flowers
    for (let i = 0; i < 3; i++) { const yy = -ph * (0.72 + i * 0.08), xx = stemX(yy) + (i % 2 ? 6 : -6) * u; for (let p = 0; p < 5; p++) { const a = p * TAU / 5; fe(g, xx + Math.cos(a) * 1.6 * u, yy + Math.sin(a) * 1.6 * u, 1.3 * u, 0.8 * u, '#ffd84a', a); } fc(g, xx, yy, 0.8 * u, '#e09a20'); }
    lightProp(L, prt, true);
    return { L, T: twin(L), slots, ph, total, F: null, FT: null };
  }

  // ═════════════════════════════ bake ═════════════════════════════
  let SPR0 = { drop: null };   // canvases that never depend on the layout
  function fontsOnce() {
    if (!fontsP) fontsP = (async () => { try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load(`700 12px ${FONT.mono}`), document.fonts.load(`400 12px ${FONT.display}`)]), wait(1.2)]); } catch (e) { /* fonts are a nicety */ } })();
    return fontsP;
  }
  function rainy() {
    const s = DB && DB.settings; if (!s) return false;
    if (s.music === 'rain' || s.weather === 'rain') return true;
    if (s.weather === 'clear') return false;
    return mulberry(hashStr('rain' + dateKey()))() < 0.4;   // auto: a rainy day roughly 2 days in 5
  }
  function bakeSprites(gm, prt) {
    const u = gm.u, S = {};
    S.glyph = bakeGlyphs(u); S.sparkle = bakeSparkle(); S.leaf = bakeLeafBit(u); S.notes = bakeNotes(u);
    const lamp = layer(-24 * u, -66 * u, 50 * u, 72 * u); paintLamp(lamp.g, u); lightProp(lamp, prt, false); S.lamp = lamp;
    const radio = layer(-48 * u, -78 * u, 104 * u, 84 * u); S.radioGeo = paintRadio(radio.g, u); lightProp(radio, prt, true); S.radio = radio;
    const mug = layer(-18 * u, -30 * u, 40 * u, 34 * u); paintMug(mug.g, u); lightProp(mug, prt, true); S.mug = mug;
    // the tomato's wide soft shadow on the desk (portrait and short only; the Dial adds the tight contact one)
    if (!gm.wide) { const d = gm.dial, x = d.cx + 4 * u, y = d.cy + d.r * 0.86, rx = d.r * 0.98, ry = d.r * 0.2; S.tsh = layer(x - rx, y - ry, rx * 2, ry * 2); shadowE(S.tsh.g, x, y, rx, ry, 1); } else S.tsh = null;
    if (gm.duck) { const dk = layer(-16 * u, -24 * u, 34 * u, 28 * u); paintDuck(dk.g, u); lightProp(dk, prt, true); S.duck = dk; S.duckT = twin(dk); }
    const jw = gm.jar.w, jh = gm.jar.h;
    const jb = layer(-jw * 0.8, -jh - 2 * u, jw * 1.6, jh + 6 * u); paintJarBack(jb.g, u, jw, jh); S.jarB = jb;
    const jf = layer(-jw * 0.8, -jh - 2 * u, jw * 1.6, jh + 6 * u); paintJarFront(jf.g, u, jw, jh); lightProp(jf, prt, false); S.jarF = jf;
    const jt = layer(-jw * 0.8, -jh - 2 * u, jw * 1.6, jh + 6 * u); blit(jt.g, jb); blit(jt.g, jf); S.jarT = twin(jt);
    S.blob = bakeBlobs(13 * u); S.blobS = 13 * u;
    S.garland = bakeGarland(gm, prt);
    S.bolt = bakeBolt(gm.vh * 0.85, u);
    S.tom = bakeTomato(clamp(gm.dial.r * 0.9, 24, 110));
    // radio channel labels
    S.lab = {};
    for (const [ch, t] of [['lofi', 'LO-FI'], ['rain', 'RAIN'], ['city', 'CITY'], ['off', 'OFF']]) { const Lb = layer(-14 * u, -4 * u, 28 * u, 8 * u); txt(Lb.g, t, 0, 0.3 * u, 4.6 * u, FONT.mono, ch === 'off' ? 'rgba(200,200,220,0.5)' : '#f4ead4', 'center'); S.lab[ch] = Lb; }
    return S;
  }
  function geomOK(g) { return g && g.W === VW && g.H === VH; }
  function bake() {
    const gen = ++bakeGen;
    if (!G || !geomOK(G)) G = computeGeom();
    const gm = G;
    return (async () => {
      await fontsOnce();
      if (gen !== bakeGen) return;
      if (!SPR0.drop) { SPR0.drop = bakeDrop(); SPR0.wisp = bakeWisp(); glows(); }
      const prt = DAY.part(), th = themeName(), rn = rainy(), hr = DAY.hour();
      const same = B && B.g.key === gm.key;
      const nb = { g: gm, part: prt, theme: th, rain: rn, hour: hr };
      nb.spr = same && B.part === prt ? B.spr : bakeSprites(gm, prt);
      await yieldF(); if (gen !== bakeGen) return;
      nb.city = same && B.part === prt ? B.city : bakeCity(gm, prt);
      await yieldF(); if (gen !== bakeGen) return;
      nb.out = same && B.part === prt && B.rain === rn && Math.abs(B.hour - hr) < 0.02 ? B.out : bakeOutside(gm, nb.city, hr, rn, prt);
      await yieldF(); if (gen !== bakeGen) return;
      let room = null;
      const sameRoom = same && B.part === prt && B.theme === th;
      if (sameRoom && B.out === nb.out) { nb.fin = B.fin; nb.roomWin = B.roomWin; }
      else if (sameRoom) { nb.fin = copyFin(B.fin, gm); nb.roomWin = B.roomWin; stitch(nb.fin, nb.out, nb.roomWin); }
      else {
        room = bakeRoom(gm, prt, th, nb.spr);
        await yieldF(); if (gen !== bakeGen) return;
        nb.fin = compose(gm, nb.out, room); nb.roomWin = cropWin(gm, room);
      }
      nb.scr = same && B.part === prt && B.scr ? B.scr : bakeScreens(gm);
      const old = B;
      B = nb;
      if (old && old.fin !== nb.fin && old.g.key === gm.key && (old.part !== prt || old.theme !== th || old.rain !== rn)) { XF = old.fin; xfK = 0; xfDur = old.part !== prt ? 2.4 : 1.1; }
      else if (!old || old.g.key !== gm.key) XF = null;
      if (nb.scr !== (old && old.scr)) invalidateScreens();
      else if (old && old.rain !== rn) invalidateScreens(['mi']);
      if (!(same && old && old.part === prt)) B.plant = null; else B.plant = old.plant;
      bakePlant();
      prewarm();
      seedLife(!same);
      if (old && rn && !old.rain) lightning();
    })().catch((e) => reportErr('Scene.bake', e));
  }
  // the sky drifts with the clock: repaint OUTSIDE off-frame and stitch it into FIN's window
  function stitch(fin, out, w) { const x = fin.x; x.save(); x.beginPath(); x.rect(w.x, w.y, w.w, w.h); x.clip(); blit(x, out); blit(x, w); x.restore(); }
  function copyFin(f, gm) { const c = makeCanvas(f.c.width, f.c.height), x = c.getContext('2d'); x.drawImage(f.c, 0, 0); x.setTransform(gm.dpr, 0, 0, gm.dpr, 0, 0); return { c, x }; }
  function refreshSky() {
    if (!B || !B.fin) return;
    try {
      const hr = DAY.hour(), out = bakeOutside(B.g, B.city, hr, B.rain, B.part);
      stitch(B.fin, out, B.roomWin);
      B.out = out; B.hour = hr;
    } catch (e) { reportErr('Scene.sky', e); }
  }

  // ═════════════════════════════ the live bits (typed arrays; seeded per bake) ═════════════════════════════
  const NR = 160, RX = new Float32Array(NR), RY = new Float32Array(NR), RL = new Float32Array(NR), RV = new Float32Array(NR); let nr = 0, nrFar = 0;
  const ND = 40, DX = new Float32Array(ND), DY = new Float32Array(ND), DR = new Float32Array(ND), DV = new Float32Array(ND), DT = new Float32Array(ND), DS = new Uint8Array(ND); let nd = 0;
  const NST = 12, SX = new Float32Array(NST), SY = new Float32Array(NST), SA = new Float32Array(NST), SL = new Float32Array(NST), SS = new Float32Array(NST); let ns = 0, steamAcc = 0;
  const NJ = 24, JX = new Float32Array(NJ), JY = new Float32Array(NJ), JVX = new Float32Array(NJ), JVY = new Float32Array(NJ), JP_ = new Float32Array(NJ), JK = new Uint8Array(NJ), JA = new Float32Array(NJ); let nj = 0;
  const NP = 240, PX = new Float32Array(NP), PY = new Float32Array(NP), PVX = new Float32Array(NP), PVY = new Float32Array(NP), PA = new Float32Array(NP), PL = new Float32Array(NP), PS = new Float32Array(NP), PW = new Float32Array(NP), PK = new Uint8Array(NP), PQ = new Uint16Array(NP); let pn = 0;
  const EQ = new Float32Array(6), TOG = new Uint8Array(40), EQB = [0.95, 0.8, 0.62, 0.72, 0.5, 0.38];
  const NN = 4, NX = new Float32Array(NN), NY = new Float32Array(NN), NA = new Float32Array(NN), NV = new Uint8Array(NN); let nn = 0, noteAcc = 0;
  const hsh = (n) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
  const LIFE = { train: { on: false, x: 0, v: 0, next: 12 }, drone: { on: false, x: 0, y: 0, v: 0, next: 8 }, plane: { on: false, x: 0, y: 0, v: 0, next: 30 }, birds: { on: false, x: 0, y: 0, v: 0, next: 20 }, star: { on: false, t: 0, x: 0, y: 0, next: 50 }, togT: 2 };
  const LT = { t: -1, x: 0 };
  const HV = { on: false, t: 0, dur: 0.8, x0: 0, y0: 0, r0: 0, x1: 0, y1: 0, r1: 0, cx: 0, cy: 0, slot: -1 };
  const CP = { on: false, t: 0, kind: '', spr: null, x: 0, y: 0, h: 0, dir: 1, sx: 0, sy: 0, seed: 0 };
  const SCRS = { mode: 'idle', over: '', overT: 0, flick: 0, pulse: 0, line: 6, ch: 0, acc: 0, scroll: 0, extra: null };
  let music = { playing: false, phase: 0, level: 0 };
  const amb = () => QUALITY[QL].amb;
  const ru = () => (B ? B.g.u : 1);

  function seedLife(moved) {
    if (!B) return;
    const g = B.g, GL = g.GL, u = g.u, area = clamp(GL.w * g.vh / (360 * 230), 0.6, 2.4);
    const rainK = B.rain ? 1 : 0;
    nr = Math.min(NR, Math.round(QUALITY[QL].rain * area * rainK * (RM() ? 0.45 : 1))); nrFar = Math.round(nr * 0.62);
    for (let i = 0; i < nr; i++) { RX[i] = GL.x - 20 + Math.random() * (GL.w + 40); RY[i] = g.vt - 30 + Math.random() * (g.vh + 40); const far = i < nrFar; RV[i] = (far ? 420 + Math.random() * 110 : 680 + Math.random() * 200) * u; RL[i] = (far ? 8 + Math.random() * 6 : 15 + Math.random() * 11) * u; }
    nd = QUALITY[QL].rain ? Math.min(ND, Math.round(11 * amb() * area * rainK)) : 0;
    for (let i = 0; i < nd; i++) spawnDrop(i, true);
    ns = 0; steamAcc = 0;
    syncJar(moved !== false);
    if (moved !== false) TOG.fill(0);
  }
  function spawnDrop(i, any) {
    const g = B.g;
    DX[i] = g.GL.x + 3 + Math.random() * (g.GL.w - 6); DY[i] = any ? g.vt + Math.random() * g.vh : g.vt + Math.random() * g.vh * 0.6;
    DR[i] = (1.1 + Math.random() * 2.4) * g.u; DV[i] = 0; DT[i] = 0; DS[i] = 0;
  }
  // the jar mirrors today's quarantined rogues (minus the one still flying in)
  function todayKinds() { const t0 = dayStart(), out = []; if (DB) for (const r of DB.rogues) if (r.at >= t0) out.push(r.kind); return out; }
  function syncJar(reset) {
    kinds = todayKinds();
    const want = Math.min(NJ, Math.max(0, kinds.length - pendR));
    if (reset || want < nj) nj = 0;
    if (!B) return;
    const g = B.g, iw = g.jar.w / 2 - 6 * g.u, ih = g.jar.h - 12 * g.u;
    while (nj < want) { const i = nj++; JK[i] = Math.max(0, KIND_IDS.indexOf(kinds[i])); JX[i] = (Math.random() * 2 - 1) * iw * 0.8; JY[i] = -6 * g.u - Math.random() * (ih - 14 * g.u); JVX[i] = 0; JVY[i] = 0; JP_[i] = Math.random() * 10; JA[i] = 1; }
  }
  function refreshCounts() {
    const prev = nToday;
    nToday = todaySessions().length;
    goal = DB && DB.settings ? clamp(DB.settings.dailyGoal | 0 || 8, 1, 24) : 8;
    return nToday !== prev;
  }
  function emit(kind, x, y, vx, vy, life, size, q) {
    const cap = Math.min(NP, QUALITY[QL].parts);
    if (pn >= cap) return;
    const i = pn++;
    PX[i] = x; PY[i] = y; PVX[i] = vx; PVY[i] = vy; PA[i] = 0; PL[i] = life; PS[i] = size; PW[i] = Math.random() * TAU; PK[i] = kind; PQ[i] = q || 0;
  }
  function burst(kind, x, y) {
    if (!B) return;
    const u = B.g.u;
    if (kind === 'confetti') {
      if (RM()) { emit(1, x, y, 0, 0, 0.9, 26 * u, 0); return; }
      const n = Math.min(QUALITY[QL].parts >> 1, [44, 36, 24, 12][QL]), glyphs = B.spr.glyph.n;
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.9, v = (110 + Math.random() * 230) * u; emit(0, x, y, Math.cos(a) * v * 1.15, Math.sin(a) * v * 0.8 - 40 * u, 1.7 + Math.random() * 1.3, (12 + Math.random() * 8) * u, (Math.random() * glyphs) | 0); }
      for (let i = 0; i < 4; i++) emit(1, x + (Math.random() - 0.5) * 30 * u, y + (Math.random() - 0.5) * 20 * u, 0, -20 * u, 0.7 + Math.random() * 0.5, (12 + Math.random() * 10) * u, 0);
    } else if (kind === 'sparkle') {
      const n = RM() ? 3 : 12;
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, r = Math.random() * 26 * u; emit(1, x + Math.cos(a) * r, y + Math.sin(a) * r, Math.cos(a) * 14 * u, Math.sin(a) * 14 * u - 10 * u, 0.6 + Math.random() * 0.7, (8 + Math.random() * 12) * u, 0); }
    } else if (kind === 'zap') {
      const n = RM() ? 4 : 16;
      for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = (60 + Math.random() * 160) * u; emit(2, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.25 + Math.random() * 0.3, (3 + Math.random() * 4) * u, 0); }
    } else if (kind === 'leaves') {
      for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = (40 + Math.random() * 70) * u; emit(3, x, y, Math.cos(a) * v, Math.sin(a) * v, 0.9 + Math.random() * 0.5, (0.6 + Math.random() * 0.5), 0); }
    } else if (kind === 'bubbles') {
      for (let i = 0; i < 6; i++) emit(4, x + (Math.random() - 0.5) * 12 * u, y, (Math.random() - 0.5) * 10 * u, -(14 + Math.random() * 20) * u, 0.6 + Math.random() * 0.4, (1 + Math.random() * 1.6) * u, 0);
    }
  }
  function lightning() {
    if (!B || !B.rain) return;
    LT.t = 0; LT.x = B.g.GL.x + B.g.GL.w * (0.15 + Math.random() * 0.7);
  }

  // ═════════════════════════════ update ═════════════════════════════
  function screenBase() {
    if (TIMER.state === 'paused') return 'pause';
    if (TIMER.mode !== 'focus') return 'brk';
    return TIMER.state === 'running' ? 'focus' : 'idle';
  }
  function update(dt) {
    const u0 = PROF ? performance.now() : 0;
    try { update1(dt); } finally { if (PROF) { PROF.ut = performance.now() - u0; PROF.us = (PROF.us || 0) + PROF.ut; } }
  }
  function update1(dt) {
    T += dt;
    if (!B) return;
    const g = B.g, u = g.u, A = amb(), rm = RM();
    dimK += ((FOCUSMODE.on ? 1 : 0) - dimK) * Math.min(1, dt * 4);
    if (tshT >= 0 && (tshT += dt) > 2.1) tshT = -1;
    breath += (breathT - breath) * Math.min(1, dt * 0.9);
    if (XF) { xfK += dt / xfDur; if (xfK >= 1) { XF = null; xfK = 1; } }
    // the music the radio shows
    try { const b = typeof Snd !== 'undefined' && Snd.beat ? Snd.beat() : null; music.playing = !!(b && b.playing); music.phase = b ? +b.phase || 0 : 0; music.level = typeof Snd !== 'undefined' && Snd.level ? +Snd.level() || 0 : 0; } catch (e) { music.playing = false; }
    const live = A >= 0.5 && !rm;
    for (let i = 0; i < 6; i++) {
      const base = EQB[i], kick = Math.exp(-music.phase * 5.5), hh = 0.5 + 0.5 * Math.sin(T * (9 + i * 2.3) + i * 1.7);
      const tgt = music.playing && live ? clamp(0.16 + base * (0.6 * kick + 0.32 * hh) * (0.55 + music.level * 0.8), 0.08, 1) : music.playing ? 0.35 * base + 0.1 : 0.06;
      EQ[i] += (tgt - EQ[i]) * Math.min(1, dt * 16);
    }
    // rain
    if (nr) {
      const x0 = g.GL.x - 20, w = g.GL.w + 40, y1 = g.sill;
      for (let i = 0; i < nr; i++) { RY[i] += RV[i] * dt; RX[i] += RV[i] * 0.16 * dt; if (RY[i] > y1) { RY[i] = g.vt - 20 - Math.random() * 40; RX[i] = x0 + Math.random() * w - (y1 - g.vt) * 0.16; } }
    }
    if (nd) {
      for (let i = 0; i < nd; i++) {
        if (DS[i] === 0) { if (Math.random() < dt * 0.06 * (DR[i] / u)) { DS[i] = 1; DV[i] = 12 * u; } }
        else { DV[i] = Math.min(70 * u, DV[i] + 90 * u * dt); if (Math.random() < dt * 1.5) DV[i] *= 0.2; DY[i] += DV[i] * dt; DT[i] = Math.min(28 * u, DT[i] + DV[i] * dt * 0.8); DX[i] += (Math.random() - 0.5) * 6 * u * dt; if (DY[i] > g.sill - 2) spawnDrop(i, false); }
      }
    }
    // the city's life
    const city = B.city.rec, night = B.part !== 'day';
    if (live) {
      const L = LIFE;
      if ((L.togT -= dt) < 0 && city.tog.length && night) { L.togT = 1.5 + Math.random() * 4; const j = (Math.random() * (city.tog.length / 4)) | 0; TOG[j] ^= 1; }
      if (city.track) { const tr = L.train; if (!tr.on && T > tr.next) { tr.on = true; const dir = Math.random() < 0.5 ? 1 : -1; tr.v = dir * 70 * city.k; tr.x = dir > 0 ? city.track.x0 - B.city.rec.train.w - 10 : city.track.x1 + 10; } if (tr.on) { tr.x += tr.v * dt; if ((tr.v > 0 && tr.x > city.track.x1 + 10) || (tr.v < 0 && tr.x < city.track.x0 - B.city.rec.train.w - 10)) { tr.on = false; tr.next = T + (30 + Math.random() * 50) / A; } } }
      const sky = city.sky;
      if (sky) {
        const dr = L.drone; if (!dr.on && T > dr.next) { dr.on = true; const dir = Math.random() < 0.5 ? 1 : -1; dr.v = dir * (18 + Math.random() * 12) * city.k; dr.x = dir > 0 ? sky.x0 - 10 : sky.x1 + 10; dr.y = lerp(sky.y0, sky.y1, 0.3 + Math.random() * 0.6); }
        if (dr.on) { dr.x += dr.v * dt; dr.y += Math.sin(T * 0.9) * 3 * dt; if (dr.x < sky.x0 - 20 || dr.x > sky.x1 + 20) { dr.on = false; dr.next = T + (25 + Math.random() * 40) / A; } }
        const pl = L.plane; if (night && A >= 0.75) { if (!pl.on && T > pl.next) { pl.on = true; const dir = Math.random() < 0.5 ? 1 : -1; pl.v = dir * 22 * city.k; pl.x = dir > 0 ? sky.x0 - 10 : sky.x1 + 10; pl.y = sky.y0 + (sky.y1 - sky.y0) * Math.random() * 0.35; } if (pl.on) { pl.x += pl.v * dt; if (pl.x < sky.x0 - 20 || pl.x > sky.x1 + 20) { pl.on = false; pl.next = T + 60 + Math.random() * 90; } } }
        const bd = L.birds; if (!night) { if (!bd.on && T > bd.next) { bd.on = true; const dir = Math.random() < 0.5 ? 1 : -1; bd.v = dir * 34 * city.k; bd.x = dir > 0 ? sky.x0 - 30 : sky.x1 + 30; bd.y = lerp(sky.y0, sky.y1, Math.random() * 0.6); } if (bd.on) { bd.x += bd.v * dt; if (bd.x < sky.x0 - 40 || bd.x > sky.x1 + 40) { bd.on = false; bd.next = T + 30 + Math.random() * 60; } } }
        const st = L.star; if (st.on) { st.t += dt; if (st.t > 0.9) st.on = false; }
      }
    }
    // steam from the tea
    if (A >= 0.5) {
      steamAcc += dt * (rm ? 0.8 : 1.6);
      const nmax = A >= 1 ? 7 : A >= 0.75 ? 5 : 3;
      while (steamAcc > 1 && ns < nmax) { steamAcc -= 1; const i = ns++; SX[i] = g.mug.x + (Math.random() - 0.5) * 6 * u; SY[i] = g.mug.y - 22 * u; SA[i] = 0; SL[i] = 2.2 + Math.random() * 1.2; SS[i] = (0.7 + Math.random() * 0.5) * u; }
      for (let i = 0; i < ns; i++) { SA[i] += dt; if (SA[i] >= SL[i]) { ns--; SX[i] = SX[ns]; SY[i] = SY[ns]; SA[i] = SA[ns]; SL[i] = SL[ns]; SS[i] = SS[ns]; i--; continue; } SY[i] -= 11 * u * dt; SX[i] += Math.sin(T * 1.6 + i) * 4 * u * dt; }
    }
    // music notes drift up from the radio while something plays
    if (music.playing && live && DB && DB.settings && DB.settings.music !== 'off') {
      noteAcc += dt * (0.55 + music.level * 0.4);
      if (noteAcc > 1 && nn < (A >= 1 ? 3 : 2)) { noteAcc = 0; const i = nn++; NX[i] = g.radio.x + (Math.random() * 20 - 6) * u; NY[i] = g.radio.y - 46 * u; NA[i] = 0; NV[i] = Math.random() < 0.5 ? 1 : 0; }
    } else noteAcc = 0;
    for (let i = 0; i < nn; i++) { NA[i] += dt; if (NA[i] > 2.6) { nn--; NX[i] = NX[nn]; NY[i] = NY[nn]; NA[i] = NA[nn]; NV[i] = NV[nn]; i--; continue; } NY[i] -= 13 * u * dt; NX[i] += Math.sin(T * 1.8 + i * 2) * 6 * u * dt; }
    // the plant
    const k = 26, c = 3.2;
    wigV += (-k * wig - c * wigV) * dt; wig += wigV * dt;
    if (BNC.on && (BNC.t += dt) > 0.75) { BNC.on = false; BNC.slot = -1; }
    if (duckT > 0) duckT = Math.max(0, duckT - dt);
    if (jarPulse > 0) jarPulse = Math.max(0, jarPulse - dt * 1.4);
    if (pendH && (pendT -= dt) < 0 && !HV.on) { pendH = 0; landTomato(-1); }
    // the jar's blobs drift
    if (nj) {
      const iw = g.jar.w / 2 - 6 * u, top = -(g.jar.h - 12 * u) + 6 * u, bot = -5 * u, drift = live ? 1 : 0.25;
      const midY = (top + bot) / 2, hy = (bot - top) / 2;
      for (let i = 0; i < nj; i++) {
        JP_[i] += dt * drift;
        const tx = Math.sin(JP_[i] * 0.31 + i * 2.4) * iw * 0.8, ty = midY + Math.sin(JP_[i] * 0.23 + i * 1.7) * hy * 0.8;
        JVX[i] += ((tx - JX[i]) * 0.9 - JVX[i] * 1.2) * dt;
        JVY[i] += ((ty - JY[i]) * 0.9 - JVY[i] * 1.2) * dt;
        JX[i] += JVX[i] * dt; JY[i] += JVY[i] * dt;
        if (JX[i] < -iw) { JX[i] = -iw; JVX[i] = Math.abs(JVX[i]) * 0.6; } if (JX[i] > iw) { JX[i] = iw; JVX[i] = -Math.abs(JVX[i]) * 0.6; }
        if (JY[i] < top) { JY[i] = top; JVY[i] = Math.abs(JVY[i]) * 0.5; } if (JY[i] > bot) { JY[i] = bot; JVY[i] = -Math.abs(JVY[i]) * 0.4; }
        if (JA[i] < 1) JA[i] = Math.min(1, JA[i] + dt * 2);
      }
    }
    // the screens
    const base = screenBase();
    if (SCRS.over && (SCRS.overT -= dt) <= 0) SCRS.over = '';
    const mode = SCRS.over || base;
    if (mode !== SCRS.mode) { SCRS.mode = mode; SCRS.flick = 0.22; }
    if (SCRS.flick > 0) SCRS.flick -= dt;
    if (SCRS.pulse > 0) SCRS.pulse -= dt;
    if (mode === 'focus' && A >= 0.5) {
      const S = B.scr && B.scr.ed.code; if (S) {
        SCRS.acc += dt * (rm ? 7 : 11);
        const len = CODE[SCRS.line % S.rows].length;
        while (SCRS.acc >= 1) { SCRS.acc -= 1; SCRS.ch++; if (SCRS.ch > len + 4) { SCRS.ch = 0; SCRS.line++; SCRS.scroll = 1; } }
      }
    }
    if (SCRS.scroll > 0) SCRS.scroll = Math.max(0, SCRS.scroll - dt * 4);
    // moments
    if (pn) {
      for (let i = 0; i < pn; i++) {
        PA[i] += dt;
        if (PA[i] >= PL[i]) { pn--; PX[i] = PX[pn]; PY[i] = PY[pn]; PVX[i] = PVX[pn]; PVY[i] = PVY[pn]; PA[i] = PA[pn]; PL[i] = PL[pn]; PS[i] = PS[pn]; PW[i] = PW[pn]; PK[i] = PK[pn]; PQ[i] = PQ[pn]; i--; continue; }
        const kd = PK[i];
        if (kd === 0 || kd === 3) { PVY[i] += 330 * u * dt; PVX[i] *= 1 - 1.4 * dt; PVY[i] *= 1 - 1.1 * dt; PW[i] += dt * 7; }
        else if (kd === 2) { PVY[i] += 90 * u * dt; PVX[i] *= 1 - 4 * dt; PVY[i] *= 1 - 4 * dt; }
        else if (kd === 4) { PVY[i] -= 10 * u * dt; }
        PX[i] += PVX[i] * dt; PY[i] += PVY[i] * dt;
      }
    }
    if (HV.on) { HV.t += dt; if (HV.t >= HV.dur) { HV.on = false; landTomato(HV.slot); } else if (!rm && HV.t >= 0 && Math.random() < dt * 45) emit(1, curX(HV), curY(HV), 0, 0, 0.45, (6 + Math.random() * 6) * u, 0); }
    if (CP.on) { CP.t += dt; capStep(); }
    if (LT.t >= 0) { LT.t += dt; if (LT.t > 1.1) LT.t = -1; }
    // now and then: the day turned, the sky drifted, the minute changed
    if ((tick += dt) > 1) { tick = 0; periodic(); }
  }
  function periodic() {
    const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    if (m !== lastMin) { lastMin = m; setTimeout(() => { if (B && B.scr) { try { const old = B.scr.mi.c; B.scr.mi.c = {}; screenContent('mi', 'clock'); if (!B.scr.mi.c.clock) B.scr.mi.c = old; } catch (e) { reportErr('Scene.clock', e); } } }, 0); }
    const dk = dateKey();
    if (dk !== lastDay) { const first = !lastDay; lastDay = dk; if (!first) { refreshCounts(); pendH = 0; bakePlant(); syncJar(true); invalidateScreens(); if (B && rainy() !== B.rain) bake(); } }
    if ((skyTick += 1) >= 120 && B && Math.abs(DAY.hour() - B.hour) > 0.02) { skyTick = 0; setTimeout(refreshSky, 0); }
  }
  // the harvest: the ripe tomato flies from the dial to its slot on the vine
  function slotPos(i) {
    if (!B || !B.plant) return { x: VW * 0.15, y: LAYOUT.deskY - 60, r: 6 };
    const s = B.plant.slots[clamp(i, 0, B.plant.slots.length - 1)], st = B.g.stem;
    return { x: st.x + s.x, y: st.y + s.y, r: s.r };
  }
  const curX = (h) => { const e = easeInOut(clamp(h.t / h.dur, 0, 1)), a = 1 - e; return a * a * h.x0 + 2 * a * e * h.cx + e * e * h.x1; };
  const curY = (h) => { const e = easeInOut(clamp(h.t / h.dur, 0, 1)), a = 1 - e; return a * a * h.y0 + 2 * a * e * h.cy + e * e * h.y1; };
  // the fruit is re-baked off-frame; the bouncing tomato (never smaller than the baked one) covers the swap
  function landTomato(slot) {
    pendH = 0;
    const i = slot >= 0 ? slot : nToday - 1;
    if (i < 0) { setTimeout(bakePlant, 0); return; }
    BNC.on = true; BNC.t = 0; BNC.slot = i;
    setTimeout(bakePlant, RM() ? 420 : 0);
    wigV += 70 * ru() * (RM() ? 0 : 1);
    const p = slotPos(i); burst('sparkle', p.x, p.y);
    if (!RM()) burst('leaves', p.x, p.y);
  }
  // the capture: the rogue glitches in, Patch zaps it, it shrinks and drops into the jar
  function capPos() {
    const g = B.g, S = g.patch.size;
    let hx = g.patch.x + S * 0.3, hy = g.deskY - S * 0.4;
    try { const h = Patch.hand && Patch.hand(); if (h && isFinite(h.x)) { hx = h.x; hy = h.y; } } catch (e) {}
    return { hx, hy };
  }
  function onCapture(p) {
    if (!B) return;
    const r = p && p.rogue; const kind = r && r.kind || 'zatsu';
    if (CP.on) { CP.t = 99; capStep(); }
    pendR++;
    const g = B.g, S = g.patch.size, hp = capPos(), dir = hp.hx >= g.patch.x ? 1 : -1;
    CP.on = true; CP.t = 0; CP.kind = kind; CP.dir = dir; CP.seed = Math.random() * 100;
    CP.x = clamp(g.patch.x + dir * S * 0.48, g.GL.x + S * 0.12, g.GL.x + g.GL.w - S * 0.12); CP.y = g.deskY - S * 0.62; CP.h = S * 0.3;
    let spr = null; try { spr = Patch.rogue ? Patch.rogue(kind) : null; } catch (e) { spr = null; }
    CP.spr = spr && spr.width ? spr : bigBlob(kind, 40 * g.u).c;
  }
  function capStep() {
    if (CP.t < 2.05) return;
    setTimeout(prepDone, 200);
    CP.on = false; pendR = Math.max(0, pendR - 1);
    const before = nj; syncJar(false);
    if (B && nj > before) { const i = nj - 1, g = B.g; JY[i] = -(g.jar.h - 12 * g.u) + 6 * g.u; JVY[i] = 40 * g.u; JA[i] = RM() ? 0 : 1; burst('bubbles', g.jar.x + JX[i], g.jar.y + JY[i]); jarPulse = RM() ? 0.6 : 1.2; }
  }

  // ═════════════════════════════ draw ═════════════════════════════
  function panes(c, g) { for (const p of g.panes) c.rect(p.x, p.y, p.w, p.h); }
  // dev only: ?sprof=1 times the parts of a frame (Scene.prof()); ?sskip=out,patch,… leaves parts out
  const PROF = QS.get('sprof') === '1' ? { n: 0, t: new Float64Array(12), f: new Float32Array(600), fp: new Float32Array(600), fi: 0, fn: 0, u0: 0, ut: 0 } : null;
  const SKIP = (QS.get('sskip') || '').split(',');
  const sk = (k) => SKIP.indexOf(k) >= 0;
  let pt0 = 0;
  const PF = new Float32Array(8);
  const pmark = (i) => { if (!PROF) return; const t = performance.now(); PROF.t[i] += t - pt0; PF[i] = t - pt0; pt0 = t; };
  function draw(c) {
    if (PROF) { pt0 = performance.now(); PROF.f0 = pt0; PROF.n++; PROF.pt = 0; }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    if (!B) { c.fillStyle = PAL.night; c.fillRect(0, 0, cv.width, cv.height); return; }
    const g = B.g, fin = B.fin.c;
    if (sk('fin')) { c.fillStyle = '#123'; c.fillRect(0, 0, cv.width, cv.height); }
    else if (fin.width === cv.width && fin.height === cv.height) c.drawImage(fin, 0, 0); else c.drawImage(fin, 0, 0, cv.width, cv.height);
    if (XF) { c.globalAlpha = 1 - smooth(xfK); c.drawImage(XF.c, 0, 0, cv.width, cv.height); c.globalAlpha = 1; }
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    // the tomato's shadow on the desk: gone while the Dial's tomato is picked (1.1 s) until the new one grows in (1.5 s)
    const ts = B.spr.tsh;
    if (ts) { const t = tshT, k = t < 1.1 ? 1 : t < 1.26 ? 1 - (t - 1.1) / 0.16 : t < 1.5 ? 0 : t < 2 ? smooth((t - 1.5) / 0.5) : 1; if (k > 0.004) { c.globalAlpha = (B.theme === 'day' ? 0.32 : 0.55) * k; blit(c, ts); c.globalAlpha = 1; } }
    pmark(0);
    // 1. outside: city lights, the train, the sky's traffic, rain, drops, lightning (clipped to the glass)
    if (!sk('out') && outsideBusy()) { c.save(); c.beginPath(); panes(c, g); c.clip(); drawOutside(c, g); c.restore(); }
    pmark(1);
    // 2. heads-down: everything but the glass falls into shadow
    if (dimK > 0.004) { c.globalAlpha = 0.68 * dimK; c.fillStyle = '#04050e'; c.beginPath(); c.rect(0, 0, g.W, g.H); panes(c, g); c.fill('evenodd'); c.globalAlpha = 1; }
    // 3. the room: garland, plant, jar
    if (!sk('sill')) { drawGarland(c, g); drawPlant(c, g); drawJar(c, g); }
    pmark(2);
    // 4. her screens
    if (!sk('screens')) drawScreens(c, g);
    pmark(3);
    // 5. Patch, cut off by the desk
    if (PROF) PROF.pa = performance.now();
    if (!sk('patch')) drawPatch(c, g);
    if (PROF) PROF.pt = performance.now() - PROF.pa;
    pmark(4);
    // 6. the desk's props
    if (!sk('props')) drawProps(c, g);
    pmark(5);
    // 7. moments
    drawFX(c, g);
    pmark(6);
    if (PROF) { const tot0 = performance.now() - PROF.f0 + PROF.ut; PF[7] = PROF.ut; if (!PROF.slow) PROF.slow = []; if (PROF.slow.length < 6 || tot0 > PROF.slow[PROF.slow.length - 1][0]) { PROF.slow.push([+tot0.toFixed(2), SCRS.mode, HV.on ? 'hv' : BNC.on ? 'bnc' : '', ...Array.from(PF, (v) => +v.toFixed(2))]); PROF.slow.sort((a, b) => b[0] - a[0]); PROF.slow.length = Math.min(6, PROF.slow.length); } }
    if (PROF) { const tot = performance.now() - PROF.f0 + PROF.ut, i = PROF.fi; PROF.f[i] = tot; PROF.fp[i] = PROF.pt; PROF.fi = (i + 1) % 600; PROF.fn = Math.min(600, PROF.fn + 1); PROF.ut = 0; }
  }
  function outsideBusy() {
    const L = LIFE, r = B.city.rec;
    if (nr || nd || LT.t >= 0 || L.train.on || L.drone.on || L.plane.on || L.birds.on || L.star.on) return true;
    if (B.part === 'day') return false;
    if (r.flick.length || (r.blink.length && amb() >= 0.5)) return true;
    for (let j = 0, n = r.tog.length >> 2; j < n; j++) if (TOG[j]) return true;
    return false;
  }
  function drawOutside(c, g) {
    const city = B.city.rec, night = B.part !== 'day', A = amb(), u = g.u, k = city.k;
    // window lights switching on and off
    if (night && city.tog.length) { c.fillStyle = WINC[0]; for (let j = 0, n = city.tog.length / 4; j < n; j++) if (TOG[j]) c.fillRect(city.tog[j * 4], city.tog[j * 4 + 1], city.tog[j * 4 + 2], city.tog[j * 4 + 3]); }
    // aircraft lights on the towers
    if (night && city.blink.length && A >= 0.5) {
      const gr = GW.red, r = 5 * k, n = Math.min(city.blink.length, (A >= 1 ? 7 : A >= 0.75 ? 5 : 3) * 3); c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i += 3) { if (Math.sin(T * 2.2 + city.blink[i + 2]) < 0.2) continue; c.drawImage(gr, city.blink[i] - r, city.blink[i + 1] - r, r * 2, r * 2); }
      // flickering neon
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    if (night && city.flick.length) {
      c.globalCompositeOperation = 'lighter';
      for (const f of city.flick) { let a = 0.9; if (A >= 0.5) { a = 0.85 + 0.15 * Math.sin(T * 3 + f.ph); const ph = (T + f.ph) % 9; if ((ph > 4 && ph < 4.08) || (ph > 4.16 && ph < 4.3)) a = 0.08; } c.globalAlpha = a; blit(c, f.L); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // the train on the elevated line
    const L = LIFE;
    if (L.train.on && city.track) { const tr = city.train; c.drawImage(tr.c, L.train.x + tr.x, city.track.y + tr.y, tr.w, tr.h); if (night) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.8; const gw = GW.warm, hx = L.train.v > 0 ? L.train.x + tr.w : L.train.x; c.drawImage(gw, hx - 12 * k, city.track.y - 9 * k, 24 * k, 12 * k); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; } }
    // a drone, a plane, birds, a shooting star
    if (L.drone.on) { const d = L.drone; c.fillStyle = night ? '#0b0d1e' : '#3a4060'; c.fillRect(d.x - 3 * k, d.y - 0.8 * k, 6 * k, 1.6 * k); c.fillRect(d.x - 4.5 * k, d.y - 1.6 * k, 2 * k, 0.6 * k); c.fillRect(d.x + 2.5 * k, d.y - 1.6 * k, 2 * k, 0.6 * k); if (night) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(T * 6) > 0 ? 1 : 0.25; c.drawImage(GW.red, d.x - 4 * k, d.y - 3 * k, 8 * k, 8 * k); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; } }
    if (L.plane.on) { const p = L.plane; c.globalCompositeOperation = 'lighter'; c.globalAlpha = (T * 1.3) % 1 < 0.12 ? 1 : 0.35; c.drawImage(GW.white, p.x - 4 * k, p.y - 4 * k, 8 * k, 8 * k); c.globalAlpha = 0.7; c.drawImage(GW.red, p.x - 2.5 * k + 3 * k, p.y - 2.5 * k, 5 * k, 5 * k); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    if (L.birds.on) { const b = L.birds; c.beginPath(); for (let i = 0; i < 3; i++) { const bx = b.x + i * 9 * k * (b.v > 0 ? -1 : 1), by = b.y + (i % 2) * 4 * k, f = Math.sin(T * 9 + i * 2) * 2 * k; c.moveTo(bx - 3 * k, by - f); c.lineTo(bx, by); c.lineTo(bx + 3 * k, by - f); } c.strokeStyle = 'rgba(30,40,70,0.7)'; c.lineWidth = 0.9 * k; c.stroke(); }
    if (L.star.on) { const s = L.star, e = clamp(s.t / 0.9, 0, 1), x = s.x + e * 90 * k, y = s.y + e * 40 * k; c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.sin(e * Math.PI); c.beginPath(); c.moveTo(x - 30 * k, y - 13 * k); c.lineTo(x, y); c.strokeStyle = 'rgba(220,230,255,0.8)'; c.lineWidth = 1.2 * k; c.stroke(); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    // rain: two depths, one stroke each
    if (nr) {
      const sl = 0.16;
      c.beginPath(); for (let i = 0; i < nrFar; i++) { c.moveTo(RX[i], RY[i]); c.lineTo(RX[i] + RL[i] * sl, RY[i] + RL[i]); }
      c.strokeStyle = night ? 'rgba(175,195,255,0.24)' : 'rgba(255,255,255,0.3)'; c.lineWidth = 0.9; c.stroke();
      c.beginPath(); for (let i = nrFar; i < nr; i++) { c.moveTo(RX[i], RY[i]); c.lineTo(RX[i] + RL[i] * sl, RY[i] + RL[i]); }
      c.strokeStyle = night ? 'rgba(205,220,255,0.33)' : 'rgba(255,255,255,0.4)'; c.lineWidth = 1.3; c.stroke();
    }
    if (nd) {
      c.beginPath(); for (let i = 0; i < nd; i++) if (DT[i] > 1) { c.moveTo(DX[i], DY[i] - DT[i]); c.lineTo(DX[i], DY[i] - DR[i]); }
      c.strokeStyle = 'rgba(200,215,255,0.16)'; c.lineWidth = 1.2 * u; c.stroke();
      const d = SPR0.drop; for (let i = 0; i < nd; i++) { const r = DR[i]; c.drawImage(d, DX[i] - r * 1.3, DY[i] - r * 1.3, r * 2.6, r * 2.6); }
    }
    // lightning
    if (LT.t >= 0) {
      const t = LT.t, rm = RM();
      const a = rm ? Math.sin(Math.min(1, t / 1.1) * Math.PI) * 0.22 : t < 0.05 ? t / 0.05 : t < 0.13 ? 1 - (t - 0.05) / 0.08 * 0.8 : t < 0.19 ? 0.2 + (t - 0.13) / 0.06 * 0.6 : Math.max(0, 0.8 * (1 - (t - 0.19) / 0.7));
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = a * 0.5; c.fillStyle = '#b8c8ff'; c.fillRect(g.GL.x, g.GL.y, g.GL.w, g.GL.h);
      if (!rm && t < 0.32) { const bo = B.spr.bolt; c.globalAlpha = Math.min(1, a * 1.4); c.drawImage(bo.c, LT.x + bo.x, g.vt + bo.y, bo.w, bo.h); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }
  function drawGarland(c, g) {
    const G0 = B.spr.garland; blit(c, G0.L);
    if (B.part === 'day' || amb() < 0.5) return;
    const w = 0.5 + 0.5 * Math.sin(T * 0.9), k = 0.55 * (1 - dimK * 0.6);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = w * k; blit(c, G0.odd); c.globalAlpha = (1 - w) * k; blit(c, G0.even);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  function drawPlant(c, g) {
    const P = B.plant; if (!P) return;
    const st = g.stem, u = g.u, rm = RM(), live = amb() >= 0.5 && !rm;
    const sway = (live ? Math.sin(T * 0.85) * 0.9 * u + Math.sin(T * 0.37 + 1) * 0.6 * u : 0) + (rm ? 0 : wig);
    const sh = -sway / P.ph;
    c.setTransform(DPR, 0, DPR * sh, DPR, DPR * st.x, DPR * st.y);
    blit(c, P.L); if (P.F) blit(c, P.F);
    if (BNC.on && BNC.slot >= 0) {
      const s = P.slots[BNC.slot]; if (s) {
        const t = clamp(BNC.t / 0.75, 0, 1), sc = rm ? 1 : t < 0.3 ? lerp(1, 1.42, easeOut(t / 0.3)) : lerp(1.42, 1, easeOutBack((t - 0.3) / 0.7, 2.2) );
        const T0 = B.spr.tom, r = s.r * Math.max(1, sc); c.globalAlpha = rm ? Math.min(1, t * 1.8) : 1;
        c.drawImage(T0.c, s.x + T0.x * r / T0.r, s.y + T0.y * r / T0.r, T0.w * r / T0.r, T0.h * r / T0.r); c.globalAlpha = 1;
      }
    }
    if (dimK > 0.004) { c.globalAlpha = 0.68 * dimK; blit(c, P.T); if (P.FT) blit(c, P.FT); c.globalAlpha = 1; }
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function drawJar(c, g) {
    const S = B.spr, j = g.jar, u = g.u;
    c.setTransform(DPR, 0, 0, DPR, DPR * j.x, DPR * j.y);
    blit(c, S.jarB);
    if (nj) {
      const bob = amb() >= 0.5 ? 0.6 * u : 0;
      for (let i = 0; i < nj; i++) { const L = S.blob[KIND_IDS[JK[i]]]; c.globalAlpha = JA[i]; c.drawImage(L.c, JX[i] + L.x, JY[i] + L.y + Math.sin(T * 1.7 + i) * bob, L.w, L.h); }
      c.globalAlpha = 1;
    }
    blit(c, S.jarF);
    if (dimK > 0.004) { c.globalAlpha = 0.6 * dimK; blit(c, S.jarT); c.globalAlpha = 1; }
    // the lid's containment light flares when a rogue is locked in
    if (jarPulse > 0.01) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, jarPulse); c.drawImage(GW.mint, -j.w * 0.75, -j.h - 10 * u, j.w * 1.5, 22 * u); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  const SIGRGB = KIND_IDS.map((k) => { const r = ROGUE(k); const c = hexc(r ? r.sig : '#ff3d9a'); return `${c[0]},${c[1]},${c[2]}`; });
  let GW = null;
  function glows() {
    if (GW) return GW;
    GW = { red: glowOf('255,60,70', 32, 0.6), white: glowOf('255,255,255', 32, 0.6), warm: glowOf('255,240,200', 32, 0.5), amber: glowOf(PAL.amberRGB, 64, 0.5),
      bulb: glowOf('255,236,200', 32, 0.6), mint: glowOf(PAL.mintRGB, 64, 0.5), spark: glowOf(PAL.mintRGB, 32, 0.7), mintSoft: glowOf(PAL.mintRGB, 64, 0.3),
      garland: glowOf('255,200,130', 32, 0.55), bubble: glowOf('190,220,255', 32, 0.6), ledRain: glowOf('143,200,255', 32, 0.6), ledCity: glowOf('255,154,92', 32, 0.6),
    };
    return GW;
  }
  function drawScreens(c, g) {
    const S = B.scr; if (!S) return;
    const mode = SCRS.mode, A = amb();
    let a = 1;
    if (SCRS.flick > 0) a = RM() ? 1 - SCRS.flick * 1.6 : (T * 14) % 1 > 0.5 ? 1 : 0.62;
    for (let k = 0; k < 3; k++) {
      const id = k === 0 ? 'ed' : k === 1 ? 'st' : 'mi', s = g.scr[id];
      c.setTransform(DPR, DPR * s.sk, 0, DPR, DPR * s.x, DPR * s.y);
      c.globalAlpha = a;
      if (k === 0) drawEditor(c, s, S.ed, mode, A);
      else if (k === 1) {
        const sm = mode === 'done' ? 'done' : mode === 'focus' ? 'focus' : mode === 'pause' ? 'pause' : mode === 'brk' ? (TIMER.mode === 'long' ? 'long' : 'brk') : 'idle';
        const L = screenContent('st', sm); if (L) {
          blit(c, L);
          if (L.bar && TIMER.state !== 'idle' && sm !== 'done' && sm !== 'idle') {
            let pr = 0; try { pr = Engine.progress ? Engine.progress() : 0; } catch (e) { pr = 0; }
            const b = L.bar, f = sm === 'focus' || sm === 'pause'; c.fillStyle = f ? 'rgba(61,255,194,0.22)' : 'rgba(255,179,92,0.22)'; c.fillRect(b.x, b.y, b.w, b.h);
            c.fillStyle = f ? MINT : '#ffb35c'; c.fillRect(b.x, b.y, b.w * clamp(pr, 0, 1), b.h);
          }
        }
      } else { const L = screenContent('mi', 'clock'); if (L) blit(c, L); }
    }
    // a pulse of light on the screens: milestones, breathing, heads-down (one additive pass)
    const glowA = (SCRS.pulse > 0 ? 0.5 * Math.sin(Math.min(1, SCRS.pulse) * Math.PI) : 0) + 0.25 * breath + 0.18 * dimK;
    if (glowA > 0.02 && A >= 0.3) {
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, glowA);
      for (let k = 0; k < 2; k++) { const s = k ? g.scr.st : g.scr.ed; c.setTransform(DPR, DPR * s.sk, 0, DPR, DPR * s.x, DPR * s.y); blit(c, S[k ? 'st' : 'ed'].panel); }
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  function drawEditor(c, s, P, mode, A) {
    const hdr = P.hdr, pad = Math.max(3, 3 * B.g.u);
    if (mode === 'focus' || mode === 'pause') {
      const head = screenContent('ed', 'code'); if (head) blit(c, head);
      const S = P.code, lh = S.lh, rows = Math.max(1, Math.floor((s.h - hdr - pad) / lh)), dpr = B.g.dpr, n = S.rows;
      const top = hdr + pad * 0.6, off = SCRS.scroll * lh, sw = s.w - pad, line = SCRS.line;
      // the lines already typed (plus the one sliding out at the top), in at most two blits
      let a0 = Math.max(0, line - rows + (off > 0 ? 0 : 1)), y = top + (a0 - (line - rows + 1)) * lh + off;
      while (a0 < line) {
        const i0 = a0 % n, cnt = Math.min(line - a0, n - i0), yy = Math.max(y, top), skip = yy - y, h = cnt * lh - skip;
        if (h > 0) c.drawImage(S.L.c, 0, (i0 * lh + skip) * dpr, sw * dpr, h * dpr, pad, yy, sw, h);
        a0 += cnt; y += cnt * lh;
      }
      // the line being typed, and the cursor
      const cw = Math.min(sw - pad, SCRS.ch * S.cw), yt = top + (rows - 1) * lh + off, th = Math.min(lh, s.h - 1.5 - yt);
      if (cw > 0 && th > 0) c.drawImage(S.L.c, 0, (line % n) * lh * dpr, cw * dpr, th * dpr, pad, yt, cw, th);
      if (mode === 'focus' && (T * 2) % 1 < 0.6 && th > lh * 0.8) { c.fillStyle = MINT; c.fillRect(pad + Math.min(s.w - pad * 2, SCRS.ch * S.cw), yt + lh * 0.12, S.cw * 0.85, lh * 0.76); }
      if (mode === 'pause') { const o = screenOverlay('ed', 'pause'); if (o) blit(c, o); }
      return;
    }
    const key = mode === 'done' ? 'done' : mode === 'today' ? 'today' : mode === 'brk' ? 'brk' : 'idle';
    const L = screenContent('ed', key, key === 'done' && !P.c.done ? SCRS.extra || { n: nToday, rogues: 0 } : null); if (!L) return;
    blit(c, L);
    if (key === 'idle' && L.cur && (T * 1.6) % 1 < 0.55) { c.fillStyle = MINT; c.fillRect(L.cur.x, L.cur.y, L.cur.w, L.cur.h); }
    if (key === 'brk' && amb() >= 0.3) {
      const y0 = hdr + (s.h - hdr) * 0.66, amp = (s.h - hdr) * 0.07, w = s.w - pad * 2;
      c.beginPath(); for (let i = 0; i <= 24; i++) { const x = pad + w * i / 24, y = y0 + Math.sin(i * 0.55 + T * 1.2) * amp * Math.sin(i / 24 * Math.PI); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.strokeStyle = 'rgba(255,179,92,0.8)'; c.lineWidth = Math.max(0.8, 1.1 * B.g.u); c.stroke();
    }
  }
  function drawPatch(c, g) {
    if (typeof Patch === 'undefined' || !Patch || typeof Patch.draw !== 'function') return;
    c.save(); c.beginPath(); c.rect(0, 0, g.W, g.deskY); c.clip();
    PO.dim = dimK;
    try { Patch.draw(c, g.patch.x, g.patch.y, g.patch.size, PO); } catch (e) { reportErr('Scene:Patch.draw', e); }
    c.restore();
    c.setTransform(DPR, 0, 0, DPR, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // the screens' mint light on her
    if (B.part !== 'day' && amb() >= 0.3) { const S = g.patch.size; c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.09 + 0.04 * dimK; c.drawImage(GW.mintSoft, g.patch.x - S * 0.45, g.deskY - S * 0.82, S * 0.9, S * 0.55); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  }
  function drawProps(c, g) {
    const S = B.spr, u = g.u, dim = dimK > 0.004;
    // the lamp brightens as the room breathes (the lamp itself is in the background)
    if (breath > 0.02 && B.part !== 'day') { c.setTransform(DPR, 0, 0, DPR, DPR * g.lamp.x, DPR * g.lamp.y); c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.3 * breath * (1 - dimK); c.drawImage(GW.amber, -48 * u, -64 * u, 96 * u, 52 * u); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    // the radio: EQ, channel label, LED (its body is in the background)
    c.setTransform(DPR, 0, 0, DPR, DPR * g.radio.x, DPR * g.radio.y);
    const R0 = S.radioGeo, ch = DB && DB.settings ? DB.settings.music : 'lofi', col = ch === 'rain' ? '#8fc8ff' : ch === 'city' ? '#ff9a5c' : ch === 'off' ? '#5a6280' : MINT;
    const eq = R0.eq, bw = eq.w / 6;
    c.globalCompositeOperation = 'lighter'; c.fillStyle = col; c.beginPath();
    for (let i = 0; i < 6; i++) { const h = Math.max(0.6 * u, EQ[i] * eq.h * (ch === 'off' ? 0.2 : 1)); c.rect(eq.x + i * bw + bw * 0.18, eq.y + eq.h - h, bw * 0.64, h); }
    c.fill();
    c.globalAlpha = ch === 'off' ? 0.15 : 0.6 + 0.4 * (music.playing ? Math.exp(-music.phase * 4) : 0.4); c.drawImage(ch === 'rain' ? GW.ledRain : ch === 'city' ? GW.ledCity : GW.spark, R0.led.x - 4 * u, R0.led.y - 4 * u, 8 * u, 8 * u);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    const lab = S.lab[ch] || S.lab.lofi; c.globalAlpha = 1 - dimK * 0.6; c.drawImage(lab.c, R0.lab.x + lab.x, R0.lab.y + lab.y, lab.w, lab.h); c.globalAlpha = 1;
    if (nn) {
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      const set = S.notes[ch] || S.notes.lofi;
      for (let i = 0; i < nn; i++) { const f = NA[i] / 2.6, L = set[NV[i]]; c.globalAlpha = (f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8) * 0.85 * (1 - dimK * 0.7); c.drawImage(L.c, NX[i] + L.x, NY[i] + L.y, L.w, L.h); }
      c.globalAlpha = 1;
    }
    // the rubber duck (wide desks), squeaks when tapped
    if (g.duck && S.duck) {
      const q = duckT > 0 ? Math.sin((0.5 - duckT) * 30) * 0.12 * duckT * 2 : 0;
      c.setTransform(DPR * (1 + q), 0, 0, DPR * (1 - q), DPR * g.duck.x, DPR * g.duck.y);
      blit(c, S.duck); if (dim) { c.globalAlpha = 0.66 * dimK; blit(c, S.duckT); c.globalAlpha = 1; }
    }
    // steam from the mug (the mug is in the background)
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (ns) {
      const w = SPR0.wisp; c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < ns; i++) { const f = SA[i] / SL[i], a = (f < 0.25 ? f / 0.25 : 1 - (f - 0.25) / 0.75) * (B.part === 'day' ? 0.5 : 0.32) * (1 - dimK * 0.6), s = SS[i] * (6 + f * 10); c.globalAlpha = a; c.drawImage(w, SX[i] - s / 2, SY[i] - s, s, s * 2); }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
  }
  function drawFX(c, g) {
    const S = B.spr, u = g.u;
    // the harvest flight (t < 0: still hidden under the Dial's pop-off)
    if (HV.on && HV.t >= 0) {
      const x = curX(HV), y = curY(HV), t = clamp(HV.t / HV.dur, 0, 1), r = lerp(HV.r0, HV.r1, easeIn(t)) * (1 + 0.28 * Math.sin(t * Math.PI)), T0 = S.tom, a = t * 5.5, co = Math.cos(a), si = Math.sin(a), k = r / T0.r;
      c.setTransform(DPR * co, DPR * si, -DPR * si, DPR * co, DPR * x, DPR * y);
      c.drawImage(T0.c, T0.x * k, T0.y * k, T0.w * k, T0.h * k);
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    // the capture
    if (CP.on) drawCapture(c, g);
    // particles: confetti and leaves, then light
    if (pn) {
      const GA = S.glyph, LF = S.leaf; let ca = 1;
      for (let i = 0; i < pn; i++) {
        const kd = PK[i]; if (kd !== 0 && kd !== 3) continue;
        const f = PA[i] / PL[i], a = f > 0.75 ? (1 - f) / 0.25 : 1, fl = 0.25 + 0.75 * Math.abs(Math.cos(PW[i])), s = PS[i];
        if (a !== ca) { c.globalAlpha = a; ca = a; }
        if (kd === 0) { const q = PQ[i]; c.drawImage(GA.L.c, GA.sx[q], GA.sy[q], GA.sw, GA.sw, PX[i] - s * fl / 2, PY[i] - s / 2, s * fl, s); }
        else c.drawImage(LF.c, PX[i] + LF.x * s * fl, PY[i] + LF.y * s, LF.w * s * fl, LF.h * s);
      }
      c.globalCompositeOperation = 'lighter';
      const sp1 = S.sparkle, sk = GW.spark, bb = GW.bubble;
      for (let i = 0; i < pn; i++) {
        const kd = PK[i]; if (kd === 0 || kd === 3) continue;
        const f = PA[i] / PL[i];
        if (kd === 1) { const s = PS[i] * Math.sin(f * Math.PI); c.globalAlpha = 1; c.drawImage(sp1.c, PX[i] - s / 2, PY[i] - s / 2, s, s); }
        else if (kd === 2) { const s = PS[i] * (1 - f); c.globalAlpha = 1 - f; c.drawImage(sk, PX[i] - s, PY[i] - s, s * 2, s * 2); }
        else { const s = PS[i]; c.globalAlpha = (1 - f) * 0.8; c.drawImage(bb, PX[i] - s, PY[i] - s, s * 2, s * 2); }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    // a hovered hotspot glows a little (pointer devices)
    if (hoverR) { const h = hoverR; c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.16; c.drawImage(GW.mintSoft, h.x - h.w * 0.2, h.y - h.h * 0.2, h.w * 1.4, h.h * 1.4); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
    // lightning lights the room too
    if (LT.t >= 0 && LT.t < 0.6 && !RM()) { const a = LT.t < 0.05 ? LT.t / 0.05 : Math.max(0, 1 - (LT.t - 0.05) / 0.5); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.09; c.fillStyle = '#8ea6ff'; c.fillRect(0, 0, g.W, g.H); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  }
  function drawCapture(c, g) {
    const t = CP.t, u = g.u, rm = RM(), jar = g.jar;
    let x = CP.x, y = CP.y, sc = 1, a = 1;
    const mx = jar.x, my = jar.y - jar.h + 2 * u;
    if (rm) { a = t < 0.4 ? t / 0.4 : t < 1.2 ? 1 : Math.max(0, 1 - (t - 1.2) / 0.4); }
    else if (t < 0.35) { sc = easeOutBack(t / 0.35); a = Math.min(1, t / 0.15); }
    else if (t < 1.1) { sc = 1 + Math.sin((t - 0.35) * 40) * 0.03; }
    else if (t < 1.4) { sc = lerp(1, 0.28, easeIn((t - 1.1) / 0.3)); }
    else { const e = easeInOut(clamp((t - 1.4) / 0.6, 0, 1)), cx = (x + mx) / 2, cy = Math.min(y, my) - g.patch.size * 0.25; const b = 1 - e; x = b * b * CP.x + 2 * b * e * cx + e * e * mx; y = b * b * CP.y + 2 * b * e * cy + e * e * my; sc = lerp(0.28, 0.16, e); }
    const H = CP.h * sc;
    // the beam
    if (!rm && t > 0.35 && t < 1.25) {
      const hp = capPos(), n = 9, q = Math.floor(T * 30) * 17 + CP.seed;
      c.beginPath(); c.moveTo(hp.hx, hp.hy);
      for (let i = 1; i < n; i++) { const f = i / n, jx = (hsh(q + i) - 0.5) * 14 * u * Math.sin(f * Math.PI), jy = (hsh(q + i + 50) - 0.5) * 14 * u * Math.sin(f * Math.PI); c.lineTo(lerp(hp.hx, x, f) + jx, lerp(hp.hy, y, f) + jy); }
      c.lineTo(x, y);
      const ba = t < 0.45 ? (t - 0.35) / 0.1 : t > 1.1 ? (1.25 - t) / 0.15 : 1;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = ba * 0.25; c.strokeStyle = MINT; c.lineWidth = 9 * u; c.stroke();
      c.globalAlpha = ba * 0.6; c.lineWidth = 3.2 * u; c.stroke();
      c.globalAlpha = ba; c.strokeStyle = '#eafff8'; c.lineWidth = 1.2 * u; c.stroke();
      c.globalAlpha = ba * 0.8; const gw = GW.mint; c.drawImage(gw, x - 26 * u, y - 26 * u, 52 * u, 52 * u); c.drawImage(gw, hp.hx - 12 * u, hp.hy - 12 * u, 24 * u, 24 * u);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.5) emit(2, x + (Math.random() - 0.5) * H * 0.5, y + (Math.random() - 0.5) * H * 0.5, (Math.random() - 0.5) * 140 * u, (Math.random() - 0.5) * 140 * u, 0.25, 3 * u, 0);
    }
    // the rogue
    const src = CP.spr, sw = src.width, sh = src.height, w = H * sw / sh;
    c.globalAlpha = a;
    if (!rm && t < 0.5) {
      // glitching in: torn into slices that settle
      const n = 7, j = (1 - t / 0.5) * 16 * u, q = Math.floor(T * 24) * 13;
      for (let i = 0; i < n; i++) { const off = (hsh(q + i) - 0.5) * j; c.drawImage(src, 0, sh * i / n, sw, sh / n, x - w / 2 + off, y - H / 2 + H * i / n, w, H / n + 0.5); }
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = a * 0.35; c.drawImage(src, x - w / 2 + 3 * u, y - H / 2, w, H); c.globalCompositeOperation = 'source-over';
    } else c.drawImage(src, x - w / 2, y - H / 2, w, H);
    if (!rm && t > 0.35 && t < 1.25) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.25 + 0.2 * Math.sin(T * 50); c.drawImage(src, x - w / 2, y - H / 2, w, H); c.globalCompositeOperation = 'source-over'; }
    c.globalAlpha = 1;
  }

  // ═════════════════════════════ input ═════════════════════════════
  function inR(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
  function hitTest(x, y) {
    const g = B ? B.g : null; if (!g) return null;
    for (const [id, r] of g.hits) if (inR(r, x, y)) return id;
    try { if (Patch && Patch.hit && Patch.hit(x, y)) return 'patch'; } catch (e) {}
    if (x >= g.GL.x && x <= g.GL.x + g.GL.w && y >= g.vt && y <= g.sill) return 'window';
    return null;
  }
  const WEATHER_NEXT = { auto: 'rain', rain: 'clear', clear: 'auto' };
  const MUSIC_NEXT = { lofi: 'rain', rain: 'city', city: 'off', off: 'lofi' };
  function tap(x, y) {
    const id = hitTest(x, y);
    if (!id) return null;
    BUS.emit('scene:tap', { id, x, y });
    const u = ru(), g = B.g;
    if (id === 'plant') { if (RM()) burst('sparkle', g.plant.x, g.sill - g.potH - g.plantH * 0.5); else { wigV += (x < g.plant.x ? 1 : -1) * 120 * u; burst('leaves', g.plant.x, g.sill - g.potH - g.plantH * 0.6); } }
    else if (id === 'window') { const s = DB && DB.settings ? DB.settings.weather : 'auto'; try { Engine.setSetting('weather', WEATHER_NEXT[s] || 'auto'); } catch (e) { reportErr('Scene:weather', e); } }
    else if (id === 'radio') { const s = DB && DB.settings ? DB.settings.music : 'lofi'; try { Engine.setSetting('music', MUSIC_NEXT[s] || 'lofi'); } catch (e) { reportErr('Scene:music', e); } for (let i = 0; i < 6; i++) EQ[i] = Math.random(); }
    else if (id === 'mug') { for (let i = 0; i < 4 && ns < NST; i++) { const j = ns++; SX[j] = g.mug.x + (Math.random() - 0.5) * 10 * u; SY[j] = g.mug.y - 22 * u - i * 4 * u; SA[j] = 0.2; SL[j] = 1.6 + Math.random() * 0.6; SS[j] = (1 + Math.random() * 0.5) * u; } try { if (Patch.pose) Patch.pose('sip', { hold: 1.8 }); } catch (e) {} }
    else if (id === 'screens') { SCRS.over = 'today'; SCRS.overT = 4.5; if (B.scr) { B.scr.ed.c.today = null; try { screenContent('ed', 'today'); } catch (e) {} } }
    else if (id === 'duck') { duckT = RM() ? 0 : 0.5; BUS.emit('sfx', { name: 'pop', vol: 0.5 }); }
    else if (id === 'jar') { const jx = x - g.jar.x; for (let i = 0; i < nj; i++) { const dx = JX[i] - jx || 0.1; JVX[i] += Math.sign(dx) * (40 + Math.random() * 50) * u; JVY[i] -= (30 + Math.random() * 50) * u; } burst('bubbles', g.jar.x, g.jar.y - g.jar.h * 0.4); }
    return id;
  }
  function hover(x, y) {
    const id = hitTest(x, y); hoverR = null;
    if (id && id !== 'patch' && id !== 'window' && B) for (const h of B.g.hits) if (h[0] === id && inR(h[1], x, y)) { hoverR = h[1]; break; }
    return !!id;
  }

  // ═════════════════════════════ events ═════════════════════════════
  function prepDone() {
    if (!B || !B.scr || TIMER.mode !== 'focus') return;
    SCRS.extra = { n: nToday + 1, rogues: TIMER.rogues | 0 };
    try { screenContent('ed', 'done', SCRS.extra); } catch (e) { reportErr('Scene.prep', e); }
  }
  function onDone(p) {
    if (!B || !p) return;
    if (!p.away && !document.hidden) tshT = 0;
    if (p.mode === 'focus') {
      const away = !!p.away;
      if (away) { pendH = 0; refreshCounts(); bakePlant(); }
      const ex = { n: nToday, rogues: p.session ? p.session.rogues | 0 : 0 };
      if (!SCRS.extra || SCRS.extra.n !== ex.n || SCRS.extra.rogues !== ex.rogues || !(B.scr && B.scr.ed.c.done)) { SCRS.extra = ex; if (B.scr) B.scr.ed.c.done = null; }
      SCRS.over = 'done'; SCRS.overT = away ? 4 : 7;
      if (!away && !RM()) { const g = B.g; burst('confetti', g.scr.ed.x + g.scr.ed.w / 2, g.scr.ed.y + g.scr.ed.h * 0.4); burst('confetti', g.scr.st.x + g.scr.st.w / 2, g.scr.st.y + g.scr.st.h * 0.5); }
    } else { invalidateScreens(['st']); }
  }
  function onSession(p) {
    const s = p && p.session;
    if (s && s.kind === 'focus') { pendH = 1; pendT = 4.5; }
    refreshCounts(); bakePlant();
    if (B && B.scr) { const d = B.scr.ed.c.done; B.scr.ed.c = d ? { done: d } : {}; B.scr.st.c = {}; try { screenContent('st', 'done'); } catch (e) {} prewarm(); }
  }
  function onHarvest(p) {
    if (!B || !p) return;
    if (tshT >= 0) tshT = 1.1;
    const i = clamp(nToday - 1, 0, 23), to = slotPos(i);
    if (RM() || !isFinite(p.x)) { landTomato(i); return; }
    // pick up where the Dial's pop-off leaves its tomato (shrunk to about a third, lifted a little)
    // hidden for 0.18 s while the Dial's pop-off squashes up and vanishes (it covers the start point), then a 0.34 s
    // flight: it lands ~0.52 s after the harvest, 1.6 s into the moment (DESIGN.md §7), on Snd's 'land' (harvest + 0.5 s)
    HV.on = true; HV.t = -0.18; HV.dur = 0.34; HV.slot = i;
    HV.x0 = p.x; HV.y0 = p.y - 22; HV.r0 = clamp(p.r || 40, 10, 140) * 0.42; HV.x1 = to.x; HV.y1 = to.y; HV.r1 = to.r;
    const side = HV.x1 < B.g.patch.x ? -1 : 1, edge = side < 0 ? B.g.GL.x + 10 : B.g.GL.x + B.g.GL.w - 10;
    HV.cx = lerp(HV.x1, edge, 0.35) + side * 10 * B.g.u; HV.cy = Math.min(HV.y0, HV.y1) + (HV.y0 - HV.y1) * 0.1 - 30 * B.g.u;
  }
  function onSettings(p) {
    const k = p && p.key;
    if (!k || k === 'dailyGoal') { refreshCounts(); bakePlant(); invalidateScreens(['st']); }
    if (k === 'motion' && B) seedLife();
    if (k === 'music' && B && rainy() !== B.rain) bake();
    if (!k && B && rainy() !== B.rain) bake();
  }
  function resync() { pendH = 0; HV.on = false; BNC.on = false; refreshCounts(); bakePlant(); pendR = 0; CP.on = false; syncJar(true); invalidateScreens(); if (B && rainy() !== B.rain) bake(); }
  function onActivity(p) {
    if (!p || !B) return;
    if (p.phase === 'start' && p.id === 'window') { const L = LIFE; L.train.next = T; L.drone.next = T + 2; if (B.part === 'day') L.birds.next = T + 4; else { L.star.on = true; L.star.t = 0; const s = B.city.rec.sky; if (s) { L.star.x = lerp(s.x0, s.x1, 0.2 + Math.random() * 0.4); L.star.y = s.y0; } } }
    if (p.id === 'breathe' && p.phase === 'end') breathT = 0;
  }
  function onStep(p) { if (p && p.breath) breathT = p.breath === 'in' ? 1 : p.breath === 'out' ? 0 : breathT; }

  // ═════════════════════════════ hooks ═════════════════════════════
  function init() {
    BUS.on('daypart', () => bake());
    BUS.on('theme', () => { if (B) bake(); });
    BUS.on('settings', onSettings);
    BUS.on('data', resync);
    BUS.on('session:new', onSession);
    BUS.on('timer:done', onDone);
    BUS.on('timer:milestone', () => { SCRS.pulse = 1.2; });
    BUS.on('timer:start', (p) => { if (SCRS.over === 'done' || SCRS.over === 'today') SCRS.over = ''; if (p && p.mode === 'focus') setTimeout(prepDone, 120); });
    BUS.on('harvest', onHarvest);
    BUS.on('rogue:capture', onCapture);
    BUS.on('rogue:change', () => { if (!CP.on) syncJar(true); });
    BUS.on('patch:unlock', () => { if (!B) return; let a = null; try { a = Patch.anchor && Patch.anchor(); } catch (e) {} const g = B.g; burst('sparkle', a && isFinite(a.x) ? a.x : g.patch.x, a && isFinite(a.y) ? a.y + g.patch.size * 0.35 : g.deskY - g.patch.size * 0.4); });
    BUS.on('activity', onActivity);
    BUS.on('activity:step', onStep);
    BUS.on('visible', () => { tick = 2; periodic(); if (B && Math.abs(DAY.hour() - B.hour) > 0.02) setTimeout(refreshSky, 0); });
    BUS.on('ready', () => { invalidateScreens(); });
    refreshCounts(); kinds = todayKinds(); lastDay = dateKey();
  }
  // a resize clears the canvas (core sets its size); paint the last bake into it straight away so a quality step or
  // a rotation never shows a blank frame while the new bake is made
  function layout() { G = computeGeom(); if (B) { try { draw(ctx); } catch (e) { reportErr('Scene.layout', e); } } }
  function plant() { const p = slotPos(Math.max(0, nToday - pendH)); return { x: p.x, y: p.y }; }

  // per frame: Scene total (update + draw, Patch.draw included) and Patch.draw alone; median / p95 in ms
  function prof() {
    if (!PROF) return null;
    const n = Math.max(1, PROF.n), o = { n }; ['fin', 'outside', 'sill', 'screens', 'patch', 'props', 'fx'].forEach((k, i) => { o[k] = +(PROF.t[i] / n).toFixed(3); });
    const st = (a) => { const v = Array.from(a.slice(0, PROF.fn)).sort((x, y) => x - y), q = (p) => +(v[Math.min(v.length - 1, Math.floor(p * v.length))] || 0).toFixed(2); return { med: q(0.5), p95: q(0.95), max: q(1) }; };
    o.scene = st(PROF.f); o.patchOnly = st(PROF.fp); o.mine = st(PROF.f.map((x, i) => x - PROF.fp[i])); o.upd = +(PROF.us / n).toFixed(3); PROF.us = 0;
    o.slow = PROF.slow; PROF.slow = [];
    PROF.n = 0; PROF.t.fill(0); PROF.fn = 0; PROF.fi = 0; return o;
  }
  return { init, bake, layout, update, draw, tap, hover, burst, plant, prof };
})();

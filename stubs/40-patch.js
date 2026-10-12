// STUB Patch: a placeholder figure, a working speech bubble (CONTRACT.md §8.3). The real one lives in src/40-patch.js.
const Patch = (() => {
  let ax = 0, ay = 0, box = { x: 0, y: 0, w: 0, h: 0 }, bubT = 0, t = 0;
  CSS('patch-stub', `.pb-bubble{position:fixed;max-width:240px;padding:10px 14px;border-radius:16px;background:var(--surface);color:var(--text);font:600 14px/1.35 var(--body);box-shadow:var(--shadow);transform:translate(-50%,-100%);opacity:0;transition:opacity .2s}.pb-bubble.on{opacity:1}`);
  function say(text, o = {}) {
    if (!PREFS.talk && !o.force) return;
    const el = $('bubble'); if (!el) return;
    el.innerHTML = ''; const b = h('div', { class: 'pb-bubble' }, String(text)); el.appendChild(b);
    b.style.left = clamp(ax, 130, VW - 130) + 'px'; b.style.top = Math.max(LAYOUT.top.h + 50, ay - 8) + 'px';
    requestAnimationFrame(() => b.classList.add('on'));
    clearTimeout(bubT); bubT = setTimeout(() => b.classList.remove('on'), o.ms || 3800);
  }
  return {
    ready: true,
    init() {},
    bake() {},
    update(dt) { t += dt; },
    draw(c, x, y, size) {
      // x,y = the point on the desk line under her centre; size = her full height in CSS px
      const s = size / 240, bob = Math.sin(t * 2) * 1.5;
      c.save(); c.translate(x, y); c.scale(s, s);
      c.fillStyle = '#3b4058'; c.fillRect(-46, -110 + bob, 92, 110);
      c.fillStyle = '#24160f'; c.beginPath(); c.arc(0, -150 + bob, 62, 0, TAU); c.fill();
      c.fillStyle = PAL.skin; c.beginPath(); c.arc(0, -140 + bob, 42, 0, TAU); c.fill();
      c.strokeStyle = PAL.mint; c.lineWidth = 4; c.strokeRect(-34, -152 + bob, 28, 20); c.strokeRect(6, -152 + bob, 28, 20);
      c.restore();
      ax = x; ay = y - size * 0.86; box = { x: x - 60 * s, y: y - 215 * s, w: 120 * s, h: 215 * s };
    },
    say,
    sayLine(key, vars, o) { say(LINE(key, vars), o); },
    hand: () => ({ x: ax - 40, y: ay + 90 }),
    anchor: () => ({ x: ax, y: ay }),
    hit: (x, y) => x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h,
    pose() {},
    rogue: () => null,
    rogueURL: () => null,
  };
})();

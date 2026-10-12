// STUB Scene: a flat room so the app runs (CONTRACT.md §8.4). The real one lives in src/45-scene.js.
const Scene = (() => {
  let t = 0;
  return {
    init() {},
    bake() {},
    layout() {},
    update(dt) { t += dt; },
    draw(c) {
      c.setTransform(DPR, 0, 0, DPR, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, LAYOUT.deskY);
      g.addColorStop(0, '#0c0f22'); g.addColorStop(1, '#232a55');
      c.fillStyle = g; c.fillRect(0, 0, VW, VH);
      c.fillStyle = '#1b2145'; c.fillRect(VW * 0.12, LAYOUT.top.h + 16, (LAYOUT.stage.w || VW) * 0.76, LAYOUT.deskY - LAYOUT.top.h - 40);
      const st = LAYOUT.stage;
      Patch.draw(c, st.x + st.w * 0.5, LAYOUT.deskY, Math.min(260, (LAYOUT.deskY - LAYOUT.top.h) * 0.9));
      c.fillStyle = '#2a2140'; c.fillRect(0, LAYOUT.deskY, VW, VH - LAYOUT.deskY);
      c.fillStyle = '#3d3060'; c.fillRect(0, LAYOUT.deskY, VW, 6);
    },
    tap(x, y) { if (Patch.hit(x, y)) BUS.emit('scene:tap', { id: 'patch', x, y }); return null; },
    hover: (x, y) => Patch.hit(x, y),
    burst() {},
    plant: () => ({ x: VW * 0.8, y: LAYOUT.deskY - 40 }),
  };
})();

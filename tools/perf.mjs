#!/usr/bin/env node
// Frame cost per phase under CPU throttling (4× ≈ a mid-range phone, 6× ≈ an old, slow one).
//   node tools/perf.mjs --dir dist --throttle 6 --phases "idle:wait 4000|running:start;wait 4000|log:sheet log;wait 3000"
// Each phase: run its steps after a perf reset, then read __pomo.perf() (JS work per drawn frame + gap between frames).
// Budget (CONTRACT.md §9): at --throttle 4, work median ≤ 4 ms and p95 ≤ 8 ms in every phase.
import { opts, open, run } from './lib.mjs';
const O = opts(process.argv.slice(2));
const phases = (O.phases || 'idle:wait 4000|running:start;wait 4000|break:finish;wait 4000').split('|').map((p) => { const i = p.indexOf(':'); return [p.slice(0, i), p.slice(i + 1)]; });
const { browser, page, errors, srv } = await open(O);
const rows = [];
for (const [name, steps] of phases) {
  await run(page, 'perfreset', O, () => {});
  await run(page, steps, O, () => {});
  const p = await page.evaluate(() => window.__pomo.perf());
  rows.push({ phase: name, workMed: p.work.median, workP95: p.work.p95, workMax: p.work.max, gapMed: p.gap.median, gapP95: p.gap.p95, frames: p.work.n, QL: p.QL, DPR: p.DPR });
}
console.log(`throttle ${O.throttle}× · ${O.size} @${O.dpr}`);
console.table(rows);
if (errors.length) console.log('console errors:\n  ' + errors.slice(0, 10).join('\n  '));
await browser.close(); srv.close();

#!/usr/bin/env node
// Drive a built dist/ in headless Chromium: run steps, take screenshots, report console errors and module errors.
//   node tools/shot.mjs --dir dist --out .shots --steps "wait 800; shot home; start; wait 1200; shot running; perf"
// Options: --size 390x844 --dpr 2 --touch --throttle 4 --query "hour=22&dev=1" --v1 test/fixtures/v1.json --reduced --scheme light
// Sizes to check: 390x844 (default), 375x667, 844x390 (phone landscape), 1440x900 --dpr 1 (desktop).
import { opts, open, run } from './lib.mjs';
const O = opts(process.argv.slice(2));
const { browser, page, errors, srv } = await open(O);
let code = 0;
try {
  await run(page, O.steps || 'wait 1200; shot home', O);
  const modErr = await page.evaluate(() => window.__pomo.errors());
  if (Object.keys(modErr).length) { console.log('  module errors:', JSON.stringify(modErr)); code = 1; }
} catch (e) { console.error('✖ step failed:', e.message); code = 1; }
if (errors.length) { console.log('  console errors:\n    ' + errors.slice(0, 20).join('\n    ')); code = 1; }
else console.log('  ✓ no console errors');
await browser.close(); srv.close();
process.exit(code);

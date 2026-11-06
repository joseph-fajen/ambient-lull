// Runs tests/audio-checks.html in headless Chrome and prints the results.
// Usage: npm run test:audio   (Node 22+, and Chrome, Chromium or Edge installed)
// Set CHROME=/path/to/browser to choose the browser. Exits with 1 if any check fails.
import { openPage, waitFor, fail } from './browser.mjs';

const PAGE = 'tests/audio-checks.html';
const TIMEOUT_MS = 30 * 60 * 1000; // the checks take about 5–10 minutes, longer on slow machines

let page;
try {
  page = await openPage(PAGE);
  console.log(`Running ${PAGE} in ${page.browserName} (about 5–10 minutes)…`);
  const started = Date.now();
  const outcome = await waitFor(page.evaluate, 'document.body?.dataset.result', TIMEOUT_MS, 'the checks to finish');
  const lines = await page.evaluate(`[
    document.getElementById('status').textContent,
    ...[...document.querySelectorAll('#results li')].map(li => li.textContent),
  ]`);
  console.log(lines.slice(1).join('\n'));
  console.log(`\n${lines[0]} (${Math.round((Date.now() - started) / 1000)} s)`);
  await page.close();
  process.exit(outcome === 'pass' ? 0 : 1);
} catch (err) {
  await page?.close();
  fail(String(err.message ?? err));
}

// SPIKE (throwaway, branch forest-spike): renders the four forest ear-check clips to
// clips/forest/ and prints their loudness next to today's (clip A).
// Usage: npm run clips:forest [-- --seconds 240 --seed 7 --only B]
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openPage, waitFor, fail } from './browser.mjs';

const OUT = fileURLToPath(new URL('../clips/forest/', import.meta.url));
const { values: opts } = parseArgs({ options: {
  seconds: { type: 'string', default: '240' }, seed: { type: 'string', default: '7' }, only: { type: 'string' },
} });
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
const dB = x => (20 * Math.log10(x)).toFixed(1);

let page;
try {
  page = await openPage(`tests/forest-clips.html?seconds=${opts.seconds}&seed=${opts.seed}`);
  await waitFor(page.evaluate, 'document.body?.dataset.ready', 60000, 'the forest clip page');
  let ids = await page.evaluate('window.clipIds');
  if (opts.only) ids = (await page.evaluate('window.allClipIds')).filter(id => opts.only.split(',').includes(id));
  await mkdir(OUT, { recursive: true });
  const rows = [];
  for (const id of ids) {
    const started = Date.now();
    const { name, stats, wav } = await page.evaluate(`window.clip(${JSON.stringify(id)})`);
    const wavPath = join(OUT, `${name}.wav`);
    await writeFile(wavPath, Buffer.from(wav, 'base64'));
    let file = wavPath;
    if (hasFfmpeg) {
      file = join(OUT, `${name}.mp3`);
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-b:a', '192k', file]);
      if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
      await rm(wavPath);
    }
    rows.push({ id, name, ...stats });
    console.log(`${file}  (${((Date.now() - started) / 1000).toFixed(0)} s)`);
  }
  const ref = rows.find(r => r.id === 'A');
  console.log('\nclip                    peak dB  before limiter  loudest 3 s  quietest 3 s  vs A loudest');
  for (const r of rows) {
    const vs = ref ? (r.loudest3s - ref.loudest3s).toFixed(1) : '-';
    console.log(`${r.name.padEnd(24)}${dB(r.peak).padStart(7)}${dB(r.peakBeforeLimiter).padStart(16)}${(r.loudest3s ?? -Infinity).toFixed(1).padStart(13)}${(r.quietest3s ?? -Infinity).toFixed(1).padStart(14)}${String(vs).padStart(14)}`);
  }
  await page.close();
} catch (err) {
  await page?.close();
  fail(String(err.message ?? err));
}

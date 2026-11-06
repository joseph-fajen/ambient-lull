// Renders a clip of each sound to clips/, for listening on any device and for blind tests.
// Usage: npm run clips [-- options]   (Node 22+, Chrome, and ffmpeg for MP3; WAV without it)
//   --sounds glass,harp   only these sounds (ids from SOUNDS in src/settings.js)
//   --seconds 30          clip length
//   --seed 7              which melody (the same for every sound)
//   --blind               files named Sound A, Sound B… in a shuffled order; the answers
//                         go in clips/answers.txt
// Every clip uses the app's default settings, so only the sound differs.
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { openPage, waitFor, fail } from './browser.mjs';

const OUT = fileURLToPath(new URL('../clips/', import.meta.url));
const { values: opts } = parseArgs({ options: {
  sounds: { type: 'string' }, seconds: { type: 'string', default: '30' },
  seed: { type: 'string', default: '7' }, blind: { type: 'boolean', default: false },
} });
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;

let page;
try {
  page = await openPage(`tests/clips.html?seconds=${opts.seconds}&seed=${opts.seed}`);
  await waitFor(page.evaluate, 'document.body?.dataset.ready', 30000, 'the clip page');
  let sounds = await page.evaluate('window.sounds');
  if (opts.sounds) {
    const wanted = opts.sounds.split(',');
    const unknown = wanted.filter(id => !sounds.some(s => s.id === id));
    if (unknown.length) throw new Error(`Unknown sound: ${unknown.join(', ')}`);
    sounds = sounds.filter(s => wanted.includes(s.id));
  }
  if (opts.blind) sounds = sounds.map(s => [Math.random(), s]).sort((a, b) => a[0] - b[0]).map(([, s]) => s);
  await mkdir(OUT, { recursive: true });
  const answers = [];
  for (const [i, sound] of sounds.entries()) {
    const name = opts.blind ? `Sound ${String.fromCharCode(65 + i)}` : `${String(i + 1).padStart(2, '0')} ${sound.name} (${sound.detail})`;
    const wav = Buffer.from(await page.evaluate(`window.clipWav(${JSON.stringify(sound.id)})`), 'base64');
    const wavPath = join(OUT, `${name}.wav`);
    await writeFile(wavPath, wav);
    let file = wavPath;
    if (hasFfmpeg) {
      file = join(OUT, `${name}.mp3`);
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-b:a', '192k', file]);
      if (r.status !== 0) throw new Error(`ffmpeg failed: ${r.stderr}`);
      await rm(wavPath);
    }
    answers.push(`${name}: ${sound.name} (${sound.detail})`);
    console.log(`${file}`);
  }
  if (opts.blind) await writeFile(join(OUT, 'answers.txt'), answers.join('\n') + '\n');
  await page.close();
} catch (err) {
  await page?.close();
  fail(String(err.message ?? err));
}

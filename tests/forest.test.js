// SPIKE (throwaway, branch forest-spike): the forest's pure side.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import { createRandom } from '../src/music.js';
import { planForest, createTides, conductorChanges, poolIn, REGISTERS, LAYERS, VOICE_CAP } from '../src/forest/plan.js';

test('tides only scale down, never above 1', () => {
  const tides = createTides(createRandom(3));
  for (const layer of Object.keys(LAYERS)) {
    for (let t = 0; t < 600; t += 0.5) {
      const level = tides.level(layer, t);
      assert.ok(level <= 1 && level >= 10 ** (LAYERS[layer].floorDb / 20) - 1e-9);
      assert.ok(tides.brightness(layer, t) <= 1);
    }
  }
});

test('a 4-minute clip has 7 key changes and 4 sound changes', () => {
  const changes = conductorChanges(DEFAULT_SETTINGS, 240, { keyEvery: 30, soundEvery: 48 });
  let keys = 0, sounds = 0, prev = DEFAULT_SETTINGS;
  for (const c of changes) { keys += c.key !== prev.key; sounds += c.sound !== prev.sound; prev = c; }
  assert.equal(keys, 7);
  assert.equal(sounds, 4);
});

test('forest voices stay in their register and scale, and under the cap', () => {
  for (const seed of [1, 7, 42]) {
    const { events, changes } = planForest(DEFAULT_SETTINGS, 236, seed);
    const stateAt = t => [DEFAULT_SETTINGS, ...changes].filter(c => (c.at ?? 0) <= t).pop();
    for (const e of events) {
      if (e.kind === 'sustain') {
        const { key, scale } = stateAt(e.time);
        const pool = poolIn(key, scale, REGISTERS[e.layer]);
        assert.ok(pool.includes(e.midi));
        if (e.glideTo != null) assert.ok(pool.includes(e.glideTo));
      }
    }
    const voices = events.filter(e => ['sustain', 'wave', 'swarm'].includes(e.kind))
      .map(e => ({ from: e.time, to: e.time + e.duration + (e.kind === 'swarm' ? 2 : 0), n: e.copies?.length ?? 1 }));
    for (const v of voices) {
      const load = voices.filter(w => w.from <= v.from && w.to > v.from).reduce((n, w) => n + w.n, 0);
      assert.ok(load <= VOICE_CAP, `seed ${seed}: ${load} voices at ${v.from.toFixed(1)} s`);
    }
  }
});

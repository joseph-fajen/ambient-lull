import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_SETS, nearestSample, nameToMidi } from '../src/samples.js';
import { SOUNDS } from '../src/settings.js';

test('nameToMidi: real pitch names, A4 = 69', () => {
  assert.equal(nameToMidi('A4'), 69);
  assert.equal(nameToMidi('C4'), 60);
  assert.equal(nameToMidi('Fs2'), 42);
  assert.equal(nameToMidi('Cs5'), 73);
});

test('nearestSample: plays a recorded note as is', () => {
  assert.deepEqual(nearestSample([57, 60, 63], 60), { midi: 60, rate: 1 });
});

test('nearestSample: retunes the closest note (the lower one on a tie)', () => {
  const recorded = [57, 60, 63];
  assert.equal(nearestSample(recorded, 61).midi, 60);
  assert.equal(nearestSample(recorded, 62).midi, 63);
  assert.equal(nearestSample(recorded, 58.5).midi, 57);
  assert.ok(Math.abs(nearestSample(recorded, 62).rate - 2 ** (-1 / 12)) < 1e-12);
});

// The vibraphone's lowest bar is F3 (MIDI 53), so it stretches further down.
const MAX_RETUNE = { vibraphone: 11 };

for (const [name, set] of Object.entries(SAMPLE_SETS)) {
  test(`${name}: covers the melody range, MIDI 42–77, retuning at most ${MAX_RETUNE[name] ?? 2} semitones`, () => {
    const recorded = set.notes.map(nameToMidi);
    for (let midi = 42; midi <= 77; midi++) {
      const { midi: from } = nearestSample(recorded, midi);
      assert.ok(Math.abs(midi - from) <= (MAX_RETUNE[name] ?? 2), `MIDI ${midi} from ${from}`);
    }
  });
}

test('every sound that needs recordings names a set that exists', () => {
  for (const s of SOUNDS.filter(s => s.samples)) assert.ok(SAMPLE_SETS[s.samples], s.id);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_SETS, nearestSample } from '../src/samples.js';

const PIANO = [42, 45, 48, 51, 54, 57, 60, 63, 66, 69, 72, 75, 78];

test('nearestSample: plays a recorded note as is', () => {
  assert.deepEqual(nearestSample(PIANO, 60), { midi: 60, rate: 1 });
});

test('nearestSample: retunes the closest note, never more than 1.5 semitones', () => {
  for (let midi = 42; midi <= 77; midi++) {
    const { midi: from, rate } = nearestSample(PIANO, midi);
    assert.ok(Math.abs(midi - from) <= 1.5, `MIDI ${midi} from ${from}`);
    assert.ok(Math.abs(rate - 2 ** ((midi - from) / 12)) < 1e-12);
  }
  assert.equal(nearestSample(PIANO, 61).midi, 60);
  assert.equal(nearestSample(PIANO, 62).midi, 63);
});

test('the piano set covers the melody range, MIDI 42–77', () => {
  assert.equal(SAMPLE_SETS.piano.notes.length, PIANO.length);
});

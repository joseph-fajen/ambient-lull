import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  KEYS, SCALES, CENTER_MIDI, TEMPO_MIN, TEMPO_MAX, NOTE_LENGTH_MIN, NOTE_LENGTH_MAX,
  rootMidi, notePool, nextNote, noteLength, createRandom, createComposer, dronePitch, nextKeyInCircle,
  harmonyNote, HARMONY_INTERVALS, HARMONY_CHANCE_MAX, NOTE_LENGTHS,
} from '../src/music.js';

const settingsFor = (key, scale, tempo = 40) => ({ key, scale, tempo });

// Index of the pool note nearest to a pitch (ties go to the lower note).
function nearestIndex(pool, midi) {
  let best = 0;
  for (let i = 1; i < pool.length; i++) {
    if (Math.abs(pool[i] - midi) < Math.abs(pool[best] - midi)) best = i;
  }
  return best;
}

test('scales have the expected intervals', () => {
  const expected = {
    'major-pentatonic': [0, 2, 4, 7, 9],
    'minor-pentatonic': [0, 3, 5, 7, 10],
    'major': [0, 2, 4, 5, 7, 9, 11],
    'natural-minor': [0, 2, 3, 5, 7, 8, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
    'japanese-in': [0, 1, 5, 7, 8],
  };
  assert.deepEqual(Object.fromEntries(SCALES.map(s => [s.id, s.intervals])), expected);
});

test('every scale is well-formed data (so adding one is a single line)', () => {
  assert.equal(new Set(SCALES.map(s => s.id)).size, SCALES.length, 'ids are unique');
  for (const s of SCALES) {
    assert.equal(typeof s.name, 'string');
    assert.equal(s.intervals[0], 0, `${s.id} starts on the root`);
    for (let i = 1; i < s.intervals.length; i++) {
      assert.ok(s.intervals[i] > s.intervals[i - 1], `${s.id} intervals rise`);
    }
    assert.ok(s.intervals.at(-1) < 12, `${s.id} stays within one octave`);
  }
});

test('12 keys, one spelling each, covering every pitch class once', () => {
  assert.equal(KEYS.length, 12);
  assert.deepEqual(KEYS.map(k => k.semitone).sort((a, b) => a - b), [...Array(12).keys()]);
  assert.equal(new Set(KEYS.map(k => k.id)).size, 12);
  assert.equal(new Set(KEYS.map(k => k.name)).size, 12);
});

test('every key is centred near middle C (B is not almost an octave above C)', () => {
  for (const k of KEYS) {
    const root = rootMidi(k.id);
    assert.ok(Math.abs(root - CENTER_MIDI) <= 6, `${k.id} root ${root}`);
    for (const s of SCALES) {
      const pool = notePool(k.id, s.id);
      const middle = (pool[0] + pool.at(-1)) / 2;
      assert.ok(Math.abs(middle - CENTER_MIDI) <= 6, `${k.id} ${s.id} centred at ${middle}`);
    }
  }
  assert.ok(Math.abs(rootMidi('B') - rootMidi('C')) <= 1);
});

test('note pool for C major pentatonic', () => {
  assert.deepEqual(notePool('C', 'major-pentatonic'),
    [48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72]);
});

test('rules sweep: every key x scale x seed obeys range, scale, step and duration', () => {
  let checked = 0;
  for (const k of KEYS) {
    for (const s of SCALES) {
      const pool = notePool(k.id, s.id);
      const pitchClasses = new Set(s.intervals.map(i => (i + k.semitone) % 12));
      for (let seed = 1; seed <= 20; seed++) {
        const rng = createRandom(seed);
        const tempo = TEMPO_MIN + Math.floor(rng() * (TEMPO_MAX - TEMPO_MIN + 1));
        const settings = settingsFor(k.id, s.id, tempo);
        let prev = null;
        for (let n = 0; n < 100; n++) {
          const note = nextNote(prev, settings, rng);
          const label = `${k.id} ${s.id} seed ${seed} note ${n}: ${note.midi}`;
          assert.ok(note.midi >= pool[0] && note.midi <= pool.at(-1), `in range: ${label}`);
          assert.ok(pitchClasses.has(note.midi % 12), `in scale: ${label}`);
          if (prev !== null) {
            const step = Math.abs(pool.indexOf(note.midi) - pool.indexOf(prev));
            assert.ok(step === 1 || step === 2, `1-2 steps: ${label}, moved ${step}`);
          }
          assert.ok(note.duration >= NOTE_LENGTH_MIN && note.duration <= NOTE_LENGTH_MAX,
            `duration: ${label}, ${note.duration}`);
          prev = note.midi;
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 12 * SCALES.length * 20 * 100);
});

test('the first note is the root', () => {
  for (const k of KEYS) {
    assert.equal(nextNote(null, settingsFor(k.id, 'dorian'), createRandom(1)).midi, rootMidi(k.id));
  }
});

test('the same seed always gives the same notes', () => {
  const run = seed => {
    const rng = createRandom(seed);
    const notes = [];
    let prev = null;
    for (let i = 0; i < 50; i++) notes.push(prev = nextNote(prev, settingsFor('D', 'lydian'), rng).midi);
    return notes;
  };
  assert.deepEqual(run(42), run(42));
  assert.notDeepEqual(run(42), run(43));
});

test('changing key or scale mid-walk carries on from the nearest new note', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const rng = createRandom(seed);
    let prev = null;
    for (let i = 0; i < 20; i++) prev = nextNote(prev, settingsFor('F', 'major-pentatonic'), rng).midi;

    const next = nextNote(prev, settingsFor('F#', 'dorian'), rng).midi;
    const newPool = notePool('F#', 'dorian');
    assert.ok(newPool.includes(next), `in the new scale: ${next}`);
    const step = Math.abs(newPool.indexOf(next) - nearestIndex(newPool, prev));
    assert.ok(step >= 1 && step <= 2, `seed ${seed}: ${prev} -> ${next}`);
  }
});

test('tempo to note length: ~8 s at 20 BPM, 2-3 s at 120 BPM, smooth between', () => {
  assert.ok(Math.abs(noteLength(20) - 8) < 0.01);
  assert.ok(noteLength(120) >= 2 && noteLength(120) <= 3);
  for (let bpm = TEMPO_MIN + 1; bpm <= TEMPO_MAX; bpm++) {
    const drop = noteLength(bpm - 1) - noteLength(bpm);
    assert.ok(drop > 0 && drop < 0.2, `smooth at ${bpm} BPM (dropped ${drop})`);
  }
});

test('tempo out of range is clamped', () => {
  assert.equal(noteLength(5), noteLength(20));
  assert.equal(noteLength(500), noteLength(120));
});

test('composer: changing the live settings mid-run changes the next note', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const settings = { key: 'C', scale: 'major-pentatonic', tempo: 30 };
    const composer = createComposer(settings, createRandom(seed));
    let last;
    for (let i = 0; i < 10; i++) last = composer.next();
    assert.equal(last.duration, noteLength(30));

    settings.key = 'Eb';
    settings.scale = 'dorian';
    settings.tempo = 110;
    const next = composer.next();
    const pool = notePool('Eb', 'dorian');
    assert.ok(pool.includes(next.midi), `seed ${seed}: ${next.midi} is in E-flat Dorian`);
    assert.equal(next.duration, noteLength(110));
    const step = Math.abs(pool.indexOf(next.midi) - nearestIndex(pool, last.midi));
    assert.ok(step >= 1 && step <= 2, `seed ${seed}: carries on from ${last.midi}`);
  }
});

test('composer: each run starts on the root', () => {
  const composer = createComposer({ key: 'A', scale: 'lydian', tempo: 40 }, createRandom(1));
  assert.equal(composer.next().midi, rootMidi('A'));
});

test('drone: below the melody range in every key, in the same register', () => {
  const pitches = KEYS.map(k => dronePitch(k.id));
  for (const k of KEYS) {
    const lowestMelody = Math.min(...SCALES.map(s => notePool(k.id, s.id)[0]));
    assert.ok(dronePitch(k.id) <= lowestMelody - 12, `${k.id}: at least an octave below the melody`);
    assert.equal(((dronePitch(k.id) % 12) + 12) % 12, k.semitone, `${k.id}: drone is the root`);
  }
  assert.ok(Math.max(...pitches) - Math.min(...pitches) < 12, 'all keys within one octave');
  assert.ok(Math.min(...pitches) >= 28, 'not so low it vanishes (about 41 Hz or higher)');
});

test('circle of fifths: each step goes up a fifth, visiting all 12 keys', () => {
  assert.equal(nextKeyInCircle('C'), 'G');
  assert.equal(nextKeyInCircle('B'), 'F#');
  assert.equal(nextKeyInCircle('F#'), 'Db');
  assert.equal(nextKeyInCircle('F'), 'C');
  const seen = [];
  let key = 'C';
  for (let i = 0; i < 12; i++) { seen.push(key); key = nextKeyInCircle(key); }
  assert.equal(key, 'C', 'back to the start after 12 steps');
  assert.deepEqual(seen, ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F']);
});

test('harmony intervals are a 3rd, 4th or 5th (no seconds, no tritone)', () => {
  assert.deepEqual([...HARMONY_INTERVALS].sort((a, b) => a - b), [3, 4, 5, 7]);
});

test('harmony sweep: every key x scale x pool note has a harmony, in scale and in range', () => {
  for (const k of KEYS) {
    for (const s of SCALES) {
      const pool = notePool(k.id, s.id);
      const settings = settingsFor(k.id, s.id);
      for (const midi of pool) {
        for (let seed = 1; seed <= 5; seed++) {
          const h = harmonyNote(midi, settings, createRandom(seed));
          const label = `${k.id} ${s.id} melody ${midi}: harmony ${h}`;
          assert.ok(pool.includes(h), `in scale and range: ${label}`);
          assert.ok(HARMONY_INTERVALS.includes(Math.abs(h - midi)), `a 3rd, 4th or 5th: ${label}`);
        }
      }
    }
  }
});

test('harmony goes above the melody note, unless that would leave the range', () => {
  const pool = notePool('C', 'major');
  assert.ok(harmonyNote(60, settingsFor('C', 'major'), createRandom(1)) > 60);
  assert.ok(harmonyNote(pool.at(-1), settingsFor('C', 'major'), createRandom(1)) < pool.at(-1));
});

test('harmony picks among the 3rd, 4th and 5th, not always the same one', () => {
  const seen = new Set();
  for (let seed = 1; seed <= 50; seed++) seen.add(harmonyNote(60, settingsFor('C', 'major'), createRandom(seed)) - 60);
  assert.deepEqual([...seen].sort((a, b) => a - b), [4, 5, 7]); // C major from C: E, F, G
});

function harmonyShare(harmony, notes = 6000) {
  const composer = createComposer({ ...settingsFor('D', 'dorian'), harmony }, createRandom(7));
  let count = 0;
  for (let i = 0; i < notes; i++) if (composer.next().harmony !== null) count++;
  return count / notes;
}

test('harmony amount: 0 never, the default about 1 in 6, full about 1 in 2', () => {
  assert.equal(HARMONY_CHANCE_MAX, 0.5);
  assert.equal(harmonyShare(0), 0);
  const atDefault = harmonyShare(0.33);
  assert.ok(atDefault > 0.14 && atDefault < 0.19, `default: ${atDefault}`);
  const atFull = harmonyShare(1);
  assert.ok(atFull > 0.46 && atFull < 0.54, `full: ${atFull}`);
});

test('harmony: missing setting means none (old callers keep working)', () => {
  const composer = createComposer(settingsFor('C', 'major'), createRandom(1));
  for (let i = 0; i < 200; i++) assert.equal(composer.next().harmony, null);
});

test('composer: harmony notes follow the live key and scale, and the melody walk is unchanged', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const settings = { key: 'C', scale: 'major-pentatonic', tempo: 40, harmony: 1 };
    const composer = createComposer(settings, createRandom(seed));
    const plain = createComposer({ ...settings, harmony: 0 }, createRandom(seed));
    for (let i = 0; i < 30; i++) {
      if (i === 15) { settings.key = 'Ab'; settings.scale = 'japanese-in'; }
      const note = composer.next();
      const pool = notePool(settings.key, settings.scale);
      if (note.harmony !== null) assert.ok(pool.includes(note.harmony), `seed ${seed} note ${i}`);
      if (i < 15) assert.equal(note.midi, plain.next().midi, 'harmony draws its own random numbers');
    }
  }
});

const ringFor = beats => NOTE_LENGTHS.find(l => l.beats === beats).ring;

test('note lengths table: half a beat to 4 beats, quick notes ring shorter, held ones longer', () => {
  assert.deepEqual(NOTE_LENGTHS.map(l => l.beats), [0.5, 1, 2, 3, 4]);
  assert.equal(ringFor(1), 1, 'one beat rings as long as today');
  for (let i = 1; i < NOTE_LENGTHS.length; i++) {
    assert.ok(NOTE_LENGTHS[i].ring > NOTE_LENGTHS[i - 1].ring, 'longer notes ring longer');
  }
});

test('variety 0 (or missing) is the steady sound: every note 1 beat, today\'s ring length', () => {
  for (const variety of [0, undefined]) {
    const composer = createComposer({ ...settingsFor('C', 'major'), variety }, createRandom(3));
    for (let i = 0; i < 300; i++) {
      const note = composer.next();
      assert.equal(note.beats, 1);
      assert.equal(note.duration, noteLength(40));
    }
  }
});

test('variety sweep: allowed lengths, ring matches, quick notes in pairs so the beat comes back', () => {
  for (const variety of [0.2, 0.5, 1]) {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = createRandom(seed);
      const tempo = TEMPO_MIN + Math.floor(rng() * (TEMPO_MAX - TEMPO_MIN + 1));
      const composer = createComposer({ ...settingsFor('G', 'dorian', tempo), variety }, rng);
      let beatsSoFar = 0;
      let halves = 0; // length of the current run of half-beat notes
      for (let n = 0; n < 200; n++) {
        const note = composer.next();
        const label = `variety ${variety} seed ${seed} note ${n}`;
        assert.ok(NOTE_LENGTHS.some(l => l.beats === note.beats), `${label}: ${note.beats} beats`);
        assert.ok(Math.abs(note.duration - noteLength(tempo) * ringFor(note.beats)) < 1e-9, `${label}: ring`);
        if (note.beats !== 0.5) assert.equal(halves % 2, 0, `${label}: half-beat notes come in pairs`);
        halves = note.beats === 0.5 ? halves + 1 : 0;
        beatsSoFar += note.beats;
        if (halves % 2 === 0) assert.equal(beatsSoFar % 1, 0, `${label}: back on the beat`);
      }
    }
  }
});

function lengthShares(variety, notes = 6000) {
  const composer = createComposer({ ...settingsFor('C', 'major'), variety }, createRandom(11));
  const counts = {};
  for (let i = 0; i < notes; i++) {
    const b = composer.next().beats;
    counts[b] = (counts[b] ?? 0) + 1;
  }
  return Object.fromEntries(NOTE_LENGTHS.map(l => [l.beats, (counts[l.beats] ?? 0) / notes]));
}

test('variety amount: default mixes steady and varied notes; full has no plain 1-beat notes', () => {
  const atDefault = lengthShares(0.5);
  assert.ok(atDefault[1] > 0.3 && atDefault[1] < 0.6, `default: ${atDefault[1]} of notes are 1 beat`);
  for (const l of NOTE_LENGTHS) assert.ok(atDefault[l.beats] > 0.03, `default uses ${l.beats} beats`);
  const atFull = lengthShares(1);
  assert.equal(atFull[1], 0);
});

test('variety changes apply from the next note (after finishing a pair of quick notes)', () => {
  const settings = { ...settingsFor('C', 'major'), variety: 1 };
  const composer = createComposer(settings, createRandom(5));
  let last;
  for (let i = 0; i < 50; i++) last = composer.next();
  settings.variety = 0;
  const next = composer.next();
  if (last.beats === 0.5 && next.beats === 0.5) assert.equal(composer.next().beats, 1);
  else assert.equal(next.beats, 1);
  for (let i = 0; i < 20; i++) assert.equal(composer.next().beats, 1);
});

test('variety draws its own random numbers: the melody and harmony stay the same', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const base = { ...settingsFor('Eb', 'lydian'), harmony: 0.5 };
    const steady = createComposer({ ...base, variety: 0 }, createRandom(seed));
    const varied = createComposer({ ...base, variety: 1 }, createRandom(seed));
    for (let i = 0; i < 50; i++) {
      const a = steady.next(), b = varied.next();
      assert.equal(a.midi, b.midi);
      assert.equal(a.harmony, b.harmony);
    }
  }
});

test('harmony notes always ring long (as a 4-beat note), whatever the melody note\'s length', () => {
  const longest = Math.max(...NOTE_LENGTHS.map(l => l.ring));
  const settings = { ...settingsFor('A', 'natural-minor', 90), harmony: 1, variety: 1 };
  const composer = createComposer(settings, createRandom(4));
  const melodyLengths = new Set();
  for (let i = 0; i < 300; i++) {
    const note = composer.next();
    if (note.harmony === null) continue;
    melodyLengths.add(note.beats);
    assert.ok(Math.abs(note.harmonyDuration - noteLength(90) * longest) < 1e-9, `note ${i}`);
  }
  assert.ok(melodyLengths.has(0.5) && melodyLengths.has(4), 'covers quick and held melody notes');
});

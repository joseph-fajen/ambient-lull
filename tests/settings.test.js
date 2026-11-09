import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SOUNDS, TONE_MIN, TONE_MAX, KEY_CYCLE_MIN, KEY_CYCLE_MAX, SOUND_CYCLE_SECONDS, normalizeSettings, nextInSoundCycle } from '../src/settings.js';
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX } from '../src/music.js';
import { SOUND_RECIPES } from '../src/audio.js';

test('defaults are valid and point at real table entries', () => {
  assert.deepEqual(normalizeSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  assert.ok(KEYS.some(k => k.id === DEFAULT_SETTINGS.key));
  assert.equal(DEFAULT_SETTINGS.scale, 'major-pentatonic');
  assert.ok(SOUNDS.some(w => w.id === DEFAULT_SETTINGS.sound));
  assert.equal(DEFAULT_SETTINGS.drone, true);
});

test('sounds table: six sounds, Piano first, each with a name and detail', () => {
  assert.deepEqual(SOUNDS.map(w => w.id), ['piano', 'upright', 'harp', 'vibraphone', 'kalimba', 'pad']);
  assert.equal(DEFAULT_SETTINGS.sound, 'piano');
  for (const w of SOUNDS) assert.ok(w.name && w.detail && w.group, w.id);
  assert.equal(new Set(SOUNDS.map(w => w.id)).size, SOUNDS.length, 'ids are unique');
});

test('every sound has a recipe in the performer, and every recipe a sound', () => {
  assert.deepEqual(Object.keys(SOUND_RECIPES).sort(), SOUNDS.map(w => w.id).sort());
});

test('presets from before sounds (saved as `waveform`) load their sound', () => {
  assert.equal(normalizeSettings({ waveform: 'kalimba' }).sound, 'kalimba');
  assert.equal(normalizeSettings({ waveform: 'noise' }).sound, DEFAULT_SETTINGS.sound);
  assert.equal(normalizeSettings({ sound: 'pad', waveform: 'kalimba' }).sound, 'pad');
  assert.ok(!('waveform' in normalizeSettings({ waveform: 'sine' })), 'the old name is dropped');
});

test('presets with a removed sound load the closest one kept', () => {
  for (const id of ['sine', 'triangle', 'square', 'sawtooth', 'strings', 'choir', 'breath']) {
    assert.equal(normalizeSettings({ sound: id }).sound, 'pad', id);
  }
  assert.equal(normalizeSettings({ sound: 'glass' }).sound, 'vibraphone');
  assert.equal(normalizeSettings({ sound: 'tine' }).sound, 'vibraphone');
  assert.equal(normalizeSettings({ waveform: 'sine' }).sound, 'pad');
  assert.equal(normalizeSettings({ sound: 'harp' }).sound, 'harp', 'the old synthesized harp loads as the recorded one');
});

test('a complete valid object comes back unchanged', () => {
  const s = { key: 'F#', scale: 'dorian', sound: 'kalimba', tone: 0.25, tempo: 90, drone: false, droneVolume: 0.3, autoKey: true, keyCycleSeconds: 45, autoSound: true, harmony: 0.8, variety: 0.1, width: 0.2, drift: true };
  assert.deepEqual(normalizeSettings(s), s);
});

test('missing fields get defaults', () => {
  assert.deepEqual(normalizeSettings({ scale: 'dorian' }), { ...DEFAULT_SETTINGS, scale: 'dorian' });
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test('unknown values fall back to defaults', () => {
  const s = normalizeSettings({ key: 'H', scale: 'bebop', sound: 'noise', tone: 'bright', tempo: 'fast', drone: 'yes', droneVolume: 'loud', autoKey: 'sometimes', keyCycleSeconds: 'often', autoSound: 'often', harmony: 'lots', variety: 'some', width: 'wide', drift: 'yes' });
  assert.deepEqual(s, DEFAULT_SETTINGS);
});

test('numbers out of range are clamped; non-finite numbers fall back', () => {
  assert.equal(normalizeSettings({ tempo: 500 }).tempo, TEMPO_MAX);
  assert.equal(normalizeSettings({ tempo: 1 }).tempo, TEMPO_MIN);
  assert.equal(normalizeSettings({ tone: -3 }).tone, TONE_MIN);
  assert.equal(normalizeSettings({ tone: 9 }).tone, TONE_MAX);
  assert.equal(normalizeSettings({ tempo: NaN }).tempo, DEFAULT_SETTINGS.tempo);
  assert.equal(normalizeSettings({ tone: Infinity }).tone, DEFAULT_SETTINGS.tone);
});

test('garbage input does not crash', () => {
  for (const junk of [null, undefined, 42, 'dorian', true, [], [1, 2], () => {}]) {
    assert.deepEqual(normalizeSettings(junk), DEFAULT_SETTINGS, String(junk));
  }
});

test('returns a fresh object, drops extra fields, and does not touch the input', () => {
  const input = { scale: 'lydian', extra: 'x' };
  const out = normalizeSettings(input);
  assert.deepEqual(input, { scale: 'lydian', extra: 'x' });
  assert.ok(!('extra' in out));
  assert.notEqual(normalizeSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
});

test('drone is a true/false setting', () => {
  assert.equal(normalizeSettings({ drone: false }).drone, false);
  assert.equal(normalizeSettings({ drone: true }).drone, true);
  for (const junk of [0, 1, 'false', null]) assert.equal(normalizeSettings({ drone: junk }).drone, true);
});

test('drone volume runs 0 to 1, clamped, with a default in between', () => {
  assert.ok(DEFAULT_SETTINGS.droneVolume > 0 && DEFAULT_SETTINGS.droneVolume < 1);
  assert.equal(normalizeSettings({ droneVolume: 0 }).droneVolume, 0);
  assert.equal(normalizeSettings({ droneVolume: 2 }).droneVolume, 1);
  assert.equal(normalizeSettings({ droneVolume: -1 }).droneVolume, 0);
  assert.equal(normalizeSettings({ droneVolume: NaN }).droneVolume, DEFAULT_SETTINGS.droneVolume);
});

test('key cycling is a true/false setting, off by default', () => {
  assert.equal(DEFAULT_SETTINGS.autoKey, false);
  assert.equal(normalizeSettings({ autoKey: true }).autoKey, true);
  for (const junk of [1, 'true', null]) assert.equal(normalizeSettings({ autoKey: junk }).autoKey, false);
});

test('key cycle period: 10 s to 2 min, default 30 s, clamped', () => {
  assert.equal(DEFAULT_SETTINGS.keyCycleSeconds, 30);
  assert.equal(KEY_CYCLE_MIN, 10);
  assert.equal(KEY_CYCLE_MAX, 120);
  assert.equal(normalizeSettings({ keyCycleSeconds: 1 }).keyCycleSeconds, 10);
  assert.equal(normalizeSettings({ keyCycleSeconds: 999 }).keyCycleSeconds, 120);
  assert.equal(normalizeSettings({ keyCycleSeconds: NaN }).keyCycleSeconds, 30);
});

test('harmony runs 0 to 1, default 0.33, clamped', () => {
  assert.equal(DEFAULT_SETTINGS.harmony, 0.33);
  assert.equal(normalizeSettings({ harmony: 0 }).harmony, 0);
  assert.equal(normalizeSettings({ harmony: 5 }).harmony, 1);
  assert.equal(normalizeSettings({ harmony: -1 }).harmony, 0);
  assert.equal(normalizeSettings({ harmony: NaN }).harmony, 0.33);
});

test('an old preset without harmony loads with the default', () => {
  const old = { key: 'G', scale: 'dorian', waveform: 'sine', tone: 0.2, tempo: 30, drone: true, droneVolume: 0.5, autoKey: false, keyCycleSeconds: 30 };
  const { waveform, ...rest } = old; // sine was removed: the closest kept is Pad
  assert.deepEqual(normalizeSettings(old), { ...rest, sound: 'pad', autoSound: false, harmony: 0.33, variety: 0.5, width: 0.5, drift: false });
});

test('variety runs 0 to 1, default 0.5, clamped', () => {
  assert.equal(DEFAULT_SETTINGS.variety, 0.5);
  assert.equal(normalizeSettings({ variety: 0 }).variety, 0);
  assert.equal(normalizeSettings({ variety: 3 }).variety, 1);
  assert.equal(normalizeSettings({ variety: -1 }).variety, 0);
  assert.equal(normalizeSettings({ variety: NaN }).variety, 0.5);
});

test('width runs 0 (mono) to 1 (wide), default 0.5, clamped', () => {
  assert.equal(DEFAULT_SETTINGS.width, 0.5);
  assert.equal(normalizeSettings({ width: 0 }).width, 0);
  assert.equal(normalizeSettings({ width: 4 }).width, 1);
  assert.equal(normalizeSettings({ width: -1 }).width, 0);
  assert.equal(normalizeSettings({ width: 'wide' }).width, 0.5);
});

test('drift is a true/false setting, off by default', () => {
  assert.equal(DEFAULT_SETTINGS.drift, false);
  assert.equal(normalizeSettings({ drift: true }).drift, true);
  for (const junk of [1, 'true', null]) assert.equal(normalizeSettings({ drift: junk }).drift, false);
});

test('sound cycle: each step moves to the next sound, wrapping round', () => {
  let state = { sound: 'piano', scale: 'major', changes: 0 };
  const seen = [];
  for (let i = 0; i < SOUNDS.length; i++) {
    seen.push(state.sound);
    state = nextInSoundCycle(state);
  }
  assert.deepEqual(seen, SOUNDS.map(w => w.id));
  assert.equal(state.sound, 'piano', 'after Pad comes Piano again');
});

test('sound cycle: the scale moves on with every 6th sound change, on the same step', () => {
  let state = { sound: 'piano', scale: 'major-pentatonic', changes: 0 };
  for (let i = 1; i < SOUNDS.length; i++) {
    state = nextInSoundCycle(state);
    assert.equal(state.scale, 'major-pentatonic', `change ${i}`);
  }
  state = nextInSoundCycle(state);
  assert.deepEqual(state, { sound: 'piano', scale: 'minor-pentatonic', changes: 0 });
});

test('sound cycle: starts from any sound, and visits every scale before repeating', () => {
  let state = { sound: 'harp', scale: 'dorian', changes: 0 };
  const scales = [];
  for (let i = 0; i < SCALES.length * SOUNDS.length; i++) {
    if (state.changes === 0) scales.push(state.scale);
    assert.ok(SOUNDS.some(w => w.id === state.sound));
    state = nextInSoundCycle(state);
  }
  assert.deepEqual([...scales].sort(), SCALES.map(s => s.id).sort(), 'each scale once');
  assert.deepEqual(state, { sound: 'harp', scale: 'dorian', changes: 0 }, 'back where it started after 84 minutes');
});

test('sound cycle: after the last scale comes the first', () => {
  const last = SCALES.at(-1).id;
  const state = nextInSoundCycle({ sound: 'pad', scale: last, changes: SOUNDS.length - 1 });
  assert.equal(state.scale, SCALES[0].id);
});

test('sound cycle: 2 minutes per sound, off by default, saved as a boolean', () => {
  assert.equal(SOUND_CYCLE_SECONDS, 120);
  assert.equal(DEFAULT_SETTINGS.autoSound, false);
  assert.equal(normalizeSettings({ autoSound: true }).autoSound, true);
  assert.equal(normalizeSettings({ autoSound: 'yes' }).autoSound, false);
});

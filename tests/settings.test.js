import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, WAVEFORMS, TONE_MIN, TONE_MAX, KEY_CYCLE_MIN, KEY_CYCLE_MAX, normalizeSettings } from '../src/settings.js';
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX } from '../src/music.js';

test('defaults are valid and point at real table entries', () => {
  assert.deepEqual(normalizeSettings(DEFAULT_SETTINGS), DEFAULT_SETTINGS);
  assert.ok(KEYS.some(k => k.id === DEFAULT_SETTINGS.key));
  assert.equal(DEFAULT_SETTINGS.scale, 'major-pentatonic');
  assert.ok(WAVEFORMS.some(w => w.id === DEFAULT_SETTINGS.waveform));
  assert.equal(DEFAULT_SETTINGS.drone, true);
});

test('waveforms table: four built-in types, each with a mood name', () => {
  assert.deepEqual(WAVEFORMS.map(w => [w.mood, w.id]),
    [['Soft', 'sine'], ['Warm', 'triangle'], ['Hollow', 'square'], ['Bright', 'sawtooth']]);
});

test('a complete valid object comes back unchanged', () => {
  const s = { key: 'F#', scale: 'dorian', waveform: 'sawtooth', tone: 0.25, tempo: 90, drone: false, droneVolume: 0.3, autoKey: true, keyCycleSeconds: 45, harmony: 0.8, variety: 0.1 };
  assert.deepEqual(normalizeSettings(s), s);
});

test('missing fields get defaults', () => {
  assert.deepEqual(normalizeSettings({ scale: 'dorian' }), { ...DEFAULT_SETTINGS, scale: 'dorian' });
  assert.deepEqual(normalizeSettings({}), DEFAULT_SETTINGS);
});

test('unknown values fall back to defaults', () => {
  const s = normalizeSettings({ key: 'H', scale: 'bebop', waveform: 'noise', tone: 'bright', tempo: 'fast', drone: 'yes', droneVolume: 'loud', autoKey: 'sometimes', keyCycleSeconds: 'often', harmony: 'lots', variety: 'some' });
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
  assert.deepEqual(normalizeSettings(old), { ...old, harmony: 0.33, variety: 0.5 });
});

test('variety runs 0 to 1, default 0.5, clamped', () => {
  assert.equal(DEFAULT_SETTINGS.variety, 0.5);
  assert.equal(normalizeSettings({ variety: 0 }).variety, 0);
  assert.equal(normalizeSettings({ variety: 3 }).variety, 1);
  assert.equal(normalizeSettings({ variety: -1 }).variety, 0);
  assert.equal(normalizeSettings({ variety: NaN }).variety, 0.5);
});

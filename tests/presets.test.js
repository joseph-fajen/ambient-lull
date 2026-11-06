import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPresetStore, STORAGE_KEY, SLOT_COUNT, NAME_MAX } from '../src/presets.js';
import { DEFAULT_SETTINGS } from '../src/settings.js';

// A stand-in for localStorage.
function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    raw: () => data.get(STORAGE_KEY),
  };
}

// Storage that fails on every access (private mode, quota full, blocked site data).
const throwingStorage = {
  getItem() { throw new Error('denied'); },
  setItem() { throw new Error('denied'); },
};

const MINE = { key: 'F#', scale: 'dorian', waveform: 'sawtooth', tone: 0.3, tempo: 72, drone: false, droneVolume: 0.8, autoKey: true, keyCycleSeconds: 60, harmony: 0.7, variety: 0.25, width: 0.9, drift: true };

const withSlots = slots => fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: 1, slots }) });

test('starts with 4 empty slots', () => {
  const store = createPresetStore(fakeStorage());
  assert.equal(SLOT_COUNT, 4);
  assert.deepEqual(store.list(), [null, null, null, null]);
  assert.equal(store.load(0), null);
});

test('saving then loading gives back the same settings', () => {
  const store = createPresetStore(fakeStorage());
  store.save(1, 'Night', MINE);
  assert.deepEqual(store.load(1), MINE);
  assert.equal(store.list()[1].name, 'Night');
});

test('presets survive a reload (a new store on the same storage)', () => {
  const storage = fakeStorage();
  createPresetStore(storage).save(2, 'Rain', MINE);
  const reloaded = createPresetStore(storage);
  assert.deepEqual(reloaded.load(2), MINE);
  assert.equal(reloaded.list()[2].name, 'Rain');
});

test('values are stored by name, not list position', () => {
  const storage = fakeStorage();
  createPresetStore(storage).save(0, 'x', MINE);
  const saved = JSON.parse(storage.raw()).slots[0].settings;
  assert.equal(saved.key, 'F#');
  assert.equal(saved.scale, 'dorian');
  assert.equal(saved.waveform, 'sawtooth');
});

test('saving stores a copy, not a live reference', () => {
  const store = createPresetStore(fakeStorage());
  const settings = { ...MINE };
  store.save(0, 'x', settings);
  settings.scale = 'major';
  assert.equal(store.load(0).scale, 'dorian');
  store.load(0).scale = 'lydian';
  assert.equal(store.load(0).scale, 'dorian');
});

test('a missing field gets its default', () => {
  const { tone, ...noTone } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Old', settings: noTone }, null, null, null]));
  assert.deepEqual(store.load(0), { ...MINE, tone: DEFAULT_SETTINGS.tone });
});

test('an unknown value (like a removed scale) falls back to its default', () => {
  const store = createPresetStore(withSlots([{ name: 'Old', settings: { ...MINE, scale: 'bebop' } }]));
  assert.deepEqual(store.load(0), { ...MINE, scale: DEFAULT_SETTINGS.scale });
});

test('damaged data does not crash, and falls back sensibly', () => {
  for (const raw of ['not json', '42', 'null', '[]', '{"slots": "nope"}', '{"slots": [1, "x", true]}']) {
    const store = createPresetStore(fakeStorage({ [STORAGE_KEY]: raw }));
    assert.deepEqual(store.list(), [null, null, null, null], raw);
  }
  // A slot that exists but has garbage settings loads as defaults.
  const store = createPresetStore(withSlots([{ name: 'Odd', settings: 'garbage' }]));
  assert.deepEqual(store.load(0), DEFAULT_SETTINGS);
  // Extra slots beyond 4 are ignored.
  const many = createPresetStore(withSlots(Array(9).fill({ name: 'n', settings: MINE })));
  assert.equal(many.list().length, 4);
});

test('storage that throws does not break anything; presets just are not saved', () => {
  const store = createPresetStore(throwingStorage);
  assert.deepEqual(store.list(), [null, null, null, null]);
  assert.equal(store.persistent, false);
  assert.equal(store.save(0, 'x', MINE), false, 'reports that it was not saved');
  assert.deepEqual(store.load(0), MINE, 'still usable until the page closes');
});

test('no storage at all (null) also works', () => {
  const store = createPresetStore(null);
  assert.equal(store.persistent, false);
  assert.equal(store.save(3, 'x', MINE), false);
  assert.deepEqual(store.load(3), MINE);
});

test('an empty name gets a default; long names are trimmed', () => {
  const store = createPresetStore(fakeStorage());
  store.save(1, '', MINE);
  assert.equal(store.list()[1].name, 'Preset 2');
  store.save(2, '   ', MINE);
  assert.equal(store.list()[2].name, 'Preset 3');
  store.save(3, '  Slow Dorian evening, with drone off and long tails  ', MINE);
  assert.equal(store.list()[3].name.length, NAME_MAX);
  assert.ok(store.list()[3].name.startsWith('Slow Dorian'));
  assert.equal(store.list()[3].name, store.list()[3].name.trim());
});

test('overwriting needs confirmation only when the slot is already filled', () => {
  const store = createPresetStore(fakeStorage());
  assert.equal(store.needsConfirm(0), false);
  store.save(0, 'First', MINE);
  assert.equal(store.needsConfirm(0), true);
  assert.equal(store.needsConfirm(1), false);
});

test('opening the page never writes to storage (damaged data is left alone)', () => {
  const storage = fakeStorage({ [STORAGE_KEY]: 'not json' });
  createPresetStore(storage).list();
  assert.equal(storage.raw(), 'not json');
});

test('storage that can be read but not written reports presets as not saved', () => {
  const readOnly = { getItem: () => null, setItem() { throw new Error('quota'); } };
  const store = createPresetStore(readOnly);
  assert.equal(store.save(0, 'x', MINE), false);
  assert.equal(store.persistent, false);
  assert.deepEqual(store.load(0), MINE);
});

test('presets saved before drone volume existed load with the default volume', () => {
  const { droneVolume, ...older } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Before', settings: older }]));
  assert.equal(store.load(0).droneVolume, DEFAULT_SETTINGS.droneVolume);
});

test('presets saved before harmony existed load with the default harmony', () => {
  const { harmony, ...older } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Before', settings: older }]));
  assert.equal(store.load(0).harmony, DEFAULT_SETTINGS.harmony);
});

test('presets saved before variety existed load with the default variety', () => {
  const { variety, ...older } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Before', settings: older }]));
  assert.deepEqual(store.load(0), { ...older, variety: DEFAULT_SETTINGS.variety });
});

test('presets saved before width existed load with the default width', () => {
  const { width, ...older } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Before', settings: older }]));
  assert.deepEqual(store.load(0), { ...older, width: DEFAULT_SETTINGS.width });
});

test('presets saved before drift existed load with drift off', () => {
  const { drift, ...older } = MINE;
  const store = createPresetStore(withSlots([{ name: 'Before', settings: older }]));
  assert.deepEqual(store.load(0), { ...older, drift: false });
});

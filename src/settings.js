// The one settings object: defaults, and turning any input into valid settings.
// Pure: used by the controls, the engine, and presets.
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX } from './music.js';

// The sounds. `id` is saved in presets; `name` is the big label and `detail` the small
// one under it. `group` says how it plays: struck (a strike, then a natural fade) or
// sustained (a slow swell). `samples` names a set of recordings (src/samples.js) that
// the sound needs loaded. The performer (src/audio.js) has a recipe for each id.
export const SOUNDS = [
  { id: 'piano', name: 'Piano', detail: 'grand piano', group: 'struck', samples: 'piano' },
  { id: 'upright', name: 'Upright', detail: 'soft piano', group: 'struck', samples: 'upright' },
  { id: 'harp', name: 'Harp', detail: 'concert harp', group: 'struck', samples: 'harp' },
  { id: 'vibraphone', name: 'Vibes', detail: 'vibraphone', group: 'struck', samples: 'vibraphone' },
  { id: 'kalimba', name: 'Kalimba', detail: 'thumb piano', group: 'struck' },
  { id: 'pad', name: 'Pad', detail: 'synth pad', group: 'sustained' },
];

// Sounds that were removed (2026-11-09), and the closest one kept, so old presets still
// load with a similar sound. The four classic waveforms swelled in gently, like Pad.
// (`harp` was a synthesized harp; the id now means the recorded one.)
export const REPLACED_SOUNDS = {
  sine: 'pad', triangle: 'pad', square: 'pad', sawtooth: 'pad',
  glass: 'vibraphone', tine: 'vibraphone',
  strings: 'pad', choir: 'pad', breath: 'pad',
};

// Tone runs from 0 (darkest) to 1 (brightest); the performer maps it to a filter.
export const TONE_MIN = 0;
export const TONE_MAX = 1;

// Seconds between key changes when cycling round the circle of fifths.
export const KEY_CYCLE_MIN = 10; // the drone's crossfade takes 2 s, so not much shorter
export const KEY_CYCLE_MAX = 120;

// Cycle sounds & scales: the sound moves on every 2 minutes, and the scale with every
// full round of the sounds (12 minutes each; 84 minutes before it all repeats).
export const SOUND_CYCLE_SECONDS = 120;

const nextIn = (table, id) => table[(table.findIndex(e => e.id === id) + 1) % table.length].id;

// One step of the cycle: the next sound, and on every SOUNDS.length-th step the next
// scale too, on the same note. `changes` counts steps since the scale last moved, so a
// round starts from whatever sound is picked.
export function nextInSoundCycle({ sound, scale, changes }) {
  const done = changes + 1 >= SOUNDS.length;
  return {
    sound: nextIn(SOUNDS, sound),
    scale: done ? nextIn(SCALES, scale) : scale,
    changes: done ? 0 : changes + 1,
  };
}

export const DEFAULT_SETTINGS = Object.freeze({
  key: 'C',
  scale: 'major-pentatonic',
  sound: 'piano',
  tone: 0.5,
  tempo: 40,
  drone: true,
  droneVolume: 0.33, // 0 (silent) to 1 (about 10 dB louder than the melody)
  autoKey: false, // cycle the key round the circle of fifths
  keyCycleSeconds: 30,
  autoSound: false, // cycle sounds every 2 minutes, and scales after each round of sounds
  harmony: 0.33, // 0 (never) to 1 (every other note, on average); the default is about 1 in 6
  variety: 0.5, // note lengths: 0 (steady, one per beat) to 1 (every note varies)
  width: 0.5, // stereo: 0 (mono) to 1 (wide); the default is gently wide
  drift: false, // the harmony amount slowly rises and falls around the slider
});

const oneOf = (table, value, fallback) => (table.some(e => e.id === value) ? value : fallback);

const number = (value, lo, hi, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(hi, Math.max(lo, value)) : fallback;

// Always returns a complete, valid settings object, whatever it is given.
export function normalizeSettings(input) {
  const s = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const d = DEFAULT_SETTINGS;
  return {
    key: oneOf(KEYS, s.key, d.key),
    scale: oneOf(SCALES, s.scale, d.scale),
    // `waveform`: the name before sounds
    sound: oneOf(SOUNDS, REPLACED_SOUNDS[s.sound ?? s.waveform] ?? s.sound ?? s.waveform, d.sound),
    tone: number(s.tone, TONE_MIN, TONE_MAX, d.tone),
    tempo: number(s.tempo, TEMPO_MIN, TEMPO_MAX, d.tempo),
    drone: typeof s.drone === 'boolean' ? s.drone : d.drone,
    droneVolume: number(s.droneVolume, 0, 1, d.droneVolume),
    autoKey: typeof s.autoKey === 'boolean' ? s.autoKey : d.autoKey,
    keyCycleSeconds: number(s.keyCycleSeconds, KEY_CYCLE_MIN, KEY_CYCLE_MAX, d.keyCycleSeconds),
    autoSound: typeof s.autoSound === 'boolean' ? s.autoSound : d.autoSound,
    harmony: number(s.harmony, 0, 1, d.harmony),
    variety: number(s.variety, 0, 1, d.variety),
    width: number(s.width, 0, 1, d.width),
    drift: typeof s.drift === 'boolean' ? s.drift : d.drift,
  };
}

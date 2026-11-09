// The one settings object: defaults, and turning any input into valid settings.
// Pure: used by the controls, the engine, and presets.
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX } from './music.js';

// The sounds. `id` is saved in presets; `name` is the big label and `detail` the small
// one under it. `group` sorts them in the picker. The performer (src/audio.js) has a
// recipe for each id. The first four are the built-in Web Audio waveforms; their ids
// are the waveform names, so presets from before this table still load.
export const SOUNDS = [
  { id: 'sine', name: 'Soft', detail: 'sine', group: 'classic' },
  { id: 'triangle', name: 'Warm', detail: 'triangle', group: 'classic' },
  { id: 'square', name: 'Hollow', detail: 'square', group: 'classic' },
  { id: 'sawtooth', name: 'Bright', detail: 'sawtooth', group: 'classic' },
  { id: 'glass', name: 'Glass', detail: 'bell', group: 'struck' },
  { id: 'kalimba', name: 'Kalimba', detail: 'thumb piano', group: 'struck' },
  { id: 'harp', name: 'Harp', detail: 'plucked string', group: 'struck' },
  { id: 'tine', name: 'Tine', detail: 'electric piano', group: 'struck' },
  { id: 'piano', name: 'Piano', detail: 'grand piano', group: 'struck' },
  { id: 'pad', name: 'Pad', detail: 'synth pad', group: 'sustained' },
  { id: 'strings', name: 'Strings', detail: 'bowed', group: 'sustained' },
  { id: 'choir', name: 'Choir', detail: '"ooh" voices', group: 'sustained' },
  { id: 'breath', name: 'Breath', detail: 'flute', group: 'sustained' },
];

// Tone runs from 0 (darkest) to 1 (brightest); the performer maps it to a filter.
export const TONE_MIN = 0;
export const TONE_MAX = 1;

// Seconds between key changes when cycling round the circle of fifths.
export const KEY_CYCLE_MIN = 10; // the drone's crossfade takes 2 s, so not much shorter
export const KEY_CYCLE_MAX = 120;

export const DEFAULT_SETTINGS = Object.freeze({
  key: 'C',
  scale: 'major-pentatonic',
  sound: 'triangle',
  tone: 0.5,
  tempo: 40,
  drone: true,
  droneVolume: 0.33, // 0 (silent) to 1 (about 10 dB louder than the melody)
  autoKey: false, // cycle the key round the circle of fifths
  keyCycleSeconds: 30,
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
    sound: oneOf(SOUNDS, s.sound ?? s.waveform, d.sound), // `waveform`: the name before sounds
    tone: number(s.tone, TONE_MIN, TONE_MAX, d.tone),
    tempo: number(s.tempo, TEMPO_MIN, TEMPO_MAX, d.tempo),
    drone: typeof s.drone === 'boolean' ? s.drone : d.drone,
    droneVolume: number(s.droneVolume, 0, 1, d.droneVolume),
    autoKey: typeof s.autoKey === 'boolean' ? s.autoKey : d.autoKey,
    keyCycleSeconds: number(s.keyCycleSeconds, KEY_CYCLE_MIN, KEY_CYCLE_MAX, d.keyCycleSeconds),
    harmony: number(s.harmony, 0, 1, d.harmony),
    variety: number(s.variety, 0, 1, d.variety),
    width: number(s.width, 0, 1, d.width),
    drift: typeof s.drift === 'boolean' ? s.drift : d.drift,
  };
}

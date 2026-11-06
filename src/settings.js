// The one settings object: defaults, and turning any input into valid settings.
// Pure: used by the controls, the engine, and presets.
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX } from './music.js';

// The four built-in Web Audio waveforms. `id` is saved; `mood` is the big label.
export const WAVEFORMS = [
  { id: 'sine', mood: 'Soft' },
  { id: 'triangle', mood: 'Warm' },
  { id: 'square', mood: 'Hollow' },
  { id: 'sawtooth', mood: 'Bright' },
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
  waveform: 'triangle',
  tone: 0.5,
  tempo: 40,
  drone: true,
  droneVolume: 0.33, // 0 (silent) to 1 (about 10 dB louder than the melody)
  autoKey: false, // cycle the key round the circle of fifths
  keyCycleSeconds: 30,
  harmony: 0.33, // 0 (never) to 1 (every other note, on average); the default is about 1 in 6
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
    waveform: oneOf(WAVEFORMS, s.waveform, d.waveform),
    tone: number(s.tone, TONE_MIN, TONE_MAX, d.tone),
    tempo: number(s.tempo, TEMPO_MIN, TEMPO_MAX, d.tempo),
    drone: typeof s.drone === 'boolean' ? s.drone : d.drone,
    droneVolume: number(s.droneVolume, 0, 1, d.droneVolume),
    autoKey: typeof s.autoKey === 'boolean' ? s.autoKey : d.autoKey,
    keyCycleSeconds: number(s.keyCycleSeconds, KEY_CYCLE_MIN, KEY_CYCLE_MAX, d.keyCycleSeconds),
    harmony: number(s.harmony, 0, 1, d.harmony),
  };
}

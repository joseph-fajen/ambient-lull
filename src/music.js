// Composer core: keys, scales, the note-picking walk, and tempo -> note length.
// Pure functions only: no Web Audio, no DOM, no Math.random (randomness is passed in).

// One spelling per pitch. `id` is what gets saved; `name` is what the UI shows.
export const KEYS = [
  { id: 'C', name: 'C', semitone: 0 },
  { id: 'Db', name: 'D♭', semitone: 1 },
  { id: 'D', name: 'D', semitone: 2 },
  { id: 'Eb', name: 'E♭', semitone: 3 },
  { id: 'E', name: 'E', semitone: 4 },
  { id: 'F', name: 'F', semitone: 5 },
  { id: 'F#', name: 'F♯', semitone: 6 },
  { id: 'G', name: 'G', semitone: 7 },
  { id: 'Ab', name: 'A♭', semitone: 8 },
  { id: 'A', name: 'A', semitone: 9 },
  { id: 'Bb', name: 'B♭', semitone: 10 },
  { id: 'B', name: 'B', semitone: 11 },
];

// Semitones above the root. Adding a scale is one line.
export const SCALES = [
  { id: 'major-pentatonic', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'major', name: 'Major', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'natural-minor', name: 'Natural minor', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'japanese-in', name: 'Japanese In', intervals: [0, 1, 5, 7, 8] },
];

export const CENTER_MIDI = 60; // middle C
export const RANGE_OCTAVES = 2; // total span, centred on the root

export const TEMPO_MIN = 20;
export const TEMPO_MAX = 120;
export const NOTE_LENGTH_MAX = 8; // seconds, at TEMPO_MIN
export const NOTE_LENGTH_MIN = 2.5; // seconds, at TEMPO_MAX

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const findKey = id => KEYS.find(k => k.id === id);
const findScale = id => SCALES.find(s => s.id === id);

// The root in the octave nearest middle C, so every key sits in the same register.
export function rootMidi(keyId) {
  const s = findKey(keyId).semitone;
  return s <= 6 ? CENTER_MIDI + s : CENTER_MIDI + s - 12;
}

// The next key round the circle of fifths: up a fifth (7 semitones), C G D A ... F C.
export function nextKeyInCircle(keyId) {
  const semitone = (findKey(keyId).semitone + 7) % 12;
  return KEYS.find(k => k.semitone === semitone).id;
}

// The drone sits two octaves below the root: under the whole melody range.
export const dronePitch = keyId => rootMidi(keyId) - 24;

// Every playable MIDI note for a key and scale, low to high.
export function notePool(keyId, scaleId) {
  const root = rootMidi(keyId);
  const half = (RANGE_OCTAVES * 12) / 2;
  const intervals = new Set(findScale(scaleId).intervals);
  const pool = [];
  for (let midi = root - half; midi <= root + half; midi++) {
    if (intervals.has((((midi - root) % 12) + 12) % 12)) pool.push(midi);
  }
  return pool;
}

function nearestIndex(pool, midi) {
  let best = 0;
  for (let i = 1; i < pool.length; i++) {
    if (Math.abs(pool[i] - midi) < Math.abs(pool[best] - midi)) best = i;
  }
  return best;
}

// Random walk: start on the root, then move 1 or 2 scale steps (1 step twice as
// likely, for a smoother line). The last pitch is snapped to the current scale
// first, so key and scale changes carry on from where the melody was.
export function nextNote(prevMidi, settings, rng) {
  const pool = notePool(settings.key, settings.scale);
  const duration = noteLength(settings.tempo);
  if (prevMidi === null || prevMidi === undefined) {
    return { midi: rootMidi(settings.key), duration };
  }
  const from = nearestIndex(pool, prevMidi);
  const size = rng() < 2 / 3 ? 1 : 2;
  const dir = rng() < 0.5 ? -1 : 1;
  let to = from + dir * size;
  if (to < 0 || to >= pool.length) to = from - dir * size; // bounce off the edges
  return { midi: pool[to], duration };
}

// Harmony: a second note from the scale, a minor or major 3rd, a 4th or a 5th
// (semitones) away from the melody note. Above it when there's room in the melody
// range, otherwise the same distance below, so it never leaves the range.
export const HARMONY_INTERVALS = [3, 4, 5, 7];
export const HARMONY_CHANCE_MAX = 0.5; // at harmony = 1, every other note on average

// Slow drift: when on, the harmony amount rises and falls on its own, in a slow wave
// from 1/4 to 1.75 times the slider (capped at 1), starting at the slider and rising
// first. Proportional to the slider, so Never stays Never. `seconds` is the time since
// Start; the slider itself never changes.
export const DRIFT_PERIOD = 180; // seconds for one rise and fall
export const DRIFT_DEPTH = 0.75;

export function harmonyAmount(settings, seconds) {
  const h = settings.harmony ?? 0;
  if (!settings.drift) return h;
  return Math.min(1, h * (1 + DRIFT_DEPTH * Math.sin((2 * Math.PI * seconds) / DRIFT_PERIOD)));
}

export function harmonyNote(midi, settings, rng) {
  const pool = notePool(settings.key, settings.scale);
  const above = pool.filter(m => HARMONY_INTERVALS.includes(m - midi));
  const below = pool.filter(m => HARMONY_INTERVALS.includes(midi - m));
  const choices = above.length ? above : below;
  return choices.length ? choices[Math.floor(rng() * choices.length)] : null;
}

// Note lengths, in beats: the gap until the next note. `ring` scales how long the note
// sounds (1 = noteLength at this tempo), so quick notes are shorter and held ones
// longer. `weight` is how likely each is when a note varies from 1 beat. Half-beat
// notes always come in pairs, so the melody lands back on the beat.
export const NOTE_LENGTHS = [
  { beats: 0.5, ring: 0.6, weight: 0.3 },
  { beats: 1, ring: 1, weight: 0 },
  { beats: 2, ring: 1.3, weight: 0.35 },
  { beats: 3, ring: 1.5, weight: 0.15 },
  { beats: 4, ring: 1.7, weight: 0.2 },
];

// Harmony notes always ring as long as the longest melody note, so they sustain
// under the melody's rhythm instead of following it.
const HARMONY_RING = Math.max(...NOTE_LENGTHS.map(l => l.ring));

// A note's length in beats. Variety 0 is always 1 beat; at 1, every note varies.
function pickBeats(variety, rng) {
  if (!(rng() < variety)) return 1;
  let r = rng() * NOTE_LENGTHS.reduce((sum, l) => sum + l.weight, 0);
  for (const l of NOTE_LENGTHS) {
    if ((r -= l.weight) < 0) return l.beats;
  }
  return NOTE_LENGTHS.at(-1).beats;
}

// The composer for one run: remembers the last note and reads the live settings
// object for every new note, so changes apply from the next note on.
// Harmony, note lengths and stereo places each draw from their own random sequence,
// so those settings never change the melody line itself.
// `next(seconds)` takes the note's time since Start, for drift (missing means 0).
// Each note also gets a place left to right, `pan` from -1 to 1; its harmony note goes
// on the opposite side. The performer scales these by the Width setting.
export function createComposer(settings, rng) {
  let prev = null;
  let halfPending = false; // the second note of a pair of half-beat notes is due
  const harmonyRng = createRandom(Math.floor(rng() * 2 ** 32));
  const lengthSeed = Math.floor(rng() * 2 ** 32);
  const lengthRng = createRandom(lengthSeed);
  // Seeded from the length seed rather than another draw, so a given seed still plays
  // the same melody as before stereo existed.
  const panRng = createRandom(lengthSeed ^ 0x9e3779b9);
  return {
    next(seconds = 0) {
      const note = nextNote(prev, settings, rng);
      prev = note.midi;
      const chance = harmonyAmount(settings, seconds) * HARMONY_CHANCE_MAX;
      const harmony = harmonyRng() < chance ? harmonyNote(note.midi, settings, harmonyRng) : null;
      const beats = halfPending ? 0.5 : pickBeats(settings.variety ?? 0, lengthRng);
      halfPending = beats === 0.5 && !halfPending;
      const ring = NOTE_LENGTHS.find(l => l.beats === beats).ring;
      const pan = panRng() * 2 - 1;
      return {
        ...note, duration: note.duration * ring, beats, pan,
        harmony, harmonyDuration: note.duration * HARMONY_RING, harmonyPan: -pan,
      };
    },
  };
}

// Seconds per beat.
export function beatInterval(bpm) {
  return 60 / clamp(bpm, TEMPO_MIN, TEMPO_MAX);
}

// Note length shrinks smoothly from 8 s at 20 BPM to 2.5 s at 120 BPM. The curve is
// exponential, which keeps the number of overlapping notes at about 5 or fewer.
export function noteLength(bpm) {
  const t = (clamp(bpm, TEMPO_MIN, TEMPO_MAX) - TEMPO_MIN) / (TEMPO_MAX - TEMPO_MIN);
  return NOTE_LENGTH_MAX * (NOTE_LENGTH_MIN / NOTE_LENGTH_MAX) ** t;
}

// Seeded random numbers in [0, 1) (mulberry32). Tests use it for repeatable runs.
export function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

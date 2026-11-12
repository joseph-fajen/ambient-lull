// SPIKE (throwaway, branch forest-spike): the forest's pure side. It decides what plays
// and when: the conductor (key and sound cycles), the tides, the layers and the voices.
// No audio here; src/forest/play.js plays what this returns.
// See docs/forest-of-sound.architecture.md.
import { SCALES, rootMidi, nextKeyInCircle, createComposer, createRandom, beatInterval, dronePitch } from '../music.js';
import { nextInSoundCycle } from '../settings.js';

// The layers, near to far (architecture section 3). `space` names the reverb a layer
// sends to: High shares Far's hall. Widths come in two sets, for clips B and C.
export const LAYERS = {
  near: { space: 'room', dry: 0.8, wet: 0.3, cutoff: null, floorDb: -4 },
  middle: { space: 'medium', dry: 0.55, wet: 0.5, cutoff: 1500, floorDb: -10 },
  far: { space: 'hall', dry: 0.25, wet: 0.85, cutoff: 800, floorDb: -10 },
  high: { space: 'hall', dry: 0.3, wet: 0.8, cutoff: 6000, floorDb: -12 },
};
export const SPACES = { room: 1.2, medium: 3, hall: 7 }; // reverb seconds
export const WIDTH_SETS = {
  depth: { near: 0.4, middle: 0.6, far: 0.9, high: 1 }, // the table: narrow up front, wide behind
  wide: { near: 0.75, middle: 0.85, far: 1, high: 1 }, // the other set: wide all over
};

// Registers (MIDI), beyond today's 43-78 melody.
export const REGISTERS = { middle: [48, 72], far: [31, 55], high: [72, 91] };

// Tides: smooth rises and falls with periods that don't line up. Each moves between
// its floor (in dB) and 0 dB, so a tide only ever makes things quieter or darker.
export const LOUDNESS_PERIOD = 73;
export const BRIGHTNESS_PERIOD = 131;
export const BRIGHTNESS_FLOOR = 0.45; // the darkest cutoff, as a share of the layer's own

const rise = (t, period, phase) => 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / period + phase)); // 0..1

export function createTides(rng, still = false) {
  const phases = Object.fromEntries(Object.keys(LAYERS).map(k => [k, [rng(), rng()]]));
  return {
    // Gain for a layer at time t: 1 at the top of the tide, its floor at the bottom.
    level(layer, t) {
      if (still) return 1;
      return 10 ** ((LAYERS[layer].floorDb * (1 - rise(t, LOUDNESS_PERIOD, phases[layer][0]))) / 20);
    },
    // Share of the layer's cutoff, from BRIGHTNESS_FLOOR up to 1.
    brightness(layer, t) {
      if (still) return 1;
      return BRIGHTNESS_FLOOR + (1 - BRIGHTNESS_FLOOR) * rise(t, BRIGHTNESS_PERIOD, phases[layer][1]);
    },
  };
}

// Conductor: every key and sound change in a run, using today's cycles.
export function conductorChanges(start, seconds, { keyEvery, soundEvery }) {
  const times = new Set();
  for (let t = keyEvery; t < seconds; t += keyEvery) times.add(+t.toFixed(3));
  for (let t = soundEvery; t < seconds; t += soundEvery) times.add(+t.toFixed(3));
  const state = { key: start.key, scale: start.scale, sound: start.sound };
  let changes = 0;
  const out = [];
  for (const at of [...times].sort((a, b) => a - b)) {
    if (Math.abs(at / keyEvery - Math.round(at / keyEvery)) < 1e-6) state.key = nextKeyInCircle(state.key);
    if (Math.abs(at / soundEvery - Math.round(at / soundEvery)) < 1e-6) {
      const next = nextInSoundCycle({ ...state, changes });
      state.sound = next.sound;
      state.scale = next.scale;
      changes = next.changes;
    }
    out.push({ at, ...state });
  }
  return out;
}

export function stateAt(start, changes, t) {
  let s = { key: start.key, scale: start.scale, sound: start.sound };
  for (const c of changes) if (c.at <= t) s = c;
  return s;
}

// Every note of a key and scale within a register.
export function poolIn(key, scale, [lo, hi]) {
  const root = rootMidi(key) % 12;
  const intervals = SCALES.find(s => s.id === scale).intervals;
  const pool = [];
  for (let m = lo; m <= hi; m++) if (intervals.includes((((m - root) % 12) + 12) % 12)) pool.push(m);
  return pool;
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const between = (lo, hi, rng) => lo + (hi - lo) * rng();

// The hinted melody: each melody note as 3 copies tuned very slightly apart, a few
// milliseconds apart and spread a little left to right.
export const HINT_COPIES = [
  { cents: -7, delay: 0, spread: -0.35 },
  { cents: 0, delay: 0.023, spread: 0 },
  { cents: 6, delay: 0.041, spread: 0.35 },
];

// Voices other than the melody may hold at most this many sounds at once (a swarm
// counts each copy). Today's melody, tripled, comes on top.
export const VOICE_CAP = 16;

// The whole run's events, sorted by time. Offline, so planned in one go; a live engine
// would plan the same way a window at a time.
export function planForest(start, seconds, seed, { keyEvery = 30, soundEvery = 48, melody = 'hinted' } = {}) {
  const rng = createRandom(seed);
  const changes = conductorChanges(start, seconds, { keyEvery, soundEvery });
  const at = t => stateAt(start, changes, t);
  const events = [];

  // Melody: today's composer, reading the settings as the conductor changes them.
  const live = { ...start };
  const composer = createComposer(live, createRandom(seed));
  for (let t = 0.05; t < seconds;) {
    Object.assign(live, at(t));
    const note = composer.next(t);
    events.push({ kind: 'melody', time: t, note, sound: live.sound, copies: melody === 'hinted' ? HINT_COPIES : [{ cents: 0, delay: 0, spread: 0 }] });
    t += note.beats * beatInterval(live.tempo);
  }

  // Drone: on the root, two octaves down, crossfading at each key change.
  events.push({ kind: 'drone', time: 0.05, midi: dronePitch(start.key) });
  let droneKey = start.key;
  for (const c of changes) if (c.key !== droneKey) { events.push({ kind: 'drone', time: c.at, midi: dronePitch(c.key) }); droneKey = c.key; }

  // Forest voices, each kind from its own random stream, held under the cap.
  const busy = [];
  const room = (time, duration, count) => {
    const load = busy.filter(b => b.time < time + duration && b.end > time).reduce((n, b) => n + b.count, 0);
    if (load + count > VOICE_CAP) return false;
    busy.push({ time, end: time + duration, count });
    return true;
  };

  const sRng = createRandom(seed ^ 0x51);
  for (let t = 2; t < seconds - 8; t += between(5, 10, sRng)) {
    const layer = sRng() < 0.75 ? 'middle' : 'far';
    const { key, scale } = at(t);
    const pool = poolIn(key, scale, REGISTERS[layer]);
    const duration = between(14, 24, sRng);
    const from = pick(pool, sRng);
    const i = pool.indexOf(from);
    const glide = sRng() < 0.5 ? pool[Math.min(pool.length - 1, Math.max(0, i + (sRng() < 0.5 ? -1 : 1)))] : null;
    if (!room(t, duration, 1)) continue;
    events.push({ kind: 'sustain', layer, time: t, duration, midi: from, glideTo: glide, glideAt: duration * between(0.35, 0.6, sRng), pan: between(-1, 1, sRng) });
  }

  const wRng = createRandom(seed ^ 0xa7);
  for (let t = 6; t < seconds - 8; t += between(14, 26, wRng)) {
    const duration = between(9, 15, wRng);
    if (!room(t, duration, 1)) continue;
    events.push({ kind: 'wave', layer: 'far', time: t, duration, cutoff: between(350, 900, wRng), peak: between(0.7, 1, wRng) });
  }

  const swRng = createRandom(seed ^ 0x3c);
  for (let t = 20; t < seconds - 10; t += between(25, 45, swRng)) {
    const { key, scale } = at(t);
    const pool = poolIn(key, scale, REGISTERS.high);
    const a = pick(pool, swRng);
    const partners = pool.filter(m => [3, 4, 5, 7].includes(Math.abs(m - a)));
    const b = partners.length ? pick(partners, swRng) : a;
    const duration = between(12, 20, swRng);
    const n = 10;
    if (!room(t, duration + 2, n)) continue;
    const copies = Array.from({ length: n }, (_, k) => ({
      midi: k % 2 ? b : a, cents: between(-10, 10, swRng), delay: between(0, 2, swRng),
      pan: between(-1, 1, swRng), flutter: between(4, 8, swRng),
    }));
    events.push({ kind: 'swarm', layer: 'high', time: t, duration, copies });
  }

  return { changes, events: events.sort((x, y) => x.time - y.time) };
}


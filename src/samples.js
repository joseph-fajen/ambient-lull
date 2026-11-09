// Recorded instruments: a few real notes per instrument, each retuned slightly to play
// the notes in between. A set loads in the background the first time its sound is
// picked; until then, the sound plays as a stand-in (see SOUND_RECIPES in src/audio.js).
// Sources and licences: samples/CREDITS.md.

// Note names in the file names, by their real pitch: "Ds4" is D sharp 4 (MIDI 63), and
// A4 is 440 Hz.
const NAMES = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
export const nameToMidi = name => {
  const [, letter, octave] = name.match(/^([A-G]s?)(\d)$/);
  return 12 * (Number(octave) + 1) + NAMES[letter];
};

// Each set covers the melody's range, MIDI 42–77.
export const SAMPLE_SETS = {
  // Salamander Grand Piano: every 3 semitones.
  piano: { folder: 'samples/piano/', notes: ['Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5'] },
  // VCSL concert harp, played mezzo-forte: about every 3 semitones.
  harp: { folder: 'samples/harp/', notes: ['F2', 'A2', 'C3', 'E3', 'G3', 'B3', 'D4', 'F4', 'A4', 'C5', 'E5', 'G5'] },
  // VCSL vibraphone, soft mallets. Its lowest bar is F3 (MIDI 53), so lower notes are
  // that bar retuned down.
  vibraphone: { folder: 'samples/vibraphone/', notes: ['F3', 'A3', 'C4', 'E4', 'G4', 'B4', 'D5', 'F5', 'A5'] },
  // VCSL upright piano (a Knight), played softly: every 4 semitones.
  upright: { folder: 'samples/upright/', notes: ['F2', 'A2', 'Cs3', 'F3', 'A3', 'Cs4', 'F4', 'A4', 'Cs5', 'F5'] },
};

// Pure: the recorded note closest to `midi` (the lower one on a tie), and how far to
// retune it, as a playback rate (2 = an octave up).
export function nearestSample(recorded, midi) {
  let best = recorded[0];
  for (const r of recorded) if (Math.abs(r - midi) < Math.abs(best - midi)) best = r;
  return { midi: best, rate: 2 ** ((midi - best) / 12) };
}

// Loaded sets: name -> Map(midi -> AudioBuffer).
const loaded = new Map();

// Evening out the notes: each note is scaled by its loudness over its first LEVEL_SECONDS
// as it will play (a note retuned down plays slower, so it covers less of its recording),
// shaped like the note itself: the soft strike's rise over `attack` seconds (x²), then
// the fade-out, (1 - x)². Recordings decay at different speeds: unshaped, the
// vibraphone's quickly fading lowest bar came out 4 dB louder than the rest. And a
// sharp pluck loses more to the soft strike: the harp's A4 came out 3 dB quieter (measured).
const LEVEL_SECONDS = 3;
const LEVEL_TARGET = 0.1;
const levels = new Map(); // "set midi" -> level
// Mixed to mono: the app places each note left to right itself (Width), and the
// measurements assume a mono note.
function toMono(buffer) {
  const n = buffer.length;
  const mono = new Float32Array(n);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < n; i++) mono[i] += data[i] / buffer.numberOfChannels;
  }
  const out = new AudioBuffer({ length: n, sampleRate: buffer.sampleRate, numberOfChannels: 1 });
  out.copyToChannel(mono, 0);
  return out;
}

// `seconds` and `attack` are in the recording's time (already scaled by the rate).
function earlyLevel(buffer, seconds, attack) {
  const data = buffer.getChannelData(0);
  const n = Math.ceil(seconds * buffer.sampleRate);
  const rise = Math.max(1, Math.ceil(attack * buffer.sampleRate));
  let sum = 0, weights = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.min(1, (i / rise) ** 2) * (1 - i / n) ** 2;
    const v = i < data.length ? data[i] : 0;
    sum += (v * w) ** 2;
    weights += w * w;
  }
  return LEVEL_TARGET / Math.sqrt(sum / weights);
}

const pending = new Map();

// Loads a set (once). `base` is where the repo's root is, relative to the page.
export function loadSampleSet(name, base = './') {
  if (!pending.has(name)) {
    const set = SAMPLE_SETS[name];
    const decoder = new OfflineAudioContext(1, 1, 44100); // only used to decode
    pending.set(name, Promise.all(set.notes.map(async note => {
      const response = await fetch(`${base}${set.folder}${note}.mp3`);
      if (!response.ok) throw new Error(`Couldn't load ${set.folder}${note}.mp3`);
      const buffer = toMono(await decoder.decodeAudioData(await response.arrayBuffer()));
      return [nameToMidi(note), buffer];
    })).then(entries => { loaded.set(name, new Map(entries)); }));
  }
  return pending.get(name);
}

// The recording to play for `midi`, with its rate and level, or null if not loaded yet.
// `attack` is the note's strike time, in seconds.
export function sampleFor(name, midi, attack) {
  const set = loaded.get(name);
  if (!set) return null;
  const { midi: from, rate } = nearestSample([...set.keys()], midi);
  const buffer = set.get(from);
  const key = `${name} ${midi} ${attack}`;
  if (!levels.has(key)) levels.set(key, earlyLevel(buffer, LEVEL_SECONDS * rate, attack * rate));
  return { buffer, rate, level: levels.get(key) };
}

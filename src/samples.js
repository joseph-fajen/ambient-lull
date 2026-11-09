// Recorded instruments: a few real notes per instrument, each retuned slightly to play
// the notes in between. Loaded once, in the background, when the page opens; until a
// set has loaded, its sound plays as a stand-in (see SOUND_RECIPES in src/audio.js).
//
// Piano: Salamander Grand Piano v3 by Alexander Holm, CC-BY 3.0 (see samples/CREDITS.md).
// Recorded every 3 semitones; these 13 cover the melody's range, MIDI 42–77.

// Note names in the file names: "Ds4" is D sharp 4 (MIDI 63).
const NAMES = { C: 0, Ds: 3, Fs: 6, A: 9 };
const nameToMidi = name => {
  const [, letter, octave] = name.match(/^([A-Z]s?)(\d)$/);
  return 12 * (Number(octave) + 1) + NAMES[letter];
};

export const SAMPLE_SETS = {
  piano: {
    folder: 'samples/piano/',
    notes: ['Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5'],
  },
};

// Pure: the recorded note closest to `midi` (the lower one on a tie), and how far to
// retune it, as a playback rate (2 = an octave up).
export function nearestSample(recorded, midi) {
  let best = recorded[0];
  for (const r of recorded) if (Math.abs(r - midi) < Math.abs(best - midi)) best = r;
  return { midi: best, rate: 2 ** ((midi - best) / 12) };
}

// Loaded sets: name -> Map(midi -> { buffer, level }). `level` evens out the recordings:
// each one is scaled by its loudness over its first 1.5 s, so every note sounds about
// as loud (as for Harp).
const loaded = new Map();
const LEVEL_SECONDS = 1.5;
const LEVEL_TARGET = 0.1;

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

function earlyLevel(buffer) {
  const data = buffer.getChannelData(0);
  const n = Math.min(data.length, Math.ceil(LEVEL_SECONDS * buffer.sampleRate));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += data[i] * data[i];
  return LEVEL_TARGET / Math.sqrt(sum / n);
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
      return [nameToMidi(note), { buffer, level: earlyLevel(buffer) }];
    })).then(entries => { loaded.set(name, new Map(entries)); }));
  }
  return pending.get(name);
}

// The recording to play for `midi`, with its rate and level, or null if not loaded yet.
export function sampleFor(name, midi) {
  const set = loaded.get(name);
  if (!set) return null;
  const { midi: from, rate } = nearestSample([...set.keys()], midi);
  return { ...set.get(from), rate };
}

// Performer: turns notes into sound with Web Audio. Knows nothing about melody.
//
// Signal path:  note (sound recipe -> panner)  ->  bus.input
//               bus.input -> dry ----------------\
//               bus.input -> reverb -> wet -------+-> bus.master -> speakers
//               drone -> bus.dryInput -> dry ----/  (skips the reverb)
// Each run of the engine gets its own bus, so fading its master also fades the
// reverb tail.
import { createRandom } from './music.js';

export const ATTACK = 0.4; // seconds of fade-in
export const VOICE_PEAK = 0.2; // loudest point of one note, leaving headroom for overlaps
export const TONE_CUTOFF_MIN = 600; // Hz, tone = 0
export const TONE_CUTOFF_MAX = 3200; // Hz, tone = 1 (kept low so sawtooth never gets harsh)
export const REVERB_SECONDS = 4;
export const DRY_LEVEL = 0.7;
// Overall output level. Leaves headroom for the drone and harmony at full volume over the
// busiest melody, at full width (measured over many seeds: worst about 0.84).
export const MASTER_LEVEL = 0.57;
export const WET_LEVEL = 0.5;
export const STOP_FADE = 1.5; // seconds for Stop to fade to silence

export const midiToFrequency = midi => 440 * 2 ** ((midi - 69) / 12);

// Tone 0..1 -> cutoff, on an exponential scale so the slider feels even.
export const toneToCutoff = tone => TONE_CUTOFF_MIN * (TONE_CUTOFF_MAX / TONE_CUTOFF_MIN) ** tone;

// Long, smooth fade-out: (1 - x)^2 from 1 to 0, ending with zero slope (no click).
const RELEASE_SHAPE = Float32Array.from({ length: 128 }, (_, i) => (1 - i / 127) ** 2);

// Stereo: a note's place (-1..1, from the composer) times Width times this. Even at
// Wide, no note sits entirely in one ear.
export const WIDTH_MAX = 0.8;

// The browser's panner is equal-power: a centred note comes out 3 dB down in each
// channel. This makes up for it, so Mono sounds exactly as before stereo existed, and a
// panned note is as loud overall as a centred one.
const PAN_GAIN = Math.SQRT2;

export const stereoPosition = (pan, width) => pan * width * WIDTH_MAX;

// Shared by every sound: the note's volume envelope. A fade-in (`attack`, shortened
// for very short notes) to `peak`, then a long, smooth fade to silence at `duration`.
export function envelope(ctx, time, duration, peak, attack = ATTACK) {
  const amp = ctx.createGain();
  const rise = Math.min(attack, duration / 4);
  amp.gain.setValueAtTime(0, time);
  amp.gain.linearRampToValueAtTime(peak, time + rise);
  amp.gain.setValueCurveAtTime(RELEASE_SHAPE.map(x => x * peak), time + rise, duration - rise);
  return amp;
}

// Shared by every sound: the low-pass filter the Tone slider sets.
export function toneFilter(ctx, tone) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = toneToCutoff(tone);
  filter.Q.value = 0; // no resonant peak
  return filter;
}

// Sound recipes, one per id in SOUNDS (src/settings.js). Each one is
//   (ctx, out, time, { midi, duration, peak }, settings) => the source node that ends last
// It plays one note into `out`, at most `peak` loud, silent by `duration`. playNote
// handles volume, stereo place and cleanup, so a recipe only makes the sound.

// The classic sounds: one built-in waveform through the tone filter. Volume matching:
// each has a gain so switching doesn't jump in loudness, matched to triangle (the
// default) by average loudness at the middle tone; the tone setting moves these by under
// 1 dB. Re-measure with the "volume-matched" audio check if a sound changes.
const waveformSound = (type, gain) => (ctx, out, time, { midi, duration, peak }, { tone }) => {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = midiToFrequency(midi);
  osc.connect(toneFilter(ctx, tone)).connect(envelope(ctx, time, duration, peak * gain)).connect(out);
  osc.start(time);
  osc.stop(time + duration);
  return osc;
};

export const SOUND_RECIPES = {
  sine: waveformSound('sine', 0.82), // -1.7 dB
  triangle: waveformSound('triangle', 1),
  square: waveformSound('square', 0.71), // -3.0 dB
  sawtooth: waveformSound('sawtooth', 1.24), // +1.9 dB
};

// One note. `level` (default 1) scales its volume; `pan` (default 0) is its place.
// The sound comes from `settings.sound`, read before each note, so changes apply live.
export function playNote(ctx, destination, time, { midi, duration, level = 1, pan = 0 }, settings) {
  const { sound, width = 0 } = settings;
  const panner = ctx.createStereoPanner();
  panner.pan.value = stereoPosition(pan, width);
  panner.connect(destination);
  const peak = VOICE_PEAK * level * PAN_GAIN;
  const last = SOUND_RECIPES[sound](ctx, panner, time, { midi, duration, peak }, settings);
  last.onended = () => panner.disconnect();
}

// A melody note from the composer, plus its harmony note if it has one. The harmony
// is quieter, so it supports the melody instead of competing with it, and it always
// rings long (its own length from the composer), whatever the melody's rhythm. It sits
// on the opposite side from the melody note.
export const HARMONY_LEVEL = 0.5;

export function playWithHarmony(ctx, destination, time, note, settings) {
  playNote(ctx, destination, time, note, settings);
  if (note.harmony != null) {
    playNote(ctx, destination, time, { midi: note.harmony, duration: note.harmonyDuration, level: HARMONY_LEVEL, pan: note.harmonyPan }, settings);
  }
}

// Drone: a soft, sustained bass on the root, tamboura-like. A sine gives the body;
// two slightly detuned sawtooths add a gentle beating buzz, through a low-pass whose
// cutoff drifts slowly so the overtones shimmer. Fixed sound: ignores the sound and tone settings.
export const DRONE_LEVEL_MAX = 1.0; // at full volume: about 10 dB louder than the melody
export const DRONE_FADE = 2; // seconds to fade in or out (also the key-change crossfade)
const DRONE_GLIDE = 0.08; // seconds: volume changes glide instead of jumping

// Volume 0..1 -> gain. Squared, so the slider feels even to the ear.
// The default volume (0.33) gives about 0.11: roughly 9 dB under the melody.
export const droneGain = volume => DRONE_LEVEL_MAX * volume ** 2;

// Two gain stages, so their automations never mix: `fade` (fade-in/out, straight
// ramps only) and `level` (the volume slider, short glides only). Mixing both kinds of
// automation on one gain, then freezing it with cancelAndHoldAtTime, made Chrome drop
// the drone to silence at a key change: an audible pop.
export function startDrone(ctx, destination, time, midi, volume) {
  const freq = midiToFrequency(midi);
  const level = ctx.createGain();
  level.gain.value = droneGain(volume);
  level.connect(destination);
  const out = ctx.createGain(); // the fade stage
  out.gain.setValueAtTime(0, time);
  out.gain.linearRampToValueAtTime(1, time + DRONE_FADE);
  out.connect(level);

  const sources = [];
  const source = (type, frequency, level, to, detune = 0) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = level;
    osc.connect(g).connect(to);
    sources.push(osc);
    return g;
  };

  source('sine', freq, 0.6, out); // body

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq * 5;
  filter.Q.value = 4; // a soft resonant bump that sweeps through the overtones
  filter.connect(out);
  source('sawtooth', freq, 0.25, filter, -6);
  source('sawtooth', freq, 0.25, filter, +6);
  source('sine', 0.08, freq * 2.5, filter.frequency); // slow drift of the cutoff

  for (const osc of sources) osc.start(time);

  let released = false;
  return {
    // Glide to a new volume, starting at `at`. Doesn't touch the fade.
    setVolume(newVolume, at) {
      if (released) return;
      level.gain.setTargetAtTime(droneGain(newVolume), at, DRONE_GLIDE);
    },

    // Fade out from wherever the fade-in had reached at `at`, then stop. That point is
    // worked out here rather than read back from the browser. Re-stating the ramp up to
    // `at` keeps a fade-in that's still under way intact until then.
    release(at) {
      if (released) return;
      released = true;
      const reached = Math.min(1, Math.max(0, (at - time) / DRONE_FADE));
      out.gain.cancelScheduledValues(at);
      out.gain.linearRampToValueAtTime(reached, at);
      out.gain.linearRampToValueAtTime(0, at + DRONE_FADE);
      for (const osc of sources) osc.stop(at + DRONE_FADE + 0.05);
      sources[0].onended = () => level.disconnect();
    },
  };
}

// Output chain for one run: dry + reverb mixed into a master gain.
export function createBus(ctx, destination = ctx.destination) {
  const input = ctx.createGain();
  const dryInput = ctx.createGain(); // for sustained sounds: the reverb would colour one pitch unevenly
  const master = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const reverb = ctx.createConvolver();
  dry.gain.value = DRY_LEVEL;
  wet.gain.value = WET_LEVEL;
  reverb.buffer = impulseResponse(ctx);
  master.gain.value = MASTER_LEVEL;

  input.connect(dry).connect(master);
  dryInput.connect(dry);
  input.connect(reverb).connect(wet).connect(master);
  master.connect(destination);

  return {
    input,
    dryInput,
    master,
    // Fade everything on this bus (notes and reverb tail) to silence. Returns the end time.
    fadeOut(time, seconds = STOP_FADE) {
      master.gain.cancelScheduledValues(time);
      master.gain.setValueAtTime(master.gain.value, time);
      master.gain.linearRampToValueAtTime(0, time + seconds);
      return time + seconds;
    },
    // Unplug the bus once it's silent; any notes still booked on it are cut off unheard.
    disconnect() {
      master.disconnect();
    },
  };
}

// Generated reverb: decaying stereo noise, softened so the tail isn't hissy.
// Built once per audio context, from a fixed seed so it sounds (and measures) the same every time.
const impulseCache = new WeakMap();

function impulseResponse(ctx) {
  if (impulseCache.has(ctx)) return impulseCache.get(ctx);
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * REVERB_SECONDS);
  const buffer = ctx.createBuffer(2, length, rate);
  const fadeIn = Math.floor(rate * 0.01);
  const rng = createRandom(1);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      smooth += 0.25 * (rng() * 2 - 1 - smooth); // one-pole low-pass on the noise
      const decay = Math.exp((-6.9 * t) / REVERB_SECONDS); // -60 dB at the end
      data[i] = smooth * decay * Math.min(1, i / fadeIn);
    }
  }
  impulseCache.set(ctx, buffer);
  return buffer;
}

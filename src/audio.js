// Performer: turns notes into sound with Web Audio. Knows nothing about melody.
//
// Signal path:  note (sound recipe -> panner)  ->  bus.input
//               bus.input -> dry ----------------\
//               bus.input -> reverb -> wet -------+-> bus.master -> speakers
//               drone -> bus.dryInput -> dry ----/  (skips the reverb)
// Each run of the engine gets its own bus, so fading its master also fades the
// reverb tail.
import { createRandom } from './music.js';
import { sampleFor } from './samples.js';

export const ATTACK = 0.4; // seconds of fade-in
export const VOICE_PEAK = 0.2; // loudest point of one note, leaving headroom for overlaps
export const TONE_CUTOFF_MIN = 600; // Hz, tone = 0
export const TONE_CUTOFF_MAX = 3200; // Hz, tone = 1 (kept low so sawtooth never gets harsh)
export const REVERB_SECONDS = 4;
export const DRY_LEVEL = 0.7;
// Overall output level. Leaves headroom for the drone and harmony at full volume over the
// busiest melody, at full width, in every sound (measured over many seeds). Lowered from
// 0.57 when the struck sounds came in: their sharper starts took the worst peak to 0.895.
export const MASTER_LEVEL = 0.54;
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

// Struck and plucked sounds: a quick but soft start, then a natural fade (an
// exponential decay with time constant `decay` seconds), inside the usual envelope so
// the note is still silent by its end. The start rises along x² over STRUCK_ATTACK, so
// it has no click but still sounds struck rather than swelled.
export const STRUCK_ATTACK = 0.04;
const RISE_SHAPE = Float32Array.from({ length: 64 }, (_, i) => (i / 63) ** 2);

function struckEnvelope(ctx, time, duration, peak, decay) {
  const amp = ctx.createGain();
  const rise = Math.min(STRUCK_ATTACK, duration / 4);
  amp.gain.setValueCurveAtTime(RISE_SHAPE.map(x => x * peak), time, rise);
  amp.gain.setValueCurveAtTime(RELEASE_SHAPE.map(x => x * peak), time + rise, duration - rise);
  const fade = ctx.createGain();
  fade.gain.setValueAtTime(1, time + rise);
  fade.gain.setTargetAtTime(0, time + rise, decay);
  amp.connect(fade);
  return { input: amp, output: fade };
}

// A sine whose frequency is wobbled by another sine (FM synthesis). The wobble's depth,
// the "index", sets how many overtones there are; here it starts at `from` and falls
// towards `to` with time constant `tau`, so the note starts bright and mellows.
function fmPair(ctx, time, duration, frequency, ratio, from, to, tau) {
  const carrier = ctx.createOscillator();
  carrier.frequency.value = frequency;
  const mod = ctx.createOscillator();
  mod.frequency.value = frequency * ratio;
  const depth = ctx.createGain(); // index × modulator frequency = deviation in Hz
  depth.gain.setValueAtTime(from * frequency * ratio, time);
  depth.gain.setTargetAtTime(to * frequency * ratio, time, tau);
  mod.connect(depth).connect(carrier.frequency);
  for (const osc of [carrier, mod]) { osc.start(time); osc.stop(time + duration); }
  return carrier;
}

// Glass: a bell. The 3.5 ratio gives bell-like overtones that don't line up with the
// note's harmonics; Tone sets how bright the strike is.
function glassSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const env = struckEnvelope(ctx, time, duration, peak * 1.33, 1.6);
  const carrier = fmPair(ctx, time, duration, f, 3.5, 0.6 + 1.4 * tone, 0.15, 0.8);
  carrier.connect(toneFilter(ctx, tone)).connect(env.input);
  env.output.connect(out);
  return carrier;
}

// Kalimba: a short, woody thumb piano. A 1:1 FM "knock" that dies fast, plus the
// metal tine's quiet high overtone (about 5.4× the note, not a harmonic).
function kalimbaSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const env = struckEnvelope(ctx, time, duration, peak * 1.9, 0.55);
  const filter = toneFilter(ctx, tone);
  filter.connect(env.input);
  const body = fmPair(ctx, time, duration, f, 1, 1.5, 0, 0.05);
  body.connect(filter);
  const ping = ctx.createOscillator();
  ping.frequency.value = f * 5.4;
  const pingLevel = ctx.createGain();
  pingLevel.gain.setValueAtTime(0.25, time);
  pingLevel.gain.setTargetAtTime(0, time, 0.06);
  ping.connect(pingLevel).connect(filter);
  ping.start(time);
  ping.stop(time + duration);
  env.output.connect(out);
  return body;
}

// Harp: a plucked string by Karplus-Strong. A short burst of noise circulates in a
// delay one period long; blending neighbours each time round softens and fades it,
// like a real string. Browsers can't run a feedback delay that short (it needs under
// 128 samples above about 344 Hz), so the pluck is computed here, once per pitch.
const HARP_SECONDS = 8; // longer than any note
const HARP_DAMPING = 0.15; // 0.5 is the classic average (dullest, fastest fade); lower rings longer
const HARP_PLUCK_SOFTNESS = 0.2; // smoothing of the pluck's noise: lower is softer
const HARP_RMS = 0.243; // each pitch's loudness over its first 1.5 s
const harpCache = new Map();
function harpBuffer(ctx, midi) {
  const key = `${midi}@${ctx.sampleRate}`;
  if (harpCache.has(key)) return harpCache.get(key);
  const rate = ctx.sampleRate;
  const period = rate / midiToFrequency(midi) - HARP_DAMPING; // the damping adds this much delay
  const n = Math.ceil(HARP_SECONDS * rate);
  const y = new Float32Array(n);
  const rng = createRandom(midi);
  const burst = Math.ceil(period);
  // The pluck: noise, smoothed twice round the loop so it starts soft (a fingertip, not a
  // pick), with its average removed so it carries no offset.
  for (let i = 0; i < burst; i++) y[i] = rng() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) {
    let smooth = 0;
    for (let lap = 0; lap < 2; lap++) { // the first lap only warms up the filter
      for (let i = 0; i < burst; i++) { smooth += HARP_PLUCK_SOFTNESS * (y[i] - smooth); if (lap) y[i] = smooth; }
    }
  }
  const mean = y.subarray(0, burst).reduce((a, v) => a + v, 0) / burst;
  for (let i = 0; i < burst; i++) y[i] -= mean;
  const loss = 0.999; // per pass: higher notes pass more often, so they fade sooner, as on a harp
  for (let i = burst + 1; i < n; i++) { // from here, two periods back is inside the buffer
    const d = i - period, j = Math.floor(d), frac = d - j;
    const a = y[j] + frac * (y[j + 1] - y[j]); // the sample one period back
    const b = y[j - 1] + frac * (y[j] - y[j - 1]);
    y[i] += loss * ((1 - HARP_DAMPING) * a + HARP_DAMPING * b);
  }
  // Level each pitch by its loudness over the first 1.5 s, not its loudest sample, so
  // every note sounds about as loud (higher strings fade faster, so they'd sound quieter).
  let sum = 0;
  const early = Math.ceil(1.5 * rate);
  for (let i = 0; i < early; i++) sum += y[i] * y[i];
  const level = Math.sqrt(sum / early) / HARP_RMS;
  for (let i = 0; i < n; i++) y[i] /= level;
  const buffer = new AudioBuffer({ length: n, sampleRate: rate, numberOfChannels: 1 });
  buffer.copyToChannel(y, 0);
  harpCache.set(key, buffer);
  return buffer;
}

function harpSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  // A brighter pluck is spikier for the same loudness, so it plays a little quieter as
  // Tone rises (about 1 dB at the brightest), keeping the loudest mix under the peak limit.
  const gain = 2.8 * (1 - 0.12 * tone);
  const env = struckEnvelope(ctx, time, duration, peak * gain, 30); // the string fades on its own
  const src = new AudioBufferSourceNode(ctx, { buffer: harpBuffer(ctx, midi) });
  src.connect(toneFilter(ctx, tone)).connect(env.input);
  env.output.connect(out);
  src.start(time);
  src.stop(time + duration);
  return src;
}

// Tine: an electric piano. A 1:1 FM body with a soft bark at the start, and a quiet
// bell-like tine two octaves up that fades quickly.
function tineSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const env = struckEnvelope(ctx, time, duration, peak * 1.32, 1.4);
  const filter = toneFilter(ctx, tone);
  filter.connect(env.input);
  const body = fmPair(ctx, time, duration, f, 1, 0.4 + 1.0 * tone, 0.2, 0.35);
  body.connect(filter);
  const tine = ctx.createOscillator();
  tine.frequency.value = f * 4;
  const tineLevel = ctx.createGain();
  tineLevel.gain.setValueAtTime(0.18, time);
  tineLevel.gain.setTargetAtTime(0, time, 0.12);
  tine.connect(tineLevel).connect(filter);
  tine.start(time);
  tine.stop(time + duration);
  env.output.connect(out);
  return body;
}

// Sustained sounds: a slow swell (SWELL seconds, shortened for short notes), held, with
// gentle movement while they ring, then the usual long fade.
export const SWELL = 0.9;

// An oscillator that starts and stops with the note. `detune` is in cents.
function oscillator(ctx, time, duration, type, frequency, detune = 0) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;
  osc.start(time);
  osc.stop(time + duration);
  return osc;
}

// Vibrato: a slow wobble of `cents` on each oscillator's pitch, at `rate` Hz. It fades in
// after the swell, as a player's would.
function vibrato(ctx, time, duration, oscs, rate, cents) {
  const lfo = oscillator(ctx, time, duration, 'sine', rate);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(cents, time + Math.min(1.5, duration / 2));
  lfo.connect(depth);
  for (const osc of oscs) depth.connect(osc.detune);
}

// Pad: three sawtooths a few cents apart, so they drift in and out of phase (a slow
// shimmer), with a soft sine an octave down for body.
function padSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const filter = toneFilter(ctx, tone);
  filter.connect(envelope(ctx, time, duration, peak * 1.22, SWELL)).connect(out);
  const saws = ctx.createGain();
  saws.gain.value = 0.4;
  saws.connect(filter);
  for (const cents of [-9, 0, 9]) oscillator(ctx, time, duration, 'sawtooth', f, cents).connect(saws);
  const sub = ctx.createGain();
  sub.gain.value = 0.5;
  sub.connect(filter);
  const body = oscillator(ctx, time, duration, 'sine', f / 2);
  body.connect(sub);
  return body;
}

// Strings: two sawtooths a little apart, like two players, with a delayed vibrato and
// a bow-like swell.
function stringsSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const filter = toneFilter(ctx, tone);
  filter.connect(envelope(ctx, time, duration, peak * 1.86, SWELL * 0.8)).connect(out);
  const oscs = [-5, 6].map(cents => oscillator(ctx, time, duration, 'sawtooth', f, cents));
  const mix = ctx.createGain();
  mix.gain.value = 0.5;
  for (const osc of oscs) osc.connect(mix);
  mix.connect(filter);
  vibrato(ctx, time, duration, oscs, 5, 8);
  return oscs[0];
}

// Choir: a buzzy source through three band-pass filters at the resonances of a sung
// "ooh" (its formants), which is what makes a sound read as a voice.
// [Hz, level, sharpness (Q)]. Kept broad: sharper bands sound more vowel-like, but they
// made notes near a band up to 7 dB louder and others 10 dB quieter (measured).
const OOH_FORMANTS = [[450, 1, 1], [850, 0.5, 2], [2400, 0.15, 3]];
const CHOIR_PLAIN = 0.25;
// Even with broad bands, notes near A4 (MIDI 69) come out loudest, falling off smoothly
// either side; this evens it out (measured: 5.5 dB across the range without it).
const CHOIR_CENTRE = 69;
const CHOIR_TILT = 0.22; // dB per semitone from the centre
const choirEvenness = midi => 10 ** ((CHOIR_TILT * Math.abs(midi - CHOIR_CENTRE)) / 20);
function choirSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const filter = toneFilter(ctx, tone);
  filter.connect(envelope(ctx, time, duration, peak * 0.75 * choirEvenness(midi), SWELL)).connect(out);
  const oscs = [-7, 7].map(cents => oscillator(ctx, time, duration, 'sawtooth', f, cents)); // two singers
  const source = ctx.createGain();
  for (const osc of oscs) osc.connect(source);
  const plain = ctx.createGain(); // a little of the voice unfiltered, so low notes (below the bands) don't fade
  plain.gain.value = CHOIR_PLAIN;
  source.connect(plain).connect(filter);
  for (const [hz, level, q] of OOH_FORMANTS) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = hz;
    band.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = level;
    source.connect(band).connect(g).connect(filter);
  }
  vibrato(ctx, time, duration, oscs, 4.5, 10);
  return oscs[0];
}

// Breath: a flute-like sine with a touch of its octave, plus a little noise tuned to the
// note (the air in the tone) and a gentle vibrato.
const noiseCache = new Map();
function noiseBuffer(ctx) {
  if (noiseCache.has(ctx.sampleRate)) return noiseCache.get(ctx.sampleRate);
  const rng = createRandom(1);
  const data = Float32Array.from({ length: ctx.sampleRate * 2 }, () => rng() * 2 - 1);
  const buffer = new AudioBuffer({ length: data.length, sampleRate: ctx.sampleRate, numberOfChannels: 1 });
  buffer.copyToChannel(data, 0);
  noiseCache.set(ctx.sampleRate, buffer);
  return buffer;
}

function breathSound(ctx, out, time, { midi, duration, peak }, { tone }) {
  const f = midiToFrequency(midi);
  const filter = toneFilter(ctx, tone);
  filter.connect(envelope(ctx, time, duration, peak * 0.81, SWELL * 0.5)).connect(out);
  const tone1 = oscillator(ctx, time, duration, 'sine', f);
  const tone2 = oscillator(ctx, time, duration, 'sine', f * 2);
  const octave = ctx.createGain();
  octave.gain.value = 0.15;
  tone1.connect(filter);
  tone2.connect(octave).connect(filter);
  vibrato(ctx, time, duration, [tone1, tone2], 4.8, 6);
  const air = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer(ctx), loop: true });
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = f * 2;
  band.Q.value = 3;
  const airLevel = ctx.createGain();
  airLevel.gain.value = 0.35;
  air.connect(band).connect(airLevel).connect(filter);
  air.start(time, (midi * 0.137) % 1.5); // start somewhere different for each pitch
  air.stop(time + duration);
  return tone1;
}

// Piano: a recorded grand piano (src/samples.js), the nearest recorded note retuned to
// the one wanted. A real piano is never harsh, so its Tone range sits higher than the
// synthesized sounds' (PIANO_TONE_LIFT times the cutoff). The recordings fade on their
// own. Until they've loaded, the note plays as Warm, so Start never waits.
// Like Harp, it plays a little quieter as Tone brightens (about 0.5 dB at the brightest):
// a bright piano strike is spiky, and at full gain it took the loudest mix to 0.899.
const PIANO_GAIN = 6.2;
const PIANO_BRIGHT_TRIM = 0.06;
const PIANO_TONE_LIFT = 2;
function pianoSound(ctx, out, time, note, settings) {
  const sample = sampleFor('piano', note.midi);
  if (!sample) return SOUND_RECIPES.triangle(ctx, out, time, note, settings);
  const { duration, peak } = note;
  const env = struckEnvelope(ctx, time, duration, peak * PIANO_GAIN * (1 - PIANO_BRIGHT_TRIM * settings.tone) * sample.level, 30);
  const filter = toneFilter(ctx, settings.tone);
  filter.frequency.value *= PIANO_TONE_LIFT;
  const src = new AudioBufferSourceNode(ctx, { buffer: sample.buffer, playbackRate: sample.rate });
  src.connect(filter).connect(env.input);
  env.output.connect(out);
  src.start(time);
  src.stop(time + duration);
  return src;
}

export const SOUND_RECIPES = {
  sine: waveformSound('sine', 0.82), // -1.7 dB
  triangle: waveformSound('triangle', 1),
  square: waveformSound('square', 0.71), // -3.0 dB
  sawtooth: waveformSound('sawtooth', 1.24), // +1.9 dB
  glass: glassSound,
  kalimba: kalimbaSound,
  harp: harpSound,
  tine: tineSound,
  piano: pianoSound,
  pad: padSound,
  strings: stringsSound,
  choir: choirSound,
  breath: breathSound,
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

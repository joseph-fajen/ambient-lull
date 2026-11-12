// SPIKE (throwaway, branch forest-spike): plays what src/forest/plan.js decides.
// Four layer buses sharing three reverbs, the new voices (sustain, swarm, wave), the
// hinted melody through today's sound recipes, and the tides as gain and filter curves.
import { playNote, startDrone, midiToFrequency, toneToCutoff, MASTER_LEVEL } from '../audio.js';
import { createRandom } from '../music.js';
import { LAYERS, SPACES } from './plan.js';

// The forest's master, set by measurement so its loudest 3 s stays at or under today's.
export const FOREST_MASTER = MASTER_LEVEL * 1.33; // measured: with every tide at its top (clip D) the loudest 3 s matches today
const HINT_LEVEL = 0.42; // each of the 3 melody copies
const HARMONY_LEVEL = 0.5;
const SUSTAIN_PEAK = 0.045; // set by measurement: about 4 dB under the hinted melody
const SWARM_PEAK = 0.015; // each copy; set by measurement: faint, about 9 dB under the melody
const WAVE_PEAK = 0.11;
const DRONE_TRIM = 0.7; // today's dry level, so the drone sits as it does today
const TIDE_STEP = 0.25; // seconds between points on a tide curve

const SOFT_CLIP = Float32Array.from({ length: 2049 }, (_, i) => {
  const x = (i / 1024) - 1, a = Math.abs(x), knee = 0.85, top = 0.95;
  const y = a <= knee ? a : knee + (top - knee) * Math.tanh((a - knee) / (top - knee));
  return Math.sign(x) * y;
});

// A generated reverb, as today's, but any length and darker for longer spaces.
function impulse(ctx, seconds, seed) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  const rng = createRandom(seed);
  const soften = seconds > 4 ? 0.12 : seconds > 2 ? 0.2 : 0.3;
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      smooth += soften * (rng() * 2 - 1 - smooth);
      data[i] = smooth * Math.exp((-6.9 * i) / rate / seconds) * Math.min(1, i / (rate * 0.01));
    }
  }
  return buffer;
}

// One stereo noise buffer, shared by every wave.
const noiseCache = new WeakMap();
function noise(ctx) {
  if (noiseCache.has(ctx)) return noiseCache.get(ctx);
  const buffer = ctx.createBuffer(2, ctx.sampleRate * 6, ctx.sampleRate);
  const rng = createRandom(99);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let b = 0;
    for (let i = 0; i < d.length; i++) { b = 0.97 * b + 0.03 * (rng() * 2 - 1); d[i] = b * 4; } // soft, dark noise
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

// The tide as a curve over the whole run (offline: booked in one go).
function curve(seconds, fn) {
  return Float32Array.from({ length: Math.ceil(seconds / TIDE_STEP) + 1 }, (_, i) => fn(i * TIDE_STEP));
}

// Layer buses. Each: input -> level (tide) -> filter (tide) -> dry to the master and a
// send to its space. `pre` is the master before the limiter, for measuring.
export function createForest(ctx, { seconds, tides, widths, tone }) {
  const pre = ctx.createGain();
  pre.gain.value = FOREST_MASTER;
  // Backstop: a fixed soft clip that leaves everything under 0.85 untouched and rounds
  // anything above towards 0.95. Not a DynamicsCompressorNode: Chrome adds make-up gain
  // to that, which made the whole mix louder.
  const limiter = new WaveShaperNode(ctx, { curve: SOFT_CLIP, oversample: '2x' });
  pre.connect(limiter);

  const spaces = {};
  for (const [name, secs] of Object.entries(SPACES)) {
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, secs, secs * 10);
    conv.connect(pre);
    spaces[name] = conv;
  }

  const layers = {};
  for (const [name, def] of Object.entries(LAYERS)) {
    const input = ctx.createGain();
    const level = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0;
    const base = def.cutoff ?? toneToCutoff(tone) * 2; // Near: the recipes apply Tone themselves
    level.gain.setValueCurveAtTime(curve(seconds, t => tides.level(name, t)), 0, seconds);
    filter.frequency.setValueCurveAtTime(curve(seconds, t => base * tides.brightness(name, t)), 0, seconds);
    const dry = ctx.createGain();
    dry.gain.value = def.dry;
    const send = ctx.createGain();
    send.gain.value = def.wet;
    input.connect(level).connect(filter);
    filter.connect(dry).connect(pre);
    filter.connect(send).connect(spaces[def.space]);
    layers[name] = { input, width: widths[name] };
  }

  // The drone: Far's tide, but no reverb (a reverb colours one held pitch unevenly).
  const droneIn = ctx.createGain();
  droneIn.gain.value = DRONE_TRIM;
  const droneTide = ctx.createGain();
  droneTide.gain.setValueCurveAtTime(curve(seconds, t => tides.level('far', t)), 0, seconds);
  droneIn.connect(droneTide).connect(pre);

  return { pre, out: limiter, layers, droneIn };
}

const panner = (ctx, pan, out) => {
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(out);
  return p;
};

// A soft swell: up over `rise`, held, down over `fall`, silent at the end.
function swell(ctx, time, duration, peak, rise, fall) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + rise);
  g.gain.setValueAtTime(peak, time + duration - fall);
  g.gain.linearRampToValueAtTime(0, time + duration);
  return g;
}

function playSustain(ctx, layer, e) {
  const out = swell(ctx, e.time, e.duration, SUSTAIN_PEAK, e.duration * 0.3, e.duration * 0.4);
  out.connect(panner(ctx, e.pan * layer.width, layer.input));
  const f = midiToFrequency(e.midi);
  for (const [type, cents, g] of [['sine', -4, 0.6], ['sine', 4, 0.6], ['triangle', 0, 0.35]]) {
    const osc = new OscillatorNode(ctx, { type, frequency: f, detune: cents });
    if (e.glideTo != null) {
      osc.frequency.setValueAtTime(f, e.time + e.glideAt);
      osc.frequency.exponentialRampToValueAtTime(midiToFrequency(e.glideTo), e.time + e.glideAt + 3);
    }
    const gain = new GainNode(ctx, { gain: g });
    osc.connect(gain).connect(out);
    osc.start(e.time);
    osc.stop(e.time + e.duration + 0.05);
  }
}

function playSwarm(ctx, layer, e) {
  for (const c of e.copies) {
    const t = e.time + c.delay;
    const out = swell(ctx, t, e.duration, SWARM_PEAK, e.duration * 0.35, e.duration * 0.45);
    out.connect(panner(ctx, c.pan * layer.width, layer.input));
    const flutter = new GainNode(ctx, { gain: 0.75 });
    const lfo = new OscillatorNode(ctx, { frequency: c.flutter });
    const depth = new GainNode(ctx, { gain: 0.25 });
    lfo.connect(depth).connect(flutter.gain);
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: midiToFrequency(c.midi), detune: c.cents });
    osc.connect(flutter).connect(out);
    for (const o of [osc, lfo]) { o.start(t); o.stop(t + e.duration + 0.05); }
  }
}

function playWave(ctx, layer, e) {
  const src = new AudioBufferSourceNode(ctx, { buffer: noise(ctx), loop: true });
  const filter = new BiquadFilterNode(ctx, { type: 'lowpass', Q: 0.3 });
  // The cutoff opens a little as the wave rises and closes as it falls.
  filter.frequency.setValueAtTime(e.cutoff * 0.5, e.time);
  filter.frequency.linearRampToValueAtTime(e.cutoff, e.time + e.duration * 0.45);
  filter.frequency.linearRampToValueAtTime(e.cutoff * 0.4, e.time + e.duration);
  const out = swell(ctx, e.time, e.duration, WAVE_PEAK * e.peak, e.duration * 0.45, e.duration * 0.55);
  src.connect(filter).connect(out).connect(layer.input);
  src.start(e.time, (e.time * 7.3) % 5);
  src.stop(e.time + e.duration + 0.05);
}

function playMelody(ctx, layer, e, settings) {
  const s = { ...settings, sound: e.sound, width: layer.width };
  const { note } = e;
  for (const c of e.copies) {
    const t = e.time + c.delay;
    const cents = c.cents / 100;
    const level = e.copies.length > 1 ? HINT_LEVEL : 1;
    playNote(ctx, layer.input, t, { midi: note.midi + cents, duration: note.duration, level, pan: note.pan + c.spread }, s);
    if (note.harmony != null) {
      playNote(ctx, layer.input, t, { midi: note.harmony + cents, duration: note.harmonyDuration, level: level * HARMONY_LEVEL, pan: note.harmonyPan + c.spread }, s);
    }
  }
}

// Book every event of a plan.
export function playForest(ctx, forest, events, settings) {
  let drone = null;
  for (const e of events) {
    if (e.kind === 'melody') playMelody(ctx, forest.layers.near, e, settings);
    else if (e.kind === 'sustain') playSustain(ctx, forest.layers[e.layer], e);
    else if (e.kind === 'swarm') playSwarm(ctx, forest.layers.high, e);
    else if (e.kind === 'wave') playWave(ctx, forest.layers.far, e);
    else if (e.kind === 'drone' && settings.drone) {
      drone?.release(e.time);
      drone = startDrone(ctx, forest.droneIn, e.time, e.midi, settings.droneVolume);
    }
  }
}

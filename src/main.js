// Shell: wires the UI to the composer (music.js), the timing (scheduler.js) and the
// performer (audio.js).
import { DEFAULT_SETTINGS, WAVEFORMS, TONE_MIN, TONE_MAX } from './settings.js';
import { KEYS, SCALES, TEMPO_MIN, TEMPO_MAX, beatInterval, createComposer, dronePitch, nextKeyInCircle } from './music.js';
import { playNote, createBus, startDrone } from './audio.js';
import { createTransport, createKeyCycle } from './scheduler.js';
import { createPresetStore, NAME_MAX } from './presets.js';

const TICK_MS = 50; // how often the timer loop books notes

// The one settings object: controls write to it, the engine reads it before each note.
const settings = { ...DEFAULT_SETTINGS };

const transport = createTransport();
const keyCycle = createKeyCycle();
let ctx = null;
let bus = null; // the current run's output; a stopped run's bus fades out on its own
let timer = null;
let composer = null;
let drone = null; // the current drone voice, if any
let droneMidi = null; // its pitch (null: no drone)

const startButton = document.getElementById('start');
const stopButton = document.getElementById('stop');

function tick() {
  if (settings.autoKey && keyCycle.due(ctx.currentTime)) {
    settings.key = nextKeyInCircle(settings.key);
    keySelect.value = settings.key; // applies from the next note, like a manual change
  }
  for (const time of transport.due(ctx.currentTime, () => beatInterval(settings.tempo))) {
    updateDrone(time);
    playNote(ctx, bus.input, time, composer.next(), settings);
  }
}

// Bring the drone in line with the settings, in step with the next melody note.
// A key change crossfades: the old drone fades out while the new one fades in.
function updateDrone(time) {
  const want = settings.drone ? dronePitch(settings.key) : null;
  if (want === droneMidi) return;
  drone?.release(time);
  drone = want === null ? null : startDrone(ctx, bus.dryInput, time, want, settings.droneVolume);
  droneMidi = want;
}

async function start() {
  ctx ??= new AudioContext();
  await ctx.resume();
  if (!transport.start(ctx.currentTime)) return; // already playing
  bus = createBus(ctx);
  composer = createComposer(settings, Math.random);
  drone = null;
  droneMidi = null;
  keyCycle.reset(ctx.currentTime);
  clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
  tick();
  updateButtons();
}

function stop() {
  if (!transport.stop()) return; // not playing
  clearInterval(timer);
  timer = null;
  const run = transport.run;
  const oldBus = bus;
  const end = oldBus.fadeOut(ctx.currentTime);
  drone?.release(ctx.currentTime);
  drone = null;
  droneMidi = null;
  setTimeout(() => {
    oldBus.disconnect();
    transport.finish(run);
    updateButtons();
  }, (end - ctx.currentTime) * 1000 + 100);
  updateButtons();
}

function updateButtons() {
  startButton.disabled = transport.state === 'playing';
  stopButton.disabled = transport.state !== 'playing';
}

// Controls: built from the data tables. Each one writes to `settings`; the engine
// picks the change up on the next note.
const keySelect = document.getElementById('key');
const scaleSelect = document.getElementById('scale');
const tempoSlider = document.getElementById('tempo');
const tempoValue = document.getElementById('tempo-value');
const droneToggle = document.getElementById('drone');
const autoKeyToggle = document.getElementById('auto-key');
const droneVolumeSlider = document.getElementById('drone-volume');
const waveformGroup = document.getElementById('waveform');
const toneSlider = document.getElementById('tone');

const fillSelect = (select, table) => select.replaceChildren(...table.map(e => new Option(e.name, e.id)));
fillSelect(keySelect, KEYS);
fillSelect(scaleSelect, SCALES);
// Waveform picker: mood name large, technical name small.
waveformGroup.replaceChildren(...WAVEFORMS.map(w => {
  const label = document.createElement('label');
  const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'waveform', value: w.id });
  const mood = Object.assign(document.createElement('span'), { textContent: w.mood });
  const tech = Object.assign(document.createElement('small'), { textContent: w.id });
  label.append(input, mood, tech);
  return label;
}));
toneSlider.min = TONE_MIN;
toneSlider.max = TONE_MAX;
tempoSlider.min = TEMPO_MIN;
tempoSlider.max = TEMPO_MAX;

// Show the settings object in the controls (at page load, and after loading a preset).
function showSettings() {
  keySelect.value = settings.key;
  scaleSelect.value = settings.scale;
  tempoSlider.value = settings.tempo;
  tempoValue.textContent = `${settings.tempo} BPM`;
  droneToggle.checked = settings.drone;
  autoKeyToggle.checked = settings.autoKey;
  droneVolumeSlider.value = settings.droneVolume;
  waveformGroup.querySelector(`input[value="${settings.waveform}"]`).checked = true;
  toneSlider.value = settings.tone;
}

// Restart the 30-second key countdown (on a manual key change, switching cycling on,
// or loading a preset). Before the first Start there's no clock yet; Start resets it.
const restartKeyCycle = () => { if (ctx) keyCycle.reset(ctx.currentTime); };

keySelect.addEventListener('change', () => {
  settings.key = keySelect.value;
  restartKeyCycle();
});
autoKeyToggle.addEventListener('change', () => {
  settings.autoKey = autoKeyToggle.checked;
  restartKeyCycle();
});
scaleSelect.addEventListener('change', () => { settings.scale = scaleSelect.value; });
tempoSlider.addEventListener('input', () => {
  settings.tempo = Number(tempoSlider.value);
  tempoValue.textContent = `${settings.tempo} BPM`;
});
droneToggle.addEventListener('change', () => { settings.drone = droneToggle.checked; });
// Drone volume is a mix level, not a note property, so it applies right away (with a short glide).
droneVolumeSlider.addEventListener('input', () => {
  settings.droneVolume = Number(droneVolumeSlider.value);
  drone?.setVolume(settings.droneVolume, ctx.currentTime);
});
waveformGroup.addEventListener('change', e => { settings.waveform = e.target.value; });
toneSlider.addEventListener('input', () => { settings.tone = Number(toneSlider.value); });
showSettings();

// Presets: 4 named slots. Loading applies live, like any other change.
function browserStorage() {
  try {
    return window.localStorage; // can throw when site data is blocked
  } catch {
    return null;
  }
}
const presets = createPresetStore(browserStorage());
const presetList = document.getElementById('presets');
const presetNote = document.getElementById('preset-note');

function showPresets() {
  presetList.replaceChildren(...presets.list().map((slot, i) => {
    const row = document.createElement('div');
    row.className = 'preset';
    const name = Object.assign(document.createElement('input'), {
      type: 'text', value: slot?.name ?? '', placeholder: `Preset ${i + 1}`, maxLength: NAME_MAX,
    });
    name.setAttribute('aria-label', `Preset ${i + 1} name`);
    const save = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Save' });
    const load = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Load', disabled: !slot });

    save.addEventListener('click', () => {
      if (presets.needsConfirm(i) && !confirm(`Replace "${slot.name}" with the current settings?`)) return;
      presets.save(i, name.value, settings);
      showPresets();
    });
    load.addEventListener('click', () => {
      Object.assign(settings, presets.load(i));
      showSettings();
      drone?.setVolume(settings.droneVolume, ctx.currentTime);
      restartKeyCycle();
    });
    row.append(name, save, load);
    return row;
  }));
  presetNote.hidden = presets.persistent;
}
showPresets();

startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);
updateButtons();

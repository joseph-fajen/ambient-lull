# Ambient Toy

A generative ambient music toy that runs in the browser. Press Start and hear an endless, gentle melody over a soft root drone, until you press Stop. Every combination of settings is meant to sound pleasant.

Plain HTML and JavaScript modules, using the Web Audio API directly. No build step and no dependencies.

## Run it

```sh
python3 -m http.server
```

Then open <http://localhost:8000> and press **Start**.

## Controls

All changes apply live, from the next note (drone volume applies immediately).

| Control | What it does |
| --- | --- |
| Key | Any of the 12 roots. The pitch range stays centred near middle C in every key. |
| Cycle keys | When on, moves the key up a fifth every 30 s while playing (C → G → D … → F → C). Picking a key by hand restarts the countdown. Off by default. |
| Scale | Major pentatonic (default), minor pentatonic, major, natural minor, Dorian, Lydian, Japanese In. |
| Tempo | 20–120 BPM, one note per beat. Notes ring for about 8 s at 20 BPM, down to 2.5 s at 120 BPM. |
| Sound | Soft (sine), Warm (triangle, default), Hollow (square), Bright (sawtooth), volume-matched. |
| Tone | A low-pass filter from Dark to Bright, limited so even Bright never gets harsh. |
| Drone | A soft bass on the root, two octaves down (on by default). Key changes crossfade it. The slider sets its volume, from silent up to about 10 dB louder than the melody. |
| Presets | 4 named slots. Save stores the current settings (asking first if the slot is filled); Load applies them live. Kept in the browser's localStorage. |

## Test it

**Unit tests** (Node 18+, nothing to install):

```sh
npm test
```

These cover the pure logic: scales and keys, the melody walk (a sweep of every key × scale × 20 seeds, checking range, scale, step size and note length), tempo to note length, note timing and Start/Stop states with a fake clock, settings validation, and presets with fake and failing storage.

**Audio checks:** with the server running, open <http://localhost:8000/tests/audio-checks.html>. It renders sound offline (to numbers, not the speakers) and checks:

- the waveforms are volume-matched
- notes and the drone start and end without clicks
- the drone sits under the melody in every key at default volume, and about 10 dB louder than the melody at full volume
- the peak stays below 1.0 in the worst case
- the output is silent after Stop

## How it's built

```
src/
  music.js       composer (pure): keys, scales, circle of fifths, the melody walk, drone pitch, tempo → note length
  settings.js    the settings object (pure): defaults, waveform table, validation
  scheduler.js   timing (pure): which notes are due in the lookahead window; Start/Stop states; key-cycle countdown
  audio.js       performer: the note voice, the drone, reverb, and each run's output chain
  presets.js     the 4 preset slots; storage is passed in
  main.js        the page: controls, the timer loop, connecting everything
tests/
  *.test.js          unit tests (node --test)
  audio-checks.html  offline audio measurements, opened in the browser
notes/           design thinking and the build plan
```

- **One settings object.** The controls write to it, and the engine reads it before every note. Presets save and load it.
- **The composer decides which note; the performer decides how it sounds.** The composer is pure and tested without audio.
- **The engine books notes 0.3 s ahead on the audio clock** for steady timing. If the clock jumps (for example, a sleeping tab), it skips forward instead of playing a burst of missed notes.
- **Each Start gets its own output chain.** Stop fades that chain out, reverb tail included, then unplugs it. Pressing Start again during a fade begins a fresh run alongside it.

## Changing things

- **Add a scale:** one line in `SCALES` in `src/music.js`, as a name plus intervals in semitones. It appears in the dropdown automatically.
- **Tune the sound:** the constants at the top of `src/audio.js` (fade-in, note volume, tone range, reverb mix, Stop fade, per-waveform gains, drone's maximum level).
- **After changing the sound, re-run the audio checks.** The per-waveform gains in particular were measured, so re-measure them if you change a voice.

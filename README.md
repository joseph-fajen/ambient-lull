# Ambient Lull

Generative ambient music that runs in the browser: a calm, ever-changing backdrop. Press Start and hear an endless, gentle melody over a soft root drone, until you press Stop. Every combination of settings is meant to sound pleasant.

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
| Cycle keys | When on, moves the key up a fifth while playing (C → G → D … → F → C). The slider sets how often: every 10 s to 2 min (default 30 s). Picking a key by hand restarts the countdown. Off by default. |
| Scale | Major pentatonic (default), minor pentatonic, major, natural minor, Dorian, Lydian, Japanese In. |
| Tempo | 20–120 BPM: the length of a beat. A 1-beat note rings for about 8 s at 20 BPM, down to 2.5 s at 120 BPM. |
| Rhythm | From Steady (one note per beat) to Varied. Varied notes last half a beat (always in pairs, so the melody lands back on the beat) up to 4 beats. Quick notes ring shorter and held notes longer. Default: in the middle, about half the notes 1 beat. |
| Sound | 13 sounds, all volume-matched and even from low notes to high. **Classic:** Soft (sine), Warm (triangle, default), Hollow (square), Bright (sawtooth). **Struck:** Glass (bell), Kalimba (thumb piano), Harp (plucked string), Tine (electric piano), Piano (a recorded grand piano): a soft strike, then a natural fade. **Sustained:** Pad, Strings, Choir ("ooh"), Breath (flute): a slow swell with gentle movement. |
| Tone | A low-pass filter from Dark to Bright, limited so even Bright never gets harsh. |
| Width | Stereo, from Mono to Wide. Each melody note gets its own place left to right, and its harmony note sits on the opposite side. The drone stays in the middle. Even at Wide, no note is entirely in one ear. Default: gently wide, about halfway. |
| Harmony | Now and then a second, quieter note sounds with the melody: a 3rd, 4th or 5th, always in the scale and inside the melody's range. Harmony notes always ring long, as long as a 4-beat note, whatever the melody's rhythm. The slider sets how often, from Never to Often (about every other note). Default: about 1 note in 6. |
| Drift | When on, the Harmony amount rises and falls on its own over 3 minutes: from a quarter of the slider's setting up to 1.75 times it (at most Often). It starts at the slider and rises first, timed from Start. The slider doesn't move, and Never stays Never. Off by default. |
| Drone | A soft bass on the root, two octaves down (on by default). Key changes crossfade it. The slider sets its volume, from silent up to about 10 dB louder than the melody. |
| Presets | 4 named slots. Save stores the current settings (asking first if the slot is filled); Load applies them live. Kept in the browser's localStorage. |

## Listen to the sounds

```sh
npm run clips
```

Renders a 30-second clip of each sound to `clips/` (MP3 if ffmpeg is installed, otherwise WAV), with the same melody and default settings, so only the sound differs. Play them on any device. Options: `-- --sounds glass,harp` for some sounds only, `-- --blind` for a blind test (files named Sound A, B…, with the answers in `clips/answers.txt`). Needs Node 22+ and Chrome, as for the audio checks.

## Test it

**Unit tests** (Node 18+, nothing to install):

```sh
npm test
```

These cover the pure logic: scales and keys, the melody walk (a sweep of every key × scale × 20 seeds, checking range, scale, step size and note length), harmony notes (in scale, in range and a 3rd, 4th or 5th away, for every note of every key × scale), stereo places (both sides, harmony opposite the melody), harmony drift (its curve, Never stays Never, the slider untouched), note lengths (allowed lengths, quick notes in pairs, back on the beat), tempo to note length, note timing and Start/Stop states with a fake clock, settings validation, and presets with fake and failing storage.

**Audio checks** (Node 22+, and Chrome, Chromium or Edge):

```sh
npm run test:audio
```

This runs `tests/audio-checks.html` in a headless browser and prints the results (about 5–10 minutes). It exits with an error if any check fails. Set `CHROME=/path/to/browser` to choose the browser. You can also open the page yourself, with the server running, at <http://localhost:8000/tests/audio-checks.html>.

The page renders sound offline (to numbers, not the speakers) and checks:

- the sounds are volume-matched, and each one is even from its lowest note to its highest
- notes and the drone start and end without clicks
- the drone changes key without a pop
- the drone sits under the melody in every key at default volume, and about 10 dB louder than the melody at full volume
- the peak stays below 1.0 in the worst case (drone and harmony at full, full width)
- harmony adds little loudness (under 1 dB at default)
- varied rhythm stays within 3 dB of steady in loudness
- Width places notes left to right without changing loudness (Mono is centred)
- Drift keeps harmony within its loudness limit through a whole rise and fall
- the output is silent after Stop

## How it's built

```
src/
  music.js       composer (pure): keys, scales, circle of fifths, the melody walk, harmony notes, note lengths (rhythm), stereo places, harmony drift, drone pitch, tempo → note length
  settings.js    the settings object (pure): defaults, sounds table, validation
  scheduler.js   timing (pure): which notes are due in the lookahead window; Start/Stop states; key-cycle countdown
  samples.js     recorded sounds: which files, loading them, the nearest recorded note for each pitch
  audio.js       performer: a recipe for each sound, the note player (with its stereo place), harmony level, the drone, reverb, and each run's output chain
  presets.js     the 4 preset slots; storage is passed in
  main.js        the page: controls, the timer loop, connecting everything
tests/
  *.test.js            unit tests (node --test)
  audio-checks.html    offline audio measurements, opened in the browser
  run-audio-checks.mjs runs those in headless Chrome from the command line
notes/           design thinking and the build plan
samples/         recorded notes for the sampled sounds, and their credits (CREDITS.md)
```

- **One settings object.** The controls write to it, and the engine reads it before every note. Presets save and load it.
- **The composer decides which note; the performer decides how it sounds.** The composer is pure and tested without audio.
- **The engine books notes 0.3 s ahead on the audio clock** for steady timing. If the clock jumps (for example, a sleeping tab), it skips forward instead of playing a burst of missed notes.
- **Each Start gets its own output chain.** Stop fades that chain out, reverb tail included, then unplugs it. Pressing Start again during a fade begins a fresh run alongside it.

## Changing things

- **Add a scale:** one line in `SCALES` in `src/music.js`, as a name plus intervals in semitones. It appears in the dropdown automatically.
- **Add a sound:** an entry in `SOUNDS` in `src/settings.js` (id, name, detail, group) and a recipe with the same id in `SOUND_RECIPES` in `src/audio.js`. A unit test checks the two match. Then set its gain with the volume-matching audio check.
- **Tune the sound:** the constants at the top of `src/audio.js` (fade-in, note volume, harmony level, stereo width, tone range, reverb mix, Stop fade, drone's maximum level), and each sound's gain next to its recipe.
- **After changing the sound, re-run the audio checks.** Each sound's gain was measured, so re-measure it if you change that sound.

## Known limitations

- Some browsers slow down timers in background tabs. If yours does, notes may come unevenly while the tab is hidden, though never in a burst when you return. Chrome doesn't slow down tabs that are playing audio.

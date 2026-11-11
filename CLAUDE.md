# CLAUDE.md — Ambient Lull

## What this is

Generative ambient music in the browser: press Start for an endless, gentle melody over a soft drone. It's a personal project, played on desktop and phone. Plain HTML and JavaScript modules on the Web Audio API, with no build step and no dependencies. `README.md` covers what it does, how to run it and how it's built.

## Where things stand

- **Built:** v1 plus everything in `notes/build-plan.md` ("After v1"), and 6 sounds: 4 recorded (Piano, Upright, Harp, Vibes) and 2 synthesized (Kalimba, Pad). The other 10 synthesized sounds were removed on 2026-11-09. See `notes/brainstorm.md`, section 3. Also **Cycle sounds** (2026-11-09): a new sound every 2 minutes and a new scale after all six. See section 6.
- **Next and open:** `notes/brainstorm.md` holds the decisions and open questions: remove the Width control (fixed wide), narrow Tempo to 20–60 BPM, custom chord progressions alongside Cycle keys, then a more beautiful UI. Harmony changes and a mobile app are parked.
- **Still to do:** the listening checks in `notes/build-plan.md`. Only the owner can do those.

## Architecture map

```
index.html            # the page and its controls; loads src/main.js
src/
  main.js             # shell: wires the UI to the composer, the timing and the performer
  music.js            # composer: keys, scales, the note walk, tempo -> note length. Pure, no audio
  scheduler.js        # transport: when notes are due, start/stop states. Pure, clock passed in
  audio.js            # performer: sound recipes (SOUND_RECIPES), panning, reverb, drone, master level
  samples.js          # recorded instruments: loading and retuning the sample sets (SAMPLE_SETS)
  settings.js         # the one settings object: defaults, SOUNDS, normalizeSettings for any input
  presets.js          # 4 saved slots in localStorage (key still `ambient-toy.presets`)
samples/<set>/        # mono MP3s named by real pitch; sources and licences in CREDITS.md
tests/
  *.test.js           # unit tests for the pure modules (node --test)
  audio-checks.html   # offline audio measurements: volume match, clicks, peaks, loudness
  run-audio-checks.mjs, render-clips.mjs, browser.mjs   # run pages in headless Chrome
notes/                # design-thinking.md (why), build-plan.md (milestones), brainstorm.md (decisions)
```

## Ground rules (conventions)

- **"It can't sound bad"** is the core promise. Every setting combination should sound pleasant, and the defaults should sound good on the first Start.
- **Keep the composer pure.** `src/music.js` decides which note and when, and is tested without audio. `src/audio.js` decides how it sounds.
- **Measure, don't guess.** Volume matching, peak headroom and evenness are set by measurement, and the audio checks enforce them.
- **Adding a sound:** add an entry to `SOUNDS` in `src/settings.js` and a recipe to `SOUND_RECIPES` in `src/audio.js`. Then set its gain so it matches Kalimba at the middle Tone. Check its evenness across MIDI 42–77, not just its average: Choir's first version averaged right but swung 23 dB from note to note. Check the worst-case peak too (limit 0.9).
- **Adding a recorded sound:** put mono MP3s, named by their real pitch, in `samples/<set>/`, add the set to `SAMPLE_SETS` in `src/samples.js`, a `sampledSound` recipe, and a `SOUNDS` entry with `samples`. Credit the source in `samples/CREDITS.md`, and use only open licences (CC0 or CC-BY). Measure each file's real pitch: VCSL names some instruments an octave low. Levelling per note is automatic; set the gain by measurement.
- **Old presets must keep loading.** Settings are stored by name, and `normalizeSettings` fills in or falls back. The `waveform` field is read as `sound`, and removed sounds map to the closest kept (`REPLACED_SOUNDS` in `src/settings.js`).
- **Git workflow:** commit and push after each piece of work. Recent work goes straight to `main`, after the tests pass.
- **Testing:** done means `npm test` passes, plus `npm run test:audio` after any change to `src/audio.js`.
- Comments and notes use plain English, as in the existing files.

## Working principles (agent steering)

- **The owner** is a senior technical writer who often works from their phone. Keep replies short and plain, and lead with the outcome.
- **Pace:** work 2–3 steps at a time and check in. Don't run far ahead.
- **Decisions:** record them in `notes/brainstorm.md` as you go, under **Decided**, **Open** and **Progress**.
- **Listening:** the owner can't hear audio from the cloud machine. Send listening clips (`npm run clips`, with the SendUserFile tool) for any change to the sound.

## Commands

- install: none (no dependencies) · run: `python3 -m http.server`, then open http://localhost:8000
- test: `npm test` (Node 18+, about 105 tests, under a second)
- audio checks: `npm run test:audio` (Node 22+ and Chrome, about 5–7 minutes; set `CHROME=/path/to/browser` to choose one)
- clips: `npm run clips -- --sounds triangle,harp` (writes to `clips/`, which git ignores; ffmpeg turns them into MP3)

### In a cloud session

Chromium is at `/opt/pw-browsers/chromium-*/chrome-linux*/chrome`, and as root it only starts with `--no-sandbox`, so point `CHROME` at a small wrapper script:

```sh
printf '#!/bin/sh\nexec %s --no-sandbox "$@"\n' "$(ls /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)" > /tmp/chrome && chmod +x /tmp/chrome
CHROME=/tmp/chrome npm run test:audio   # about 7 minutes; give it a 10-minute timeout
CHROME=/tmp/chrome npm run clips -- --sounds triangle,harp
```

**Phone link:** the app is published as a private claude.ai artifact at https://claude.ai/artifact/YFhG1tRBj8vx5aNEXmtqXz. To update it from a new session, publish `index.html` with the `src/*.js` files, passing that URL as `url` (read the artifact first). GitHub Pages isn't enabled, and the owner would have to turn it on in the repo settings.

## On-demand context

- Why the project is the way it is → `notes/design-thinking.md`. What's decided and open → `notes/brainstorm.md`.
- Skills, subagents and references from the course AI layer → `.claude/skills/`, `.claude/agents/`, `.claude/references/`.
- `.claude/references/engineering.md` and `direction.md` are still the course's unfilled templates. Fill them in before relying on them.

Keep this file true: run `/rules-check-drift` before every merge.

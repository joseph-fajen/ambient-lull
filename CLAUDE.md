# Ambient Lull: notes for Claude

Generative ambient music in the browser: plain HTML and JavaScript modules on the Web Audio API, with no build step and no dependencies. Read `README.md` for what it does, how to run it and how the code is laid out.

## Where things stand

- **Built:** v1 plus everything in `notes/build-plan.md` ("After v1"), and 6 sounds: 4 recorded (Piano, Upright, Harp, Vibes) and 2 synthesized (Kalimba, Pad). The other 10 synthesized sounds were removed on 2026-11-09. See `notes/brainstorm.md`, section 3. Also **Cycle sounds** (2026-11-09): a new sound every 2 minutes and a new scale after all six. See section 6.
- **Next and open:** `notes/brainstorm.md` holds the decisions and open questions: remove the Width control (fixed wide), narrow Tempo to 20–60 BPM, custom chord progressions alongside Cycle keys, then a more beautiful UI. Harmony changes and a mobile app are parked.
- **Still to do:** the listening checks in `notes/build-plan.md`. Only the owner can do those.

## Working with the owner

- They're a senior technical writer who often works from their phone. Keep replies short and plain, and lead with the outcome.
- Work 2–3 steps at a time and check in. Don't run far ahead.
- Record decisions in `notes/brainstorm.md` as you go: **Decided**, **Open**, and **Progress**.
- They can't hear audio from this machine. Send listening clips (`npm run clips`, with the SendUserFile tool) for any change to the sound.
- Commit and push after each piece of work. Recent work goes straight to `main`, after the tests pass.

## Rules for the code

- **"It can't sound bad"** is the core promise. Every setting combination should sound pleasant, and the defaults should sound good on the first Start.
- **Keep the composer pure.** `src/music.js` decides which note and when, and is tested without audio. `src/audio.js` decides how it sounds.
- **Measure, don't guess.** Volume matching, peak headroom and evenness are set by measurement, and the audio checks enforce them. After changing anything in `src/audio.js`, run `npm run test:audio`.
- **Adding a sound:** add an entry to `SOUNDS` in `src/settings.js` and a recipe to `SOUND_RECIPES` in `src/audio.js`. Then set its gain so it matches Kalimba at the middle Tone. Check its evenness across MIDI 42–77, not just its average: Choir's first version averaged right but swung 23 dB from note to note. Check the worst-case peak too (limit 0.9).
- **Adding a recorded sound:** put mono MP3s, named by their real pitch, in `samples/<set>/`, add the set to `SAMPLE_SETS` in `src/samples.js`, a `sampledSound` recipe, and a `SOUNDS` entry with `samples`. Credit the source in `samples/CREDITS.md`, and use only open licences (CC0 or CC-BY). Measure each file's real pitch: VCSL names some instruments an octave low. Levelling per note is automatic; set the gain by measurement.
- **Old presets must keep loading.** Settings are stored by name, and `normalizeSettings` fills in or falls back. The `waveform` field is read as `sound`, and removed sounds map to the closest kept (`REPLACED_SOUNDS` in `src/settings.js`).
- Comments and notes use plain English, as in the existing files.

## Running things in a cloud session

- **Unit tests:** `npm test` (Node 18+). About 105 tests, under a second.
- **Audio checks and clips** need Chrome. Here, Chromium is at `/opt/pw-browsers/chromium-*/chrome-linux*/chrome`, and as root it only starts with `--no-sandbox`, so point `CHROME` at a small wrapper script:

  ```sh
  printf '#!/bin/sh\nexec %s --no-sandbox "$@"\n' "$(ls /opt/pw-browsers/chromium-*/chrome-linux*/chrome | head -1)" > /tmp/chrome && chmod +x /tmp/chrome
  CHROME=/tmp/chrome npm run test:audio   # about 7 minutes; give it a 10-minute timeout
  CHROME=/tmp/chrome npm run clips -- --sounds triangle,harp
  ```

  Clips go to `clips/`, which git ignores. ffmpeg turns them into MP3.
- **Phone link:** the app is published as a private claude.ai artifact at https://claude.ai/artifact/YFhG1tRBj8vx5aNEXmtqXz. To update it from a new session, publish `index.html` with the `src/*.js` files, passing that URL as `url` (read the artifact first). GitHub Pages isn't enabled, and the owner would have to turn it on in the repo settings.

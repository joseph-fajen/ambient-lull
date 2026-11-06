# Build plan: v1

How to build the toy described in `baseline-prompt-v2.md`, in order, with a check at each step. The *why* behind the decisions is in `design-thinking.md`.

**Status (2026-11-05):** milestones 0–7 are built and on `main`, plus the extras in "After v1" at the end. Still to do: the listening sweep in milestone 7, and ticking the boxes.

**How to use this:** build one milestone at a time. After each one, stop. Run the tests, do the listening check, and tick the box before moving on. The risky parts (timing, start/stop) come early, so they're proven before the easy parts pile on top.

---

## Testing approach

Three layers. Each catches what the others can't.

### 1. Automated unit tests: the pure core

- **Tool:** Node's built-in test runner (`node --test`), with no dependencies to install. Run with `npm test`.
- **What it covers:** everything that makes decisions without making sound: scales, keys, note picking, tempo-to-length mapping, scheduler timing, start/stop states, settings and presets.
- **Write the tests first for the core.** These behaviors are already specified, so the tests are just the spec written as code.
- **Encode "it can't sound bad" as rules the tests check.** Don't stop at a few examples. Loop over **every key × every scale × many random seeds**, and check that every generated note:
  - stays inside the pitch range,
  - is in the scale,
  - moves at most 2 scale steps from the last note,
  - and has a duration within the allowed range.

  A few thousand generated notes per run makes the core promise something the tests enforce, not just a hope.

### 2. Automated audio checks: the sound itself

- **Tool:** a browser page, `tests/audio-checks.html`, that renders sound with `OfflineAudioContext`. This renders audio to numbers instead of the speakers, faster than real time, then shows pass/fail.
- **What it measures:**
  - **No clicks:** each note starts and ends at near-zero volume.
  - **No distortion:** the peak stays below 1.0 in the worst case, which is 120 BPM, sawtooth, brightest tone and many overlapping notes.
  - **Matched volume:** each waveform's average loudness is within about 2 dB of the others.
  - **Stop is clean:** the output is silent after the fade-out.
- This catches problems your ears might miss on laptop speakers, or that only show up in certain combinations.

### 3. Listening checklist: what numbers can't judge

Each milestone ends with "listen for" checks. The final milestone has a full **"can't sound bad" sweep**: try the extremes of every control, alone and combined.

### Seams that make this possible

The code takes these as inputs instead of reaching for them directly, so tests can substitute fakes:

- **The random number generator** gets a seed in tests, so results are repeatable. This also enables "replay that piece" later.
- **The current time** comes from a fake clock in tests, so scheduler tests run instantly.
- **Storage** gets a fake, including one that throws errors, to test what happens when browser storage fails.
- **The audio context** is a real one when playing and an offline one in audio checks.

### Deliberately not doing

These would be overkill at this size:

- coverage percentage targets
- a CI pipeline
- a browser-automation framework
- mocking the whole Web Audio API (the offline rendering is more honest)

---

## Suggested file structure

```
index.html
package.json            no dependencies; "type": "module", "test": "node --test"
README.md               how to run, how to test
src/
  music.js              pure: keys, scales, note-picking walk, tempo → note length
  settings.js           pure: defaults, validating and filling in settings
  scheduler.js          pure: which notes are due in the lookahead window; start/stop states
  audio.js              performer: Web Audio nodes, voices, filter, reverb, master volume
  presets.js            save/load the 4 slots (storage passed in)
  main.js               shell: UI wiring, timer loop, connects everything
tests/
  music.test.js
  settings.test.js
  scheduler.test.js
  presets.test.js
  audio-checks.html     OfflineAudioContext checks, opened in the browser
```

---

## Milestones

### 0. Skeleton
**Build:** the folders, `package.json`, an empty page, and a README with run instructions.
**Check:**
- [ ] `npm test` runs, even with no tests yet.
- [ ] `python3 -m http.server` serves the page, with no console errors.

### 1. Music core (pure, tests first)
**Build:** `music.js` and `settings.js`.
**Automated tests:**
- [ ] Every scale has the right intervals. Adding a scale is one line of data.
- [ ] All 12 keys stay centered near middle C (B isn't almost an octave higher than C).
- [ ] The rules sweep: every key × every scale × many seeds, checking range, in-scale, step size and duration.
- [ ] The same seed always gives the same notes.
- [ ] Tempo to note length: about 8 s at 20 BPM, about 2–3 s at 120 BPM, smooth in between. Values out of range get clamped.
- [ ] Settings: missing fields get defaults, unknown values (like a removed scale) fall back to defaults, and garbage input doesn't crash.

### 2. One note, end to end
**Build:** `audio.js`, with one voice, the envelope, the filter, reverb and master volume, plus a temporary "play one note" button. Also `tests/audio-checks.html`.
**Audio checks:**
- [ ] No click at the start or end of a note.
- [ ] The peak stays below 1.0.

**Listen for:** a smooth fade-in, a long fade-out, a spacious reverb tail, and no click.

### 3. Endless melody, Start and Stop (the risky part)
**Build:** `scheduler.js` (the lookahead window logic and the start/stop states) and the timer loop in `main.js`.
**Automated tests (fake clock):**
- [ ] Notes come exactly 60/BPM seconds apart, with no gaps or duplicates across windows.
- [ ] A tempo change affects the next note, not ones already scheduled.
- [ ] If the clock jumps ahead (for example, the browser tab slept), it skips forward instead of playing a burst of missed notes.
- [ ] State changes: stopped → playing → stopping → stopped. Start while playing does nothing. Start while stopping is handled cleanly, not as two engines at once.

**Audio check:**
- [ ] After Stop, the output is silent once the fade finishes.

**Listen for:**
- steady timing for several minutes
- a clean fade on Stop
- mashing Start/Stop never doubles the sound or leaves a stuck note
- switching tabs and back doesn't produce a burst of notes

### 4. Melody controls
**Build:** the key, scale and tempo controls, wired to the settings object.
**Automated tests:**
- [ ] Changing a setting mid-run changes the next note the composer picks.

**Listen for:** each change is heard within a note or two. A key change mid-play sounds like a modulation, not a mess.

### 4b. Root drone (added mid-build)
**Build:** a sustained drone on the key's root, below the melody, with an on/off toggle (default on). Soft bass/tamboura-like sound: a sine body plus two slightly detuned, low-passed sawtooths whose filter drifts slowly. It ignores the waveform and tone settings. Key changes crossfade the drone on the next melody note; Stop fades it with everything else.
**Automated tests:**
- [ ] The drone pitch sits below the melody range in every key, in the same register for all keys.
- [ ] Settings: `drone` is a true/false value; anything else falls back to the default (on).

**Audio checks:**
- [ ] No click when the drone starts; silent after it's released.
- [ ] The peak stays below 1.0 with the drone playing under the worst-case melody.
- [ ] The drone is quieter than the melody (at its default volume).

**Listen for:** a soft bass bed under the melody (at its default volume). Key changes glide between roots with no click. Toggling the drone fades it in or out on the next note.

### 5. Sound controls
**Build:** the waveform picker (mood name plus technical name), volume matching for each waveform, and the tone slider with its limited range.
**Audio checks:**
- [ ] The 4 waveforms are within about 2 dB of each other.
- [ ] No distortion with sawtooth at the brightest tone at 120 BPM.

**Listen for:** no loudness jump when switching waveforms. Sawtooth at the brightest tone is still pleasant, not harsh.

### 6. Presets
**Build:** `presets.js` and the 4 named slots, with save, load and the overwrite confirmation.
**Automated tests (fake storage):**
- [ ] Saving then loading gives back the same settings.
- [ ] Values are stored by name, not list position.
- [ ] A missing field gets its default.
- [ ] Damaged data or an unknown scale falls back to defaults.
- [ ] Storage that throws errors doesn't break the app; presets just aren't saved.
- [ ] An empty name gets a default ("Preset 2"). Long names are trimmed.
- [ ] Overwrite needs confirmation only when the slot is already filled.

**Listen and click for:**
- loading while playing shifts the music on the next note
- presets survive a page reload
- the confirm dialog appears only when overwriting

### 7. Final pass
- [ ] All automated tests and audio checks pass.
- [ ] **The "can't sound bad" sweep:** for each waveform, try the slowest and fastest tempo, the darkest and brightest tone, and every scale, including a key change mid-play. Nothing sounds harsh, muddy, clipped or broken.
- [ ] Defaults: a fresh page plus one press of Start sounds good, with no tweaking.
- [ ] Remove the temporary "play one note" button.
- [ ] Update the README.

---

## After v1

Features and fixes added after milestone 7, each built and tested the same way. All are on `main`.

### Drone volume
- A slider next to the Drone toggle (`droneVolume`, 0–1, default 0.33, saved in presets). It applies immediately with a short glide, since it's a mix level rather than a note property.
- At full volume the drone is about 10 dB louder than the melody, at the user's request. Its first maximum was level with the melody.
- To keep the peak below 1.0, the overall output came down about 3.7 dB (`MASTER_LEVEL` 0.65 in `src/audio.js`). The default position keeps the default drone level unchanged, at about 9 dB under the melody.
- Audio checks: about 10 dB louder than the melody at full volume; peak below 1.0 with the drone at full volume.

### Cycle keys
- A toggle (`autoKey`, default off) that moves the key up a fifth round the circle (C, G, D … F, C) while playing, on the audio clock.
- A slider sets how often (`keyCycleSeconds`, 10–120 s, default 30). Both are saved in presets.
- Each change lands on the next note, like a manual key change, and crossfades the drone.
- A manual key change, switching it on, or loading a preset restarts the countdown. Changing the interval keeps the time already waited.
- Each change restarts the countdown, so every key gets a full period, even after a clock jump (one change, not a burst).
- Tests: the circle visits all 12 keys and returns home; the countdown timing, resets, interval changes and clock jumps, all with a fake clock.

### Fix: pop at key changes
- After the drone volume slider had been moved, a key change dropped the old drone to silence in under 2 ms. `cancelAndHoldAtTime` miscalculated the held value after a volume glide.
- The drone now has separate gain stages for its fade and its volume. The fade's starting point is worked out directly instead of read back from the browser.
- Audio check: no pop when the drone changes key, both after slider moves and mid fade-in. It fails on the old code.

### Listening checks for these
- [ ] Drone slider: smooth glide, no zipper noise. At Loud, the drone takes over without harshness or distortion.
- [ ] Cycle keys at 10 s with the drone turned up: each key change glides, with no pop.
- [ ] Biggest register shifts: F to C and F♯ to D♭ (up to 7 semitones). Smooth, not jarring.

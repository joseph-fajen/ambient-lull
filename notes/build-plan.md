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

- **Tool:** a browser page, `tests/audio-checks.html`, that renders sound with `OfflineAudioContext`. This renders audio to numbers instead of the speakers, faster than real time, then shows pass/fail. `npm run test:audio` runs it in headless Chrome and prints the results (added after v1).
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

### Harmony
- A slider (`harmony`, 0–1, default 0.33, saved in presets). The chance that a note gets a harmony note is half the setting: about 1 in 6 at the default, every other note at full.
- The harmony note is in the scale, a minor or major 3rd, a 4th or a 5th from the melody note. It goes above when there's room in the melody range, otherwise the same distance below, so it never leaves the range. Every note of every key × scale has at least one choice.
- It starts with the melody note. It always rings as long as a 4-beat note (see Note length variety below), at the user's request, so it sustains under the melody's rhythm instead of following it.
- It's played at 0.5 of the melody's level (`HARMONY_LEVEL` in `src/audio.js`, about 6 dB under the melody). First measured at 0.6, 0.8 and 1.0 with harmony notes as long as the melody note; 0.6 was chosen. Once harmony rang long, 0.6 made the music too loud (+1.2 dB at the default), so it came down to 0.5.
- Harmony draws its own random numbers, so moving the slider adds or removes harmony notes without changing the melody line.
- Tests: the sweep above; the share of notes with harmony at 0, the default and full; old presets load with the default.
- Audio checks: harmony makes the music +0.9 dB louder at the default and +1.2 dB at full (limits 1 and 1.5 dB). For the peak, see below.

### Note length variety (Rhythm)
- A slider labelled Rhythm, Steady to Varied (`variety`, 0–1, default 0.5, saved in presets; old presets load with 0.5). At 0 it's the old sound exactly: one note per beat, each ringing `noteLength(tempo)`.
- Each note varies from 1 beat with chance `variety`. A varied note is half a beat, 2, 3 or 4 beats, picked from `NOTE_LENGTHS` in `src/music.js` (weights 0.3, 0.35, 0.15, 0.2). Half-beat notes always come in pairs, so the melody lands back on the beat. At the default about 40% of notes are 1 beat.
- Tempo still sets the pulse: at 40 BPM quick notes are 0.75 s apart and held ones up to 6 s.
- Ring length goes with the gap: `noteLength(tempo)` × 0.6 for half a beat, up to × 1.7 for 4 beats.
- The rhythm draws its own random numbers, so the slider doesn't change the melody line or the harmony.
- The scheduler's `due()` now hands out note times one at a time (a generator), so the gap to the next note can depend on the note just composed.
- Tests: the length table; Steady is the old sound; a sweep of allowed lengths, ring, pairs and staying on the beat; the shares at the default and full; live changes; separate random numbers; the scheduler reading each gap after the note before.
- Audio checks: varied rhythm has fewer notes on average, so it's about 1.7 dB quieter at the default and up to 2.5 dB at full (limit 3 dB). Left as it is: sparser music being a little quieter sounds natural. The drone check now measures against the real default melody: the drone is about 9 dB under it, and about 10.3 dB over it at full.

### Peak headroom, re-measured
- Peaks vary a lot from one random run to the next. Over 48 runs, harmony at full took the worst case to 0.916 (0.810 without harmony), closer to 1.0 than the old 2-seed check had shown.
- The overall output came down 0.7 dB (`MASTER_LEVEL` 0.65 → 0.6). The peak check now covers 72 runs, including varied rhythm, with a limit of 0.9 to leave room for unluckier runs. Worst now: 0.836.

### Listening checks for these
- [ ] Drone slider: smooth glide, no zipper noise. At Loud, the drone takes over without harshness or distortion.
- [ ] Cycle keys at 10 s with the drone turned up: each key change glides, with no pop.
- [ ] Biggest register shifts: F to C and F♯ to D♭ (up to 7 semitones). Smooth, not jarring.
- [ ] Harmony at default: occasional, gentle two-note moments; the melody still leads.
- [ ] Harmony at Often, in Japanese In and Lydian: consonant every time, never muddy. Try the lowest key (F♯) with Dark tone too.
- [ ] Rhythm at default and at Varied: runs of quick notes and long held ones that feel like phrasing, not stumbling. Steady sounds as before.
- [ ] Rhythm at Varied, 20 BPM: 4-beat notes leave 12 s gaps. Spacious, not empty?
- [ ] Rhythm at Varied, 120 BPM: quick pairs 0.25 s apart, with the soft 0.4 s fade-in. Still distinct notes, not a smear?
- [ ] Harmony at Often with Rhythm at Varied: the long harmony notes sustain under quick runs without getting muddy.

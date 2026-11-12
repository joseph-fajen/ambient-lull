# Engineering: what code in this project is judged against

This is a steering document, not a rules file. `CLAUDE.md` loads on every task and stays short. This file
loads only when code is **written or judged**: the implement, review and fix skills read it. `CLAUDE.md`
holds the steps (how to add a sound, how to test); this file holds the judgment behind them.

## How this document works

- The owner writes it. Agents may propose entries from real runs; adding one is the owner's edit, in a
  reviewed PR. A reviewer that rewrites its own criteria is drifting, not calibrating.
- Anything here that becomes machine-checkable moves into a test or an audio check, and then leaves this
  file. The audio checks already own the numbers: volume matching, evenness, peak limit and clicks.
- Entries can be checked against the code. A drifted entry is deleted, not annotated.
- Facts that change (counts, paths, lists of sounds) don't belong here. Point at the source that owns them.
- Every rule earned its place through a real problem or a decision. The story stays in git history and
  `docs/`; this file keeps the rule.

## The objective function

It can't sound bad, first. Correct, second. Speed last.

A change that passes the tests but makes some setting combination sound worse has failed. Spend more review
on changes the listener hears, and on changes to saved data, than on changes that can't reach either.

## Taste

- **Toy, not a settings form.** A new control has to earn its place, and should keep the control count the
  same or lower. Prefer a good fixed value to a slider.
- **Limit ranges to what sounds good.** A slider's ends, a register or a level is clamped so every position
  is pleasant. The defaults sound good on the first Start with no tweaking.
- **The composer stays pure.** `src/music.js`, `src/scheduler.js` and `src/settings.js` never touch Web
  Audio, the DOM or a real clock; randomness and time are passed in. Anything that can't be tested in Node
  without a browser is in the wrong module.
- **Data, not branches.** Keys, scales and sounds are table entries (`SCALES`, `SOUNDS`, `SOUND_RECIPES`,
  `SAMPLE_SETS`). Adding one is a new entry, not a new `if`.
- **Measure, don't guess.** A gain, level or correction is set from a measurement, and the measurement
  method matches how the note is heard (with its envelope, at the played speed). Average loudness is not
  enough: check evenness from the lowest note to the highest, and the worst-case peak.
- **No dependencies, no build step.** Plain JavaScript modules on the Web Audio API, served as files. A
  library or bundler is a direction call (`direction.md §no-build-step`), not a ticket.
- **Saved data fails soft.** Settings and presets are read through `normalizeSettings`, which fills in
  missing fields, clamps ranges and maps removed values to the closest kept one. Bad data or missing browser
  storage falls back to defaults; it never throws or stops the music.
- **Recordings degrade gracefully.** Until a sample set loads, its sound plays as its synthesized stand-in.
  A failed load is a warning, not an error.
- **The smallest truthful change.** Every guard and fallback protects a named failure. Before adding
  machinery, look for machinery to delete.
- **Fix drift on the path you touch.** When a change shows two places that should agree and don't (a range
  in the code and in the checks, a comment and the value it describes), correct both.
- **Comments and notes use plain English** and explain why. Code that needs narration is usually too
  complex, and the finding is simplification.

## Risk taxonomy

What raises the stakes of a change, and so the depth of its review:

- **Output level:** master level, gains, reverb mix, drone and harmony levels. Too loud can hurt ears or
  speakers, and a jump between sounds is jarring. Needs `npm run test:audio` and a measurement, never a
  guess.
- **Timing and envelopes:** the scheduler, note start and stop, fades and Stop. Mistakes are heard as clicks,
  gaps, stuck notes or tails that never end.
- **Saved data:** setting names, the preset format and the `ambient-toy.presets` key. Old presets must keep
  loading; change it only by adding or by mapping old values.
- **Recorded samples:** licences (CC0 or CC-BY only, credited in `samples/CREDITS.md`) and each file's
  real pitch.
- **The sound itself:** anything a listener hears. Only the owner can judge it, by ear, from listening clips.

A change in these areas gets adversarial review: an explicit attempt to break it, varied settings (every
sound, low and high Tone, slow and fast tempo, drone and harmony at full), and a stated answer to "what would
make this merge wrong." A notes-only change gets the minimum.

## Review posture

- "Could not tell" is a verdict. A change to the sound that hasn't been heard goes to the owner, never a
  silent pass.
- A failed or skipped check defaults to not ready. Skipping `npm run test:audio` after a change to
  `src/audio.js` or `src/samples.js` is a finding.
- Findings carry their source: the rule they break, and `file:line`.
- Review anchors on the original request. The PR body is a set of claims to check, not the scope.
- A test proves a decision by varying the input it turns on. A test that stubs the deciding function proves
  nothing.

# Brainstorm: refinements, sounds, UI and mobile

Started 2026-11-06, after v1 and the "After v1" extras were built (see `build-plan.md`). Decisions go in **Decided**; everything else is still open.

## Guiding principle

"Toy, not a settings form" (`design-thinking.md` §1). The page has grown from 7 controls to about 14. Every refinement should keep the control count the same or lower it, unless the new control earns its place.

## 1. Simplify existing controls

### Width: remove the control

- **Decided (2026-11-12): moved into the forest work; see section 9.**
- **Decided (direction):** always rich and wide; no Mono option.
- **Open:** fixed at which width? Today's default is 0.5 (places within ±0.4); Wide is 1.0 (±0.8). Pick by ear on headphones, maybe somewhere between.
- **Note:** the peak check already runs at full width, so any fixed value is covered. Old presets with a `width` value just ignore it.

### Harmony: present most of the time

- **Decided (2026-11-06): parked.** No changes to Harmony for now. The notes below are kept for later.
- **Wanted:** harmony about 75% of the time.
- **Catch:** today the slider tops out at harmony on **every other note** (`HARMONY_CHANCE_MAX` = 0.5 in `src/music.js`), so 75% of notes isn't reachable yet.
- **Open:** "75% of the time" can mean two different things:
  - 75% of melody notes start a harmony note, or
  - a harmony note is *sounding* 75% of the time. Harmony notes ring as long as a 4-beat note, so they overlap several melody notes. Even today's default (1 in 6 notes) leaves a harmony note ringing a large share of the time. This may need much less than 75% of notes.
- **To measure:** the share of time a harmony note is sounding, at a few settings. Then choose by ear.
- **Watch:** loudness and peak. Harmony at full adds +1.1 dB today; more harmony means re-checking the audio limits, and maybe lowering `HARMONY_LEVEL`.
- **Open:** keep the slider (with a new top and default) or remove it and fix the amount? Does Drift stay?

### Tempo: narrow to 20–60 BPM

- **Decided (2026-11-12): parked for now; see section 9.**
- **Decided (direction):** range 20–60 BPM. The default (40) stays inside.
- **Catch:** note length is scaled across the tempo range (`noteLength()` in `src/music.js`). Just changing `TEMPO_MAX` to 60 would quietly shorten notes at 60 BPM from about 5 s to about 2.5 s. Keep the old curve (about 8 s at 20 BPM, about 5 s at 60) by fixing the curve's end points separately from the slider's range.
- Old presets above 60 BPM get clamped to 60 (settings validation already does this).

## 2. Chord progressions

- **Decided (2026-11-12): parked for now; see section 9.**
- **Wanted:** enter a custom chord progression, used instead of (or alongside) Cycle keys. Keep Cycle keys.
- **Insight:** these work at two levels. Cycle keys changes the *key* (home note). A progression moves between chords *within* a key. If the progression is written relative to the key, as scale degrees (I – vi – IV – V), not letter names (C – Am – F – G), then both work together: Cycle keys carries the whole progression into each new key.
- **What a chord would change:**
  - the melody walk leans towards chord notes (especially on longer notes)
  - harmony notes pick chord notes
  - the drone follows the chord's root, or stays on the key's root (to decide)
- **Catch, "it can't sound bad":** chords depend on the scale. Major pentatonic (C D E G A) has no F, so a IV chord (F A C) can't be fully built from it. Options: only offer chords the current scale contains, or let chord notes step outside the scale.
- **Open:**
  - how long each chord lasts: beats, bars, or seconds (like Cycle keys)?
  - how you enter it: typed text ("I vi IV V"), picked from a list of known progressions, or both?
  - saved in presets?

## 3. More distinct sounds

- **Problem:** in a blind test, a listener couldn't tell Soft, Warm, Hollow and Bright apart.
- **Insight, why:** the four waveforms differ only in their upper harmonics. The Tone filter (limited so nothing gets harsh) removes most of those, and volume matching removes the loudness difference. What's left is similar, by design. Sounds that people *can* tell apart differ mostly over time: how the note starts (attack), how it decays, and how its tone moves while it rings.
- **Ambient-friendly sound families to explore:**
  - **Pad:** several slightly detuned oscillators, slow swell, gentle movement (the drone already does a version of this)
  - **Bell or glass:** FM synthesis; a bright start that mellows (vibraphone, glass, kalimba-like)
  - **Plucked string:** Karplus-Strong; a soft pluck that fades (harp-like)
  - **Breath or flute:** a sine plus a little filtered noise
  - **Choir-like:** filters shaped like vowel sounds ("ooh", "aah")
- **Structure:** `design-thinking.md` §6.4 already planned for this: the note-player takes the sound settings as input, so a new "voice" can plug in. Each sound becomes a recipe: synthesis method, envelope, filter.
- **Acceptance test:** someone who isn't a musician can tell every sound apart without looking. The audio checks keep the rest honest: volume-matched, no clicks, peak below the limit.
- **Decided (2026-11-06):** keep all four current sounds, and explore about **8 new ones** with clearly different character. 12 in total.

### Candidate 8: two groups of four

Picked to spread across the things a listener hears first: how a note starts, whether it fades or holds, and how it moves while ringing.

**Struck and plucked:** a clear start, then a natural fade.

| Name (idea) | Like | How it's made |
| --- | --- | --- |
| Glass | glass bell | FM synthesis with a non-whole-number ratio: shimmering, bell-like overtones that mellow as it fades |
| Kalimba | thumb piano | FM, short and woody |
| Harp | plucked string | Karplus-Strong: a burst of noise through a short tuned delay, which becomes a plucked tone |
| Tine | electric piano | FM, a soft bell-like "tine" over a warm body |

**Sustained:** a slow swell, held, with movement.

| Name (idea) | Like | How it's made |
| --- | --- | --- |
| Pad | synth pad | several detuned oscillators with a slow swell (a cousin of the drone) |
| Strings | bowed strings | detuned sawtooths, slow bow-like attack, gentle vibrato |
| Choir | "ooh" voices | a buzzy source through vowel-shaped filters |
| Breath | flute | a sine plus a little filtered noise, slight vibrato |

- **Keeping the lull:** struck sounds start faster than today's 0.4 s fade-in. Give them a soft start (still no click) and keep the long reverb, so they stay gentle.
- **Tone slider:** each recipe decides what Tone means for it (the filter for most; brightness of the FM overtones for the bells).

### Progress

- **2026-11-06:** step 1 done (sounds table, output unchanged). The struck group is built: Glass, Kalimba, Harp and Tine, volume-matched by measurement. `npm run clips` renders listening clips (`--blind` for a blind test).
- Harp plays up to about 1 dB quieter as Tone brightens: a brighter pluck is spikier, and it took the loudest mix to 0.914.
- The overall output came down about 0.5 dB (`MASTER_LEVEL` 0.57 → 0.54), so the struck sounds keep room under the peak limit (worst was 0.895, Kalimba).
- The sustained group is built: Pad, Strings, Choir and Breath. All 12 sounds are in the app.
- **Found while tuning:** a sound can match on average yet be uneven from note to note. Choir's first draft used narrow vowel filters, which made notes near a filter up to 7 dB louder and others 10 dB quieter. Broader filters plus a small per-note correction fixed it, and Harp's notes are now levelled by their early loudness. A new audio check holds every sound within 3 dB from its lowest note to its highest.
- At the app's defaults (with reverb), Pad, Strings and Choir come out 1.4–1.6 dB louder than Warm. That's within the 2 dB matching tolerance, so it's left as is.

- **2026-11-09: recorded samples.** Idea: the synthesized sounds the owner likes best (Kalimba, Pad) are the ones synthesis does naturally; acoustic instruments are where synthesis falls short and recordings win. Prototype: **Piano**, from the Salamander Grand Piano (CC-BY 3.0, credited in `samples/CREDITS.md`). 13 MP3 notes, every 3 semitones, under 1 MB; each note plays the nearest one, retuned by at most 1.5 semitones. They load in the background; until then Piano plays as Warm. Mixed to mono, with the usual soft strike. Volume-matched, even within 2.1 dB, and a little quieter at bright Tone for peak headroom. No library needed.
- **2026-11-09: the owner likes the piano** ("very nice"). Samples work for this app.
- **Open:** which instruments next (harp, strings, vibraphone, felt piano)? Should sampled ones replace the weaker synthesized ones? Keep the recording's stereo, and a crisper strike?

- **2026-11-09: three more recorded sounds, for listening.** Searched for open licences. No openly licensed felt piano exists that we found (the free ones, like Spitfire LABS Soft Piano, Jon Meyer's Kawai Felt Piano or Pianobook packs, don't allow redistribution or state no licence). Built from VCSL (CC0): **Soft piano** (a Knight upright played softly, with a darker Tone and a gentler strike, as a felt-piano stand-in), **Concert harp**, and **Vibes** (vibraphone, soft mallets). Strings left out for now (owner's choice; they'd also need looping).
- **Found while tuning:** a recording's loudness has to be measured the way it will be heard. Levelling each note by its plain loudness left the vibraphone 5.7 dB uneven (its lowest bar fades fastest) and the harp 3.2 dB (its A4 has a sharp pluck that the soft strike rounds off). Weighting by the note's own shape (strike rise, then fade, at the played speed) brought every recorded sound within 1.3 dB, and the piano from 2.1 to 0.3 dB.
- **Decided (2026-11-09): six sounds.** Keep Piano, Upright (was "Soft piano"; shorter for the picker), Harp (the recorded concert harp, which takes the name), Vibes, Kalimba and Pad. Removed: Soft, Warm, Hollow, Bright, Glass, Tine, the synthesized Harp, Strings, Choir and Breath. Old presets load the closest kept sound (waveforms, Strings, Choir, Breath → Pad; Glass, Tine → Vibes). Default is now Piano (was Warm); recorded sounds play as Kalimba until loaded. The picker is 3 across.

### How to build it

1. **Refactor first, no sound change.** Make each sound an entry in a `SOUNDS` table (label, smaller technical name, recipe). The current four share one recipe. The audio checks should prove the output is identical, as with stereo's Mono check.
2. **Prototype the new recipes,** one group at a time.
3. **Listen:** render a short clip of each sound (the same seeded melody for all) to audio files. They can be played on a phone, and used for a blind test.
4. **Keep the checks:** extend the volume-matching, no-click and peak checks to every sound.

- **Settings:** presets store `waveform: "sine"` today. Either keep the field name for old presets, or rename it to `sound` and accept old values.
- **UI note:** 12 sounds won't fit the current row of buttons. Group them (Classic / Struck / Sustained) when we get to the UI.
- **Decided (2026-11-06):** the 8 candidates, as listed. **Done:** all 8 are built, and the owner approved how they sound.

## 4. A more beautiful UI

- **Decided (2026-11-12): parked for now; see section 9.**
- Wait until the control set settles (sections 1–3), so we design for the final controls.
- **Open:** look and feel references, and whether visuals (something moving with the music) are part of it.

## 5. Mobile: link, web app, or phone app

- **Decided (2026-11-06): back burner.** Not urgent. The notes below are kept for later.
- **Decided (2026-11-12): the web page only, for now.** Consider a mobile app only after the refinements (sections 1–2) and the UI (section 4) settle.

The options, cheapest first:

1. **A link.** Host it (for example on GitHub Pages) and it plays in a phone browser. No app store.
2. **An installable web app (PWA).** The same site, plus a small manifest and offline support. It gets a home-screen icon and opens full screen, like an app.
3. **A native app wrapper** (for example Capacitor). The same code inside an app, in the App Store and Google Play.

- **The deciding question: does it need to keep playing with the screen locked?** For a backdrop or sleep sound, probably yes. That is where browsers struggle:
  - Mobile browsers pause or throttle pages in the background. The scheduler's timer, which queues notes ahead, gets slowed down or stopped, so the music stops or stutters.
  - On iPhone, Web Audio can be silenced by the ring/silent switch.
  - A native app can ask the system for background audio, which solves both. This is the main reason to go native.
- **Suggested path:** host it first and try it on phones (cheap, and it shows the real problems). Add the PWA next. Go native only if background playback is needed and the web can't do it well enough.
- **Open:** how will you mostly use it on a phone: screen on and in front of you, or locked in a pocket or on the nightstand?

## 6. Cycle sounds & scales

- **Wanted (2026-11-09):** every 2 minutes the sound moves to the next one (Piano → Upright → Harp → Vibes → Kalimba → Pad → Piano …). After all 6 sounds have played, the Scale moves to the next one and stays for the next 6 sounds. A cycle within a cycle, running until Stop.
- **Length:** 7 scales × 6 sounds × 2 min. Each scale lasts 12 minutes, and the whole trip takes 84 minutes before it repeats.
- **Decided (2026-11-09):**
  - **One checkbox**, "Cycle sounds & scales", fixed at 2 minutes per sound. No slider ("toy, not a settings form").
  - **Switch at the next note.** The engine already reads the sound before each note, so ringing notes fade out in the old sound with their reverb tail. No crossfade unless it sounds abrupt by ear (listen closely to the changes to and from Pad).
  - **The scale changes on the 6th sound change**, on the same note as the sound change: a new chapter. Counting changes, not "back to Piano", means it starts from whatever sound and scale are picked.
  - **Picking a sound by hand** switches straight away and restarts the 2-minute countdown (like Cycle keys). The count towards the next scale carries on.
  - **Picking a scale by hand** takes effect, and the cycle carries on from it.
  - **Cycle keys stays independent.** Both can be on at once.
  - **Order** follows the `SOUNDS` and `SCALES` tables, wrapping round.
  - **The sound buttons and Scale menu update on screen** as they change, as the Key menu does.
  - **Saved in presets** (on/off).
  - **Load the recordings ahead of time**, so a recorded sound doesn't play as its Kalimba stand-in the first time it comes up. For example, load the next sound when cycling is switched on and after each change.
  - **Testing:** unit tests for the counting. A temporary fast mode (`?fast`, 10 s per sound) for listening in the browser, **removed before finishing**.

### Progress

- **2026-11-09: step 1 done (logic and tests, nothing visible yet).** `nextInSoundCycle()` and `SOUND_CYCLE_SECONDS` in `src/settings.js`, and an `autoSound` setting (off by default, saved in presets; old presets load with it off). The 2-minute timer will reuse `createKeyCycle()` from `src/scheduler.js`, which is a plain countdown. Next: step 2, wiring it into the app with `?fast` for listening.
- **2026-11-09: step 2 done (in the app, waiting to be heard).** A "Cycle sounds" checkbox under the sound picker ("…and scales"). While playing, the sound moves on every 2 minutes and the scale with every 6th change; the picker and Scale menu follow. The next recorded sound loads one turn ahead. Start, switching it on and loading a preset start a fresh round; picking a sound by hand restarts the 2 minutes and keeps the count. Checked in headless Chrome with `?fast` (10 s per sound): all six in order, the scale changed with the return to Piano, and a hand-picked sound got its full turn. Still temporary: `?fast` in `src/main.js`.
- **2026-11-09: the owner listened and it works fine.** The switch at the next note is smooth enough: no crossfade needed.
- **2026-11-09: step 3 done. Cycle sounds & scales is finished.** `?fast` removed. 104 unit tests and all 17 audio checks pass. README updated (Controls table, tests, layout).

## 7. Follow-ups (minor)

- **Open (found 2026-11-09): the melody range in the checks is one semitone off.** `notePool()` in `src/music.js` reaches MIDI 43–78 (G2 in the key of G up to F♯5 in the key of F♯), but `tests/audio-checks.html` (the evenness check, lines 79 and 340), its report text, and the comment above `SAMPLE_SETS` in `src/samples.js` say 42–77. So F♯5 is never checked for evenness. Fix: test 43–78 (or work it out from `notePool()` across all keys), update the comment, and re-run `npm run test:audio`. Every recorded set already has a note within 1 semitone of MIDI 78 (Piano F♯5; Harp G5; Upright and Vibes F5).

## 8. Way of working (v2 agentic coding course)

The project started as a baseline of how the owner worked before the course (tagged `baseline-v1`). The aim is to adopt the v2 course practices fully, with the course AI layer fitted to Ambient Lull on the `ai-layer` branch.

- **Decided (2026-11-11):**
  - **Every change goes through a pull request**, notes included: a branch, `piv-create-pr`, an agent review with `piv-review-pr`, then the owner merges. Nothing is pushed straight to `main` any more.
  - **Commit messages use the v2 default:** a tagged subject (`feat`, `fix`, `docs`, `refactor`, `test` or `chore`, with an optional area, such as `docs(brainstorm): …`), imperative, 72 characters at most. The body has a `What changed:` part, and an `AI layer changes:` part whenever CLAUDE.md or `.claude/` changed.
  - **No AI credit** in commits or pull requests: no "Co-Authored-By: Claude", no "Generated with Claude Code". A Claude Code setting turns it off.
  - **The pull-request rule is enforced, not just written.** It lives in CLAUDE.md only, so it can't drift between two files. A GitHub ruleset on `main` requires a pull request, with 0 approvals because the owner works alone and GitHub won't let anyone approve their own PR. It refuses direct pushes from anyone: the owner, the agent, Archon or a script. `.claude/settings.json` also blocks the agent from running `gh pr merge`, because GitHub can't tell the agent's merge from the owner's.
- **Decided (2026-11-12): no codebase-search server.** The course layer came with an MCP server for structured code search (`where_is`, `find_references`, `outline`), run through `uv`. It worked on plain JavaScript, but it gave the same answers as `grep`: `normalizeSettings` had 1 definition and 56 uses either way. The course says it pays off on large codebases, and Ambient Lull is about 1,200 lines in seven source files. Its reference file described the AI Tutor (pyright, a TypeScript language server, check scripts this repo doesn't have). Removed `.mcp.json`, `tooling/mcp/codebase_search.py` and `.claude/references/codebase-search-and-lsp.md`; bring them back from git or the starter pack if the code grows past what `grep` handles well.
- **Decided (2026-11-12): one hook, a stop gate on `npm test`.** `.claude/hooks/stop-gate.sh` runs `npm test` when the agent tries to finish with changed files, and blocks the stop until it passes. It blocks twice in a session, then lets the 3rd stop through. It runs on any changed files, notes-only changes included, because `npm test` takes under a second (the owner's call). It enforces CLAUDE.md's "done means `npm test` passes". The audio checks stay out (5 to 7 minutes); `piv-validate` covers them. The other course hooks were written for the AI Tutor (`uv`, ruff, mypy, `app/backend`) and are deleted: `pre_tool_use.py` (no secrets here, and it blocked any command mentioning `process.env`), `post_tool_use.py` (a log nobody read), `subagent_start_engineering.py` (the `code-reviewer` agent already reads `engineering.md`, which closes the open item from the PR #5 review), `format-touched.sh` (no formatter, `direction.md §no-build-step`), `baton.sh` (no issue files), `automation-hooks.settings.json` and `settings.json.example`. Templates for the automation hooks stay in `.claude/skills/compose-hook-workflow/references/`.
- **Decided (2026-11-12): no `.agents/` folder.** It came in with the copied course layer: older slash commands (prime, plan-feature, execute, commit, validate, code-review and more) that duplicate the `piv-*` skills, reference material for other projects (an Obsidian Copilot setup, a sample PRD, vertical-slice patterns for Python apps) and four long course articles. Nothing used it, and the commands could compete with the fitted skills. Deleted before merging `ai-layer` into `main`; the articles are in the starter pack and in git history.
- **Decided (2026-11-12): working documents live in `docs/`.** `notes/` became `docs/`, and the forest epic moved there from the repo root. `README.md` and `CLAUDE.md` stay at the root, `samples/CREDITS.md` beside the samples. The course skills already default to `docs/`: epics as `docs/<slug>.prd.md` (`plan-create-prd`), local tickets as `docs/tickets/<epic-slug>.md` (`piv-slice-epic`) and issue investigations in `docs/issues/` (`piv-investigate-issue`). An epic's architecture doc sits beside it as its twin, `docs/<slug>.architecture.md`. Implementation plans and reports stay in `.claude/plans/` and `.claude/reports/`, where `piv-plan-implementation` and `piv-implement` put them. The old prompts (`baseline-prompt.md`, `baseline-prompt-v2.md`, `kickoff-prompt.md`) keep their `notes/` paths as written, for the record.
- **Open (2026-11-11): fit the Archon workflows when the course reaches Archon.** The three in `.archon/workflows/` already use branches and pull requests, but they hard-code commit messages (such as `feat: lane 1 — …`) without the area or the body parts, and read only CLAUDE.md, not `conventions.md`. Probably covered by the no-credit setting, since they run Claude in the repo; not yet confirmed. The ruleset protects `main` from them meanwhile.

### Progress

- **2026-11-11:** `baseline-v1` tagged. The course layer is committed as copied on `ai-layer`, and the parts written for the AI Tutor are removed. Next: fit `conventions.md`, CLAUDE.md and the settings to these decisions, then adapt `engineering.md`, `direction.md`, `piv-validate` and the `code-reviewer` agent.
- **2026-11-12:** `conventions.md`, CLAUDE.md and the settings fitted (PR #1); review reports kept out of git (PR #2). `engineering.md` and `direction.md` drafted for Ambient Lull, waiting for the owner's edits. Next: the `code-reviewer` agent, then `piv-validate`, then the codebase-search note.
- **2026-11-12:** PR #3 merged; its after-merge review led to four follow-ups. CLAUDE.md now asks for `npm run test:audio` after changes to `src/samples.js` too. `direction.md` drops "each play is new" (no exact replay and no recording to audio: not wanted, `design-thinking.md` §7), says "for now" on the web page, and merges the two no-dependencies clauses.
- **2026-11-12:** the `code-reviewer` agent retuned for Ambient Lull with `meta-agent`: it reads `engineering.md`, `conventions.md`, CLAUDE.md and `direction.md`, and routes findings into the five buckets. Tested on planted bugs (old presets, the master level, randomness in the composer, a README control): the first run filed a preset revert under AGENT FIXES and left the unrun audio checks without a severity. Both fixed in the agent file, and the reruns pass. Next: `piv-validate`, then the codebase-search note.
- **2026-11-12:** PR #5 (the `code-reviewer` retune) merged into `ai-layer`. `piv-validate` fitted with `skills-create`: it always runs `npm test`, and runs `npm run test:audio` only when `src/audio.js` or `src/samples.js` changed since the base branch (uncommitted files count). Audio checks that are required but can't run (no Chrome, Node older than 22) count as a FAIL. No type check, lint or build (`direction.md §no-build-step`). Tested on a scratch branch: a clean tree passed with the audio checks skipped, a broken test failed by name, and a touched `src/audio.js` ran the audio checks (17 passed, 223 s). The PR #6 review led to three small fixes (both `npm test` summary formats, the base branch named in the report, how a bad `CHROME` path falls through). The audio checks keep a 10-minute cap, the owner's call. Next: the codebase-search note.
- **2026-11-12:** PR #6 (`piv-validate`) merged into `ai-layer`. The codebase-search server tried and removed (see Decided). Next: fit `piv-review-pr` and `piv-review-changes`, then wire or delete the unused hook.
- **2026-11-12:** PR #7 (the codebase-search removal) merged into `ai-layer`. `piv-review-pr` and `piv-review-changes` fitted with `skills-create`: both read `engineering.md`, `conventions.md` (`## review`), CLAUDE.md and `direction.md`, validate with `piv-validate` and hand the review to the `code-reviewer` agent, using its five buckets. `piv-review-pr` posts with `gh pr comment` only, because GitHub refuses approve and request-changes on the owner's own PRs. Its severity table drops "type safety": Critical is harm to the listener or saved data (too loud, presets that fail to load, music that stops), and High covers logic errors, guessed gains and audio checks not run. Tested on a scratch branch with two planted bugs, a dropped `waveform` fallback and `Math.random` in `beatInterval`: `piv-validate` failed on 3 preset tests, the agent found both, and it routed the preset revert to HUMAN DECIDES. It rated the composer bug Critical; the owner kept the table, so that is High (correct, not heard). Next: review all of `.claude/hooks/`.
- **2026-11-12:** PR #8 (`piv-review-pr` and `piv-review-changes`) merged into `ai-layer`. All of `.claude/hooks/` reviewed: the stop gate fitted with `hooks-create` and wired, the rest deleted (see Decided). Tested on a scratch branch: with a planted failing test, a real `claude -p` session was blocked on tries 1 and 2 and let through on try 3; with passing tests and a changed file, it finished without a block.
- **2026-11-12:** PR #9 (the hooks review) merged into `ai-layer`. The owner confirmed their edits to `engineering.md` and `direction.md`, made in the PR #3 follow-ups, so both are final. Next: merge `ai-layer` into `main`, then the app work in CLAUDE.md, starting with removing the Width control.
- **2026-11-12:** PR #10 (the steering-docs note) merged into `ai-layer`. Before merging `ai-layer` into `main`, the drift check found `.agents/` (about 10,000 lines, never fitted); deleted (see Decided). Next: the `ai-layer` → `main` pull request.

## 9. A forest of sound (big idea, exploring)

- **Wanted (2026-11-12):** after listening for a while, the owner finds the music beautiful but flat: one melody, one space, one loudness. Two changes:
  - **Richer texture:** many layers at once (foreground, middle, background), a shimmering quality overall, and not every sound through one filter.
  - **Dynamics like emotional expression:** swelling and falling. (Later narrowed: quieter, never louder than today; see Decided.)
- **Inspirations:**
  - **Plant music** (electrodes on plants, the signals mapped to synthesized sounds): many sustained tones, others coming and going, some gliding in pitch.
  - **The shore:** slow swells and falls, now and then a wave crashing. (Later replaced: waves far offshore, no crashing; see Decided.)
  - **Crickets and insects:** many similar voices singing together, each slightly different.
  - **Many cycles with different lengths**, so the mix keeps changing and never quite repeats.
  - **A wider range of pitch:** lower and higher octaves for colour and richness. Today the melody spans 2 octaves (MIDI 43–78).
  - **Keep** Cycle keys and Cycle sounds & scales.
- **Where the code stands:** one composer picks one note at a time (`src/music.js`), with harmony now and then adding a note on top. Today every note goes through one shared reverb and one master level (`createBus` in `src/audio.js`; only the drone skips the reverb, through `dryInput`), and peaks at the same `VOICE_PEAK`. There is already a slow 3-minute drift (`DRIFT_PERIOD`) and a per-note `level`, both starting points.
- **The shape proposed (2026-11-12), three levels of time:**
  - **Conductor (minutes):** the existing key, scale and sound cycles, plus a few slow "tides" (loudness, brightness, density, shimmer) with periods that don't line up, such as 47 s, 73 s, 131 s and 4 min. Eno's *Music for Airports* uses tape loops of different lengths the same way.
  - **Layers (foreground, middle, background):** each with its own filter, stereo spread, reverb, loudness and pitch register. Near is drier and brighter in a short space; far is darker, quieter and mostly reverb, in a long one.
  - **Voices (seconds):** sounds with a lifetime (enter, sing, fade, leave), of a few kinds: **Melodist** (today's note walk, up front), **Sustainer** (long tones that glide between scale notes; plant music), **Swarm** (one sound copied 8–20 times, each a little detuned, off-time and panned differently; crickets) and **Wave** (filtered noise that swells and recedes, like waves far offshore, with no crash; the shore).
  - Built as "an ecosystem on top of parallel layers": today's melody becomes the foreground Melodist, so nothing liked is lost. The conductor, layers and populations stay pure and tested; `src/audio.js` only plays what they decide.
- **Decided (2026-11-12):**
  - **Not one shared reverb.** One reverb for everything is too much of a limitation for this direction (the owner's call). Each layer gets its own space: a short room up front, a medium space in the middle and a long hall at the back. The spike starts with one reverb per layer; whether some voices blend between spaces is open. Check the cost on a phone, since reverbs are the heaviest part.
  - **The Wave layer may use noise**, a sound without pitch. Not everything has to be a note.
  - **The tides drive the forest automatically.** No density or dynamics control for the listener.
  - **A wider pitch range:** each layer gets its own register, so the whole spans more than today's 2 octaves (for example a low background, a high swarm).
  - **Try it in a spike before deciding more:** a throwaway branch with one tide, three layers and three kinds of voice (Sustainer, Swarm, Wave) under today's melody, judged by listening clips.
  - **Gentle dynamics, quieter not louder (2026-11-12, the PRD interview).** The loudest moment is no louder than the app gets today; the contrast comes from dipping quieter. Like waves far offshore, rising and falling, not crashing on the shore. This replaces the first idea of a Wave with "now and then a brighter crash".
  - **The new version sits beside today's app** until it proves itself. If it works it replaces today's sound, perhaps with today's version kept as a choice.
  - **No nature recordings** for now: the sounds evoke nature without being field recordings.
  - **Not for sleep.** It's for the living room, listening closely or reading, often with others.
  - **Change Ambient Lull, not a new project** (the owner's call, after the PRD review). It changes `direction.md §endless-gentle-music` ("a calm backdrop that never needs attention") and puts pressure on `§it-cant-sound-bad`; updating `direction.md` is the owner's edit, in its own reviewed PR.
  - **direction.md updated (2026-11-12, the owner's call):** `§endless-gentle-music` now says subtlety is the key: the music never demands attention and works as a background, but rewards close listening, and covers both versions for now. `§it-cant-sound-bad` narrowed to what it means: notes never clash, and the defaults sound good. `§toy-not-a-settings-form` notes that the forest page has only Start and Stop. `§a-few-chosen-sounds` becomes `§a-curated-palette`: up to about 24 sounds, since the forest needs a larger set. New IS NOT lines: `§not-sleep-music` and `§no-field-recordings`. The core-promise line in `CLAUDE.md` follows.
  - **Other refinements parked for now (2026-11-12, the owner's call):** narrowing Tempo (section 1), custom chord progressions (section 2) and a more beautiful UI (section 4).
  - **Width moves into the forest work (2026-11-12).** It gets a default value and is then left alone: a single control or a fixed setting, perhaps a different width for each layer. Width matters a lot for how it sounds on stereo speakers. This replaces the plan to remove the control at one fixed width (section 1).
- **Open:**
  - **Width: one control, one fixed setting, or a fixed width per layer?** For `plan-architecture`, then judged by ear on stereo speakers in the spike.
  - **What does "never louder than today" measure?** The loudest peak, the average loudness, or both. A limiter on the master would cap the peaks either way.
  - **Shimmer:** detuned copies and a faint high octave first. A true shimmer reverb needs a custom audio worklet, which `§no-build-step` allows but is more work.
  - **Recorded sounds at the edges:** the sets cover about F2 to G5 (Vibes F3 to A5). Lower and higher octaves suit the synthesized sounds; recorded ones may need new samples or stay in the middle layer.
  - **Measurement:** today's checks measure single notes. A changing mix needs checks over a long render: loudness over time, the worst peak and the quietest stretch.
  - **Phone:** cap the active voices at about 24–32, and check the cost of one reverb per layer on a real phone.

### Progress

- **2026-11-12:** the epic is written with `plan-create-prd`: `docs/forest-of-sound.prd.md`. Its bet: the owner leaves it on for 45 minutes or more, 3 times in 2 weeks; it's wrong if they still switch off within about 15 minutes, it sounds busy, any moment is louder than today, or the key changes and rotating sounds are lost. Next: `plan-architecture` in a fresh session, then the spike (ear-check clips first).

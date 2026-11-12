# Direction: what this project is, and is not

This is the product-direction steering document. `CLAUDE.md` loads on every task and stays short. This file
loads only when **scope is decided**: the planning, architecture and epic-slicing skills read it. Every
clause has a name so a decline can cite it, for example `direction.md §toy-not-a-settings-form`.

The owner edits it deliberately, in a reviewed PR. Decisions and their history live in `docs/brainstorm.md`;
this file keeps only the stance.

## What this IS

- **§endless-gentle-music** Press Start for endless, gentle music, until Stop. Subtlety is the key: it never
  demands attention and is pleasant as a background, but a listener who chooses to listen closely hears
  something ever-varying, interesting and soothing, never flat. Not a piece to compose. For now two versions
  sit side by side: today's melody over a soft drone, and the forest (`docs/forest-of-sound.prd.md`), a
  hinted, shimmering melody in layers near and far.
- **§it-cant-sound-bad** Notes never clash: scales, harmony and key changes are chosen so no combination of
  settings gives clashing intervals, and the defaults sound good on the first Start. A feature that can
  bring a clash is out until it can't.
- **§toy-not-a-settings-form** Turning a control changes the music right away, on the next note. Few
  controls, each earning its place; a good fixed value beats a slider. The forest page has only Start and
  Stop, because it drives itself.
- **§a-curated-palette** A curated palette of distinct sounds, up to about 24, recorded where recordings
  sound better and synthesized where synthesis does. Sounds are judged by ear, and the weaker ones are removed.
- **§browser-on-desktop-and-phone** For now, one web page that plays in a desktop or phone browser. A mobile
  app is considered only after the refinements and the UI settle (§open-mobile-app).
- **§no-build-step** Plain HTML and JavaScript modules on the Web Audio API, served as static files. No audio,
  UI or framework libraries, no other dependencies and no bundler. Adding one is a direction call.
- **§settings-not-recordings** Presets save settings, not exact performances.

## What this is NOT

- **§not-an-instrument** Not a synth, sequencer or DAW. No piano roll, no per-note editing, no exposed synth
  parameters.
- **§no-server** No backend, accounts or cloud sync. Everything the app keeps stays in the browser.
- **§not-sleep-music** Not for falling asleep. It's for listening awake, in the background or closely.
- **§no-field-recordings** No nature or field recordings (birds, real waves). The sounds evoke nature
  without being recordings of it.
- **§open-licences-only** Recorded sounds use CC0 or CC-BY samples only, credited. No sample that can't be
  redistributed.

## Open questions (no stance yet)

Direction calls not yet made. Work that touches these should raise the question for an explicit decision,
not settle it quietly. Details in `docs/brainstorm.md`.

- **§open-chord-progressions** Custom chord progressions alongside Cycle keys: how they're entered, how long
  each chord lasts, and what happens when a chord's notes aren't in the scale.
- **§open-harmony** How often harmony sounds, and whether its slider stays. Parked.
- **§open-mobile-app** A link, an installable web app, or a native app, depending on whether it must keep
  playing with the screen locked. Parked until the refinements and the UI settle.
- **§open-ui-and-visuals** A more beautiful UI once the controls settle, and whether something moves with the
  music.

## How to evolve this doc

- Add an IS or IS NOT line when a decision forces a direction call.
- Move an open question to IS or IS NOT once it's decided in `docs/brainstorm.md`.
- Cite the clause when declining or re-scoping a change.
- Keep entries to one or two lines. This is for quick lookup while planning, not a manifesto.

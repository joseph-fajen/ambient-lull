# Brainstorm: refinements, sounds, UI and mobile

Started 2026-11-06, after v1 and the "After v1" extras were built (see `build-plan.md`). Decisions go in **Decided**; everything else is still open.

## Guiding principle

"Toy, not a settings form" (`design-thinking.md` §1). The page has grown from 7 controls to about 14. Every refinement should keep the control count the same or lower it, unless the new control earns its place.

## 1. Simplify existing controls

### Width: remove the control

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

- **Decided (direction):** range 20–60 BPM. The default (40) stays inside.
- **Catch:** note length is scaled across the tempo range (`noteLength()` in `src/music.js`). Just changing `TEMPO_MAX` to 60 would quietly shorten notes at 60 BPM from about 5 s to about 2.5 s. Keep the old curve (about 8 s at 20 BPM, about 5 s at 60) by fixing the curve's end points separately from the slider's range.
- Old presets above 60 BPM get clamped to 60 (settings validation already does this).

## 2. Chord progressions

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

- Wait until the control set settles (sections 1–3), so we design for the final controls.
- **Open:** look and feel references, and whether visuals (something moving with the music) are part of it.

## 5. Mobile: link, web app, or phone app

- **Decided (2026-11-06): back burner.** Not urgent. The notes below are kept for later.

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

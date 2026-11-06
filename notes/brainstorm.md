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
- **Open:** replace the four waveforms, or keep the best one or two and add new families? How many sounds in total (5–6?)?

## 4. A more beautiful UI

- Wait until the control set settles (sections 1–3), so we design for the final controls.
- **Open:** look and feel references, and whether visuals (something moving with the music) are part of it.

## 5. Mobile: link, web app, or phone app

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

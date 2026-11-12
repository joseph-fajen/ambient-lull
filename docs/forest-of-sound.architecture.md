# Architecture: A forest of sound

The twin of the epic, `docs/forest-of-sound.prd.md`: the epic says what and why, this file says how. Written 2026-11-12 with the owner (`plan-architecture`), grounded in the epic and `docs/brainstorm.md`, section 9. It's a high-level decision doc, not a task plan: each ticket gets its own plan later (`piv-plan-implementation`).

**Direction note.** The epic changes `direction.md §endless-gentle-music` ("a calm backdrop that never needs attention"): the forest is meant for listening closely too. Updating `direction.md` is the owner's edit, in its own PR. Nothing here depends on it, and every other clause holds: no build step, no libraries, no server, open-licence samples only, nothing new for the listener to set (`§toy-not-a-settings-form`). One more thing changes: **the palette has to be larger**, perhaps 24 sounds, against today's six (`§a-few-chosen-sounds`, renamed `§a-curated-palette` in the direction PR).

## Problem & goals

The owner gets bored after about 5 minutes: the music is beautiful but flat, with one melody, one space and one loudness. The goal is a soundscape the owner leaves on for an evening (45 minutes or more): depth from near to far, many things changing at different speeds, and loudness that dips quieter but is never louder than today. It has to keep what's liked today (the melody, the drone, the key changes and the rotating sounds and scales) and it can't sound bad. Every decision below is judged against that, and first of all against the owner's ears.

## Approaches considered

1. **More of today.** Add to today's one composer: a second melody line, more harmony, a stronger drift. Cheapest, but it's still one line through one space at one loudness, which is the problem the epic names.
2. **Fixed loops of different lengths** (the *Music for Airports* method). Generate a few phrases and loop them at lengths that don't line up, so the mix never quite repeats. Cheap to run and easy to measure, but it's less alive, and key changes and rotating sounds don't fit fixed loops.
3. **An ecosystem on parallel layers** (the shape proposed in brainstorm section 9). A conductor on the scale of minutes, layers near to far, and voices that enter, sing, fade and leave. Today's melody becomes the front voice, softened into a hinted melody, so nothing liked is lost.

**Recommended: 3.** It's the only one that answers all three complaints: depth, independent motion and dynamics. It costs the most, so the spike tests it before anything else is built.

## Recommended approach

A second engine that sits **beside** today's. A new page, `forest.html`, has only Start and Stop. Its own small shell drives a forest engine, which reuses today's composer, cycles, samples and sound recipes. `index.html`, `src/main.js` and today's `src/audio.js` behaviour stay as they are, so today's app can't be changed by accident, and the two can be compared side by side.

The engine has three levels of time:

- **Conductor (minutes).** The key, scale and sound cycles, as today, plus slow **tides**: smooth curves of time with periods that don't line up, such as 47 s, 73 s, 131 s and 4 min.
- **Layers (near to far).** Each layer has its own pitch register, filter, width, reverb space and level.
- **Voices (seconds).** Each voice has a lifetime and is one of four kinds: Melodist (today's note walk, played as a hinted melody: see below), Sustainer (long tones that glide), Swarm (one sound copied many times, each a little different) and Wave (filtered noise that swells and recedes).

The split is the same as today's composer and performer. **Pure, tested modules decide what happens and when. The audio side only plays it.**

## Key decisions

### 1. Beside today's app, and later (decided)

- **Now: a second page.** `forest.html` with Start and Stop only. It uses the default settings with Cycle keys and Cycle sounds & scales always on. Nothing is saved: no presets, no settings. `normalizeSettings` and old presets aren't touched.
- **Later: keep both futures open.** Both engines share one small interface: start at a time, a tick that books what's due, stop with a fade, and reading the one settings object. Then "replace" means today's Start runs the forest engine, and "keep as a choice" means one Classic/Forest setting, a new field that old presets fall back on. Which one to do is a one-way door, decided after the real test.
- **Phone link:** once the real test is ready, the forest page is published as a private artifact for the phone, either beside the existing one or as a second page in it. That's decided when we get there.
- *Considered:* a "Forest" checkbox in today's page (rejected: it mixes today's controls with a self-driving engine and risks today's sound during the MVP), and a separate project (the owner already ruled that out).

### 2. Pure versus sound (decided)

**Pure, no audio, tested with `node --test`:**

- **Tides.** Functions from time to a number between 0 and 1, with a seeded phase for each run. They only ever **scale down**: a loudness tide multiplies a layer's level by between about 0.3 and 1, and a brightness tide lowers a filter's cutoff from its base. So "never louder, never brighter" comes from how the tides are built, not just from a check afterwards.
- **Conductor.** It reuses `nextKeyInCircle`, `nextInSoundCycle` and the countdowns from `src/scheduler.js`, and says which key, scale and sound apply at any moment.
- **Layers.** Data only: register, filter base, width, which space, and base level.
- **The hinted melody (2026-11-12, the owner's call).** The Melodist isn't one voice but a soft blend of **3 copies, each tuned very slightly differently**, so the melody shimmers and is hinted rather than explicit. The pure side gives each copy its own small detune, timing offset and place. The audio side plays the copies, with the blend set by measurement so it isn't louder than one of today's notes.
- **Voice planners.** Given a time window, the conductor's state and a seeded random source, each planner returns timed **events**: a sustain with its pitch path, a swarm with its copies (detune, offset, pan), a wave with its swell shape. The Melodist is today's `createComposer`, unchanged.
- **Population.** Decides when voices enter and leave, and holds the voice cap.

**Plays sound** (a new forest audio module, built on the helpers in `src/audio.js`):

- One **layer bus** for each layer: filter, width and a send to its reverb, then its level, and all layers into one forest master.
- **Voice recipes:** today's `SOUND_RECIPES` for the Melodist, plus new ones for the gliding sustain, the swarm copy and the noise wave.
- **Tide automation:** sample the pure tide curves a little ahead (the same idea as the scheduler's lookahead) and glide the layer levels and cutoffs to match.

Because the tides and planners are pure and seeded, the offline clips and the live page play the same music.

*Considered:* voices as objects that own their audio nodes and tick themselves (quicker to sketch, but you can't test it without audio), and a precomputed score for the next N minutes (it breaks live key changes and "endless").

### 3. Layers: register, space, filter and width (decided as starting values; the spike tunes them by ear)

| Layer | Voices | Pitch (MIDI) | Space | Filter | Width |
|---|---|---|---|---|---|
| Near | Melodist: the hinted melody, 3 slightly detuned copies (with harmony and cycling sounds) | 43–78, as today | short room, about 1.2 s, mostly dry | the Tone setting, as today | narrow, about 0.4 |
| Middle | Sustainer | 48–72 | medium space, about 3 s | darker, about 1.5 kHz | about 0.6 |
| Far | Wave, low Sustainers, drone | 31–55, plus noise | long hall, about 7 s, mostly reverb | dark, about 800 Hz | wide, about 0.9 |
| High (in Far's hall) | Swarm | 72–91 | shares Far's hall | gentle high cut | widest, 1.0 |

- **Width: fixed per layer, no control.** Near is narrow and far is wide, so width works as a depth cue as well as a spread on stereo speakers. The spike renders two width sets so the owner can choose on stereo speakers.
- **Reverb: three spaces**, one convolver per layer, with impulse responses generated as today but at different lengths. **Fallback** if a phone struggles: two spaces (room and hall), with the Middle layer sending to both.
- **The drone keeps out of the reverb.** Today it skips the reverb because a reverb colours a single held pitch unevenly. It takes Far's filter and width, but not the hall.
- **Recorded sounds stay in Near.** The sample sets cover about F2 to G5, so the new low and high registers are synthesized.
- **Sound palette: a major open question** (see Open questions). Today's six sounds stay but are used more subtly, and many new sounds will be needed. The sounds named here are placeholders until the palette is chosen.
- *Considered:* one Width control for all layers (adds a control to a Start/Stop page), one fixed width for everything (loses width as a depth cue), and one shared reverb with different sends (the owner already ruled that out).

### 4. Dynamics: never louder than today (decided)

Measure **both** the peak and the average, on long offline renders of both engines, with the same settings and seeds:

- **Reference:** today's app at its defaults with both cycles on, rendered just as long, over several seeds.
- **Peak:** the forest's worst sample before the limiter is no higher than today's worst case. The existing peak limit is 0.9.
- **Average:** the loudest 3-second stretch, as RMS across both channels, is no louder than today's loudest 3-second stretch, within a small tolerance of about 0.5 dB (the owner's call: a small tolerance is fine). Plain RMS doesn't play down low sounds the way the ear does, so it errs on the safe side for the drone and the waves.
- **The dip:** the quietest 3-second stretch reaches about 6–10 dB below the loudest, and is never silent. The exact range is set from what sounds right in the spike.
- **Backstop:** a gentle limiter on the **forest's master only** (a `DynamicsCompressorNode`, set high and fast). The checks show it hardly ever works. A limiter you can hear working would be a bug, not the design.
- These become new long-render audio checks in the real build. Today's checks measure single notes, so they need this addition. Keep the renders short enough that `npm run test:audio` stays within a few more minutes.

*Considered:* peak only plus a limiter (a mix can stay under the peak cap and still sound louder), and average only (a stray peak could still poke out).

### 5. Key, scale and sound cycles (decided)

- **The conductor owns them, always on** (with today's six sounds as placeholders until the new palette is chosen), using today's pure functions: the circle of fifths, a new sound every 2 minutes and a new scale with every 6th sound change.
- **Every layer follows the key and scale.** The **sound cycle changes the Near melody only**. The other layers keep their own synthesized sounds.
- **At a key change:** the drone crossfades as today. New voices use the new key. In the spike, voices that are still sounding just finish. Neighbouring keys on the circle share most of their notes, so that may be fine. If clashes are heard, those voices glide to the nearest note of the new key instead.
- *Later experiment:* the melody passing between layers and instruments (the epic's "orchestral" question).

### 6. Phone cost (decided)

- **Budget:** about 24 voices at once, where each swarm copy counts as a voice. One shared noise buffer serves every wave. Three convolvers. The population planner enforces the cap, so it's tested.
- **Check on the owner's phone** with a temporary `?heavy` flag (double the voices) on `forest.html`, listening for crackles. It's removed before finishing, like `?fast` was.
- **If it crackles, in this order:** shorten the hall, drop to two reverbs, use fewer swarm copies, lower the voice cap.

### Data model, boundaries, stack

- **Stack:** plain JavaScript modules on the Web Audio API, as today. No libraries, no worklet. A true shimmer reverb would need an audio worklet, which `§no-build-step` allows, but it's deferred: the detuned copies of the hinted melody and the swarm come first.
- **Data:** no stored data. The forest saves nothing, and presets and `localStorage` are unchanged. The only new data shapes are the layer table and the event objects the planners return.
- **Boundaries:** no network, no server, no new samples.

## Missing pieces

- An engine interface that today's shell and the forest shell can both drive.
- A tide module, and a conductor that brings the cycles and the tides together.
- A hinted-melody player: today's composer's notes played as 3 slightly detuned copies.
- Voice planners for Sustainer, Swarm and Wave, and a population with a cap.
- Layer buses with a filter, a width, their own reverb and a level. Impulse responses at three lengths.
- New voice recipes: a gliding sustain, a swarm copy and a noise wave.
- Tide automation booked ahead on the layer levels and filters, and a limiter on the forest master.
- Long-render measurements: worst peak, loudest and quietest 3-second stretch, compared with today.
- A forest clip page for offline clips, and later `forest.html` with its shell.

## Spikes & experiments

### The spike: ear-check clips (the epic's MVP step 1)

```
Question:      Does an ecosystem of layers, voices and tides sound like the right direction:
               deeper, more alive, still calm, and never louder than today?
Spike:         On a throwaway branch: pure tides (2), a conductor, the layer table, and
               planners for Sustainer, Swarm and Wave under the hinted melody (3 detuned
               copies of today's melody) and today's drone, all with placeholder sounds,
               played through 4 layer buses sharing 3 reverbs. A forest clip page renders
               4-minute clips offline. No forest.html, no phone check, no new audio checks.
               Timebox: about 2 working sessions.
Decision rule: go on to the real test if the owner hears depth and change in clip B and
               prefers it to clip A, it isn't busy, and the numbers show it's no louder.
               The clips judge depth, motion and dynamics, not the sounds themselves.
               Rework the voices or the tides if it's busy or flat. Stop the epic if the
               direction itself is wrong (the epic's own stop point).
```

**What it builds, and nothing more:**

- **Two tides:** loudness, about 73 s, and brightness, about 131 s, so a 4-minute clip has a few rises and dips. The density and shimmer tides wait for the real test.
- **Three kinds of new voice** (Sustainer, Swarm, Wave) plus the hinted melody as the Melodist, with the drone as today, on the layers in the table.
- **Placeholder sounds (the owner's call):** today's six sounds, used subtly, for the hinted melody, and simple synthesized sounds for the sustain, the swarm and the wave. Choosing the real palette comes after, with its own clips.
- **Cycles on:** a key change every 30 s (today's default) and a sound change every 2 minutes, so each clip has 8 key changes and 2 sound changes. A scale change takes 12 minutes, so it isn't heard in a clip.

**The clips** (4 minutes each, same seed, sent as MP3s):

| Clip | What it is | What it answers |
|---|---|---|
| A | Today's app, defaults, both cycles on | The reference |
| B | The forest | The direction: depth, change, calm |
| C | The forest with the other width set | Width on stereo speakers |
| D | The forest with the tides held still | What the tides add |

Each clip prints its worst peak and its loudest and quietest 3-second stretch next to clip A's, so "never louder" is checked from the first clip.

**Then:** the real test (MVP step 2): `forest.html`, the phone check, the long-render audio checks, and the evening listens.

## Open questions

- **The sound palette (major).** The new vision needs the sounds rethought. Today's six all have qualities worth keeping (the Pad especially) and can stay, used more subtly, but many new sounds will be needed. What the palette is, and how the hinted melody's 3 voices are chosen from it (copies of one sound, or a blend of different sounds), is its own piece of work after the spike, judged by clips.
- **Key changes with voices still sounding:** do they clash? Settled by ear in clip B. If they do, those voices glide to the new key.
- **The key-change pace in the forest:** today's 30 s may be too busy with long sustains. Settled by ear; a longer fixed pace is cheap to change.
- **The size of the dip:** about 6–10 dB is a guess. Settled by ear in the spike, then made into a check.
- **Shimmer:** are the detuned copies and a faint high octave enough, or is a worklet needed? Deferred until after the real test.
- **"Orchestral":** sections entering and leaving, and the melody passing between instruments. A later experiment after the real test.
- **Replace or choice:** the one-way door, decided after the real test.
- **Phone link:** a second artifact or a second page in the existing one, decided at the real test.
- **Do the people listening with the owner hear it the same way?** Only the real test can tell.

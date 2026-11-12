# Epic: A forest of sound

Brownfield epic for Ambient Lull. Written 2026-11-12 from an interview with the owner (`plan-create-prd`). Background and the first design ideas are in `notes/brainstorm.md`, section 9. This file is intent only: how to build it is left to `plan-architecture`.

## 1. Problem Statement

The owner, the app's main listener, gets bored with Ambient Lull after about 5 minutes, switches it off and puts on other music. It is beautiful but flat: everything seems to come from one place, at one loudness, along one line, with too little variety and nuance to stay alive over a long listen. The cost: the app loses its listener within minutes, so it never becomes the music put on for an evening.

## 2. Evidence

- **Observed (the owner, listening):** "After about 5 minutes, it starts to feel flat." Happens both when listening closely and when reading with it on.
- **Observed (what they do instead):** "I switch it off, then switch to other music."
- **Observed (what holds them):** recordings of plant music (signals from electrodes on plants, mapped to synthesized sounds) keep their attention where the app doesn't: many sustained sounds, others coming and going, some changing in pitch.
- **Assumption, validate via the MVP:** that more depth, more independent motion and gentle changes in loudness are what's missing, and not something else (the melody itself, the sounds, the tempo).
- **Assumption, validate via the MVP:** that the people listening with the owner (their wife, friends) will hear it the same way.

## 3. Thesis (why build it)

- **Why this:** the owner wants a combination they haven't found anywhere else: a tamboura-like drone (perhaps coming and going like a swell), circle-of-fifths key changes, rotating sounds and scales, an orchestral feel, shimmering layers and variety. Recordings are fixed. This mix doesn't exist as a recording, and the app already has half of it.
- **Why now:** the owner noticed being bored with the app as it is, and noticed preferring recordings like the plant music. That led to thinking of forests, oceans and insects as models.
- **Why it beats how they cope today:** today the cope is switching to recordings. A generative version with this particular mix, endless and never quite repeating, would be something the recordings can't be.
- **The picture to judge it by:** watching the sunset from the top of a cliff. The ocean's tides and waves below, wildlife in the forest behind, a gentle breeze, and subtle orchestral qualities. Calming and soothing, but interesting and never static.

## 4. Hypothesis

> **We believe** a soundscape with depth (near and far), many things changing at different speeds, and a gentle rise and fall in loudness, never louder than today, will cause **the owner (and whoever is listening with them)** to **leave it playing**, resulting in **Ambient Lull becoming the music put on for an evening in the living room, in place of recordings.**
>
> **We'll know we're RIGHT if** the owner leaves it on for 45 minutes or more, at least 3 times over 2 weeks, without switching it off out of boredom, and can still hear new things after 20 minutes.
>
> **We'll know we're WRONG if** any of these happens:
> - the owner still switches it off within about 15 minutes;
> - it sounds busy or cluttered (the owner hears it that way, or their wife or a friend finds it distracting);
> - any moment is louder or harsher than today's app;
> - it loses what the owner likes about it today: the key changes and the rotating sounds are no longer part of the experience.

The owner's own reactions are the main evidence. Their wife's and friends' reactions are considered too.

## 5. Target User & JTBD

- **Primary user:** the owner, listening at home, closely or while reading. Often in the living room with their wife, or with friends over.
- **JTBD:** When I want music on while I listen closely or read, I want an endless soundscape that keeps changing in depth, colour and loudness, so I stay with it for an hour or more instead of switching to a recording.
- **Non-users:**
  - **People going to sleep.** This isn't sleep music.
  - **Anyone wanting to shape the sound themselves.** It isn't an instrument (`direction.md §not-an-instrument`).
- **Constraints from today's app:** it must keep "it can't sound bad" (`direction.md §it-cant-sound-bad`), and the loudest moment must be no louder than the app gets today.

## 6. MVP

The thinnest line that proves or disproves the bet, in two steps:

1. **Ear check.** A few 3–5 minute listening clips. Is this the right direction at all? If not, stop here.
2. **The real test.** A version the owner can leave playing for an evening (living-room speakers or phone), with Start and Stop only. It sits **beside today's app**, so the two can be compared.

It must include:
- **Depth:** sounds near and far.
- **Variety:** several things changing at different speeds.
- **Gentle dynamics:** a rise and fall in loudness that dips quieter for contrast and never goes louder than today. Like waves far offshore, rising and falling, not crashing on the shore.
- **What's liked today:** the melody, the key changes and the rotating sounds and scales.
- **The drone,** perhaps coming and going like a swell.

It can leave out: new controls, presets, a new look, and polish on every sound.

**Door check:** building it beside today's app is a two-way door, cheap to undo. The one-way doors are later and go to `plan-architecture`: whether it replaces today's sound (the owner's intent if it succeeds, perhaps with today's version kept as a choice) and whether it stays in Ambient Lull or becomes its own project.

## 7. Success Metrics

| Metric | Target | How measured |
|---|---|---|
| Long listens | 45 min or more, at least 3 times in 2 weeks, without switching off out of boredom | The owner notes each evening's listen: how long, and why it ended |
| Early switch-offs | None within about 15 minutes out of boredom | The same notes |
| Still interesting | New things heard after 20 minutes | The owner's notes after each long listen |
| Not busy | Neither the owner nor the people listening with them find it cluttered or distracting | The owner's notes, plus what their wife or friends say |
| Never louder | The loudest moment is no louder than today's app; no harsh moments | Measured against today's app, then confirmed by ear |
| Keeps what's liked | Key changes and rotating sounds are still part of it | The owner, by ear |

## 8. Non-goals

- **Sleep music.**
- **Loud crescendos or crashing waves.** The dynamics go quieter, not louder.
- **Listener controls for the layers or the dynamics.** It drives itself.
- **Nature recordings** (birds, real waves). The sounds evoke nature without being field recordings. The owner wants to try without them first.
- **Replacing today's sound during the MVP.** The new version sits beside it until the bet is proven.

## 9. Open Questions

- [ ] **What does "orchestral" mean in sound?** The owner agreed it means sections entering and leaving, a wide sound and the melody passing between instruments. How much of that fits in the MVP is TBD — needs validation by ear.
- [ ] **Does it replace today's sound if it works, or do both stay as choices?** The owner leans towards replacing it, but sees value in keeping today's version available.
- [ ] **Change Ambient Lull, or start a new project?** For `plan-architecture` (`direction.md §endless-gentle-music` would change).
- [ ] **Does "never louder than today" mean the loudest peak, the average loudness, or both?** TBD — needs measurement.
- [ ] **Do the people listening with the owner hear it the way the owner does?** TBD — needs validation in the real test.

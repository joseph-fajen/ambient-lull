# Baseline exercise prompt, v2

Revised after pausing to think the design through (see `design-thinking.md`). The original is in `baseline-prompt.md`.

**What changed from v1:** any key, a choice of 7 scales, 4 waveforms, a tone slider, a 20–120 BPM tempo with note length tied to it, live changes, 4 named preset slots, and structure that leaves room to grow.

```
I'm starting a small fun project in this empty repo: a generative ambient music toy that runs in the browser.

Goal for this first version: open a web page, press Start, and hear an endless, gentle, ambient melody until I press Stop. The core promise is "it can't sound bad": every combination of settings should sound pleasant, and the defaults should sound good on the first press of Start.

Tooling:
- Use the Web Audio API directly (no audio libraries).
- Plain HTML + JavaScript modules, no build step. It should run with `python3 -m http.server`.

Music:
- Key: any of the 12 roots (one spelling per note, e.g. F♯ not G♭). Keep the pitch range centered around middle C whatever the key, so B doesn't sound almost an octave higher than C.
- Scales: major pentatonic (default), minor pentatonic, major, natural minor, Dorian, Lydian, and Japanese In. Store scales as data (a name plus a list of intervals) so adding one is a single line. Scales have different lengths, so set the range in octaves and make note-picking work for any length.
- Melody: a random walk. Each note moves one or two scale steps from the last, so it wanders instead of jumping.

Sound:
- Waveforms: sine, triangle, square, sawtooth, volume-matched so switching doesn't cause a loudness jump. Label each with a mood name and the technical name in smaller text: Soft (sine), Warm (triangle), Hollow (square), Bright (sawtooth).
- A Tone/Brightness slider: a low-pass filter on every note, with its range limited so even sawtooth never sounds harsh.
- Each note gets a gentle fade-in and a long fade-out, so nothing clicks or pops.
- Reverb (a convolver with a generated impulse response) mixed with the dry signal, for a spacious feel.

Controls:
- Key dropdown, scale dropdown, waveform picker, tone slider, tempo slider, Start and Stop.
- Tempo: 20–120 BPM, one note per beat. Note length follows tempo: about 8 seconds at 20 BPM, down to about 2–3 seconds at 120 BPM, so fast tempos don't turn the reverb to mush.
- All changes apply live, starting with the next note.
- Stop fades out cleanly, with no stuck notes or reverb tails.
- Schedule notes slightly ahead on the audio clock for steady timing.

Presets:
- 4 preset slots, each with a name I type. Each slot can save the current settings and load them back.
- Loading applies live, like any other change. Saving over a filled slot asks me to confirm first.
- Store them in localStorage, saving values by name (e.g. "dorian"), not by list position.
- When loading, fill in defaults for any missing setting, and fall back to defaults if the data is invalid or a saved value no longer exists. The app should still work if localStorage is unavailable.

Structure (to leave room to grow, without overbuilding):
- One settings object (key, scale, waveform, tone, tempo) that the controls write to and the engine reads before each note.
- Keep the "composer" (which note, and when) separate from the "performer" (how it sounds). The composer logic should be pure and testable.
- Keys, scales and waveforms as data tables, not if/else chains.
- The note-player takes the sound settings as input, so a different voice could plug in later.

Follow the build plan in `notes/build-plan.md`. Build one milestone at a time, including its tests, and stop after each one so I can run the checks and listen before you continue. Before starting, briefly tell me if you'd change anything in the plan or file structure. For each milestone, tell me exactly how to run it and what to listen for.
```

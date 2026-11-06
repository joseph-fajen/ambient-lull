# Design thinking: generative ambient music toy

Discussion notes from the baseline exercise (lessons 1.2–1.3), 2026-11-05.

## Where we left off

- Started the baseline exercise with `notes/baseline-prompt.md`. Claude proposed a plan, then I paused before any code was written to think the design through. **No code has been written yet.**
- I want more than the original prompt asked for: **any key**, a **selection of scales**, and **3–4 waveforms**. Start simple, but leave room to grow.
- Next steps:
  1. ~~Answer the open questions below.~~ Done, see "Decisions made".
  2. ~~Update the baseline prompt.~~ Done: `notes/baseline-prompt-v2.md`, with the original left untouched for the record.
  3. Build v1.
- Baseline reflection note: stopping to think before building was a driver's-seat moment. Remember it for the three diagnostic questions.

## Decisions made

- **Tempo: 20–120 BPM**, one note per beat. This replaces the original 10–60 notes per minute. I first considered 200 BPM as the top, but that crowds the reverb with too many overlapping notes.
- **Note length follows tempo:** about 8 seconds at 20 BPM, shrinking to about 2–3 seconds at 120 BPM. Slow tempos give a long ambient wash and fast ones a lighter arpeggio, with no extra control needed.
- **Changes apply live**, starting with the next note. Notes already ringing finish in the old settings.
- **Tone/Brightness slider is in v1.** It's a filter that cuts high frequencies, limited to a range that always sounds good.
- **Scales (7):** major pentatonic (the default), minor pentatonic, major, natural minor, Dorian, Lydian, and Japanese In.
- **Waveform labels show both:** mood name large, technical name small (Soft/sine, Warm/triangle, Hollow/square, Bright/sawtooth).
- **Presets are in v1:** 4 named slots that save and load settings, not exact replays. I considered exact replay (recording note events), but saving settings is simpler and covers what I want.
  - Loading applies live, like any other change.
  - Saving over a filled slot asks to confirm.
  - Store values by name (`"dorian"`), not list position. Fill in defaults for anything missing, and fall back to defaults on bad data or when browser storage is unavailable.

## v1 spec

Key dropdown (12) · Scale dropdown (7) · Waveform picker (4, volume-matched) · Tone slider · Tempo slider (20–120 BPM) · Start/Stop · 4 named preset slots. Changes apply live, on the next note.

---

## 1. The core promise: "it can't sound bad"

Every combination of settings should still sound pleasant. Judge each new control by whether it keeps that promise.

- **Defaults matter most.** The first press of Start, with no tweaking, should already sound good.
- **Limit ranges.** Tempo, register and loudness ranges should only cover good-sounding settings.
- **Changes should be heard right away.** Turning a dial and hearing the music shift is what makes it a toy, not a settings form.

## 2. Keys

- **12 roots** (C–B). Register catch: if every key starts at its root in the same octave, B sounds almost an octave higher than C. Keep the pitch range roughly centered whatever the key, for example by choosing the root octave nearest middle C.
- **Note names are only for display.** F♯ and G♭ are the same note to the computer. Pick one spelling for the dropdown.

## 3. Scales

- **Pentatonic scales sound good automatically for ambient music.** They have no half-step intervals, so notes overlapping in the reverb never clash.
- **Seven-note scales** (major, minor, the modes) have half-steps like E–F and B–C. Long overlapping notes create some tension. That can be lovely, but it's a different mood, and the note-picking logic or note length might need adjusting for them.
- **Scales should be data, not code.** Each one is a name plus a list of intervals. Adding a scale is one line.
- **Scales have different lengths** (5, 6 or 7 notes). Set the pitch range in octaves, not note counts, and make the note-picking logic work with any length.
- **Starting set:** major pentatonic, minor pentatonic, major, natural minor, Dorian, Lydian, plus one exotic scale (whole-tone or the Japanese In scale).

## 4. Waveforms

Web Audio has exactly four built-in waveforms: **sine, triangle, square, sawtooth**.

- **Loudness changes when you switch.** Square and sawtooth sound much louder and buzzier than sine. Without per-waveform volume matching, switching makes a jarring jump.
- **Raw square and sawtooth aren't ambient.** They need a filter that cuts the high frequencies to soften them. That filter can become a **Tone/Brightness slider**, which might be more expressive than the waveform choice itself.
- **Naming:** technical names ("Sawtooth") vs mood names ("Soft / Warm / Hollow / Bright"). Could show mood names with the technical name as a smaller label.

## 5. Live changes vs restart

When the key changes mid-playback, notes from the old key are still ringing in the reverb, so the switch can sound smeared for a moment. That's usually fine, and it can even sound like a modulation (a key change in the music). Decide on purpose.

## 6. Building in room to grow without overbuilding

These four structural choices cost almost nothing now and make most future features easy:

1. **One settings object** (key, scale, waveform, tempo, tone) that the controls write to and the engine reads before each note. Presets, saving, and shareable links with the settings in the URL all come from this.
2. **Keep "composer" and "performer" separate.** The composer decides which note and when. The performer decides how it sounds.
3. **Scales, keys and waveforms as data tables**, not if/else chains.
4. **The note-player takes the sound settings as input**, so a future "voice" (a pad, a sampled instrument, a custom synth) can plug in without changes elsewhere.

## 7. Future ideas (not v1)

- a drone or pad layer under the melody
- chord changes
- density: the chance of a rest instead of a note
- velocity variation (notes at different loudness)
- stereo panning
- ~~presets~~ (moved into v1)
- visuals
- seeded randomness ("replay that exact piece")
- recording to audio

## Original technical plan (from before the pause)

Kept for reference. It still mostly applies, extended with the ideas above.

- Plain HTML and JS modules, no Vite or build step, served with `python3 -m http.server`.
- Note picking by random walk: each note moves one or two scale steps up or down from the last, so the melody wanders instead of jumping.
- Sine oscillator per note, a gain envelope with a 0.4s fade-in and a long exponential fade-out, and a convolver reverb from a generated 4-second impulse response, mixed with the dry signal.
- A scheduler that queues notes slightly ahead on the audio clock, for steady timing.
- Stop fades the master volume out over 1.5s, then closes the audio context, so no note or reverb tail can get stuck.
- Tempo slider set to 10–60 notes per minute, with each note ringing for 3–8 seconds.
- Proposed files: `index.html`, `src/music.js` (pure logic), `src/audio.js` (Web Audio), `src/main.js` (UI and scheduler), `README.md`.

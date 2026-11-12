# Baseline exercise prompt

Drafted with help from Claude (outside the course profile) before starting the baseline.

```
I'm starting a small fun project in this empty repo: a generative ambient music toy that runs in the browser.

Goal for this first version: open a web page, press Start, and hear an endless, gentle, ambient melody until I press Stop.

Requirements:
- Use the Web Audio API directly (no audio libraries). Keep tooling minimal — plain HTML + JavaScript/TypeScript is fine; use Vite only if it really helps.
- Notes are chosen randomly from a single scale (C major pentatonic is fine), in a comfortable middle register.
- Soft sound: a simple waveform (sine or triangle) with a gentle fade-in and a long fade-out on each note, so nothing clicks or pops.
- Add a reverb-like or echo effect so it feels spacious.
- One slider that controls tempo (how often new notes play).
- Start and Stop buttons. Stop should fade out cleanly with no stuck notes.
- Keep the music logic (scale, picking notes, timing) separate from the audio code, so it can be tested later.

Before writing code, briefly tell me your plan and the file structure. Then build it, tell me exactly how to run it, and tell me what I should listen for to check that it works.
```

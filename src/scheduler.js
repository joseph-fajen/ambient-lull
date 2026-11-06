// Transport: when notes are due, and the start/stop states. Pure: the clock is passed in.
//
// The timer loop calls due(now, interval) often (every ~50 ms). It returns the start
// times of notes falling inside the next LOOKAHEAD seconds, so they can be booked on
// the audio clock ahead of time for steady timing.

export const LOOKAHEAD = 0.3; // seconds booked ahead
export const START_DELAY = 0.05; // seconds between pressing Start and the first note

export function createTransport() {
  let state = 'stopped'; // 'stopped' | 'playing' | 'stopping'
  let run = 0; // increases on every start, so a stale fade-out can be ignored
  let firstTime = 0; // when the run's first note plays
  let lastTime = null; // start time of the last note booked (null: none yet)

  return {
    get state() { return state; },
    get run() { return run; },

    // Returns true if this began a new run (from stopped, or during a fade-out).
    start(now) {
      if (state === 'playing') return false;
      state = 'playing';
      run++;
      lastTime = null;
      firstTime = now + START_DELAY;
      return true;
    },

    // Returns true if this began a fade-out.
    stop() {
      if (state !== 'playing') return false;
      state = 'stopping';
      return true;
    },

    // Called when a run's fade-out has finished. Ignored if a newer run has started.
    finish(finishedRun) {
      if (state === 'stopping' && finishedRun === run) state = 'stopped';
    },

    // Note times in [now, now + LOOKAHEAD). `interval()` gives the current seconds per
    // beat; it is read for each new note, so tempo changes apply from the next note.
    due(now, interval) {
      if (state !== 'playing') return [];
      const times = [];
      for (;;) {
        let next = lastTime === null ? firstTime : lastTime + interval();
        if (next < now) next = now; // clock jumped (tab slept): skip forward, no burst
        if (next >= now + LOOKAHEAD) break;
        times.push(next);
        lastTime = next;
      }
      return times;
    },
  };
}

// Key cycling: says when it's time to move to the next key. The clock and the period
// are passed in on every call, so a period change applies straight away and keeps the
// time already waited.
export function createKeyCycle() {
  let last = null; // when the countdown last (re)started (null: not started)
  return {
    // Start the countdown afresh: on Start, when cycling is switched on, or after
    // the key is changed by hand.
    reset(now) {
      last = now;
    },
    // True once each period. Each change restarts the countdown from that moment, so
    // every key gets a full period, even after a late tick or a clock jump.
    due(now, period) {
      if (last === null || now < last + period) return false;
      last = now;
      return true;
    },
  };
}

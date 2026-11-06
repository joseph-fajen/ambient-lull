import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransport, createKeyCycle, LOOKAHEAD, START_DELAY } from '../src/scheduler.js';
import { createRandom } from '../src/music.js';

const close = (a, b) => Math.abs(a - b) < 1e-9;

// Drive the transport like the timer loop would, with a fake clock. Returns all note times.
function runClock(transport, { from, to, step, interval }) {
  const times = [];
  for (let now = from; now <= to; now += step()) times.push(...transport.due(now, interval));
  return times;
}

function assertEvenlySpaced(times, gap) {
  for (let i = 1; i < times.length; i++) {
    assert.ok(close(times[i] - times[i - 1], gap), `gap ${i}: ${times[i] - times[i - 1]} (expected ${gap})`);
  }
}

test('notes come exactly 60/BPM apart, with no gaps or duplicates across windows', () => {
  for (const bpm of [20, 60, 120]) {
    const t = createTransport();
    t.start(0);
    const times = runClock(t, { from: 0, to: 60, step: () => 0.05, interval: () => 60 / bpm });
    assert.ok(close(times[0], START_DELAY));
    assertEvenlySpaced(times, 60 / bpm);
    assert.equal(times.length, Math.floor((60 + LOOKAHEAD - START_DELAY) / (60 / bpm)) + 1);
  }
});

test('timing stays exact even when the timer fires irregularly', () => {
  const rng = createRandom(7);
  const t = createTransport();
  t.start(0);
  const times = runClock(t, { from: 0, to: 60, step: () => rng() * LOOKAHEAD * 0.9, interval: () => 0.5 });
  assertEvenlySpaced(times, 0.5);
});

test('a tempo change affects the next note, not ones already scheduled', () => {
  let bpm = 60;
  const t = createTransport();
  t.start(0);
  const before = runClock(t, { from: 0, to: 10, step: () => 0.05, interval: () => 60 / bpm });
  bpm = 120;
  const after = runClock(t, { from: 10.05, to: 20, step: () => 0.05, interval: () => 60 / bpm });
  assertEvenlySpaced(before, 1);
  assert.ok(close(after[0] - before.at(-1), 0.5), 'next note uses the new tempo');
  assertEvenlySpaced(after, 0.5);
});

test('if the clock jumps ahead (tab slept), it skips forward instead of bursting', () => {
  const t = createTransport();
  t.start(0);
  const before = runClock(t, { from: 0, to: 5, step: () => 0.05, interval: () => 0.5 });
  const burst = [...t.due(65, () => 0.5)];
  assert.ok(burst.length <= 1, `only one note right away, got ${burst.length}`);
  assert.ok(burst[0] >= 65, 'no notes in the past');
  const after = runClock(t, { from: 65.05, to: 70, step: () => 0.05, interval: () => 0.5 });
  assertEvenlySpaced([...burst, ...after], 0.5);
  assert.ok(before.length > 0);
});

test('each gap is read after the note before it has been handled (so it can depend on that note)', () => {
  const t = createTransport();
  t.start(0);
  const pattern = [0.5, 0.5, 2, 1, 3, 0.5, 0.5, 4];
  let i = 0;
  let gap = null; // set by the "composer" for each note, before the next gap is read
  const times = [];
  for (let now = 0; now <= 40; now += 0.05) {
    for (const time of t.due(now, () => gap)) {
      times.push(time);
      gap = pattern[i++ % pattern.length];
    }
  }
  for (let n = 1; n < times.length; n++) {
    assert.ok(close(times[n] - times[n - 1], pattern[(n - 1) % pattern.length]), `gap ${n}`);
  }
  assert.ok(times.length > 15);
});

test('states: stopped -> playing -> stopping -> stopped', () => {
  const t = createTransport();
  assert.equal(t.state, 'stopped');
  assert.deepEqual([...t.due(0, () => 1)], [], 'nothing plays while stopped');

  assert.equal(t.start(0), true);
  assert.equal(t.state, 'playing');
  const run = t.run;

  assert.equal(t.stop(), true);
  assert.equal(t.state, 'stopping');
  assert.deepEqual([...t.due(1, () => 1)], [], 'nothing new is scheduled while stopping');

  t.finish(run);
  assert.equal(t.state, 'stopped');
});

test('start while playing does nothing (and does not reset timing)', () => {
  const t = createTransport();
  t.start(0);
  const first = runClock(t, { from: 0, to: 3, step: () => 0.05, interval: () => 1 });
  const run = t.run;
  assert.equal(t.start(3), false);
  assert.equal(t.run, run);
  const rest = runClock(t, { from: 3.05, to: 6, step: () => 0.05, interval: () => 1 });
  assertEvenlySpaced([...first, ...rest], 1);
});

test('stop while stopped or stopping does nothing', () => {
  const t = createTransport();
  assert.equal(t.stop(), false);
  t.start(0);
  t.stop();
  assert.equal(t.stop(), false);
  assert.equal(t.state, 'stopping');
});

test('start while stopping begins a new run; the old fade finishing does not stop it', () => {
  const t = createTransport();
  t.start(0);
  const oldRun = t.run;
  t.stop();
  assert.equal(t.start(1), true);
  assert.equal(t.state, 'playing');
  assert.notEqual(t.run, oldRun);

  t.finish(oldRun); // the old run's fade-out timer fires late
  assert.equal(t.state, 'playing', 'still playing');

  const times = [...t.due(1, () => 1)];
  assert.ok(close(times[0], 1 + START_DELAY), 'the new run starts fresh');
});

// Fake clock: which ticks (every 50 ms) say a key change is due. `period(now)` gives
// the current setting, so tests can change it mid-run.
function keyChanges(cycle, from, to, period = () => 30) {
  const at = [];
  for (let i = Math.round(from * 20); i <= Math.round(to * 20); i++) {
    const now = i / 20;
    if (cycle.due(now, period(now))) at.push(now);
  }
  return at;
}

test('key cycle: due once per period after reset', () => {
  const cycle = createKeyCycle();
  cycle.reset(10);
  assert.deepEqual(keyChanges(cycle, 10, 135), [40, 70, 100, 130]);
  const fast = createKeyCycle();
  fast.reset(0);
  assert.deepEqual(keyChanges(fast, 0, 35, () => 10), [10, 20, 30]);
});

test('key cycle: never due before the first reset', () => {
  assert.deepEqual(keyChanges(createKeyCycle(), 0, 100), []);
});

test('key cycle: a reset (manual key change) restarts the countdown', () => {
  const cycle = createKeyCycle();
  cycle.reset(0);
  assert.deepEqual(keyChanges(cycle, 0, 25), []);
  cycle.reset(25);
  assert.deepEqual(keyChanges(cycle, 25.05, 90), [55, 85]);
});

test('key cycle: changing the period keeps the time already waited', () => {
  // 20 s into a 30 s wait, switch to 15 s: change right away, then every 15 s.
  const shorter = createKeyCycle();
  shorter.reset(0);
  assert.deepEqual(keyChanges(shorter, 0, 50, now => (now < 20 ? 30 : 15)), [20, 35, 50]);
  // 20 s into a 30 s wait, switch to 60 s: the next change is at 60.
  const longer = createKeyCycle();
  longer.reset(0);
  assert.deepEqual(keyChanges(longer, 0, 125, now => (now < 20 ? 30 : 60)), [60, 120]);
});

test('key cycle: a clock jump gives one change, not a burst', () => {
  const cycle = createKeyCycle();
  cycle.reset(0);
  assert.equal(cycle.due(500, 30), true);
  assert.equal(cycle.due(500.05, 30), false);
  assert.deepEqual(keyChanges(cycle, 500.1, 531), [530]);
});

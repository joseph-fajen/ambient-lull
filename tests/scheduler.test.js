import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransport, createKeyCycle, LOOKAHEAD, START_DELAY, KEY_CYCLE_SECONDS } from '../src/scheduler.js';
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
  const burst = t.due(65, () => 0.5);
  assert.ok(burst.length <= 1, `only one note right away, got ${burst.length}`);
  assert.ok(burst[0] >= 65, 'no notes in the past');
  const after = runClock(t, { from: 65.05, to: 70, step: () => 0.05, interval: () => 0.5 });
  assertEvenlySpaced([...burst, ...after], 0.5);
  assert.ok(before.length > 0);
});

test('states: stopped -> playing -> stopping -> stopped', () => {
  const t = createTransport();
  assert.equal(t.state, 'stopped');
  assert.deepEqual(t.due(0, () => 1), [], 'nothing plays while stopped');

  assert.equal(t.start(0), true);
  assert.equal(t.state, 'playing');
  const run = t.run;

  assert.equal(t.stop(), true);
  assert.equal(t.state, 'stopping');
  assert.deepEqual(t.due(1, () => 1), [], 'nothing new is scheduled while stopping');

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

  const times = t.due(1, () => 1);
  assert.ok(close(times[0], 1 + START_DELAY), 'the new run starts fresh');
});

// Fake clock: which ticks (every 50 ms) say a key change is due.
function keyChanges(cycle, from, to) {
  const at = [];
  for (let i = Math.round(from * 20); i <= Math.round(to * 20); i++) {
    const now = i / 20;
    if (cycle.due(now)) at.push(now);
  }
  return at;
}

test('key cycle: due every 30 seconds after reset', () => {
  assert.equal(KEY_CYCLE_SECONDS, 30);
  const cycle = createKeyCycle();
  cycle.reset(10);
  assert.deepEqual(keyChanges(cycle, 10, 135), [40, 70, 100, 130]);
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

test('key cycle: a clock jump gives one change, not a burst', () => {
  const cycle = createKeyCycle();
  cycle.reset(0);
  assert.equal(cycle.due(500), true);
  assert.equal(cycle.due(500.05), false);
  assert.deepEqual(keyChanges(cycle, 500.1, 531), [530]);
});

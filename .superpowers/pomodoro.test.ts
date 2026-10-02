import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canSplit, clampMinutes, formatTime, initialState, nextPhase, randomSplit } from './pomodoro.ts'

const S = { work: 20, short: 5, long: 15, budget: null }

test('cycle is work, short, work, short, work, long, work', () => {
  let st = initialState(S)
  const seen = [st.phase]
  for (let i = 0; i < 6; i++) {
    st = nextPhase(st, S)
    seen.push(st.phase)
  }
  assert.deepEqual(seen, ['work', 'short', 'work', 'short', 'work', 'long', 'work'])
})

test('phase durations come from settings, in seconds', () => {
  let st = initialState(S)
  assert.equal(st.duration, 1200)
  st = nextPhase(st, S)
  assert.equal(st.duration, 300)
  for (let i = 0; i < 4; i++) st = nextPhase(st, S)
  assert.equal(st.phase, 'long')
  assert.equal(st.duration, 900)
})

test('budget shortens the last session, then done with no break', () => {
  const s = { ...S, budget: 50 }
  let st = initialState(s) // work 20
  st = nextPhase(nextPhase(st, s), s) // short, work 20
  st = nextPhase(nextPhase(st, s), s) // short, work 10
  assert.equal(st.phase, 'work')
  assert.equal(st.duration, 600)
  st = nextPhase(st, s)
  assert.equal(st.phase, 'done')
  assert.equal(st.budgetLeft, 0)
  assert.equal(nextPhase(st, s), st)
})

test('skipping a work session deducts only the time worked', () => {
  const s = { ...S, budget: 50 }
  const st = nextPhase(initialState(s), s, 300)
  assert.equal(st.phase, 'short')
  assert.equal(st.budgetLeft, 2700)
})

test('random queue sets work lengths, then falls back to the fixed length', () => {
  const s = { ...S, budget: 60 }
  let st = initialState(s, [10, 15])
  assert.equal(st.duration, 600)
  st = nextPhase(nextPhase(st, s, 60), s) // skip after 1 min, then break ends
  assert.equal(st.duration, 900)
  st = nextPhase(nextPhase(st, s, 60), s) // queue is empty, 58 min of budget left
  assert.equal(st.phase, 'work')
  assert.equal(st.duration, 1200)
})

test('randomSplit sums to the budget with every session in range', () => {
  for (let i = 0; i < 200; i++) {
    const parts = randomSplit(60, 5, 25)
    assert.ok(parts)
    assert.equal(parts.reduce((a, b) => a + b, 0), 60)
    assert.ok(parts.every((p) => Number.isInteger(p) && p >= 5 && p <= 25))
  }
})

test('randomSplit returns null when no split exists', () => {
  assert.equal(randomSplit(7, 5, 6), null)
  assert.equal(randomSplit(60, 30, 10), null)
  assert.equal(canSplit(7, 5, 6), false)
  assert.equal(canSplit(60, 5, 25), true)
  assert.deepEqual(randomSplit(10, 5, 5), [5, 5])
})

test('clampMinutes rounds, clamps, and treats junk as the minimum', () => {
  assert.equal(clampMinutes('20', 5, 120), 20)
  assert.equal(clampMinutes('3', 5, 120), 5)
  assert.equal(clampMinutes('500', 5, 120), 120)
  assert.equal(clampMinutes('7.6', 5, 120), 8)
  assert.equal(clampMinutes('', 5, 120), 5)
  assert.equal(clampMinutes('abc', 5, 120), 5)
})

test('formatTime shows MM:SS, and H:MM:SS from one hour', () => {
  assert.equal(formatTime(1200), '20:00')
  assert.equal(formatTime(59.2), '01:00')
  assert.equal(formatTime(7200), '2:00:00')
  assert.equal(formatTime(-1), '00:00')
})

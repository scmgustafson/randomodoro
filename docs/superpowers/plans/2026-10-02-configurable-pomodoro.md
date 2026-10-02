# Configurable Pomodoro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-page Next.js pomodoro timer on a tomato, with configurable lengths, an optional total work budget, a random session splitter, and three end-of-phase sounds.

**Architecture:** One client component (`app/page.tsx`) holds UI and timer state. All timer rules live in a pure module (`lib/pomodoro.ts`) tested with Node's built-in test runner. Sounds are synthesized with the Web Audio API in `lib/sounds.ts`. No backend.

**Tech Stack:** Next.js (App Router, TypeScript), React, plain CSS, `node --test`. No other dependencies.

**Spec:** `docs/superpowers/specs/2026-10-02-configurable-pomodoro-design.md`

## Global Constraints

- Work, short break, long break lengths: whole minutes, 5 to 120. Defaults 20 / 5 / 15.
- Total work time: optional, off by default, whole minutes, 5 or more (input capped at 1440).
- Random min and max: whole minutes, 5 to 120.
- Long break follows every 3rd work session.
- Page background ketchup red; every button mustard yellow with black text.
- Countdown shows `MM:SS`, or `H:MM:SS` at 1 hour and above.
- No dependencies beyond what `create-next-app` installs. No UI, styling, test, or audio libraries.
- No audio files: all three sounds are synthesized.
- Installing anything requires the user's explicit yes first (user's global rule). Never `git push`.

## Review Focus

1. Empty or non-numeric text in a number field → value becomes the field's minimum, never `NaN`. Pinned by the `clampMinutes` test in Task 2.
2. Skipping a work session part-way → only the time actually worked leaves the budget. Pinned by the skip test in Task 2.
3. Skipping the random sessions so budget remains after the random list runs out → next work session falls back to the fixed work length, capped by the budget. Pinned by the queue test in Task 2.
4. Tab in the background → the countdown stays correct because it is computed from an end timestamp. The sound may fire late (browser timer throttling); accepted and marked with a `ponytail:` comment. Manual check in Task 3.
5. Skip while paused → moves to the next phase and stays paused. Manual check in Task 3.

---

### Task 1: Scaffold the Next.js app

**Files:**
- Create (generated): `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore`
- Modify: `tsconfig.json`, `package.json`, `app/layout.tsx`
- Delete: `app/page.module.css`, everything in `public/`

**Interfaces:**
- Produces: a building Next.js project with an `npm test` script that runs `node --test "lib/*.test.ts"`, and the `@/*` import alias pointing at the project root.

- [ ] **Step 1: Confirm install approval**

The user must have said yes to running `npx create-next-app@latest`, which downloads `create-next-app` and installs `next`, `react`, `react-dom`, `typescript`, `@types/node`, `@types/react`, `@types/react-dom` into this folder. If not, stop and ask.

- [ ] **Step 2: Scaffold into the current folder**

```bash
npx create-next-app@latest . --ts --app --no-tailwind --no-linter --no-src-dir --no-react-compiler --no-cache-components --no-agents-md --import-alias "@/*" --use-npm --disable-git --yes
```

Expected: "Success! Created configurable-pomodoro". The existing `docs/` and `.git/` are allowed by the scaffolder.

- [ ] **Step 3: Remove template leftovers**

```bash
rm -f app/page.module.css public/*.svg
```

- [ ] **Step 4: Replace `app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'Configurable Pomodoro' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Replace `app/page.tsx` with a stub (Task 3 fills it in)**

```tsx
export default function Page() {
  return <main>Pomodoro</main>
}
```

- [ ] **Step 6: Allow `.ts` import extensions**

Node runs the test file directly and needs `./pomodoro.ts` with its extension. In `tsconfig.json`, inside `compilerOptions`, add:

```json
"allowImportingTsExtensions": true,
```

- [ ] **Step 7: Add the test script**

In `package.json` `scripts`, add:

```json
"test": "node --test \"lib/*.test.ts\""
```

- [ ] **Step 8: Verify the build**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js app"
```

---

### Task 2: Timer logic (`lib/pomodoro.ts`)

**Files:**
- Create: `lib/pomodoro.ts`
- Test: `lib/pomodoro.test.ts`

**Interfaces:**
- Produces (all exported from `lib/pomodoro.ts`):
  - `type Phase = 'work' | 'short' | 'long' | 'done'`
  - `interface Settings { work: number; short: number; long: number; budget: number | null }` (minutes; `budget: null` = unlimited)
  - `interface State { phase: Phase; duration: number; worked: number; budgetLeft: number | null; queue: number[] | null }` (`duration` and `budgetLeft` in seconds; `queue` = random session lengths in minutes still to come)
  - `initialState(s: Settings, queue?: number[] | null): State`
  - `nextPhase(st: State, s: Settings, elapsed?: number): State` (`elapsed` = seconds spent in the current phase; defaults to the full `st.duration`)
  - `canSplit(budget: number, min: number, max: number): boolean`
  - `randomSplit(budget: number, min: number, max: number, rng?: () => number): number[] | null`
  - `clampMinutes(raw: string, min: number, max: number): number`
  - `formatTime(sec: number): string`

- [ ] **Step 1: Write the failing tests**

Create `lib/pomodoro.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot find module `./pomodoro.ts`.

- [ ] **Step 3: Write the implementation**

Create `lib/pomodoro.ts`:

```ts
export type Phase = 'work' | 'short' | 'long' | 'done'

// Lengths in minutes. budget null = unlimited work time.
export interface Settings {
  work: number
  short: number
  long: number
  budget: number | null
}

export interface State {
  phase: Phase
  duration: number // seconds in the current phase
  worked: number // work sessions finished
  budgetLeft: number | null // seconds
  queue: number[] | null // random session lengths (minutes) still to come
}

function startWork(s: Settings, worked: number, budgetLeft: number | null, queue: number[] | null): State {
  const want = (queue?.[0] ?? s.work) * 60
  return {
    phase: 'work',
    duration: Math.min(want, budgetLeft ?? Infinity),
    worked,
    budgetLeft,
    queue: queue?.slice(1) ?? null,
  }
}

export function initialState(s: Settings, queue: number[] | null = null): State {
  return startWork(s, 0, s.budget === null ? null : s.budget * 60, queue)
}

// elapsed = seconds spent in the current phase (less than duration when skipped).
export function nextPhase(st: State, s: Settings, elapsed = st.duration): State {
  if (st.phase === 'done') return st
  if (st.phase !== 'work') return startWork(s, st.worked, st.budgetLeft, st.queue)
  const worked = st.worked + 1
  const budgetLeft = st.budgetLeft === null ? null : Math.max(0, st.budgetLeft - elapsed)
  if (budgetLeft === 0) return { ...st, phase: 'done', duration: 0, worked, budgetLeft }
  const long = worked % 3 === 0
  return { ...st, phase: long ? 'long' : 'short', duration: (long ? s.long : s.short) * 60, worked, budgetLeft }
}

// n sessions fit when n*min <= budget <= n*max.
export function canSplit(budget: number, min: number, max: number): boolean {
  return min >= 1 && min <= max && Math.ceil(budget / max) <= Math.floor(budget / min)
}

export function randomSplit(budget: number, min: number, max: number, rng: () => number = Math.random): number[] | null {
  if (!canSplit(budget, min, max)) return null
  const lo = Math.ceil(budget / max)
  const hi = Math.floor(budget / min)
  const n = lo + Math.floor(rng() * (hi - lo + 1))
  const parts: number[] = Array(n).fill(min)
  for (let extra = budget - n * min; extra > 0; extra--) {
    const open = parts.flatMap((p, i) => (p < max ? [i] : []))
    parts[open[Math.floor(rng() * open.length)]]++
  }
  return parts
}

export function clampMinutes(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw))
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
}

export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec))
  const pad = (n: number) => String(n).padStart(2, '0')
  const h = Math.floor(s / 3600)
  const mmss = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
  return h ? `${h}:${mmss}` : mmss
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: 9 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add lib/pomodoro.ts lib/pomodoro.test.ts
git commit -m "Add pomodoro timer logic"
```

---

### Task 3: Sounds and the page

**Files:**
- Create: `lib/sounds.ts`
- Modify: `app/page.tsx` (replace stub), `app/globals.css` (replace)

**Interfaces:**
- Consumes: everything Task 2 produces, imported from `@/lib/pomodoro`.
- Produces: `lib/sounds.ts` exports `type Sound = 'beep' | 'beeps' | 'classical'`, `unlock(): AudioContext`, `play(sound: Sound): void`.

- [ ] **Step 1: Create `lib/sounds.ts`**

```ts
export type Sound = 'beep' | 'beeps' | 'classical'

let ctx: AudioContext | undefined

// Browsers only allow audio after a user gesture; call this from a click handler.
export function unlock(): AudioContext {
  ctx ??= new AudioContext()
  void ctx.resume()
  return ctx
}

function tone(ac: AudioContext, freq: number, start: number, dur: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.2, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur)
}

const [C, D, E, F, G] = [261.63, 293.66, 329.63, 349.23, 392.0]
// Opening phrase of Beethoven's "Ode to Joy" as [frequency, beats].
const ODE: [number, number][] = [
  [E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1],
  [C, 1], [C, 1], [D, 1], [E, 1], [E, 1.5], [D, 0.5], [D, 2],
]
const BEAT = 0.5 // seconds

export function play(sound: Sound) {
  const ac = unlock()
  let t = ac.currentTime
  if (sound === 'beep') return tone(ac, 880, t, 0.3)
  if (sound === 'beeps') {
    for (let i = 0; i < 5; i++) tone(ac, 880, t + i * 0.25, 0.15)
    return
  }
  for (const [freq, beats] of ODE) {
    tone(ac, freq, t, beats * BEAT * 0.95)
    t += beats * BEAT
  }
}
```

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  canSplit,
  clampMinutes,
  formatTime,
  initialState,
  nextPhase,
  randomSplit,
  type Settings,
  type State,
} from '@/lib/pomodoro'
import { play, unlock, type Sound } from '@/lib/sounds'

const DEFAULTS = { work: 20, short: 5, long: 15, budgetOn: false, budget: 60, min: 5, max: 30, sound: 'beep' as Sound }
type Config = typeof DEFAULTS

const LABELS = { work: 'Work', short: 'Short break', long: 'Long break', done: 'Done' }

const toSettings = (c: Config): Settings => ({
  work: c.work,
  short: c.short,
  long: c.long,
  budget: c.budgetOn ? c.budget : null,
})

function Num(p: { label: string; value: number; min: number; max: number; onCommit: (v: number) => void }) {
  return (
    <label>
      {p.label}
      <input
        type="number"
        min={p.min}
        max={p.max}
        defaultValue={p.value}
        onBlur={(e) => {
          const v = clampMinutes(e.target.value, p.min, p.max)
          e.target.value = String(v)
          if (v !== p.value) p.onCommit(v)
        }}
      />
    </label>
  )
}

export default function Page() {
  const [cfg, setCfg] = useState(DEFAULTS)
  const [st, setSt] = useState<State>(() => initialState(toSettings(DEFAULTS)))
  const [left, setLeft] = useState(st.duration) // seconds left in the phase
  const [endAt, setEndAt] = useState<number | null>(null) // ms timestamp; null = not running
  const running = endAt !== null
  const done = st.phase === 'done'

  function begin(next: State, run: boolean) {
    setSt(next)
    setLeft(next.duration)
    setEndAt(run && next.phase !== 'done' ? Date.now() + next.duration * 1000 : null)
  }

  useEffect(() => {
    if (endAt === null) return
    // ponytail: main-thread interval. Browsers throttle hidden tabs, so the sound can
    // fire late (up to about a minute). Move the tick into a Web Worker if that matters.
    const id = setInterval(() => {
      const l = (endAt - Date.now()) / 1000
      if (l > 0) return setLeft(l)
      play(cfg.sound)
      begin(nextPhase(st, toSettings(cfg)), true)
    }, 250)
    return () => clearInterval(id)
  }, [endAt, st, cfg])

  // Changing a timer setting resets the cycle.
  function update(patch: Partial<Config>) {
    const c = { ...cfg, ...patch }
    setCfg(c)
    begin(initialState(toSettings(c)), false)
  }

  function toggle() {
    unlock()
    if (endAt === null) return setEndAt(Date.now() + left * 1000)
    setLeft((endAt - Date.now()) / 1000)
    setEndAt(null)
  }

  const skip = () => begin(nextPhase(st, toSettings(cfg), Math.round(st.duration - left)), running)
  const reset = () => begin(initialState(toSettings(cfg)), false)

  function random() {
    unlock()
    begin(initialState(toSettings(cfg), randomSplit(cfg.budget, cfg.min, cfg.max)), true)
  }

  const randomWhy = !cfg.budgetOn
    ? 'Set a total work time first'
    : cfg.min > cfg.max
      ? 'Min is greater than max'
      : !canSplit(cfg.budget, cfg.min, cfg.max)
        ? 'No sessions between min and max add up to the total'
        : ''

  const budgetNow = st.budgetLeft === null ? null : st.budgetLeft - (st.phase === 'work' ? st.duration - left : 0)

  return (
    <main>
      <svg viewBox="0 0 200 200" className="tomato" role="img" aria-label="Tomato timer">
        <ellipse cx="100" cy="112" rx="88" ry="78" fill="#e8301c" stroke="#5e0d07" strokeWidth="4" />
        <path d="M100 40 l-28 -8 16 16 -24 10 30 2 6 22 6 -22 30 -2 -24 -10 16 -16z" fill="#2e7d32" />
        <text x="100" y="130" textAnchor="middle" className="time">
          {formatTime(left)}
        </text>
      </svg>

      <p className="phase" aria-live="polite">
        {LABELS[st.phase]}
        {budgetNow !== null && ` · ${formatTime(budgetNow)} of work left`}
      </p>

      <div className="row">
        <button onClick={toggle} disabled={done}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button onClick={skip} disabled={done}>
          Skip
        </button>
        <button onClick={reset}>Reset</button>
      </div>

      <fieldset disabled={running}>
        <legend>Settings{running && ' (pause to edit)'}</legend>
        <Num label="Work (min)" value={cfg.work} min={5} max={120} onCommit={(v) => update({ work: v })} />
        <Num label="Short break (min)" value={cfg.short} min={5} max={120} onCommit={(v) => update({ short: v })} />
        <Num label="Long break (min)" value={cfg.long} min={5} max={120} onCommit={(v) => update({ long: v })} />
        <label>
          Limit total work time
          <input type="checkbox" checked={cfg.budgetOn} onChange={(e) => update({ budgetOn: e.target.checked })} />
        </label>
        {cfg.budgetOn && (
          <Num label="Total work (min)" value={cfg.budget} min={5} max={1440} onCommit={(v) => update({ budget: v })} />
        )}
        <Num label="Random min (min)" value={cfg.min} min={5} max={120} onCommit={(v) => setCfg({ ...cfg, min: v })} />
        <Num label="Random max (min)" value={cfg.max} min={5} max={120} onCommit={(v) => setCfg({ ...cfg, max: v })} />
        <button onClick={random} disabled={randomWhy !== ''}>
          Random
        </button>
        {randomWhy && <p className="why">{randomWhy}</p>}
      </fieldset>

      <label className="sound">
        Sound when time is up
        <select
          value={cfg.sound}
          onChange={(e) => {
            const sound = e.target.value as Sound
            setCfg({ ...cfg, sound })
            play(sound)
          }}
        >
          <option value="beep">Short beep</option>
          <option value="beeps">Many beeps</option>
          <option value="classical">Classical (Ode to Joy)</option>
        </select>
      </label>
    </main>
  )
}
```

- [ ] **Step 3: Replace `app/globals.css`**

```css
:root {
  --ketchup: #9e1b12;
  --mustard: #e1ad01;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--ketchup);
  color: #fff;
  font-family: system-ui, sans-serif;
}

main {
  max-width: 420px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.tomato {
  width: min(320px, 80vw);
}

.time {
  fill: #fff;
  font-size: 36px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.phase {
  margin: 0;
  font-size: 1.25rem;
}

.row {
  display: flex;
  gap: 12px;
}

button {
  background: var(--mustard);
  color: #000;
  border: 0;
  border-radius: 8px;
  padding: 10px 18px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 3px solid #fff;
  outline-offset: 2px;
}

fieldset {
  width: 100%;
  border: 2px solid rgb(255 255 255 / 0.4);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.sound {
  width: 100%;
}

input[type='number'] {
  width: 6em;
}

input,
select {
  font: inherit;
  padding: 4px 6px;
}

.why {
  margin: 0;
  font-size: 0.9rem;
}
```

- [ ] **Step 4: Verify tests and build**

Run: `npm test && npm run build`
Expected: 9 tests pass; build completes with no type errors.

- [ ] **Step 5: Manual check in the browser**

Run: `npm run dev` and open `http://localhost:3000`. Use Skip to move through phases quickly. Confirm:

1. Red page, tomato centered showing `20:00`, all buttons mustard with black text.
2. Start counts down; Pause freezes; Start resumes from the same value.
3. Skip while paused moves to "Short break" at `05:00` and stays paused.
4. Skip three work sessions in a row (skipping the breaks too): the third break is "Long break" at `15:00`.
5. Typing `3` in Work and tabbing out shows `5`; typing `500` shows `120`; clearing it shows `5`.
6. Tick "Limit total work time", set Total work to 30, Work to 20: after the first full or skipped work session the budget line drops only by the time worked.
7. With Total work 7, Random min 5, Random max 6: Random is disabled with "No sessions between min and max add up to the total".
8. With Total work 60, min 5, max 25: Random starts a work session between 5 and 25 minutes.
9. Each option in the sound picker plays its preview; "Classical" plays the Ode to Joy phrase.
10. Start a phase, switch to another tab for 30 seconds, return: the countdown has moved 30 seconds.
11. Reset returns to `20:00` "Work" (or the configured work length).

- [ ] **Step 6: Commit**

```bash
git add app lib/sounds.ts
git commit -m "Add tomato timer page and sounds"
```

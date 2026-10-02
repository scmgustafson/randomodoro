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

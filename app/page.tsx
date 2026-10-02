'use client'

import { useEffect, useRef, useState } from 'react'
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

const DEFAULTS = { work: 20, short: 5, long: 15, budgetOn: false, budget: 60, min: 5, max: 30, sound: 'beep' as Sound, skipDepletes: false, blur: false }
type Config = typeof DEFAULTS

const LABELS = { work: 'Work', short: 'Short break', long: 'Long break', done: 'Done' }
const RING = 2 * Math.PI * 102 // circumference of the progress ring

const toSettings = (c: Config): Settings => ({
  work: c.work,
  short: c.short,
  long: c.long,
  budget: c.budgetOn ? c.budget : null,
})

function Num(p: {
  label: string
  value: number
  min: number
  max: number
  onCommit: (v: number) => void
  notify: (msg: string) => void
}) {
  return (
    <label>
      <span>
        {p.label} <small>min</small>
      </span>
      <input
        type="number"
        min={p.min}
        max={p.max}
        defaultValue={p.value}
        onBlur={(e) => {
          const v = clampMinutes(e.target.value, p.min, p.max)
          if (Number(e.target.value) !== v)
            p.notify(`${p.label} must be a whole number from ${p.min} to ${p.max}. Set to ${v}.`)
          e.target.value = String(v)
          if (v !== p.value) p.onCommit(v)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    </label>
  )
}

export default function Page() {
  const [cfg, setCfg] = useState(DEFAULTS)
  const [st, setSt] = useState<State>(() => initialState(toSettings(DEFAULTS)))
  const [left, setLeft] = useState(st.duration) // seconds left in the phase
  const [endAt, setEndAt] = useState<number | null>(null) // ms timestamp; null = not running
  const [dark, setDark] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const toastId = useRef(0)
  const running = endAt !== null
  const done = st.phase === 'done'

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  function notify(msg: string) {
    const id = toastId.current++
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  // from = when the phase starts. A late tick passes the previous phase's end so the
  // schedule does not drift; if that would already be over (laptop slept), start now.
  function begin(next: State, run: boolean, from = Date.now()) {
    const end = from + next.duration * 1000
    setSt(next)
    setLeft(next.duration)
    setEndAt(run && next.phase !== 'done' ? (end > Date.now() ? end : Date.now() + next.duration * 1000) : null)
  }

  useEffect(() => {
    if (endAt === null) return
    // ponytail: main-thread interval. Browsers throttle hidden tabs, so the sound can
    // fire late (up to about a minute). Move the tick into a Web Worker if that matters.
    const id = setInterval(() => {
      const l = (endAt - Date.now()) / 1000
      if (l > 0) return setLeft(l)
      const next = nextPhase(st, toSettings(cfg))
      play(next.phase === 'done' ? 'victory' : cfg.sound)
      begin(next, true, endAt)
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

  function skip() {
    const whole = st.phase === 'work' && cfg.skipDepletes
    const next = nextPhase(st, toSettings(cfg), whole ? st.duration : Math.round(st.duration - left))
    if (next.phase === 'done') play('victory')
    begin(next, running)
  }
  const reset = () => begin(initialState(toSettings(cfg)), false)

  function random() {
    const why = !cfg.budgetOn
      ? 'Turn on "Limit total work time" before using Random.'
      : cfg.min > cfg.max
        ? 'Shortest random session is greater than the longest.'
        : !canSplit(cfg.budget, cfg.min, cfg.max)
          ? `No sessions of ${cfg.min} to ${cfg.max} minutes add up to ${cfg.budget} minutes.`
          : ''
    if (why) return notify(why)
    unlock()
    begin(initialState(toSettings(cfg), randomSplit(cfg.budget, cfg.min, cfg.max)), true)
  }

  const budgetNow = st.budgetLeft === null ? null : st.budgetLeft - (st.phase === 'work' ? st.duration - left : 0)
  const cycleDone = st.phase === 'long' ? 3 : st.worked % 3 // work sessions finished in this cycle of 3

  return (
    <>
      <header>
        <h1>Randomodoro</h1>
        <button onClick={() => setDark(!dark)} aria-pressed={dark}>
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <main>
        <svg
          viewBox="0 0 220 220"
          className={`tomato${running ? ' running' : ''}${cfg.blur ? ' blurred' : ''}`}
          role="img"
          aria-label={cfg.blur ? 'Time hidden' : `${formatTime(left)} left`}
        >
          <defs>
            <radialGradient id="skin" cx="35%" cy="28%" r="80%">
              <stop offset="0%" stopColor="#ff7a5c" />
              <stop offset="45%" stopColor="#e8301c" />
              <stop offset="100%" stopColor="#a8170c" />
            </radialGradient>
          </defs>
          <circle className="track" cx="110" cy="110" r="102" />
          <circle
            className="progress"
            cx="110"
            cy="110"
            r="102"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - (st.duration ? left / st.duration : 0))}
          />
          <g className="fruit">
            <ellipse cx="110" cy="120" rx="84" ry="74" fill="url(#skin)" />
            <path d="M110 48 l-28 -8 16 16 -24 10 30 2 6 22 6 -22 30 -2 -24 -10 16 -16z" fill="#2e7d32" />
          </g>
          <text x="110" y="138" textAnchor="middle" className="time">
            {formatTime(left)}
          </text>
        </svg>

        <div className="status">
          <p className="phase" aria-live="polite">
            {LABELS[st.phase]}
          </p>
          <div className="dots" role="img" aria-label={`${cycleDone} of 3 work sessions done in this cycle`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < cycleDone ? 'dot on' : 'dot'} />
            ))}
          </div>
          {budgetNow !== null && <p className="budget">{formatTime(budgetNow)} of work left</p>}
        </div>

        <div className="row">
          <button onClick={toggle} disabled={done}>
            {running ? 'Pause' : 'Start'}
          </button>
          <button onClick={skip} disabled={done}>
            Skip
          </button>
          <button onClick={reset}>Reset</button>
        </div>

        <fieldset className="card" disabled={running}>
          <legend>Settings{running && ' (pause to edit)'}</legend>
          <Num label="Work" value={cfg.work} min={5} max={120} notify={notify} onCommit={(v) => update({ work: v })} />
          <Num label="Short break" value={cfg.short} min={5} max={120} notify={notify} onCommit={(v) => update({ short: v })} />
          <Num label="Long break" value={cfg.long} min={5} max={120} notify={notify} onCommit={(v) => update({ long: v })} />
          <label>
            Limit total work time
            <input type="checkbox" checked={cfg.budgetOn} onChange={(e) => update({ budgetOn: e.target.checked })} />
          </label>
          {cfg.budgetOn && (
            <Num label="Total work" value={cfg.budget} min={5} max={1440} notify={notify} onCommit={(v) => update({ budget: v })} />
          )}
          {cfg.budgetOn && (
            <label>
              Skipping uses up the whole session
              <input
                type="checkbox"
                checked={cfg.skipDepletes}
                onChange={(e) => setCfg({ ...cfg, skipDepletes: e.target.checked })}
              />
            </label>
          )}
          <hr />
          <Num label="Shortest random session" value={cfg.min} min={5} max={120} notify={notify} onCommit={(v) => setCfg({ ...cfg, min: v })} />
          <Num label="Longest random session" value={cfg.max} min={5} max={120} notify={notify} onCommit={(v) => setCfg({ ...cfg, max: v })} />
          <button onClick={random}>Random</button>
        </fieldset>

        <div className="card">
          <label>
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
          <label>
            Victory sound when all work is done
            <button onClick={() => play('victory')}>Preview</button>
          </label>
          <label>
            Blur the timer
            <input type="checkbox" checked={cfg.blur} onChange={(e) => setCfg({ ...cfg, blur: e.target.checked })} />
          </label>
        </div>
      </main>

      <div className="toasts" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="alert">
            {t.msg}
          </div>
        ))}
      </div>
    </>
  )
}

# Configurable Pomodoro — Design

Date: 2026-10-02

## Goal

A single-page Next.js web app: a tomato in the center of the page with a countdown timer on it. Unlike a standard pomodoro, every length is configurable, work sessions can draw from a total work budget, and a Random button splits that budget into random-length sessions.

No backend, no accounts. Everything runs in the browser.

## Look

- Page background: ketchup red.
- Tomato: inline SVG, centered, with the countdown (`MM:SS`, or `H:MM:SS` at 1 hour and above) on it.
- All buttons: mustard yellow with black text (black gives the higher contrast on mustard).
- Under the tomato: current phase (Work, Short break, Long break, Done) and, when a budget is set, the remaining work budget.

## Controls

- Start/Pause, Skip (ends the current phase now), Reset (back to the first work session, budget restored).
- Settings, each 5 to 120 minutes, whole minutes:
  - Work length (default 20)
  - Short break length (default 5)
  - Long break length (default 15)
- Total work time: optional, off by default. When on, a whole number of minutes, 5 or more.
- Random: min and max session length (5 to 120 minutes, min ≤ max) and a Random button.
- Sound picker: Short beep (default), Many beeps, Classical.
- Settings are editable only while the timer is not running. Changing them resets the cycle.

## Behavior

1. Cycle: work → short break → work → short break → work → long break, then repeat. The long break follows every 3rd work session.
2. When a phase reaches 0, the chosen sound plays and the next phase starts automatically.
3. Budget, when set:
   - Each work session draws its elapsed time from the budget. Skipping a work session only deducts the time actually worked.
   - If less than a full work session remains, the next work session is shortened to what remains.
   - When the budget reaches 0, the phase becomes Done and no more work sessions start. No break follows the final work session.
4. Random:
   - Requires a budget. Splits the budget into whole-minute sessions, each between min and max, summing exactly to the budget. The number of sessions comes out of the split.
   - Replaces the fixed work length with that list of session lengths, resets the cycle, and starts the first session.
   - Breaks keep their configured lengths and the same every-3rd-session long break.
   - If no valid split exists (for example budget 7, min 5, max 6), the Random button is disabled with a one-line reason.
5. Reset clears any random session list and returns to the fixed work length.

## Sounds

All three are synthesized with the Web Audio API. No audio files, so no licensing question.

- Short beep: one tone, about 0.3 seconds.
- Many beeps: five short tones.
- Classical: the opening phrase of Beethoven's "Ode to Joy" (public domain composition), about 8 seconds.

Selecting a sound in the picker plays it as a preview. Browsers only allow audio after a user gesture; pressing Start satisfies that.

## Architecture

- Next.js (App Router, TypeScript), one page.
- `app/page.tsx`: one client component holding the UI and timer state.
- `app/globals.css`: plain CSS. No UI or styling libraries.
- `lib/pomodoro.ts`: pure logic, no React.
  - `nextPhase(state, settings)`: phase order, long-break cadence, budget handling, Done.
  - `randomSplit(budget, min, max, rng)`: returns the session list, or `null` when no split exists. `rng` is injectable for tests.
- `lib/sounds.ts`: the three Web Audio sounds.
- The countdown is computed from an end timestamp (`Date.now()`), not from counting ticks, so it stays accurate when the tab is in the background.

## Random split algorithm

Sessions are whole minutes. A split of budget `Y` into `n` sessions in `[min, max]` exists when `n*min ≤ Y ≤ n*max`. Pick `n` at random from the valid values, give each session `min`, then hand out the remaining `Y − n*min` minutes one at a time to random sessions that are still below `max`. If no `n` is valid, return `null`.

## Error handling

- Number inputs are clamped to their allowed ranges.
- Random is disabled, with the reason shown, when no budget is set, min > max, or no split exists.

## Testing

One test file for `lib/pomodoro.ts`, run with Node's built-in test runner (no test framework dependency):

- `randomSplit`: sums exactly to the budget, every session within `[min, max]`, `null` when impossible.
- `nextPhase`: phase order with the long break after the 3rd work session; budget shortens the last session; Done at 0.

UI checked manually in the browser.

## Out of scope

- Saving settings across page refreshes.
- Desktop notifications.
- Accounts, session history, statistics.

## Addendum (2026-10-02): polish

- Top bar with the title "Randomodoro" and a dark mode toggle next to it.
- Error toasts replace the inline Random reason and report corrected number inputs. The Random button is clickable whenever the timer is stopped.
- Modern styling: drop shadows, cards, transitions, a progress ring around the tomato.

## Addendum 2 (2026-10-02)

- "Skipping uses up the whole session" toggle (shown when a total work time is set, off by default). Off: a skipped work session deducts only the time actually worked. On: it deducts the full session length.
- Victory sound: a fixed synthesized fanfare that plays instead of the regular sound when the total work time reaches 0. A Preview button plays it.
- "Blur the timer" toggle: blurs the time on the tomato and hides the progress ring. Works while the timer runs.
- End-to-end tests run with Playwright (`npm run e2e`).
- A phase that ends late (throttled background tab) no longer delays the following phases; the next phase is timed from when the previous one should have ended.

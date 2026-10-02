import { expect, test, type Page } from '@playwright/test'

const T0 = new Date('2026-01-01T09:00:00')

// Freeze the page clock so the countdown only moves when a test says so.
async function open(page: Page) {
  await page.clock.install({ time: T0 })
  await page.goto('/')
  await page.clock.pauseAt(new Date(T0.getTime() + 10_000))
}

const time = (page: Page) => page.locator('.time')
const phase = (page: Page) => page.locator('.phase')
const field = (page: Page, name: RegExp) => page.getByRole('spinbutton', { name })
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })

async function setField(page: Page, name: RegExp, value: string) {
  await field(page, name).fill(value)
  await field(page, name).blur()
}

test('shows the title, the tomato timer and mustard buttons', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('heading', { name: 'Randomodoro' })).toBeVisible()
  await expect(time(page)).toHaveText('20:00')
  await expect(phase(page)).toHaveText('Work')
  await expect(button(page, 'Start')).toHaveCSS('background-color', 'rgb(225, 173, 1)')
  await expect(button(page, 'Start')).toHaveCSS('color', 'rgb(0, 0, 0)')
})

test('start counts down and pause freezes', async ({ page }) => {
  await open(page)
  await button(page, 'Start').click()
  await page.clock.runFor(5000)
  await expect(time(page)).toHaveText('19:55')
  await button(page, 'Pause').click()
  await page.clock.runFor(5000)
  await expect(time(page)).toHaveText('19:55')
})

test('a finished work session rolls into a running short break', async ({ page }) => {
  await open(page)
  await button(page, 'Start').click()
  await page.clock.runFor('20:01')
  await expect(phase(page)).toHaveText('Short break')
  await expect(button(page, 'Pause')).toBeVisible()
})

test('the third work session is followed by a long break; skip while paused stays paused', async ({ page }) => {
  await open(page)
  for (let i = 0; i < 5; i++) await button(page, 'Skip').click()
  await expect(phase(page)).toHaveText('Long break')
  await expect(time(page)).toHaveText('15:00')
  await expect(button(page, 'Start')).toBeVisible()
})

test('an out-of-range length is corrected with a toast that goes away', async ({ page }) => {
  await open(page)
  await setField(page, /^Work/, '0')
  await expect(field(page, /^Work/)).toHaveValue('1')
  await expect(time(page)).toHaveText('01:00')
  const toast = page.getByRole('alert').filter({ hasText: 'Work must be a whole number from 1 to 120' })
  await expect(toast).toBeVisible()
  await page.clock.runFor(4100)
  await expect(toast).toHaveCount(0)
})

test('random without a total work time shows an error toast', async ({ page }) => {
  await open(page)
  await button(page, 'Random').click()
  await expect(page.getByRole('alert').filter({ hasText: 'Limit total work time' })).toBeVisible()
  await expect(button(page, 'Start')).toBeVisible()
})

test('random with no possible split shows an error toast', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await setField(page, /^Total work/, '7')
  await setField(page, /^Longest/, '6')
  await button(page, 'Random').click()
  await expect(page.getByRole('alert').filter({ hasText: "4 sessions of 5 to 6 minutes can't add up to 7 minutes" })).toBeVisible()
})

test('random makes exactly the chosen number of work sessions', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await page.getByRole('checkbox', { name: 'Skipping uses up the whole session' }).check()
  await setField(page, /^Number of sessions/, '3')
  await button(page, 'Random').click()
  for (let i = 0; i < 4; i++) await button(page, 'Skip').click() // work, break, work, break
  await expect(phase(page)).toHaveText('Work')
  await button(page, 'Skip').click() // the third session uses up the last of the work time
  await expect(phase(page)).toHaveText('Done')
})

test('settings are grouped, and panel position is hidden on a phone', async ({ page }) => {
  await open(page)
  for (const name of ['Timer', 'Random', 'Sound', 'Display']) await expect(page.getByRole('group', { name })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 667 })
  await expect(page.getByRole('combobox', { name: 'Panel position' })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(375)
})

test('random starts a work session within min and max', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await setField(page, /^Longest/, '25')
  await button(page, 'Random').click()
  await expect(button(page, 'Pause')).toBeVisible()
  const [m] = ((await time(page).textContent()) ?? '').split(':').map(Number)
  expect(m).toBeGreaterThanOrEqual(5)
  expect(m).toBeLessThanOrEqual(25)
  await expect(page.locator('.budget')).toHaveText('1:00:00 of work left')
})

test('the work budget shortens the session and ends in Done', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await setField(page, /^Total work/, '5')
  await expect(time(page)).toHaveText('05:00')
  await button(page, 'Start').click()
  await page.clock.runFor('05:01')
  await expect(phase(page)).toHaveText('Done')
  await expect(button(page, 'Start')).toBeDisabled()
})

test('dark mode toggles the theme', async ({ page }, info) => {
  await open(page)
  await page.screenshot({ path: info.outputPath('light.png'), fullPage: true })
  await button(page, 'Dark mode').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(button(page, 'Light mode')).toBeVisible()
  await page.screenshot({ path: info.outputPath('dark.png'), fullPage: true })
})

test('the remaining time is exposed to screen readers', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('img', { name: '20:00 left' })).toBeVisible()
})

test('the per-second budget line is not in a live region', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await expect(page.locator('.budget')).toHaveCount(1)
  await expect(page.locator('[aria-live] .budget')).toHaveCount(0)
})

test('a late tick does not delay the next phase', async ({ page }) => {
  await open(page)
  await button(page, 'Start').click()
  await page.clock.fastForward('20:50') // tab was throttled: the tick lands 50 s after work ended
  await page.clock.runFor(1000)
  await expect(phase(page)).toHaveText('Short break')
  await expect(time(page)).toHaveText('04:09')
})

test('pressing Enter in a length field applies it', async ({ page }) => {
  await open(page)
  await field(page, /^Work/).fill('25')
  await field(page, /^Work/).press('Enter')
  await expect(time(page)).toHaveText('25:00')
})

test('skipping a work session only uses up the time worked by default', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await button(page, 'Start').click()
  await page.clock.runFor('05:00')
  await button(page, 'Skip').click()
  await expect(page.locator('.budget')).toHaveText('55:00 of work left')
})

test('with the toggle on, skipping uses up the whole work session', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await page.getByRole('checkbox', { name: 'Skipping uses up the whole session' }).check()
  await button(page, 'Start').click()
  await page.clock.runFor('05:00')
  await button(page, 'Skip').click()
  await expect(page.locator('.budget')).toHaveText('40:00 of work left')
})

test('the blur toggle hides the time on the tomato', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Blur the timer' }).check()
  await expect(time(page)).toHaveCSS('filter', 'blur(9px)')
  await expect(page.getByRole('img', { name: 'Time hidden' })).toBeVisible()
  await expect(page.locator('.progress')).toBeHidden()
})

test('the victory sound, not the regular one, plays when all work time is used', async ({ page }) => {
  // Count the tones each sound asks for: the short beep is 1, the victory sound is 8.
  await page.addInitScript(() => {
    const w = window as unknown as { tones: number }
    w.tones = 0
    const make = AudioContext.prototype.createOscillator
    AudioContext.prototype.createOscillator = function () {
      w.tones++
      return make.call(this)
    }
  })
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  await setField(page, /^Total work/, '5')
  await button(page, 'Start').click()
  await page.clock.runFor('05:01')
  await expect(phase(page)).toHaveText('Done')
  expect(await page.evaluate(() => (window as unknown as { tones: number }).tones)).toBe(8)
})

test('every length can be as short as 1 minute, with no toast', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox', { name: 'Limit total work time' }).check()
  for (const name of [/^Work/, /^Short break/, /^Long break/, /^Total work/, /^Number of sessions/, /^Shortest/, /^Longest/]) {
    await setField(page, name, '1')
    await expect(field(page, name)).toHaveValue('1')
  }
  await expect(page.getByRole('alert').filter({ hasText: 'must be' })).toHaveCount(0)
  await expect(time(page)).toHaveText('01:00')
})

test('the control panel can be moved to the left or right of the tomato', async ({ page }, info) => {
  await open(page)
  const x = async (sel: string) => (await page.locator(sel).boundingBox())!.x
  const position = page.getByRole('combobox', { name: 'Panel position' })
  await position.selectOption('Left')
  expect(await x('.panel')).toBeLessThan(await x('.tomato'))
  await page.screenshot({ path: info.outputPath('left.png'), fullPage: true })
  await position.selectOption('Right')
  expect(await x('.panel')).toBeGreaterThan(await x('.tomato'))
  await position.selectOption('Below')
  const box = async (sel: string) => (await page.locator(sel).boundingBox())!
  expect((await box('.panel')).y).toBeGreaterThan((await box('.tomato')).y + (await box('.tomato')).height)
})

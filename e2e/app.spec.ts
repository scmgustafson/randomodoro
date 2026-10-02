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
  await setField(page, /^Work/, '3')
  await expect(field(page, /^Work/)).toHaveValue('5')
  await expect(time(page)).toHaveText('05:00')
  const toast = page.getByRole('alert').filter({ hasText: 'Work must be a whole number from 5 to 120' })
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
  await page.getByRole('checkbox').check()
  await setField(page, /^Total work/, '7')
  await setField(page, /^Longest/, '6')
  await button(page, 'Random').click()
  await expect(page.getByRole('alert').filter({ hasText: 'No sessions of 5 to 6 minutes add up to 7' })).toBeVisible()
})

test('random starts a work session within min and max', async ({ page }) => {
  await open(page)
  await page.getByRole('checkbox').check()
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
  await page.getByRole('checkbox').check()
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

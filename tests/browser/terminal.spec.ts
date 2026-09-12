import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })
test.setTimeout(60_000)

const terminalRows = (page: Page) =>
  page.locator('.xterm-accessibility-tree [role="listitem"]')
const terminalInput = (page: Page) =>
  page.getByRole('textbox', { name: 'Terminal input', exact: true })
const effectsCanvas = (page: Page) => page.locator('.retro-terminal__effects')

async function lines(page: Page) {
  return (await terminalRows(page).allTextContents()).map((line) =>
    line.replaceAll('\u00a0', ' ').trim()
  )
}

async function expectLine(page: Page, text: string) {
  await expect.poll(() => lines(page)).toContain(text)
}

async function expectPrompt(page: Page, path = '~') {
  await expect
    .poll(async () => (await lines(page)).filter(Boolean).at(-1))
    .toBe(`${path} ❯`)
}

async function openDemo(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PHOSPHOR / 01'
  )
}

async function expectGpuDisplay(page: Page) {
  const canvas = effectsCanvas(page)
  await expect(canvas).toBeVisible()
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => {
        const gl = element.getContext('webgl2')
        return Boolean(
          gl &&
          !gl.isContextLost() &&
          element.width > 300 &&
          element.height > 150
        )
      })
    )
    .toBe(true)
  await expect(
    page.locator('.xterm-screen > canvas:not(.xterm-link-layer)')
  ).toBeVisible()
  await expect(page.getByText('Basic display', { exact: true })).toHaveCount(0)
}

async function openShell(page: Page) {
  await terminalInput(page).focus()
  await terminalInput(page).press('q')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expectPrompt(page)
}

async function command(page: Page, value: string) {
  const input = terminalInput(page)
  await input.focus()
  await input.pressSequentially(value)
  await input.press('Enter')
}

test('opens a GPU-rendered sample dashboard with keyboard controls', async ({
  page
}) => {
  await openDemo(page)
  await expectGpuDisplay(page)
  await expect(page.getByText('Simulated data', { exact: true })).toBeVisible()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'SAMPLE DATA'
  )

  await terminalInput(page).press('p')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PAUSED'
  )
  await terminalInput(page).press('2')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'MEMORY HISTORY'
  )
  await terminalInput(page).press('p')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText('LIVE')
  await expect(
    page.getByRole('button', { name: 'Exit demo', exact: true })
  ).toBeVisible()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'Esc / q  EXIT TO SHELL'
  )
  await terminalInput(page).press('ArrowUp')
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await terminalInput(page).press('Escape')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expectPrompt(page)

  await command(page, 'demo')
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Green', exact: true }).focus()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expect(terminalInput(page)).toBeFocused()
  await expectPrompt(page)

  await command(page, 'demo')
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Exit demo', exact: true }).click()
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expectPrompt(page)
})

test('runs Unix commands, retains files and directory, and returns from diagnostics', async ({
  page
}) => {
  await openDemo(page)
  await openShell(page)

  await command(page, 'ls')
  await expectLine(page, 'welcome.txt')
  await expectPrompt(page)
  await command(page, 'cat welcome.txt | head -2')
  await expectLine(
    page,
    'A little phosphor, a little noise, a lot of character.'
  )
  await expectPrompt(page)
  await command(page, 'cd themes')
  await expectPrompt(page, '~/themes')
  await command(page, 'pwd')
  await expectLine(page, '/home/visitor/themes')
  await expectPrompt(page, '~/themes')
  await command(page, 'cat amber.txt | head -1')
  await expectLine(page, 'AMBER')
  await expectPrompt(page, '~/themes')
  await command(page, 'printf "session_%s\\n" saved > note.txt; cat note.txt')
  await expectLine(page, 'session_saved')
  await expectPrompt(page, '~/themes')

  await command(page, 'demo')
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PHOSPHOR / 01'
  )
  await terminalInput(page).press('q')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expectPrompt(page, '~/themes')
  await command(page, 'clear; cat note.txt; pwd')
  await expectLine(page, 'session_saved')
  await expectLine(page, '/home/visitor/themes')
  await expectPrompt(page, '~/themes')
})

test('theme changes preserve the session; Reset and reload start fresh', async ({
  page
}) => {
  await openDemo(page)
  await openShell(page)
  await command(page, 'printf "theme_%s\\n" kept > visit.txt; cat visit.txt')
  await expectLine(page, 'theme_kept')
  await expectPrompt(page)

  await page.getByRole('button', { name: 'Green', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Green', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Color CRT', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Color CRT', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expectLine(page, 'theme_kept')

  const effects = page.getByRole('switch', { name: 'CRT effects' })
  await effects.click()
  await expect(effects).toHaveAttribute('aria-checked', 'false')
  await expect(effectsCanvas(page)).toBeHidden()
  await expect(
    page.locator('.xterm-screen > canvas:not(.xterm-link-layer)')
  ).toBeVisible()
  await command(page, 'clear; cat visit.txt; printf "effects_%s\\n" off')
  await expectLine(page, 'theme_kept')
  await expectLine(page, 'effects_off')
  await expectPrompt(page)

  await command(page, 'echo overwritten > welcome.txt; cd themes')
  await expectPrompt(page, '~/themes')
  await terminalInput(page).pressSequentially('echo discarded-draft')
  await page
    .getByRole('button', { name: 'Reset the terminal and current theme' })
    .click()
  await expect(effects).toHaveAttribute('aria-checked', 'true')
  await expect(
    page.getByRole('button', { name: 'Color CRT', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  await expectGpuDisplay(page)
  await expect(page.getByText('Diagnostics', { exact: true })).toBeVisible()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText('LIVE')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PROCESSOR HISTORY'
  )
  await expect(terminalInput(page)).toBeFocused()
  await openShell(page)
  await expect(page.locator('.xterm-accessibility-tree')).not.toContainText(
    'theme_kept'
  )
  await expect(page.locator('.xterm-accessibility-tree')).not.toContainText(
    'discarded-draft'
  )
  await terminalInput(page).press('ArrowUp')
  await expectPrompt(page)
  await command(page, 'test ! -e visit.txt && head -2 welcome.txt')
  await expectLine(
    page,
    'A little phosphor, a little noise, a lot of character.'
  )
  await expectPrompt(page)
  await command(page, 'touch visit.txt')
  await expectPrompt(page)

  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Amber', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PHOSPHOR / 01'
  )
  await openShell(page)
  await command(
    page,
    'if test -e visit.txt; then echo persisted; else echo fresh; fi'
  )
  await expectLine(page, 'fresh')
  await expectPrompt(page)
})

test('Reset resumes paused diagnostics and cancels running shell work', async ({
  page
}) => {
  await openDemo(page)
  await terminalInput(page).press('p')
  await terminalInput(page).press('2')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PAUSED'
  )
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'MEMORY HISTORY'
  )
  const reset = page.getByRole('button', {
    name: 'Reset the terminal and current theme'
  })
  await reset.click()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText('LIVE')
  await expect(page.locator('.xterm-accessibility-tree')).toContainText(
    'PROCESSOR HISTORY'
  )
  const firstFrame = await lines(page)
  await expect.poll(() => lines(page)).not.toEqual(firstFrame)

  await openShell(page)
  await command(page, 'sleep 1; echo stale-output; touch late.txt')
  await reset.click()
  await expect(page.locator('.xterm-accessibility-tree')).toContainText('LIVE')
  await openShell(page)
  await command(page, 'sleep 1.2; test ! -e late.txt && echo fresh-session')
  await expectLine(page, 'fresh-session')
  await expectPrompt(page)
  await expect(page.locator('.xterm-accessibility-tree')).not.toContainText(
    'stale-output'
  )
})

test('falls back to a usable DOM terminal when WebGL2 is unavailable', async ({
  page
}) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply restores the canvas receiver.
    const getContext = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        return type === 'webgl2'
          ? null
          : Reflect.apply(getContext, this, [type, ...args])
      }
    })
  })
  await openDemo(page)
  await expect(page.getByText('Basic display', { exact: true })).toBeVisible()
  await expect(effectsCanvas(page)).toBeHidden()
  await expect(page.locator('.xterm-rows')).toBeVisible()
  await expect(page.locator('.xterm-rows')).toContainText('PHOSPHOR / 01')
  await openShell(page)
  await command(page, 'ls')
  await expectLine(page, 'welcome.txt')
  await expectPrompt(page)
  await command(page, 'cd themes')
  await expectPrompt(page, '~/themes')
  await command(
    page,
    'printf "fallback_%s\\n" working > local.txt; cat local.txt'
  )
  await expectLine(page, 'fallback_working')
  await expect(page.locator('.xterm-rows')).toContainText('fallback_working')
  await expectPrompt(page, '~/themes')
  await page.getByRole('button', { name: 'Green', exact: true }).click()
  await command(page, 'clear; cat local.txt; pwd')
  await expectLine(page, 'fallback_working')
  await expectLine(page, '/home/visitor/themes')
  await expect(page.getByText('Basic display', { exact: true })).toBeVisible()
})

test('supports text selection and fits the same session after resizing', async ({
  page
}) => {
  await openDemo(page)
  await openShell(page)
  await command(
    page,
    'clear; printf "\\n\\n\\n\\n\\n\\n\\n\\n\\n\\n%45s%s\\n" "" SELECTABLE'
  )
  await expectLine(page, 'SELECTABLE')
  await expectPrompt(page)

  const rawRows = await terminalRows(page).allTextContents()
  const row = rawRows.findIndex((value) => value.trim() === 'SELECTABLE')
  expect(row).toBeGreaterThanOrEqual(0)
  const status = page.locator('.renderer-status')
  const before = await status.innerText()
  const dimensions = /^(\d+) × (\d+)$/.exec(before)
  expect(dimensions).not.toBeNull()
  const cols = Number(dimensions?.[1])
  const rows = Number(dimensions?.[2])
  const screen = await page.locator('.xterm-screen').boundingBox()
  expect(screen).not.toBeNull()
  if (!screen) throw new Error('Terminal screen has no geometry')
  await page.mouse.dblclick(
    screen.x + ((45 + 5) * screen.width) / cols,
    screen.y + ((row + 0.5) * screen.height) / rows
  )
  await expect
    .poll(() =>
      page.locator('.xterm').evaluate((element) => {
        const clipboard = new DataTransfer()
        const event = new ClipboardEvent('copy', {
          clipboardData: clipboard,
          bubbles: true,
          cancelable: true
        })
        element.dispatchEvent(event)
        return event.clipboardData?.getData('text/plain')
      })
    )
    .toBe('SELECTABLE')

  await page.setViewportSize({ width: 1000, height: 900 })
  await expect.poll(() => status.innerText()).not.toBe(before)
  await expectGpuDisplay(page)
  await expectLine(page, 'SELECTABLE')
  await command(page, 'printf "resize_%s\\n" ready')
  await expectLine(page, 'resize_ready')
  await expectPrompt(page)
})

test('Cmd+K runs clear without submitting the draft command', async ({
  page
}) => {
  await openDemo(page)
  await openShell(page)
  await command(page, 'echo before-clear')
  await expectLine(page, 'before-clear')
  await expectPrompt(page)
  await terminalInput(page).pressSequentially('touch should-not-exist.txt')
  await terminalInput(page).press('Home')
  await terminalInput(page).press('Meta+k')
  await expectPrompt(page)
  await expect
    .poll(async () => (await lines(page)).filter(Boolean))
    .toEqual(['~ ❯'])
  await terminalInput(page).press('ArrowUp')
  await expectLine(page, '~ ❯ clear')
  await terminalInput(page).press('Control+u')
  await command(page, 'test ! -e should-not-exist.txt && echo draft-safe')
  await expectLine(page, 'draft-safe')
})

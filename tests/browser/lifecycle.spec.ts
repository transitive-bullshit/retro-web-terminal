import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 1440, height: 1000 } })

interface CursorInterval {
  active: boolean
  ticks: number
}

type ProbeWindow = Window & {
  __retroCursorIntervals: Record<string, CursorInterval>
}

test('releases the effects context after a partial shader initialization failure', async ({
  page
}) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply supplies the original WebGL receiver.
    const shaderSource = WebGL2RenderingContext.prototype.shaderSource
    const fragments = new WeakMap<WebGL2RenderingContext, number>()
    WebGL2RenderingContext.prototype.shaderSource = function (shader, source) {
      const canvas = this.canvas
      if (
        canvas instanceof HTMLCanvasElement &&
        canvas.classList.contains('retro-terminal__effects') &&
        this.getShaderParameter(shader, this.SHADER_TYPE) ===
          this.FRAGMENT_SHADER
      ) {
        const count = (fragments.get(this) ?? 0) + 1
        fragments.set(this, count)
        if (count === 2) {
          canvas.dataset.probeShaderFailed = 'true'
          canvas.addEventListener(
            'webglcontextlost',
            () => {
              canvas.dataset.probeContextLost = 'true'
            },
            { once: true }
          )
          return Reflect.apply(shaderSource, this, [shader, 'invalid shader'])
        }
      }
      return Reflect.apply(shaderSource, this, [shader, source])
    }
  })
  await page.goto('/')
  const canvas = page.locator('.retro-terminal__effects')
  await expect(canvas).toHaveAttribute('data-probe-shader-failed', 'true')
  await expect(page.locator('.retro-terminal')).toHaveAttribute(
    'data-renderer',
    'fallback'
  )
  await expect(canvas).toHaveAttribute('data-probe-context-lost', 'true')
  await expect(page.locator('.xterm-rows')).toContainText('PHOSPHOR / 01')
  await expect(canvas).toBeHidden()
})

test('stops the discarded WebGL cursor timer when context loss triggers fallback', async ({
  page
}) => {
  await page.addInitScript(() => {
    const probe = window as unknown as ProbeWindow
    const intervals: Record<string, CursorInterval> = {}
    probe.__retroCursorIntervals = intervals
    const setInterval = window.setInterval.bind(window)
    const clearInterval = window.clearInterval.bind(window)
    Object.defineProperty(window, 'setInterval', {
      configurable: true,
      writable: true,
      value: (handler: TimerHandler, delay?: number, ...args: unknown[]) => {
        // The pinned WebGL addon's cursor blink interval is 600 ms.
        if (delay !== 600 || typeof handler !== 'function')
          return setInterval(handler, delay, ...args)
        const interval = { active: true, ticks: 0 }
        const id = setInterval(() => {
          interval.ticks++
          Reflect.apply(handler, window, args)
        }, delay)
        intervals[String(id)] = interval
        return id
      }
    })
    Object.defineProperty(window, 'clearInterval', {
      configurable: true,
      writable: true,
      value: (id?: number) => {
        const interval = intervals[String(id)]
        if (interval) interval.active = false
        clearInterval(id)
      }
    })
  })
  await page.goto('/')
  await expect(page.locator('.retro-terminal')).toHaveAttribute(
    'data-renderer',
    'webgl'
  )
  const input = page.getByRole('textbox', {
    name: 'Terminal input',
    exact: true
  })
  await input.focus()
  await input.press('q')
  await expect(page.getByText('Local shell', { exact: true })).toBeVisible()
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(
          (window as unknown as ProbeWindow).__retroCursorIntervals
        ).some((interval) => interval.active)
      )
    )
    .toBe(true)

  await page
    .locator('.retro-terminal__effects')
    .evaluate((canvas: HTMLCanvasElement) => {
      const extension = canvas
        .getContext('webgl2')
        ?.getExtension('WEBGL_lose_context')
      if (!extension)
        throw new Error('The context-loss test extension is unavailable')
      extension.loseContext()
    })
  await expect(page.locator('.retro-terminal')).toHaveAttribute(
    'data-renderer',
    'fallback'
  )
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.values(
          (window as unknown as ProbeWindow).__retroCursorIntervals
        ).some((interval) => interval.active)
      )
    )
    .toBe(false)
  await input.pressSequentially('printf "cleanup_%s\\n" survived')
  await input.press('Enter')
  await expect(page.locator('.xterm-rows')).toContainText('cleanup_survived')
})

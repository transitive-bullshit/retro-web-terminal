import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const sourceRoot = fileURLToPath(
  new URL('../../packages/retro-terminal/src/', import.meta.url)
)

test('real GPU passes preserve frame placement and decay cleared phosphor', async ({
  page
}) => {
  await page.goto('/')
  const results = await page.evaluate(async (path) => {
    const { EffectsPipeline } = await import(`/@fs/${path}effects/pipeline.ts`)
    const { resolveSettings, themes } = await import(`/@fs/${path}settings.ts`)
    const source = document.createElement('canvas')
    source.width = 128
    source.height = 64
    const ctx = source.getContext('2d')!
    const screen = document.createElement('canvas')
    const pipeline = new EffectsPipeline(screen)
    const placement = { left: 0, top: 0, width: 128, height: 64 }
    pipeline.resize(128, 64, placement)
    const settings = resolveSettings('color', {
      brightness: 1,
      contrast: 1,
      glow: { enabled: false },
      scanlines: { enabled: false },
      phosphor: { enabled: false },
      curvature: { enabled: false },
      persistence: { enabled: true, decay: 0.2, intensity: 1 },
      rgbShift: { enabled: false },
      noise: { enabled: false },
      flicker: { enabled: false },
      glitch: { enabled: false },
      vignette: { enabled: false }
    })
    const black = { ...themes.color, background: '#000000' }
    const gl = screen.getContext('webgl2')!
    const pixel = (x: number, y: number) => {
      const rgba = new Uint8Array(4)
      gl.readPixels(
        Math.floor(x * screen.width),
        Math.floor(y * screen.height),
        1,
        1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        rgba
      )
      return Array.from(rgba)
    }
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 128, 64)
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(16, 8, 32, 16)
    pipeline.capture(source)
    pipeline.render(0, settings, black, true)
    const first = pixel(0.25, 0.75)
    const outside = pixel(0.75, 0.25)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 128, 64)
    pipeline.capture(source)
    pipeline.render(100, settings, black, true)
    const trail = pixel(0.25, 0.75)
    pipeline.render(2000, settings, black, true)
    const faded = pixel(0.25, 0.75)
    pipeline.resetHistory()
    pipeline.render(2100, settings, black, true)
    const reset = pixel(0.25, 0.75)
    pipeline.dispose()
    return { first, outside, trail, faded, reset }
  }, sourceRoot)
  expect(results.first[0]).toBeGreaterThan(245)
  expect(results.first[1]).toBeLessThan(3)
  expect(results.outside[0]).toBeLessThan(3)
  expect(results.trail[0]).toBeGreaterThan(150)
  expect(results.trail[0]).toBeLessThan(240)
  expect(results.faded[0]).toBeLessThan(5)
  expect(results.reset[0]).toBeLessThan(3)
})

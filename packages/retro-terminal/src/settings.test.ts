import { describe, expect, it } from 'vitest'
import { resolveSettings, settingsSchema, themes } from './settings'
import { curvePoint, decayFactor } from './effects/math'

describe('effect configuration boundaries', () => {
  it('provides complete independent settings for every curated theme', () => {
    for (const name of ['amber', 'green', 'color'] as const) {
      expect(settingsSchema.safeParse(themes[name].settings).success).toBe(true)
      const settings = resolveSettings(name, { glow: { enabled: false } })
      expect(settings.glow.enabled).toBe(false)
      expect(settings.glow.radius).toBe(themes[name].settings.glow.radius)
      expect(themes[name].settings.glow.enabled).toBe(true)
    }
  })

  it('rejects out-of-range, nonfinite, and unknown control values', () => {
    expect(() =>
      resolveSettings('amber', { curvature: { amount: 2 } })
    ).toThrow()
    expect(() => resolveSettings('amber', { brightness: Number.NaN })).toThrow()
    expect(settingsSchema.safeParse({ glow: { surprise: true } }).success).toBe(
      false
    )
    expect(settingsSchema.safeParse({ glow: 3 }).success).toBe(false)
  })
})

describe('phosphor and pointer invariants', () => {
  it('decays equally over one second at 30, 60, and 120 fps', () => {
    for (const fps of [30, 60, 120]) {
      let energy = 1
      for (let frame = 0; frame < fps; frame++)
        energy *= decayFactor(1 / fps, 0.3)
      expect(energy).toBeCloseTo(decayFactor(1, 0.3), 10)
    }
  })

  it('preserves the center and is symmetric across screen axes', () => {
    expect(curvePoint(0.5, 0.5, 0.3)).toEqual({ x: 0.5, y: 0.5 })
    const flat = curvePoint(0.17, 0.29, 0)
    expect(flat.x).toBeCloseTo(0.17)
    expect(flat.y).toBeCloseTo(0.29)
    const left = curvePoint(0.1, 0.2, 0.1)
    const right = curvePoint(0.9, 0.2, 0.1)
    expect(left.x + right.x).toBeCloseTo(1)
    expect(left.y).toBeCloseTo(right.y)
    expect(left.x).toBeLessThan(0.1)
  })
})

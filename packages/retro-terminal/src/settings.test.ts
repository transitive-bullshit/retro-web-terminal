import { describe, expect, it } from 'vitest'
import {
  resolveSettings,
  themes,
  type RetroSettings,
  type RetroSettingsInput
} from './settings'
import { curvePoint, decayFactor } from './effects/math'

describe('effect settings', () => {
  it('preserves the curated appearance of each theme', () => {
    expect(resolveSettings('amber')).toMatchObject({
      brightness: 1.05,
      glow: { intensity: 0.52, radius: 2.4 },
      persistence: { decay: 0.18, intensity: 0.5 },
      rgbShift: { enabled: false }
    })
    expect(resolveSettings('green')).toMatchObject({
      brightness: 1.08,
      glow: { intensity: 0.62, radius: 2.6 },
      persistence: { decay: 0.3, intensity: 0.65 }
    })
    expect(resolveSettings('color')).toMatchObject({
      glow: { intensity: 0.32, radius: 1.7 },
      persistence: { decay: 0.11, intensity: 0.35 },
      rgbShift: { enabled: true, amount: 0.8 },
      curvature: { amount: 0.045 }
    })
  })

  it('merges partial effect overrides while preserving false and zero', () => {
    for (const name of ['amber', 'green', 'color'] as const) {
      const settings = resolveSettings(name, {
        effectsEnabled: false,
        glow: { enabled: false },
        persistence: { intensity: 0 }
      })
      expect(settings.effectsEnabled).toBe(false)
      expect(settings.glow.enabled).toBe(false)
      expect(settings.glow.radius).toBe(themes[name].settings.glow.radius)
      expect(settings.persistence.intensity).toBe(0)
      expect(settings.persistence.decay).toBe(
        themes[name].settings.persistence.decay
      )
    }
  })

  it('owns every effect object independently of presets, overrides, and other calls', () => {
    for (const name of ['amber', 'green', 'color'] as const) {
      const preset = themes[name].settings
      const first = resolveSettings(name)
      const second = resolveSettings(name)
      const overrides = { glow: { intensity: 0.1 } }
      const customized = resolveSettings(name, overrides)

      expect(first).toEqual(preset)
      expect(first).not.toBe(preset)
      expect(second).not.toBe(first)
      expect(customized.glow).not.toBe(overrides.glow)

      for (const key of Object.keys(preset) as (keyof RetroSettings)[]) {
        if (typeof preset[key] !== 'object') continue
        expect(first[key]).not.toBe(preset[key])
        expect(second[key]).not.toBe(first[key])
        expect(customized[key]).not.toBe(preset[key])
        expect(customized[key]).not.toBe(first[key])
      }

      customized.glow.intensity = 0
      expect(overrides.glow.intensity).toBe(0.1)
      expect(first.glow.intensity).toBe(preset.glow.intensity)
    }
  })

  it('treats undefined overrides as omitted', () => {
    expect(resolveSettings('green', undefined)).toEqual(themes.green.settings)
    expect(
      resolveSettings('green', {
        brightness: undefined,
        glow: { intensity: undefined, enabled: false },
        persistence: undefined
      })
    ).toEqual(resolveSettings('green', { glow: { enabled: false } }))
  })

  it('accepts settings overrides restored from JSON', () => {
    const overrides: RetroSettingsInput = {
      effectsEnabled: false,
      brightness: 1.2,
      glow: { intensity: 0 },
      rgbShift: { enabled: true, amount: 1.2 }
    }
    const restored = JSON.parse(JSON.stringify(overrides)) as RetroSettingsInput

    expect(resolveSettings('color', restored)).toEqual(
      resolveSettings('color', overrides)
    )
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

import { z } from 'zod'

export const parameterRanges = {
  brightness: { min: 0.5, max: 1.8, step: 0.01 },
  contrast: { min: 0.7, max: 1.6, step: 0.01 },
  glow: {
    intensity: { min: 0, max: 1.5, step: 0.01 },
    radius: { min: 0.5, max: 6, step: 0.1 }
  },
  scanlines: {
    intensity: { min: 0, max: 0.8, step: 0.01 },
    density: { min: 0.5, max: 2, step: 0.05 }
  },
  phosphor: { intensity: { min: 0, max: 0.7, step: 0.01 } },
  curvature: { amount: { min: 0, max: 0.3, step: 0.005 } },
  persistence: {
    decay: { min: 0.02, max: 1.5, step: 0.01 },
    intensity: { min: 0, max: 1, step: 0.01 }
  },
  rgbShift: { amount: { min: 0, max: 8, step: 0.1 } },
  noise: { intensity: { min: 0, max: 0.12, step: 0.001 } },
  flicker: {
    intensity: { min: 0, max: 0.15, step: 0.001 },
    speed: { min: 0.1, max: 30, step: 0.1 }
  },
  glitch: {
    intensity: { min: 0, max: 1, step: 0.01 },
    frequency: { min: 0, max: 1, step: 0.01 }
  },
  vignette: { intensity: { min: 0, max: 0.8, step: 0.01 } }
} as const

function parameter(range: { min: number; max: number }, value: number) {
  return z.number().min(range.min).max(range.max).default(value)
}

const enabled = () => z.boolean().default(true)

/** The source of truth for built-in effect parameters, bounds, and defaults. */
export const settingsSchema = z
  .object({
    effectsEnabled: z.boolean().default(true),
    brightness: parameter(parameterRanges.brightness, 1.05),
    contrast: parameter(parameterRanges.contrast, 1.06),
    glow: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.glow.intensity, 0.52),
        radius: parameter(parameterRanges.glow.radius, 2.4)
      })
      .strict()
      .prefault({}),
    scanlines: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.scanlines.intensity, 0.22),
        density: parameter(parameterRanges.scanlines.density, 1)
      })
      .strict()
      .prefault({}),
    phosphor: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.phosphor.intensity, 0.15)
      })
      .strict()
      .prefault({}),
    curvature: z
      .object({
        enabled: enabled(),
        amount: parameter(parameterRanges.curvature.amount, 0.065)
      })
      .strict()
      .prefault({}),
    persistence: z
      .object({
        enabled: enabled(),
        decay: parameter(parameterRanges.persistence.decay, 0.18),
        intensity: parameter(parameterRanges.persistence.intensity, 0.5)
      })
      .strict()
      .prefault({}),
    rgbShift: z
      .object({
        enabled: z.boolean().default(false),
        amount: parameter(parameterRanges.rgbShift.amount, 0.7)
      })
      .strict()
      .prefault({}),
    noise: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.noise.intensity, 0.012)
      })
      .strict()
      .prefault({}),
    flicker: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.flicker.intensity, 0.008),
        speed: parameter(parameterRanges.flicker.speed, 8)
      })
      .strict()
      .prefault({}),
    glitch: z
      .object({
        enabled: z.boolean().default(false),
        intensity: parameter(parameterRanges.glitch.intensity, 0.24),
        frequency: parameter(parameterRanges.glitch.frequency, 0.15)
      })
      .strict()
      .prefault({}),
    vignette: z
      .object({
        enabled: enabled(),
        intensity: parameter(parameterRanges.vignette.intensity, 0.3)
      })
      .strict()
      .prefault({})
  })
  .strict()
  .prefault({})

export type RetroSettings = z.output<typeof settingsSchema>
export type RetroSettingsInput = {
  [Key in keyof RetroSettings]?: RetroSettings[Key] extends object
    ? Partial<RetroSettings[Key]>
    : RetroSettings[Key]
}
export type ThemeName = 'amber' | 'green' | 'color'

export interface RetroTheme {
  label: string
  description: string
  accent: string
  background: string
  foreground: string
  monochrome: boolean
  settings: RetroSettings
}

const effectKeys = [
  'glow',
  'scanlines',
  'phosphor',
  'curvature',
  'persistence',
  'rgbShift',
  'noise',
  'flicker',
  'glitch',
  'vignette'
] as const

function mergeSettings(
  base: RetroSettings,
  overrides: RetroSettingsInput = {}
): RetroSettings {
  const merged = { ...base, ...overrides }
  for (const key of effectKeys) {
    const override = overrides[key]
    if (
      override !== undefined &&
      override !== null &&
      typeof override === 'object' &&
      !Array.isArray(override)
    ) {
      merged[key] = { ...base[key], ...override }
    }
  }
  return settingsSchema.parse(merged)
}

const defaults = settingsSchema.parse({})

export const themes = {
  amber: {
    label: 'Amber',
    description: 'Warm phosphor. Late nights at the mainframe.',
    accent: '#ffc078',
    background: '#0b0805',
    foreground: '#ffc078',
    monochrome: true,
    settings: mergeSettings(defaults)
  },
  green: {
    label: 'Green Phosphor',
    description: 'A little slower to fade. A little harder to forget.',
    accent: '#91ed8c',
    background: '#060b07',
    foreground: '#91ed8c',
    monochrome: true,
    settings: mergeSettings(defaults, {
      glow: { intensity: 0.62, radius: 2.6 },
      scanlines: { intensity: 0.25 },
      phosphor: { intensity: 0.19 },
      persistence: { decay: 0.3, intensity: 0.65 },
      brightness: 1.08
    })
  },
  color: {
    label: 'Color CRT',
    description: 'Full color. Slightly out of alignment.',
    accent: '#9bc5ff',
    background: '#080a10',
    foreground: '#d8e0ed',
    monochrome: false,
    settings: mergeSettings(defaults, {
      glow: { intensity: 0.32, radius: 1.7 },
      scanlines: { intensity: 0.18 },
      phosphor: { intensity: 0.12 },
      persistence: { decay: 0.11, intensity: 0.35 },
      rgbShift: { enabled: true, amount: 0.8 },
      curvature: { amount: 0.045 },
      vignette: { intensity: 0.22 }
    })
  }
} satisfies Record<ThemeName, RetroTheme>

/** Resolve nested built-in overrides without mutating the theme or caller. */
export function resolveSettings(
  theme: ThemeName = 'amber',
  overrides?: RetroSettingsInput
): RetroSettings {
  return mergeSettings(themes[theme].settings, overrides)
}

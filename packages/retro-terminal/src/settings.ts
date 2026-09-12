import presets from './settings.json'

export interface RetroSettings {
  effectsEnabled: boolean
  brightness: number
  contrast: number
  glow: { enabled: boolean; intensity: number; radius: number }
  scanlines: { enabled: boolean; intensity: number; density: number }
  phosphor: { enabled: boolean; intensity: number }
  curvature: { enabled: boolean; amount: number }
  persistence: { enabled: boolean; decay: number; intensity: number }
  rgbShift: { enabled: boolean; amount: number }
  noise: { enabled: boolean; intensity: number }
  flicker: { enabled: boolean; intensity: number; speed: number }
  glitch: { enabled: boolean; intensity: number; frequency: number }
  vignette: { enabled: boolean; intensity: number }
}

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

/** Suggested slider bounds; settings are not validated or clamped at runtime. */
export const parameterRanges = presets.parameterRanges

export const themes: Record<ThemeName, RetroTheme> = presets.themes

function mergeEffect<Effect extends object>(
  base: Effect,
  overrides: Partial<Effect> = {}
): Effect {
  const merged = { ...base }
  for (const key of Object.keys(overrides) as (keyof Effect)[]) {
    const value = overrides[key]
    if (value !== undefined) merged[key] = value
  }
  return merged
}

/** Merge typed overrides into an independent settings object without validation. */
export function resolveSettings(
  theme: ThemeName = 'amber',
  overrides: RetroSettingsInput = {}
): RetroSettings {
  const base = themes[theme].settings
  return {
    effectsEnabled: overrides.effectsEnabled ?? base.effectsEnabled,
    brightness: overrides.brightness ?? base.brightness,
    contrast: overrides.contrast ?? base.contrast,
    glow: mergeEffect(base.glow, overrides.glow),
    scanlines: mergeEffect(base.scanlines, overrides.scanlines),
    phosphor: mergeEffect(base.phosphor, overrides.phosphor),
    curvature: mergeEffect(base.curvature, overrides.curvature),
    persistence: mergeEffect(base.persistence, overrides.persistence),
    rgbShift: mergeEffect(base.rgbShift, overrides.rgbShift),
    noise: mergeEffect(base.noise, overrides.noise),
    flicker: mergeEffect(base.flicker, overrides.flicker),
    glitch: mergeEffect(base.glitch, overrides.glitch),
    vignette: mergeEffect(base.vignette, overrides.vignette)
  }
}

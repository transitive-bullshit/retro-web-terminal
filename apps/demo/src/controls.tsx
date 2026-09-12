import { useState } from 'react'
import { useDialKitController } from 'dialkit'
import {
  parameterRanges,
  resolveSettings,
  type RetroSettings,
  type ThemeName
} from 'retro-web-terminal'

const slider = (
  value: number,
  range: { min: number; max: number; step: number }
) =>
  [value, range.min, range.max, range.step] as [number, number, number, number]

function controlsFor(settings: RetroSettings) {
  return {
    Display: {
      Enabled: settings.effectsEnabled,
      Brightness: slider(settings.brightness, parameterRanges.brightness),
      Contrast: slider(settings.contrast, parameterRanges.contrast)
    },
    Bloom: {
      Enabled: settings.glow.enabled,
      Intensity: slider(
        settings.glow.intensity,
        parameterRanges.glow.intensity
      ),
      Radius: slider(settings.glow.radius, parameterRanges.glow.radius)
    },
    Scanlines: {
      Enabled: settings.scanlines.enabled,
      Intensity: slider(
        settings.scanlines.intensity,
        parameterRanges.scanlines.intensity
      ),
      Density: slider(
        settings.scanlines.density,
        parameterRanges.scanlines.density
      )
    },
    Phosphor: {
      _collapsed: true,
      Enabled: settings.phosphor.enabled,
      Intensity: slider(
        settings.phosphor.intensity,
        parameterRanges.phosphor.intensity
      )
    },
    Curvature: {
      _collapsed: true,
      Enabled: settings.curvature.enabled,
      Amount: slider(
        settings.curvature.amount,
        parameterRanges.curvature.amount
      )
    },
    Afterglow: {
      _collapsed: true,
      Enabled: settings.persistence.enabled,
      Decay: slider(
        settings.persistence.decay,
        parameterRanges.persistence.decay
      ),
      Intensity: slider(
        settings.persistence.intensity,
        parameterRanges.persistence.intensity
      )
    },
    'Color separation': {
      _collapsed: true,
      Enabled: settings.rgbShift.enabled,
      Amount: slider(settings.rgbShift.amount, parameterRanges.rgbShift.amount)
    },
    Noise: {
      _collapsed: true,
      Enabled: settings.noise.enabled,
      Intensity: slider(
        settings.noise.intensity,
        parameterRanges.noise.intensity
      )
    },
    Flicker: {
      _collapsed: true,
      Enabled: settings.flicker.enabled,
      Intensity: slider(
        settings.flicker.intensity,
        parameterRanges.flicker.intensity
      ),
      Speed: slider(settings.flicker.speed, parameterRanges.flicker.speed)
    },
    Glitch: {
      _collapsed: true,
      Enabled: settings.glitch.enabled,
      Intensity: slider(
        settings.glitch.intensity,
        parameterRanges.glitch.intensity
      ),
      Frequency: slider(
        settings.glitch.frequency,
        parameterRanges.glitch.frequency
      )
    },
    Vignette: {
      _collapsed: true,
      Enabled: settings.vignette.enabled,
      Intensity: slider(
        settings.vignette.intensity,
        parameterRanges.vignette.intensity
      )
    }
  }
}

function valuesFor(settings: RetroSettings) {
  return {
    Display: {
      Enabled: settings.effectsEnabled,
      Brightness: settings.brightness,
      Contrast: settings.contrast
    },
    Bloom: {
      Enabled: settings.glow.enabled,
      Intensity: settings.glow.intensity,
      Radius: settings.glow.radius
    },
    Scanlines: {
      Enabled: settings.scanlines.enabled,
      Intensity: settings.scanlines.intensity,
      Density: settings.scanlines.density
    },
    Phosphor: {
      Enabled: settings.phosphor.enabled,
      Intensity: settings.phosphor.intensity
    },
    Curvature: {
      Enabled: settings.curvature.enabled,
      Amount: settings.curvature.amount
    },
    Afterglow: {
      Enabled: settings.persistence.enabled,
      Decay: settings.persistence.decay,
      Intensity: settings.persistence.intensity
    },
    'Color separation': {
      Enabled: settings.rgbShift.enabled,
      Amount: settings.rgbShift.amount
    },
    Noise: {
      Enabled: settings.noise.enabled,
      Intensity: settings.noise.intensity
    },
    Flicker: {
      Enabled: settings.flicker.enabled,
      Intensity: settings.flicker.intensity,
      Speed: settings.flicker.speed
    },
    Glitch: {
      Enabled: settings.glitch.enabled,
      Intensity: settings.glitch.intensity,
      Frequency: settings.glitch.frequency
    },
    Vignette: {
      Enabled: settings.vignette.enabled,
      Intensity: settings.vignette.intensity
    }
  }
}

export function useRetroControls(initialTheme: ThemeName) {
  const [config] = useState(() => controlsFor(resolveSettings(initialTheme)))
  const controller = useDialKitController('Display tuning', config, {
    id: 'retro-terminal-display',
    persist: false
  })
  const values = controller.values

  const settings: RetroSettings = {
    effectsEnabled: values.Display.Enabled,
    brightness: values.Display.Brightness,
    contrast: values.Display.Contrast,
    glow: {
      enabled: values.Bloom.Enabled,
      intensity: values.Bloom.Intensity,
      radius: values.Bloom.Radius
    },
    scanlines: {
      enabled: values.Scanlines.Enabled,
      intensity: values.Scanlines.Intensity,
      density: values.Scanlines.Density
    },
    phosphor: {
      enabled: values.Phosphor.Enabled,
      intensity: values.Phosphor.Intensity
    },
    curvature: {
      enabled: values.Curvature.Enabled,
      amount: values.Curvature.Amount
    },
    persistence: {
      enabled: values.Afterglow.Enabled,
      decay: values.Afterglow.Decay,
      intensity: values.Afterglow.Intensity
    },
    rgbShift: {
      enabled: values['Color separation'].Enabled,
      amount: values['Color separation'].Amount
    },
    noise: { enabled: values.Noise.Enabled, intensity: values.Noise.Intensity },
    flicker: {
      enabled: values.Flicker.Enabled,
      intensity: values.Flicker.Intensity,
      speed: values.Flicker.Speed
    },
    glitch: {
      enabled: values.Glitch.Enabled,
      intensity: values.Glitch.Intensity,
      frequency: values.Glitch.Frequency
    },
    vignette: {
      enabled: values.Vignette.Enabled,
      intensity: values.Vignette.Intensity
    }
  }

  return {
    settings,
    reset: (theme: ThemeName) =>
      controller.setValues(valuesFor(resolveSettings(theme))),
    setEffectsEnabled: (enabled: boolean) =>
      controller.setValue('Display.Enabled', enabled)
  }
}

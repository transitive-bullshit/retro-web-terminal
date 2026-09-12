import type { RetroSettings, RetroTheme } from '../settings'
import { colorVector, decayFactor } from './math'
import {
  blurShader,
  downsampleShader,
  phosphorShader,
  screenShader,
  vertexShader
} from './shaders'

interface Target {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

interface Program {
  value: WebGLProgram
  uniform: (name: string) => WebGLUniformLocation | null
}

export interface SourcePlacement {
  left: number
  top: number
  width: number
  height: number
}

/** Owns only the effects context. xterm remains the terminal renderer. */
export class EffectsPipeline {
  private readonly gl: WebGL2RenderingContext
  private readonly phosphor: Program
  private readonly downsample: Program
  private readonly blur: Program
  private readonly screen: Program
  private readonly source: WebGLTexture
  private readonly overlay: WebGLTexture
  private readonly vao: WebGLVertexArrayObject
  private history: [Target, Target] | undefined
  private bloom: [Target, Target] | undefined
  private historyIndex = 0
  private placement: SourcePlacement = { left: 0, top: 0, width: 1, height: 1 }
  private cssWidth = 1
  private cssHeight = 1
  private lastTime: number | undefined
  private disposed = false
  private hasSource = false
  private readonly useFloat: boolean
  private sourceWidth = 0
  private sourceHeight = 0

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power'
    })
    if (!gl) throw new Error('WebGL2 effects are unavailable')
    this.gl = gl
    try {
      this.useFloat = Boolean(gl.getExtension('EXT_color_buffer_float'))
      this.phosphor = this.createProgram(phosphorShader)
      this.downsample = this.createProgram(downsampleShader)
      this.blur = this.createProgram(blurShader)
      this.screen = this.createProgram(screenShader)
      this.source = this.createTexture()
      this.overlay = this.createTexture()
      const vao = gl.createVertexArray()
      if (!vao) throw new Error('Unable to create the effects geometry')
      this.vao = vao
      gl.bindVertexArray(vao)
      // A transparent overlay is valid even when no link layer exists.
      for (const texture of [this.source, this.overlay]) {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          1,
          1,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          new Uint8Array(4)
        )
      }
    } catch (err) {
      // A failed constructor never reaches the adapter's pipeline reference.
      // Release the whole acquired context, including partially compiled resources.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      throw err
    }
  }

  private createProgram(fragmentSource: string): Program {
    const gl = this.gl
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) throw new Error('Unable to allocate a CRT shader')
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader)
        gl.deleteShader(shader)
        throw new Error(`CRT shader compilation failed: ${message}`)
      }
      return shader
    }
    const vertex = compile(gl.VERTEX_SHADER, vertexShader)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    const value = gl.createProgram()
    if (!value) throw new Error('Unable to allocate a CRT program')
    gl.attachShader(value, vertex)
    gl.attachShader(value, fragment)
    gl.linkProgram(value)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(value)
      gl.deleteProgram(value)
      throw new Error(`CRT shader linking failed: ${message}`)
    }
    const uniforms = new Map<string, WebGLUniformLocation | null>()
    return {
      value,
      uniform(name) {
        if (!uniforms.has(name))
          uniforms.set(name, gl.getUniformLocation(value, name))
        return uniforms.get(name) ?? null
      }
    }
  }

  private createTexture(): WebGLTexture {
    const gl = this.gl
    const texture = gl.createTexture()
    if (!texture) throw new Error('Unable to allocate a CRT texture')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return texture
  }

  private createTarget(width: number, height: number): Target {
    const gl = this.gl
    const texture = this.createTexture()
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      this.useFloat ? gl.RGBA16F : gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      this.useFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      null
    )
    const framebuffer = gl.createFramebuffer()
    if (!framebuffer) throw new Error('Unable to allocate CRT frame history')
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    )
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer)
      gl.deleteTexture(texture)
      throw new Error('CRT frame history is unsupported on this GPU')
    }
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { texture, framebuffer, width, height }
  }

  private releaseTargets() {
    for (const target of [...(this.history ?? []), ...(this.bloom ?? [])]) {
      this.gl.deleteFramebuffer(target.framebuffer)
      this.gl.deleteTexture(target.texture)
    }
    this.history = undefined
    this.bloom = undefined
  }

  resize(
    cssWidth: number,
    cssHeight: number,
    placement: SourcePlacement
  ): void {
    if (this.disposed) return
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.placement = placement
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.round(cssWidth * ratio))
    const height = Math.max(1, Math.round(cssHeight * ratio))
    if (
      width === this.canvas.width &&
      height === this.canvas.height &&
      this.history
    )
      return
    this.canvas.width = width
    this.canvas.height = height
    this.releaseTargets()
    this.history = [
      this.createTarget(width, height),
      this.createTarget(width, height)
    ]
    const bw = Math.max(1, Math.ceil(width / 3))
    const bh = Math.max(1, Math.ceil(height / 3))
    this.bloom = [this.createTarget(bw, bh), this.createTarget(bw, bh)]
    this.lastTime = undefined
    this.historyIndex = 0
  }

  /** Must run synchronously after xterm draws when its buffer is not preserved. */
  capture(canvas: HTMLCanvasElement, overlay?: HTMLCanvasElement): void {
    if (this.disposed || !canvas.width || !canvas.height) return
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.source)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    if (
      this.sourceWidth !== canvas.width ||
      this.sourceHeight !== canvas.height
    ) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
      )
      this.sourceWidth = canvas.width
      this.sourceHeight = canvas.height
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas
      )
    }
    if (overlay) this.captureOverlay(overlay)
    this.hasSource = true
  }

  captureOverlay(canvas: HTMLCanvasElement): void {
    if (this.disposed || !canvas.width || !canvas.height) return
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.overlay)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas)
  }

  resetHistory(): void {
    if (this.disposed) return
    const gl = this.gl
    for (const target of this.history ?? []) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
    this.lastTime = undefined
  }

  private texture(
    program: Program,
    name: string,
    unit: number,
    texture: WebGLTexture
  ): void {
    const gl = this.gl
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.uniform1i(program.uniform(name), unit)
  }

  private use(program: Program, target?: Target): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null)
    gl.viewport(
      0,
      0,
      target?.width ?? this.canvas.width,
      target?.height ?? this.canvas.height
    )
    gl.useProgram(program.value)
  }

  private sourceUniforms(program: Program, theme: RetroTheme): void {
    const gl = this.gl
    this.texture(program, 'u_source', 0, this.source)
    this.texture(program, 'u_overlay', 1, this.overlay)
    const p = this.placement
    gl.uniform4f(
      program.uniform('u_sourceRect'),
      p.left / this.cssWidth,
      1 - (p.top + p.height) / this.cssHeight,
      p.width / this.cssWidth,
      p.height / this.cssHeight
    )
    gl.uniform3fv(
      program.uniform('u_background'),
      colorVector(theme.background)
    )
    gl.uniform3fv(program.uniform('u_tint'), colorVector(theme.foreground))
    gl.uniform1f(program.uniform('u_monochrome'), theme.monochrome ? 1 : 0)
  }

  render(
    timeMs: number,
    settings: RetroSettings,
    theme: RetroTheme,
    reducedMotion: boolean
  ): boolean {
    if (
      this.disposed ||
      !this.hasSource ||
      !this.history ||
      !this.bloom ||
      this.gl.isContextLost()
    )
      return false
    const gl = this.gl
    const elapsed =
      this.lastTime === undefined
        ? 1 / 60
        : Math.max(0, (timeMs - this.lastTime) / 1000)
    this.lastTime = timeMs
    const previous = this.history[this.historyIndex]!
    const next = this.history[1 - this.historyIndex]!
    this.use(this.phosphor, next)
    this.sourceUniforms(this.phosphor, theme)
    this.texture(this.phosphor, 'u_history', 2, previous.texture)
    gl.uniform1f(
      this.phosphor.uniform('u_decay'),
      decayFactor(elapsed, settings.persistence.decay)
    )
    gl.uniform1f(
      this.phosphor.uniform('u_persistence'),
      settings.persistence.enabled ? 1 : 0
    )
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    this.historyIndex = 1 - this.historyIndex

    if (settings.glow.enabled && settings.glow.intensity > 0) {
      this.use(this.downsample, this.bloom[0])
      this.texture(this.downsample, 'u_image', 0, next.texture)
      gl.uniform2f(
        this.downsample.uniform('u_step'),
        1 / next.width,
        1 / next.height
      )
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.use(this.blur, this.bloom[1])
      this.texture(this.blur, 'u_image', 0, this.bloom[0].texture)
      gl.uniform2f(
        this.blur.uniform('u_step'),
        (settings.glow.radius * 0.5) / this.bloom[0].width,
        0
      )
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      this.use(this.blur, this.bloom[0])
      this.texture(this.blur, 'u_image', 0, this.bloom[1].texture)
      gl.uniform2f(
        this.blur.uniform('u_step'),
        0,
        (settings.glow.radius * 0.5) / this.bloom[1].height
      )
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    this.use(this.screen)
    this.sourceUniforms(this.screen, theme)
    this.texture(this.screen, 'u_image', 2, next.texture)
    this.texture(this.screen, 'u_bloom', 3, this.bloom[0].texture)
    gl.uniform2f(
      this.screen.uniform('u_resolution'),
      this.canvas.width,
      this.canvas.height
    )
    gl.uniform2f(
      this.screen.uniform('u_cssResolution'),
      this.cssWidth,
      this.cssHeight
    )
    const values = {
      u_time: timeMs / 1000,
      u_brightness: settings.brightness,
      u_contrast: settings.contrast,
      u_glow: settings.glow.enabled ? settings.glow.intensity : 0,
      u_scanlines: settings.scanlines.enabled
        ? settings.scanlines.intensity
        : 0,
      u_scanDensity: settings.scanlines.density,
      u_phosphor: settings.phosphor.enabled ? settings.phosphor.intensity : 0,
      u_curve: settings.curvature.enabled ? settings.curvature.amount : 0,
      u_trails: settings.persistence.enabled
        ? settings.persistence.intensity
        : 0,
      u_rgbShift: settings.rgbShift.enabled ? settings.rgbShift.amount : 0,
      u_noise:
        settings.noise.enabled && !reducedMotion ? settings.noise.intensity : 0,
      u_flicker:
        settings.flicker.enabled && !reducedMotion
          ? settings.flicker.intensity
          : 0,
      u_flickerSpeed: settings.flicker.speed,
      u_glitch:
        settings.glitch.enabled && !reducedMotion
          ? settings.glitch.intensity
          : 0,
      u_glitchFrequency: settings.glitch.frequency,
      u_vignette: settings.vignette.enabled ? settings.vignette.intensity : 0
    }
    for (const [name, value] of Object.entries(values))
      gl.uniform1f(this.screen.uniform(name), value)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return true
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.releaseTargets()
    for (const texture of [this.source, this.overlay])
      this.gl.deleteTexture(texture)
    for (const program of [
      this.phosphor,
      this.downsample,
      this.blur,
      this.screen
    ])
      this.gl.deleteProgram(program.value)
    this.gl.deleteVertexArray(this.vao)
    this.gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

import type { Terminal, ITheme, IDisposable } from '@xterm/xterm'
import type { WebglAddon } from '@xterm/addon-webgl'
import type { RetroSettings, ThemeName } from './settings'
import { themes } from './settings'
import { EffectsPipeline } from './effects/pipeline'
import { curvePoint } from './effects/math'

export type RendererMode = 'webgl' | 'fallback'
interface Position {
  clientX: number
  clientY: number
}
type Coordinates = [number, number] | undefined
interface MouseService {
  getCoords(
    event: Position,
    element: HTMLElement,
    cols: number,
    rows: number,
    selection?: boolean
  ): Coordinates
  getMouseReportCoords(
    event: Position,
    element: HTMLElement
  ): { col: number; row: number; x: number; y: number } | undefined
}

// The only private xterm integration boundary. Compatible versions are pinned.
interface Internals {
  _core: {
    _renderService: { onRender(listener: () => void): IDisposable }
    _mouseService: MouseService
    linkifier?: {
      onShowLinkUnderline(listener: () => void): IDisposable
      onHideLinkUnderline(listener: () => void): IDisposable
    }
  }
}
interface RendererInternals {
  _renderer?: {
    _canvas?: HTMLCanvasElement
    _cursorBlinkStateManager?: IDisposable
  }
}

export interface TerminalSourceOptions {
  theme: ThemeName
  settings: RetroSettings
  fontFamily: string
  fontSize: number
  onData: (data: string) => void
  onResize: (size: { cols: number; rows: number }) => void
  onRendererChange: (mode: RendererMode) => void
}

export interface TerminalSource {
  terminal: Terminal
  update: (
    theme: ThemeName,
    settings: RetroSettings,
    fontFamily: string,
    fontSize: number
  ) => void
  dispose: () => void
}

function palette(name: ThemeName): ITheme {
  const theme = themes[name]
  return {
    background: theme.background,
    foreground: theme.foreground,
    cursor: theme.foreground,
    cursorAccent: theme.background,
    selectionBackground:
      name === 'color' ? '#435578' : name === 'amber' ? '#6e4923' : '#315e35',
    selectionInactiveBackground: '#394038',
    black: '#1c2429',
    red: '#ef8484',
    green: '#8cce97',
    yellow: '#ebc779',
    blue: '#90b3f0',
    magenta: '#cb9be6',
    cyan: '#8dd0d3',
    white: '#d0d5d3',
    brightBlack: '#707b80',
    brightRed: '#ff9a94',
    brightGreen: '#a5edaa',
    brightYellow: '#f6dc99',
    brightBlue: '#b0cdff',
    brightMagenta: '#e6bbf6',
    brightCyan: '#adedef',
    brightWhite: '#f3f2e7'
  }
}

export async function createTerminalSource(
  root: HTMLDivElement,
  host: HTMLDivElement,
  canvas: HTMLCanvasElement,
  initial: TerminalSourceOptions,
  signal: AbortSignal
): Promise<TerminalSource | undefined> {
  const [
    { Terminal: TerminalClass },
    { FitAddon },
    { WebglAddon: WebglAddonClass }
  ] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-webgl')
  ])
  await document.fonts.ready
  if (signal.aborted) return undefined

  let name = initial.theme
  let settings = initial.settings
  let disposed = false
  let failed = false
  let composing = false
  let visible = true
  let animation = 0
  let lastCapture = 0
  let pipeline: EffectsPipeline | undefined
  let webgl: WebglAddon | undefined
  let sourceCanvas: HTMLCanvasElement | undefined
  let linkCanvas: HTMLCanvasElement | undefined
  const cleanups: (() => void)[] = []
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reducedMotion = motion.matches
  canvas.style.display = 'none'
  root.style.setProperty('--retro-background', themes[name].background)

  const terminal = new TerminalClass({
    theme: palette(name),
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: initial.fontFamily,
    fontSize: initial.fontSize,
    fontWeight: '400',
    lineHeight: 1.12,
    letterSpacing: 0,
    scrollback: 3000,
    screenReaderMode: true,
    minimumContrastRatio: 1,
    allowTransparency: false,
    convertEol: false
  })
  const fit = new FitAddon()
  terminal.loadAddon(fit)
  terminal.open(host)
  const core = (terminal as unknown as Internals)._core
  const add = (disposable: IDisposable) =>
    cleanups.push(() => disposable.dispose())
  const listen = (
    target: EventTarget,
    event: string,
    handler: EventListener
  ) => {
    target.addEventListener(event, handler)
    cleanups.push(() => target.removeEventListener(event, handler))
  }

  function stopAnimation() {
    cancelAnimationFrame(animation)
    animation = 0
  }

  function active() {
    return (
      !disposed &&
      !failed &&
      settings.effectsEnabled &&
      !composing &&
      visible &&
      !document.hidden
    )
  }

  function continuous() {
    return (
      !reducedMotion &&
      ((settings.noise.enabled && settings.noise.intensity > 0) ||
        (settings.flicker.enabled && settings.flicker.intensity > 0) ||
        (settings.glitch.enabled &&
          settings.glitch.intensity > 0 &&
          settings.glitch.frequency > 0))
    )
  }

  function requestFrame() {
    if (!animation && active()) animation = requestAnimationFrame(draw)
  }

  function draw(time: number) {
    animation = 0
    if (!active() || !pipeline) return
    try {
      if (pipeline.render(time, settings, themes[name], reducedMotion))
        canvas.style.display = 'block'
      const tail = settings.persistence.enabled
        ? settings.persistence.decay * 8 * 1000
        : 0
      if (continuous() || time - lastCapture < tail) requestFrame()
    } catch {
      fallback()
    }
  }

  function releaseWebgl() {
    // Addon 0.19.0 does not register this timer manager for disposal.
    const renderer = (webgl as unknown as RendererInternals | undefined)
      ?._renderer
    renderer?._cursorBlinkStateManager?.dispose()
    webgl?.dispose()
    webgl = undefined
  }

  function fallback() {
    if (failed || disposed) return
    failed = true
    stopAnimation()
    canvas.style.display = 'none'
    root.dataset.renderer = 'fallback'
    pipeline?.dispose()
    pipeline = undefined
    releaseWebgl()
    initial.onRendererChange('fallback')
    terminal.refresh(0, terminal.rows - 1)
  }

  function measure() {
    if (disposed || host.clientWidth < 2 || host.clientHeight < 2) return
    fit.fit()
    if (!pipeline || !sourceCanvas) return
    const outer = root.getBoundingClientRect()
    const source = sourceCanvas.getBoundingClientRect()
    pipeline.resize(outer.width, outer.height, {
      left: source.left - outer.left,
      top: source.top - outer.top,
      width: source.width,
      height: source.height
    })
    terminal.refresh(0, terminal.rows - 1)
    requestFrame()
  }

  function capture() {
    if (!active() || !pipeline || !sourceCanvas) return
    try {
      // This callback is synchronous with xterm's draw, before buffer invalidation.
      pipeline.capture(sourceCanvas, linkCanvas)
      lastCapture = performance.now()
      requestFrame()
    } catch {
      fallback()
    }
  }

  add(terminal.onData(initial.onData))
  add(terminal.onBinary(initial.onData))
  add(terminal.onResize(initial.onResize))
  fit.fit()

  try {
    if (!core._renderService?.onRender || !core._mouseService)
      throw new Error('Unsupported xterm renderer boundary')
    webgl = new WebglAddonClass(false)
    terminal.loadAddon(webgl)
    sourceCanvas = (webgl as unknown as RendererInternals)._renderer?._canvas
    if (!sourceCanvas) throw new Error('xterm has no completed-frame canvas')
    linkCanvas =
      host.querySelector<HTMLCanvasElement>('.xterm-link-layer') ?? undefined
    pipeline = new EffectsPipeline(canvas)
    add(core._renderService.onRender(capture))
    const captureLink = () => {
      if (!active() || !pipeline || !linkCanvas) return
      pipeline.captureOverlay(linkCanvas)
      lastCapture = performance.now()
      requestFrame()
    }
    if (core.linkifier) {
      add(core.linkifier.onShowLinkUnderline(captureLink))
      add(core.linkifier.onHideLinkUnderline(captureLink))
    }
    listen(sourceCanvas, 'webglcontextlost', (() =>
      fallback()) as EventListener)
    listen(canvas, 'webglcontextlost', ((event: Event) => {
      event.preventDefault()
      fallback()
    }) as EventListener)
    root.dataset.renderer = 'webgl'
    initial.onRendererChange('webgl')
    measure()
  } catch {
    fallback()
  }

  // xterm performs its own selection and mouse reporting. Correct only the coordinates
  // entering that existing machinery, using exactly the shader's sampling map.
  const mouse = core._mouseService
  if (mouse) {
    const originalCoords = mouse.getCoords.bind(mouse)
    const originalReport = mouse.getMouseReportCoords.bind(mouse)
    const map = (event: Position): Position => {
      if (
        failed ||
        composing ||
        !settings.effectsEnabled ||
        !settings.curvature.enabled
      )
        return event
      const rect = root.getBoundingClientRect()
      if (!rect.width || !rect.height) return event
      const p = curvePoint(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
        settings.curvature.amount
      )
      return {
        clientX: rect.left + p.x * rect.width,
        clientY: rect.top + p.y * rect.height
      }
    }
    mouse.getCoords = (event, element, cols, rows, selection) =>
      originalCoords.call(mouse, map(event), element, cols, rows, selection)
    mouse.getMouseReportCoords = (event, element) =>
      originalReport.call(mouse, map(event), element)
    cleanups.push(() => {
      mouse.getCoords = originalCoords
      mouse.getMouseReportCoords = originalReport
    })
  }

  const resizeObserver = new ResizeObserver(() => {
    try {
      measure()
    } catch {
      fallback()
    }
  })
  resizeObserver.observe(root)
  cleanups.push(() => resizeObserver.disconnect())
  const intersection = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true
    if (visible) {
      terminal.refresh(0, terminal.rows - 1)
      requestFrame()
    } else stopAnimation()
  })
  intersection.observe(root)
  cleanups.push(() => intersection.disconnect())
  listen(document, 'visibilitychange', (() => {
    if (document.hidden) stopAnimation()
    else {
      terminal.refresh(0, terminal.rows - 1)
      requestFrame()
    }
  }) as EventListener)
  listen(window, 'resize', (() => {
    try {
      measure()
    } catch {
      fallback()
    }
  }) as EventListener)
  listen(motion, 'change', (() => {
    reducedMotion = motion.matches
    requestFrame()
  }) as EventListener)
  listen(document.fonts, 'loadingdone', (() => {
    try {
      measure()
    } catch {
      fallback()
    }
  }) as EventListener)
  // Keep native IME candidate/composition UI at its exact unwarped input anchor.
  listen(host, 'compositionstart', (() => {
    composing = true
    canvas.style.display = 'none'
    stopAnimation()
  }) as EventListener)
  listen(host, 'compositionend', (() => {
    composing = false
    pipeline?.resetHistory()
    terminal.refresh(0, terminal.rows - 1)
    requestFrame()
  }) as EventListener)

  return {
    terminal,
    update(nextName, nextSettings, fontFamily, fontSize) {
      if (disposed) return
      const changedTheme = name !== nextName
      const changedFont =
        terminal.options.fontFamily !== fontFamily ||
        terminal.options.fontSize !== fontSize
      const enabledBefore = settings.effectsEnabled
      name = nextName
      settings = nextSettings
      if (changedTheme) {
        terminal.options.theme = palette(name)
        root.style.setProperty('--retro-background', themes[name].background)
        pipeline?.resetHistory()
      }
      if (changedFont) {
        terminal.options.fontFamily = fontFamily
        terminal.options.fontSize = fontSize
        measure()
      }
      root.dataset.effects = settings.effectsEnabled ? 'on' : 'off'
      if (!settings.effectsEnabled) {
        stopAnimation()
        canvas.style.display = 'none'
      } else {
        if (!enabledBefore) pipeline?.resetHistory()
        terminal.refresh(0, terminal.rows - 1)
        requestFrame()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopAnimation()
      for (const cleanup of cleanups.reverse()) cleanup()
      pipeline?.dispose()
      releaseWebgl()
      terminal.dispose()
      host.replaceChildren()
    }
  }
}

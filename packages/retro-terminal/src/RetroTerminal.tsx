import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { CSSProperties } from 'react'
import { resolveSettings } from './settings'
import type { RetroSettingsInput, ThemeName } from './settings'
import { createTerminalSource } from './terminal-source'
import type { RendererMode, TerminalSource } from './terminal-source'

export interface RetroTerminalHandle {
  write(data: string | Uint8Array, callback?: () => void): void
  focus(): void
  clear(): void
  getSize(): { cols: number; rows: number }
  getSelection(): string
}

export interface RetroTerminalProps {
  theme?: ThemeName
  settings?: RetroSettingsInput
  fontFamily?: string
  fontSize?: number
  className?: string
  style?: CSSProperties
  'aria-label'?: string
  onData?: (data: string) => void
  onResize?: (size: { cols: number; rows: number }) => void
  /** A returned cleanup runs before the terminal is disposed, including StrictMode remounts. */
  onReady?: (terminal: RetroTerminalHandle) => void | (() => void)
  onRendererChange?: (mode: RendererMode) => void
}

const defaultFont = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'

export const RetroTerminal = forwardRef<
  RetroTerminalHandle,
  RetroTerminalProps
>(function RetroTerminal(props, ref) {
  const root = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const source = useRef<TerminalSource | undefined>(undefined)
  const latest = useRef(props)
  useEffect(() => {
    latest.current = props
  }, [props])
  const queue = useRef<{ data: string | Uint8Array; callback?: () => void }[]>(
    []
  )
  const handle = useRef<RetroTerminalHandle>({
    write(data, callback) {
      if (source.current) source.current.terminal.write(data, callback)
      else queue.current.push({ data, callback })
    },
    focus() {
      source.current?.terminal.focus()
    },
    clear() {
      source.current?.terminal.clear()
    },
    getSize() {
      return {
        cols: source.current?.terminal.cols ?? 80,
        rows: source.current?.terminal.rows ?? 24
      }
    },
    getSelection() {
      return source.current?.terminal.getSelection() ?? ''
    }
  })
  useImperativeHandle(ref, () => handle.current, [])

  const theme = props.theme ?? 'amber'
  const settings = resolveSettings(theme, props.settings)
  const fontFamily = props.fontFamily ?? defaultFont
  const fontSize = props.fontSize ?? 14

  useEffect(() => {
    const element = root.current
    const hostElement = host.current
    const canvasElement = canvas.current
    if (!element || !hostElement || !canvasElement) return
    const abort = new AbortController()
    let disposeReady: (() => void) | void
    const current = latest.current
    void createTerminalSource(
      element,
      hostElement,
      canvasElement,
      {
        theme: current.theme ?? 'amber',
        settings: resolveSettings(current.theme ?? 'amber', current.settings),
        fontFamily: current.fontFamily ?? defaultFont,
        fontSize: current.fontSize ?? 14,
        onData(data) {
          latest.current.onData?.(data)
        },
        onResize(size) {
          latest.current.onResize?.(size)
        },
        onRendererChange(mode) {
          latest.current.onRendererChange?.(mode)
        }
      },
      abort.signal
    )
      .then((instance) => {
        if (!instance) return
        if (abort.signal.aborted) {
          instance.dispose()
          return
        }
        source.current = instance
        const fresh = latest.current
        instance.update(
          fresh.theme ?? 'amber',
          resolveSettings(fresh.theme ?? 'amber', fresh.settings),
          fresh.fontFamily ?? defaultFont,
          fresh.fontSize ?? 14
        )
        for (const entry of queue.current)
          instance.terminal.write(entry.data, entry.callback)
        queue.current = []
        disposeReady = latest.current.onReady?.(handle.current)
      })
      .catch((err) => {
        if (!abort.signal.aborted) {
          element.dataset.renderer = 'fallback'
          element.dataset.error = 'initialization'
          hostElement.textContent =
            'The terminal could not initialize. Please reload to try again.'
          console.error('Retro terminal initialization failed', err)
        }
      })
    return () => {
      abort.abort()
      disposeReady?.()
      source.current?.dispose()
      source.current = undefined
      queue.current = []
    }
  }, [])

  useEffect(() => {
    source.current?.update(theme, settings, fontFamily, fontSize)
  }, [theme, settings, fontFamily, fontSize])

  return (
    <div
      ref={root}
      className={`retro-terminal${props.className ? ` ${props.className}` : ''}`}
      style={props.style}
      aria-label={props['aria-label'] ?? 'Retro terminal'}
    >
      <div ref={host} className='retro-terminal__source' />
      <canvas
        ref={canvas}
        className='retro-terminal__effects'
        aria-hidden='true'
      />
    </div>
  )
})

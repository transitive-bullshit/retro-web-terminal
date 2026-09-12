import { useCallback, useRef, useState, type CSSProperties } from 'react'
import { DialRoot } from 'dialkit'
import {
  RetroTerminal,
  themes,
  type RetroTerminalHandle,
  type ThemeName
} from 'retro-web-terminal'
import { useRetroControls } from './controls'
import { createDemoSession } from './runtime'
import type { DemoMode, DemoSession } from './runtime/types'

const themeOptions: { name: ThemeName; label: string }[] = [
  { name: 'amber', label: 'Amber' },
  { name: 'green', label: 'Green' },
  { name: 'color', label: 'Color CRT' }
]

function TerminalMark() {
  return (
    <svg
      className='brand-mark'
      viewBox='0 0 26 25'
      fill='none'
      aria-hidden='true'
    >
      <rect
        x='1'
        y='1'
        width='24'
        height='20'
        rx='3'
        stroke='currentColor'
        strokeWidth='1.2'
      />
      <path
        d='m6 7 4 4-4 4m7 0h6M9 24h8'
        stroke='currentColor'
        strokeWidth='1.2'
      />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox='0 0 16 16' fill='none' aria-hidden='true'>
      <path
        d='M3 6a5 5 0 1 1 0 4M3 2v4h4'
        stroke='currentColor'
        strokeWidth='1.3'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  )
}

export function App() {
  const [theme, setTheme] = useState<ThemeName>('amber')
  const [framed, setFramed] = useState(true)
  const [ready, setReady] = useState(false)
  const [terminalKey, setTerminalKey] = useState(0)
  const [mode, setMode] = useState<DemoMode>('dashboard')
  const [renderer, setRenderer] = useState<'webgl' | 'fallback'>('webgl')
  const [size, setSize] = useState({ cols: 0, rows: 0 })
  const terminal = useRef<RetroTerminalHandle | null>(null)
  const session = useRef<DemoSession | null>(null)
  const controls = useRetroControls(theme)

  const onReady = useCallback((handle: RetroTerminalHandle) => {
    terminal.current = handle
    const nextSession = createDemoSession({
      write: (data) => handle.write(data),
      getSize: () => handle.getSize()
    })
    session.current = nextSession
    setMode(nextSession.getMode())
    setSize(handle.getSize())
    setReady(true)
    handle.focus()
    const unsubscribe = nextSession.subscribe(setMode)

    return () => {
      unsubscribe()
      nextSession.dispose()
      if (session.current === nextSession) session.current = null
      if (terminal.current === handle) terminal.current = null
    }
  }, [])

  const onData = useCallback((data: string) => session.current?.input(data), [])
  const onResize = useCallback((next: { cols: number; rows: number }) => {
    setSize(next)
    session.current?.resize(next.cols, next.rows)
  }, [])

  const chooseTheme = (name: ThemeName) => {
    controls.reset(name)
    setTheme(name)
  }

  const reset = () => {
    controls.reset(theme)
    setReady(false)
    setMode('dashboard')
    setTerminalKey((value) => value + 1)
  }

  const switchView = () => {
    if (mode === 'dashboard') session.current?.showShell()
    else session.current?.showDashboard()
    terminal.current?.focus()
  }

  return (
    <div
      className='workbench'
      style={{ '--phosphor': themes[theme].accent } as CSSProperties}
    >
      <header className='page-header'>
        <div className='brand'>
          <TerminalMark />
          <h1 className='brand-name'>
            retro<span> / </span>terminal
          </h1>
        </div>
        <div className='header-actions'>
          <span className='header-note'>INTERACTIVE PLAYGROUND</span>
          <a
            className='source-link'
            href='https://github.com/transitive-bullshit/retro-web-terminal'
            target='_blank'
            rel='noreferrer'
            aria-label='View the source on GitHub'
          >
            View source
            <svg viewBox='0 0 16 16' fill='none' aria-hidden='true'>
              <path
                d='M4 12 12 4M4 4h8v8'
                stroke='currentColor'
                strokeWidth='1.3'
              />
            </svg>
          </a>
        </div>
      </header>

      <main
        className='console'
        aria-label='Interactive retro terminal demo'
        onKeyDown={(event) => {
          if (
            mode === 'dashboard' &&
            event.key === 'Escape' &&
            !event.defaultPrevented
          ) {
            event.preventDefault()
            switchView()
          }
        }}
      >
        <div className='console-controls'>
          <div
            className='theme-selector'
            role='group'
            aria-label='Phosphor theme'
          >
            <span className='control-label'>Phosphor</span>
            {themeOptions.map(({ name, label }) => (
              <button
                className='theme-button'
                key={name}
                type='button'
                data-theme={name}
                style={
                  { '--theme-color': themes[name].accent } as CSSProperties
                }
                aria-pressed={theme === name}
                title={themes[name].description}
                onClick={() => chooseTheme(name)}
              >
                <span className='theme-dot' aria-hidden='true' />
                {label}
              </button>
            ))}
          </div>
          <div className='display-controls'>
            <button
              className='effects-switch'
              type='button'
              role='switch'
              aria-checked={controls.settings.effectsEnabled}
              aria-label='CRT effects'
              onClick={() =>
                controls.setEffectsEnabled(!controls.settings.effectsEnabled)
              }
            >
              <span className='switch-track' aria-hidden='true' />
              Effects
            </button>
            <button
              className='text-button'
              type='button'
              onClick={reset}
              title='Reset the terminal and current theme'
              aria-label='Reset the terminal and current theme'
            >
              <ResetIcon />
              <span className='reset-label'>Reset</span>
            </button>
          </div>
        </div>

        <div className={`monitor${framed ? '' : ' monitor--bare'}`}>
          <div
            className='screen'
            onKeyDownCapture={(event) => {
              if (
                mode === 'shell' &&
                event.metaKey &&
                !event.ctrlKey &&
                !event.altKey &&
                !event.shiftKey &&
                event.key.toLowerCase() === 'k'
              ) {
                event.preventDefault()
                event.stopPropagation()
                session.current?.clear()
              }
            }}
          >
            {!ready ? (
              <div className='screen-loading' role='status'>
                INITIALIZING DISPLAY
              </div>
            ) : null}
            <RetroTerminal
              key={terminalKey}
              className='retro-terminal'
              theme={theme}
              settings={controls.settings}
              fontSize={14}
              onReady={onReady}
              onData={onData}
              onResize={onResize}
              onRendererChange={setRenderer}
            />
          </div>
          <div className='monitor-label' aria-hidden='true'>
            <strong>RETRO / 01</strong>
            <span>PERSONAL DISPLAY TERMINAL</span>
          </div>
          <span className='power-indicator' aria-hidden='true' />
        </div>

        <div className='terminal-status'>
          <div className='status-left'>
            <span className='session-mode'>
              <span className='status-dot' aria-hidden='true' />
              {mode === 'dashboard' ? 'Diagnostics' : 'Local shell'}
            </span>
            <span className='sample-data'>
              {mode === 'dashboard'
                ? 'Simulated data'
                : 'Files reset with Reset or reload'}
            </span>
            <span className='renderer-status' data-mode={renderer}>
              {renderer === 'fallback'
                ? 'Basic display'
                : `${size.cols || '—'} × ${size.rows || '—'}`}
            </span>
          </div>
          <div className='keyboard-hint'>
            {mode === 'dashboard' ? (
              <>
                <kbd>p</kbd>
                <span>pause</span>
              </>
            ) : (
              <kbd>demo</kbd>
            )}
            <button
              className={mode === 'dashboard' ? 'exit-demo' : undefined}
              type='button'
              aria-label={mode === 'dashboard' ? 'Exit demo' : undefined}
              aria-keyshortcuts={mode === 'dashboard' ? 'Escape' : undefined}
              onClick={switchView}
            >
              {mode === 'dashboard' ? (
                <>
                  Exit demo
                  <kbd aria-hidden='true'>Esc</kbd>
                </>
              ) : (
                'return to diagnostics'
              )}
            </button>
          </div>
        </div>
      </main>

      <footer className='page-footer'>
        <p className='footer-caption'>
          <strong>
            {mode === 'dashboard'
              ? 'Press Esc or click Exit demo to use the shell.'
              : 'Type help in the shell to explore.'}
          </strong>
          <br />
          Changes stay in this tab. Reset or reload to start fresh.
        </p>
        <div className='footer-actions'>
          <button
            className='frame-switch'
            type='button'
            aria-pressed={framed}
            onClick={() => setFramed((value) => !value)}
          >
            <svg viewBox='0 0 16 16' fill='none' aria-hidden='true'>
              <rect
                x='1.5'
                y='2.5'
                width='13'
                height='10'
                rx='2'
                stroke='currentColor'
              />
              <rect
                x='4'
                y='5'
                width='8'
                height='5'
                rx='.5'
                stroke='currentColor'
              />
            </svg>
            {framed ? 'Hide frame' : 'Show frame'}
          </button>
          <span className='tune-caption'>Tune your display ↘</span>
        </div>
      </footer>
      <DialRoot
        position='bottom-right'
        theme='dark'
        defaultOpen={false}
        productionEnabled
      />
    </div>
  )
}

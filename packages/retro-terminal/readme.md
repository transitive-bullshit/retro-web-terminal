# retro-web-terminal

An embeddable React terminal with GPU-rendered CRT effects, built on xterm.js and WebGL2. Includes Amber, Green Phosphor, and Color CRT presets with individually configurable glow, scanlines, curvature, phosphor trails, color separation, noise, flicker, glitches, and vignette.

## Install

Install from npm in your React 18+ app:

```sh
pnpm add retro-web-terminal
```

## Usage

```tsx
import { useRef } from 'react'
import { RetroTerminal, type RetroTerminalHandle } from 'retro-web-terminal'
import 'retro-web-terminal/styles.css'

export function Example() {
  const terminal = useRef<RetroTerminalHandle>(null)

  return (
    <RetroTerminal
      ref={terminal}
      theme='amber'
      style={{ height: 420 }}
      settings={{ glow: { intensity: 0.4 } }}
      onReady={(handle) => handle.write('Hello, future\r\n')}
      onData={(data) => terminal.current?.write(data)}
    />
  )
}
```

Provide a height and import the CSS once. This example echoes input; connect `onData`, `onResize`, and the ref's `write()` to your own runtime or terminal transport for a real session. Use a client component in server-rendered frameworks.

The ref exposes `write(string | Uint8Array, callback?)`, `focus()`, `clear()`, `getSize()`, and `getSelection()`. `onReady` can return a cleanup function. `onRendererChange` reports `webgl` or `fallback`. Theme/settings changes preserve output. Zod validates nested settings overrides; `settingsSchema`, `resolveSettings`, `themes`, and `parameterRanges` are exported.

Current desktop browsers are the target. WebGL2 failure falls back to xterm's ordinary renderer with the same session. Reduced motion suppresses animated noise, flicker, and glitches. Extreme settings can compromise pointer alignment. Font loading is left to the host; IBM Plex Mono is preferred when available, followed by system monospace fonts.

The browser shell, DialKit controls, fonts, and monitor artwork are separate demo assets. [Repository, demo instructions, and validation](https://github.com/transitive-bullshit/retro-web-terminal).

MIT. Original CRT shaders inspired by cool-retro-term.

# Component and renderer

The MVP has two workspaces: `packages/retro-terminal` exports the React component and validated settings; `apps/demo` supplies a Vite playground, DialKit controls, browser shell, dashboard, and optional frame. Demo development aliases the package to source. The library builds independently with tsdown as ESM, declarations, and an exported stylesheet. Vercel Web Analytics is mounted once in `apps/demo/src/main.tsx` as a demo-only dependency.

## Deployment

Vercel builds from the repository root. The root `vercel.json` selects Vite, runs `pnpm build`, and serves `apps/demo/dist`. Keep Vercel’s Root Directory empty; the demo is a workspace within this root build. No environment variables are required for the demo.

## Public contract

| Prop | Meaning |
| --- | --- |
| `theme` | `amber` (default), `green`, or `color` |
| `settings` | Optional nested overrides for the selected preset |
| `fontFamily`, `fontSize` | Font controls; defaults are IBM Plex Mono with system fallbacks, 14 CSS px |
| `className`, `style`, `aria-label` | Host styling and accessible label; provide a height |
| `onData(data)` | Terminal input; transport/runtime belongs to the host |
| `onResize({ cols, rows })` | Fitted character dimensions |
| `onReady(handle)` | Initialized terminal; optionally return a cleanup function |
| `onRendererChange(mode)` | `webgl` or `fallback` |

The ref and ready callback receive `write(string | Uint8Array, callback?)`, `focus()`, `clear()`, `getSize()`, and `getSelection()`. Writes before initialization are queued. `clear()` follows xterm's clear behavior; applications can write ANSI erase/control sequences when they need precise screen operations. Input/output is imperative and does not flow through React state.

`settingsSchema`, `resolveSettings`, `parameterRanges`, and `themes` are public. Zod defines defaults and bounds. `resolveSettings(theme, overrides)` merges built-in nested settings and returns an independent validated value. Invalid/unknown parameters throw at the configuration boundary. Each of glow, scanlines, phosphor texture, curvature, persistence, RGB shift, noise, flicker, glitch, and vignette has an `enabled` switch. `effectsEnabled` bypasses the whole effects canvas. Brightness and contrast are global adjustments.

Theme changes update the palette, reset incompatible phosphor history, and preserve the session. Applications that offer a Reset action should resolve the chosen theme again, as the demo does. The package has no saved settings, user preset registry, public shader plugins, or runtime dependency on the demo.

## Rendering integration

Pinned xterm 6.0.0 and WebGL addon 0.19.0 render glyphs, ANSI backgrounds, cursor, and selection. `terminal-source.ts` is the only private xterm integration boundary: it accesses the addon's completed-frame canvas, subscribes to the internal render service (including cursor-only redraws), and corrects mouse coordinates. The adapter also disposes the cursor blink manager that addon 0.19.0 omits from its own cleanup. Keep compatible versions pinned and repeat browser checks before an upgrade.

A second WebGL2 context copies xterm's canvas synchronously after each draw. The source drawing buffer is not preserved. This timing avoids blank frames after browser compositing; the public xterm render event alone is insufficient for all redraws. The separate link-underline canvas is also captured. This is a canvas transfer between contexts, not a shared texture or guaranteed zero-copy integration.

The fixed pass sequence is:

1. Convert source color into a linear phosphor signal. Amber and Green map application colors to their phosphor tint; Color CRT retains them.
2. Combine current excitation with decayed previous excitation using a bounded maximum. Ping-pong history contains only unwarped signal, never final noise/distortion.
3. Prefilter into a one-third-resolution bloom target, then apply separable Gaussian diffusion.
4. Combine sharp signal, trails, and bloom through curvature, color offsets, and glitch displacement; apply scanlines, phosphor texture, flicker, vignette, exposure, and output encoding.

Effects resolution is capped at device pixel ratio 2. History uses RGBA16F when `EXT_color_buffer_float` is supported, with RGBA8 otherwise. Decay is based on elapsed time. Resizing and theme changes clear history. Glow work is skipped when disabled; the master switch bypasses capture/render work. Reduced motion disables animated grain, flicker, and glitches while retaining the static CRT appearance. The effects loop stops when the document is hidden or the component leaves the viewport.

The original xterm textarea, scroll viewport, and accessibility DOM remain active underneath the pointer-transparent effects canvas. Selection and mouse reports use the same destination-to-source curvature mapping as the shader. Static curvature is corrected; extreme RGB offsets and animated glitches can move visible pixels away from exact pointer positions. During IME composition, the ordinary terminal is shown so the native composition/candidate UI retains an unwarped anchor.

Graphics failure or context loss disposes the effects and WebGL addon, returning the existing terminal to xterm's DOM renderer. Session state, scrollback, and input remain. This fallback retains the theme's foreground/background palette but does not apply phosphor color conversion to application ANSI colors. GPU effects do not automatically retry until remount.

## Lifecycle and limits

Browser-only modules load on mount. Observers, input listeners, animation frames, host cleanup, terminal, and graphics resources belong to each component instance. A ready callback's cleanup runs before disposal, including React StrictMode remounts. Font readiness and container/window resizing trigger fitting; host code should avoid changing the terminal's physical size from its own resize callback.

No backend, PTY, session persistence, image protocol, or application launcher is bundled. The demo's command adapter is a separate buffered REPL over `just-bash/browser`; see [demo runtime](demo-runtime.md).

The effects are original MIT code. cool-retro-term informed the appearance and broad rendering concepts; no GPL shader implementation is included. See [credits](credits.md) and the [rendering research](research/terminal-rendering.md).

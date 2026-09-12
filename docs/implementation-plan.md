# Retro web terminal: implementation plan

Status: MVP implemented; release checks are recorded in [validation](validation.md). Updated 2026-09-12. This document retains the agreed scope and rationale; current usage and implementation guidance live in [architecture](architecture.md) and [demo runtime](demo-runtime.md).

Build an open-source React terminal that captures the visual character of cool-retro-term, with a small browser-only playground. Visual fidelity is the priority. Prefer existing terminal APIs, but accept a focused renderer adaptation when the visual result requires it. Finish with a release-ready repository; npm publication and public deployment are separate launch steps.

## Decision cheat sheet

| Area | Agreed direction |
| --- | --- |
| Terminal | xterm.js with its existing WebGL addon; validate the rendering bridge first |
| Effects | One WebGL2 backend with a fixed internal sequence of GLSL passes |
| Alternative | Wterm remains a fallback candidate if evidence changes; do not implement both engines |
| Browser baseline | Current desktop Chrome, Safari, Firefox; no experimental browser flags; mobile polish deferred |
| Failure behavior | Keep the terminal usable with its palette and ordinary renderer when GPU effects cannot run |
| Themes | Amber, Green Phosphor, Color CRT; each includes a palette and curated effect settings |
| Controls | Explicit Zod schemas; individual effect toggles and parameters through DialKit in the demo |
| Demo runtime | `just-bash/browser`, a seeded in-memory filesystem, and Unix-style commands |
| First view | An animated diagnostics dashboard with clearly labeled sample data; `q` opens the shell; `demo` returns |
| Graphics | ANSI/Unicode charts, gauges, traces, and logs; no image protocol integration in the MVP |
| Persistence | Files and settings live for the current visit; reload resets everything; provide Reset theme |
| Distribution | A React package plus a Vite demo that loads package source directly during development |
| Visual frame | Optional demo-only monitor artwork; terminal screen appearance belongs to the component |

The [source research and trade-offs](research/terminal-rendering.md) explain the foundation choice. WebGL2 is sufficient for the requested effects; WebGPU/vgpu does not remove the terminal-image capture problem. HTML-in-Canvas is unsuitable for the agreed browser baseline.

## Scope and quality bar

Include glow/bloom, scanlines and phosphor texture, screen curvature, fading phosphor trails, RGB separation, noise, flicker, and animated glitches. Each effect can be disabled independently. Defaults should feel convincingly retro and remain readable; maximum slider combinations are experimental.

Amber and Green Phosphor deliberately render monochrome. Color CRT preserves application color distinctions. Themes resolve to complete validated settings, and switching themes restores their curated parameters without restarting the terminal or shell. Reset theme restores the currently selected theme. Use a suitable permissively licensed monospace font and verify the dashboard's box-drawing and chart glyphs before tuning shaders.

Target approximately 60 fps and responsive input with curated defaults in one normally sized terminal on a modern laptop. Record the tested machine, viewport, pixel ratio, and browser; this is a target to measure, not a promise for arbitrary hardware or maximum settings. Stop unnecessary rendering when hidden. Curated defaults must preserve practical selection, scrolling, copy/paste, and keyboard interaction. Extreme distortion may compromise exact pointer alignment. Respect reduced-motion preferences for animated disturbance effects while retaining the static CRT look.

Keep the initial release focused: no server, real PTY provisioning, accounts, real market/system data, Gloomberb/Glances integration, public shader plugins, user-authored preset system, persistent sessions, or general-purpose application launcher. The underlying terminal can still be connected to external terminal data by a consuming app.

## Proposed repository shape

The current repository contains pnpm/TypeScript/Oxfmt/Oxlint tooling and placeholder Next.js scripts/configuration. Preserve the tooling and replace the placeholders during implementation.

```text
packages/retro-terminal/
  src/index.ts                  # Deliberate public exports
  src/RetroTerminal.tsx         # React lifecycle and component contract
  src/settings.ts               # Zod schemas, defaults, and built-in themes
  src/terminal-source.ts        # xterm setup and renderer-specific integration
  src/effects/                  # Fixed WebGL2 passes and shader source strings
  src/styles.css
apps/demo/
  src/App.tsx                   # Screen, theme selector, DialKit, optional frame
  src/shell.ts                  # just-bash, prompt/input, session state
  src/dashboard.ts              # Animated ANSI/Unicode sample program
  public/                       # Demo-only fonts/artwork as appropriate
```

Use pnpm workspaces for these two packages. Build the library with tsdown as browser-targeted ESM plus TypeScript declarations; keep React a peer dependency and declare runtime dependencies explicitly. Export required CSS and package assets intentionally. Prefer plain CSS and copied assets over introducing an experimental CSS build pipeline. Store GLSL as TypeScript strings to avoid leaking Vite-only shader imports into the published package.

During development, the demo resolves the package import to its source entry through Vite. Validate the built package separately so the source alias cannot conceal broken exports, missing CSS/fonts, or declaration errors. Package naming, exact module splits, and compatible version selection are routine implementation choices, not new product decisions.

## Implementation sequence

### 1. Establish the workspace and prove the rendering bridge

Create only the minimal Vite harness and package scaffolding needed for the experiment. Keep throwaway probes under `work/`. Pin compatible xterm and addon versions before relying on rendering internals.

First try using xterm's existing WebGL canvas as the image source for a second WebGL2 context. Isolate canvas discovery, frame synchronization, resizing, and disposal in one internal module. This is an image transfer between contexts, not a promised shared texture or zero-copy path. Compare preserved drawing-buffer capture with correctly synchronized capture; xterm's public `onRender` event alone does not cover every redraw.

Inventory the glyph/background/cursor/selection surface and separate link or DOM overlays. Preserve xterm's input textarea and semantic DOM. Do not assume capturing one canvas includes every visible layer, or that hiding the terminal with `display: none` preserves rendering and input behavior.

Prove glow, moderate curvature, RGB displacement, and phosphor trails together using animated terminal content. Verify typing, cursor blink, clearing, selection, scrolling, focus, resizing, and pixel-ratio changes. Keep IME composition readable and positioned consistently. Reuse the shader's destination-to-source coordinate mapping where pointer correction is needed; `pointer-events: none` alone does not align warped text with input.

**Exit criterion:** stable complete frames, practical interaction at curated distortion strengths, and measured acceptable frame cost on the target browsers. If canvas capture fails this gate, investigate adapting xterm's WebGL renderer to render into an offscreen framebuffer within its own context. Preserve its parser, terminal state, glyph rendering, and input machinery. This entails renderer maintenance and is not assumed to be a tiny patch. Record the selected integration and its limits before continuing; do not silently reduce the visual scope to pass the gate.

### 2. Build the fixed CRT effects pipeline

Use a small private WebGL2 pass runner with explicit render targets. Do not build a dynamic effects graph or public shader interface.

Start with this order:

1. Acquire the current unwarped terminal image and establish its color encoding.
2. Apply the phosphor color response in a consistent working color space. Preserve ANSI colors in Color CRT; map to monochrome phosphor in the other themes.
3. Update separate previous/next history textures using elapsed-time decay and bounded excitation. Static text must not brighten indefinitely or depend on frame rate.
4. Derive beam softness and broad bloom from the phosphor image; combine sharp text and glow deliberately.
5. Sample through curvature, RGB offsets, and glitch/jitter displacement. Apply scanline/phosphor patterns in coordinates that follow the screen.
6. Apply grain, flicker, vignette, exposure, and output color encoding.

Do not feed the final warped/noisy output back into history. Trails are a fading previous-frame effect; permanent burn-in is not a separate MVP feature. Skip unused work when effects are disabled. Clear incompatible history on resize, theme changes, and graphics-resource recreation; allow ordinary text clearing to leave only the intended fading trail. Use lower-resolution bloom and a measured pixel-ratio cap when beneficial.

**Exit criterion:** all agreed effects work together, disable cleanly, and have understandable bounded controls. Check decay at different frame rates and verify resize/resume behavior. Write original effects or use appropriately licensed material; cool-retro-term's GPL implementation is visual/architectural reference, not code to paste into this MIT project.

### 3. Complete the React component and settings contract

Keep the public API small: a built-in theme name, overrides for built-in settings, sizing/styling, an imperative output writer and focus control, and terminal input/resize callbacks. Support ordinary host-provided terminal input/output without bundling the demo shell. No public terminal-engine abstraction, external effect registration, or custom-theme management API is needed.

Create xterm and GPU resources once per mount. Stream terminal output imperatively rather than storing every chunk in React state. Apply effect/theme changes without destroying the session. Fit the terminal to its container; handle font readiness, resizing, cleanup, and React development remounts. Browser resources must be created on mount, not by importing the package.

Zod defines the complete parameter shape, ranges, defaults, and inferred types. Validate presets and incoming changes at configuration boundaries, not inside every animation frame. Keep the DialKit mapping explicit and small, using the same defaults/bounds rather than inventing a generic form generator.

**Exit criterion:** independent component instances do not share mutable terminal/GPU state; mount/unmount releases resources; theme edits preserve output; loss or failure of graphics restores a usable ordinary terminal with the same session and palette. A second graphics backend or complicated recovery manager is unnecessary.

### 4. Add the browser shell and dashboard

Use `just-bash/browser` rather than implementing Unix commands. This is a command-line REPL with buffered stdout/stderr, not a live PTY; file editing means commands and redirection rather than an embedded full-screen editor. Seed a small directory tree with a welcome file, theme notes, and sample data. Maintain file changes for the current visit. Provide familiar prompt editing, command history, basic path completion, and interruption where supported by the chosen runtime.

Manage the working directory deliberately: just-bash isolates shell state between `exec()` calls. Carry the working directory forward, but document that exported variables and shell functions reset between submissions in this MVP. Execute a user's command once, and capture/update the resulting directory without running the command a second time. Keep the command adapter separate from xterm and verify cancellation does not leave stale output or an unusable prompt. Avoid optional network/native runtimes; the demo should remain self-contained.

Implement one original diagnostics dashboard that draws into the terminal using ANSI/Unicode. Animate charts, activity meters, and a short rolling log with clearly labeled sample data. Open into the dashboard, use `q` to return to the shell, and reserve `demo` to re-enter it. Give it a small keyboard interaction such as pausing or cycling a displayed metric. Use the alternate screen and restore the previous screen, cursor visibility, and input modes on exit. Stop its timers when leaving it. Do not route the dashboard through a fake native-process layer or make unrelated commands into extra applications.

**Exit criterion:** visitors can explore with `ls`, `cd`, `pwd`, `cat`, pipes/redirection, and file edits; enter/exit the dashboard repeatedly; resize either view; and reload to a clean initial state.

### 5. Curate the demo and optional frame

Keep one page and one primary terminal. Add the three-theme selector, grouped DialKit effect toggles/sliders, Reset theme, and concise keyboard hints. Make sure DialKit remains visible in the production demo build. Neither controls nor artwork belongs in the reusable component's dependency graph.

Tune the three themes against the same dashboard and shell content, checking both a still frame and motion against the cool-retro-term reference. Readability, believable glow, phosphor texture, curvature, and trails matter more than the number of visible controls.

The [first monitor-frame concept](brand-exploration/monitor-frame-v1.md) is available as optional visual direction. Explore one unbranded monitor-bezel master image with an empty center. Use CSS nine-slice rendering, keeping the four corners fixed and stretching the four sides; the center is the live terminal, not a baked screenshot. Prefer one consistent source image over eight independently generated pieces. Keep the asset optional and demo-only. Confirm alpha, corner/edge continuity, screen alignment, and several aspect ratios before treating concept artwork as production-ready. A generated concept is not evidence that these integration checks pass.

**Exit criterion:** the default page immediately demonstrates the visual result, every effect can be explored and reset, the frame does not obstruct input, and the interface remains usable at common desktop sizes.

### 6. Verify the release-ready repository

Run the required formatter/linter/type/build checks using the repo's pnpm workflow. Add meaningful tests for configuration validation, frame-rate-independent decay and coordinate mapping where implemented, shell directory/file behavior, cancellation, and view lifecycle. Use focused browser integration checks for frame capture and terminal interaction; avoid relying solely on shader snapshots or tests that repeat implementation details.

Exercise Chrome, Safari, and Firefox with default presets: dashboard animation, typing, cursor blink, selection/copy/paste, IME, scrolling, resizing, hidden-tab resume, and graphics failure. Record actual performance results. Compare the off state and all three curated themes visually. Test reduced motion and readable fallback behavior.

Pack the library and install that tarball into a separate minimal React consumer under `work/`. Verify exports, declarations, CSS/assets, default appearance, input/output, resize, and teardown without source aliases or demo dependencies. Ensure the static Vite production build includes the controls and browser shell.

Update the README and concise current guidance under `docs/` with installation, a minimal embedding example, demo commands, browser expectations, known integration limits, and asset/license attribution. Keep source research under `docs/research/` and visual proposals under `docs/brand-exploration/`. Remove throwaway experiments from the proposed commit.

**Done:** a reproducible repository with a convincing demo, an independently verified installable package, passing appropriate checks, and concise documentation. Publishing to npm and deploying the public site happen in the later launch step.

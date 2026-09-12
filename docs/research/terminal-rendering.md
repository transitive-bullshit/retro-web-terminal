# Terminal rendering decision sheet

Research date: 2026-09-12. This is a cited research snapshot and record of the completed interview, not implementation evidence. Browser support and upstream APIs should be checked again when dependencies are pinned.

## Decisions

Use xterm.js with its WebGL2 addon and one WebGL2 effects backend. Validate the smallest rendering bridge first; strongly prefer no fork. Preserve a usable basic terminal when graphics initialization fails. Target current desktop Chrome, Safari and Firefox without flags.

Ship a reusable React component and a Vite demo loading package source. The demo opens a self-contained ANSI/Unicode dashboard: `q` enters its browser shell; `demo` returns. Use `just-bash/browser` with a seeded filesystem that resets on reload. Deliver three curated Amber, Green and Color CRT themes, with individually controllable effects validated by Zod. No public shader/plugin system, native TUI runtime, publishing or deployment is included. An optional generated monitor frame belongs only to the demo.

## Terminal foundation: verified facts

| Dimension | xterm.js | Wterm |
| --- | --- | --- |
| Emulation | Established frontend used by VS Code; supports Unicode, IME and common terminal applications | Built-in lightweight Zig/WASM core; optional Ghostty WASM core provides broader VT and grapheme handling |
| Existing renderer | DOM, or the official WebGL2 addon | DOM rows; separate canvases for supported terminal images |
| Reusable boundary | Terminal API, events and addons | Public headless `TerminalCore` exposes cells, cursor, modes, dirty rows and scrollback |
| Complete frame texture API | Not exposed by the inspected WebGL addon API; its texture atlas contains glyphs, not the terminal image | None in the headless contract; a GPU renderer would have to rasterize the supplied state |
| Interaction value | Existing selection, input, scrolling and accessibility support | DOM provides native selection and semantic text; find/accessibility cover mounted rows |
| License | MIT | Apache-2.0 |

Sources: [xterm overview](https://github.com/xtermjs/xterm.js#readme), [WebGL addon API at 6.0.0](https://github.com/xtermjs/xterm.js/blob/6.0.0/addons/addon-webgl/typings/addon-webgl.d.ts), [Wterm DOM](https://github.com/vercel-labs/wterm/tree/main/packages/@wterm/dom), [core contract](https://github.com/vercel-labs/wterm/blob/main/packages/@wterm/core/src/terminal-core.ts), [Ghostty comparison](https://github.com/vercel-labs/wterm/tree/main/packages/@wterm/ghostty).

**Inference:** xterm preserves more of the expensive rendering and interaction work. Wterm's clean core boundary is attractive, but replacing its DOM renderer expands this project's ownership. Its ready-made shell adapter does not solve the effects problem.

## Graphics choice

**Facts:** WebGL2 is widely available across browsers, including Safari since version 15. WebGPU availability still depends on OS/GPU combinations: Firefox Stable excludes Linux and Intel Macs; Safari requires macOS Tahoe 26; Chrome's Linux support includes Intel Gen12+ and qualifying NVIDIA/Wayland systems, with other configurations still restricted. Even a supported browser may return no usable GPU adapter. [WebGL2](https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext), [WebGPU implementation status, updated August 2026](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status), [adapter availability](https://developer.mozilla.org/en-US/docs/Web/API/GPU/requestAdapter).

vgpu provides WGSL fullscreen effects, offscreen targets and ping-pong resources, but its browser initialization fails when WebGPU is unavailable; it does not supply automatic WebGL fallback. [Initialization](https://github.com/vercel-labs/vgpu/blob/canary/packages/vgpu-api/src/init.docs.md), [targets](https://github.com/vercel-labs/vgpu/blob/canary/packages/vgpu-api/src/target.docs.md).

**Inference:** this effects list needs image sampling and framebuffer passes, not compute shaders. WebGL2 keeps one shader language and a broader baseline. WebGPU is unnecessary for v1.

HTML-in-canvas remains experimental: the current proposal describes a Chromium flag; Chrome documents an origin trial in versions 148–150. Its APIs draw DOM into a canvas/texture, but this is not an interoperable Safari/Firefox dependency. Three.js HTMLTexture does not remove that requirement. [Proposal](https://wicg.github.io/html-in-canvas/), [Chrome documentation](https://developer.chrome.com/blog/html-in-canvas-origin-trial).

## Three effect classes

This is an implementation model, not an upstream API:

| Class | Examples | Required data |
| --- | --- | --- |
| Surface treatment | Palette, vignette, scanlines, noise, flicker | Current pixels and procedural patterns |
| Spatial processing | Bloom/glow, curvature, RGB separation, displacement glitches | Complete terminal image; neighboring or displaced samples; intermediate textures for blur |
| Temporal processing | Phosphor persistence and trails | Current image plus retained previous-frame textures with time-based decay |

CSS can approximate some surface treatments. The selected fidelity requires processing the actual text, backgrounds, cursor and selection pixels. Temporal effects need history even when terminal output stops. Curated distortion strengths must preserve ordinary pointer usability; extreme settings need not offer exact visual hit alignment.

## Rendering bridge: unresolved until tested

The initial design likely uses two GL contexts: xterm's renderer and the effects canvas. One effects backend does not imply shared textures or zero-copy. Drawing-buffer lifetime makes capture timing important; preservation may help correctness but its cost must be measured. [WebGL drawing-buffer rules](https://registry.khronos.org/webgl/specs/latest/1.0/#THE_DRAWING_BUFFER).

Pin compatible versions and prove:

1. Complete capture through typing, ANSI redraws, clears, cursor blink, selection, focus, scrolling, resize and DPR changes. Public `onRender` alone does not cover redraw-only frames.
2. Combined bloom, curvature/RGB displacement and persistence, including final fade after output stops.
3. Selection/copy, IME and links, including semantic DOM overlays and pointer alignment.
4. Acceptable dashboard cost, hidden-page pausing, context-loss fallback and React cleanup.

[xterm rendering implementation](https://github.com/xtermjs/xterm.js/blob/6.0.0/addons/addon-webgl/src/WebglRenderer.ts#L295-L329) informs this investigation; it is not a supported completed-frame hook. If capture fails, evaluate a narrowly adapted renderer before considering broader changes. Do not silently accept a core fork.

## Demo shell and provenance

`just-bash/browser` supplies a TypeScript Bash simulation and in-memory filesystem, including `ls`, `cat`, `cd`, `pwd`, `help` and `clear`. Files survive individual executions, but working-directory/environment state resets unless the adapter manages it. Its optional Python, JavaScript and SQLite runtimes are unavailable in browsers. This choice does not run native programs. It is Apache-2.0 and has an explicit browser export. [Documentation](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/README.md), [manifest](https://github.com/vercel-labs/just-bash/blob/main/packages/just-bash/package.json).

The current repo declares MIT in [package.json](../../package.json). cool-retro-term's inspected QML implementation carries GPL-3.0-or-later notices. Use it as a visual reference; independently author this project's shaders and assets, preserve dependency notices, and record any reused third-party material separately. Do not relabel copied implementation as MIT. [Upstream source notice](https://github.com/Swordfish90/cool-retro-term/blob/master/app/qml/TerminalContainer.qml).

# Credits and licenses

The project is MIT licensed; see the root `license`. The library build includes that license in its distribution.

- **xterm.js, Fit addon, WebGL addon:** MIT. Provide terminal parsing, glyph rendering, input, selection, scrolling, and accessibility. The exported component stylesheet includes xterm's CSS and copyright notice.
- **React, Zod, DialKit, Motion, Vite, tsdown:** MIT dependencies. Their package license files remain with their installed distributions. The browser shell and controls are demo dependencies only.
- **just-bash:** Apache-2.0. Browser-only command execution and in-memory files in the demo.
- **IBM Plex Mono:** SIL Open Font License 1.1, IBM. The demo loads the locally bundled Fontsource package. The reusable component does not ship a font.
- **DialKit stylesheet:** vendored in `apps/demo/src/dialkit.css` from DialKit 2.0.2 with its MIT notice retained. The remote font import was removed so the playground has no remote font dependency.
- **Monitor artwork:** generated with OpenAI ImageGen for this project. The original prompt and master are under `docs/brand-exploration/`; the demo uses a copied PNG with nine-slice CSS. It is an optional decorative asset, never part of the component package or the live terminal image.
- **cool-retro-term:** visual and architectural inspiration. This repository contains original GLSL effects and does not include its GPL implementation.

The diagnostics dashboard is original ANSI/Unicode artwork and simulated data. It does not integrate a third-party native monitoring application.

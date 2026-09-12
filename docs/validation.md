# MVP validation

Verified 2026-09-12 on an Apple M3 Pro MacBook Pro (12 CPU cores, 18 GPU cores, 36 GB RAM), macOS 26.3. Node 26.8.1 and pnpm 12.3.4. No experimental browser flags were required.

## Automated checks

- `pnpm fix:format` and `pnpm fix:lint`: applied the repository conventions.
- `pnpm test`: formatting, lint, TypeScript, and 19 unit tests pass. Unit coverage includes schema validation, independent preset resolution, frame-rate-independent decay, curvature mapping, working-directory/file behavior, cancellation, dashboard modes, and compact layouts.
- `pnpm build`: the ESM/declaration/CSS library and static Vite demo build successfully.
- `pnpm test:browser`: 27 checks across Chromium 153, Firefox 155, and Playwright WebKit 26.6. Covers dashboard interaction and exiting with Escape or the visible button, real commands/files/directory changes, theme/reset/reload behavior, Cmd+K clear without executing a draft, selection/copy, resize, unavailable-WebGL fallback, actual GPU pixel placement and decay, failed shader cleanup, and cursor timer cleanup after context loss.

The tests caught and drove fixes for partial effects-constructor resource cleanup and an undisposed cursor timer in WebGL addon 0.19.0. GPU tests sample actual framebuffer pixels after clearing the source, checking that trails fade and reset rather than remaining as stale frames.

## Hardware rendering

Headed browsers used the Apple GPU. The demo had a 958 × 540 CSS-pixel screen at DPR 2, with effects buffers of 1916 × 1080. Chromium and Firefox used a 1440 × 1000 viewport. Native-DPR WebKit used 1440 × 1047.

Six-second foreground runs with animated sample telemetry:

| Browser / preset | Observed frames | Median rAF interval | 95th percentile |
| --- | --: | --: | --: |
| Chromium 153 / Amber | 717 | 8.3 ms | 9.1 ms |
| Chromium 153 / Green | 713 | 8.3 ms | 9.2 ms |
| Chromium 153 / Color CRT | 719 | 8.3 ms | 9.0 ms |
| Firefox 155 / Amber | 700 | 8.34 ms | 9.20 ms |
| Playwright WebKit 26.6 / Amber | 360 | 17 ms | 21 ms |

These observations meet the approximately 60 fps target on this machine. Chromium/Firefox followed the high-refresh display near 120 Hz; WebKit followed about 60 Hz. They measure animation scheduling during actual rendering, not isolated GPU execution time or a guarantee for all devices. Chromium canvas-upload calls had a 95th-percentile CPU duration of approximately 0.1 ms.

All three presets were visually inspected at rest and while animating. Replacing sparse bloom samples with prefiltered Gaussian diffusion removed repeated text edges. Screens remained complete and readable. Native Safari 26.3 was additionally checked through its actual UI: amber dashboard, pause, shell text/paste, file write/read, green/effects bypass, and return to Color CRT all worked. Safari itself was not separately benchmarked.

Headed Firefox and WebKit also passed synthetic composition hide/restore, offscreen resume, and real `WEBGL_lose_context` fallback while preserving a shell file and subsequent commands. The effects loop stopped while the document was hidden. Selection/copy uses the terminal's normal selection and clipboard event, including the curvature correction.

## Package and demo

The built tarball was installed into a separate React + Vite consumer under the ignored `work/` directory. It used only public exports and CSS, with no source alias or demo dependencies. Strict declarations and a production build passed. Two terminals independently handled string/byte output, callbacks, input, themes, and resizing. Four mount cycles per instance under StrictMode produced four ready callbacks and four cleanups. After teardown, effects contexts were released and no animation frame or discarded WebGL cursor interval remained. System-font fallback worked without external font requests.

A separate production-preview smoke test verified visible DialKit controls, shell file write/read, and return to the dashboard with no page errors.

The demo includes locally bundled IBM Plex Mono and the production-enabled DialKit controls. All effect groups were checked for toggles and keyboard slider changes. Layout checks at widths 1440, 800, and 390 found no horizontal overflow. Mobile polish is still outside the supported desktop target.

## Limits and tooling notes

- OS-native CJK candidate windows and a complete assistive-technology audit remain manual checks. Synthetic composition behavior and xterm's accessible terminal text were verified.
- Extreme distortion/glitches can compromise precise visible pointer alignment. Curated curvature corrects selection coordinates; RGB offsets and moving tears do not define separate hit targets.
- Chromium's emulated DPR can disagree with `ResizeObserver.devicePixelContentBoxSize`, which xterm uses for native canvas rounding. Fidelity checks therefore matched native display density. This emulation-only discrepancy is not patched by changing xterm's production observer.
- Performance on software WebGL is substantially lower. The figures above are hardware-GPU results.
- Vite reports large chunks for the included UI/runtime dependencies; the 1.28 MB (353 KB gzip) shell bundle loads only when the shell is first used. Its bundled `rg` implementation references Node's `zlib`, which Vite externalizes: compressed `rg -z` searches are unsupported in this browser demo. Ordinary text search and the documented filesystem commands work.
- tsdown reports that its TypeScript 7 API integration is experimental. Emitted declarations were independently typechecked in the packed consumer. JavaScript and declaration maps are included.

Temporary screenshots, traces, browser probes, and consumer fixtures live under ignored `work/` or test output directories. No package publication or public deployment was performed.

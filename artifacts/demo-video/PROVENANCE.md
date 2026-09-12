# Media provenance

## Terminal footage

Captured on 12 September 2026 from the Retro Web Terminal project: Amber and Green use commit `7c41d59`; Color CRT uses the source included in `5f29006` using agent-browser 0.37.1. H.264 browser recordings at 1920 × 1080 and 60 fps.

- `amber-dashboard.mp4`: 424 frames, 7.066667 seconds; the edit uses the first 3 seconds.
- `green-shell.mp4`: 380 frames, 6.333333 seconds; the edit uses the first 4.2 seconds.
- `color-crt.mp4`: 288 frames, 4.8 seconds; the edit uses the first 3.6 seconds. The actual `tree` command is followed by `demo`.
- The temporary capture page mounts the project's real React terminal and demo runtime, with the original monitor frame and a larger font. It does not fabricate shell output or dashboard graphics.
- Commands shown: `ls`, `cat samples/telemetry.csv`, and `printf '\nREADY TO BUILD.\n'`.
- The capture page is separate from the shipped app. The camera page does not change product source code. The separately requested Reset and mobile-width app changes do not affect the recorded terminal runtime.
- The amber take was replaced after the first recording advanced the dashboard clock too slowly. The replacement samples the existing dashboard rendering function from elapsed time at its original 8 ticks per second, retaining the processor’s existing 3× waveform pace. The new Color CRT dashboard uses the same elapsed-time capture correction after the real `demo` command executes. The amber on-screen clock was checked at 0, 2, 4, and 6 seconds against the video timeline.

## Music

User-provided file: `Lights Burn Dimmer.mp3`.

- Excerpt: **00:18–00:36**, exactly 18 seconds.
- Two-second entrance fade and two-second exit fade, using quarter-sine curves.
- Prepared at 48 kHz stereo, 24-bit PCM, approximately −19 LUFS integrated.
- Final prepared-bed peak: −10.61 dBTP. Volume is adjusted with constant gain; no dynamic compression is added.
- All three MP4s contain the identical encoded AAC soundtrack at 320 kb/s.
- The audio replacement preserves every decoded video frame from each editor's render. The delivery mux also writes consistent Rec.709 tags and exact 18-second durations.
- Editable projects reference the updated `music-bed.wav`. The complete original song is not included in the project bundle.
- Prepared WAV SHA-256: `c96b80e588b312cd19778238d09ade0ba0d3caa094b01d95a84036d1d284fa95`.

## Graphics and fonts

The ivory monitor frame is the project's existing generated asset. Code cards, titles, transitions, and CTA layouts are native to each named editor. IBM Plex Mono is distributed under the SIL Open Font License. The Resolve version uses the installed Menlo Regular font; Hyperframes and Remotion use the supplied IBM Plex Mono font.

The final MP4s were produced separately in Hyperframes, DaVinci Resolve, and Remotion. They are not differently labeled re-encodes of one editor's output.

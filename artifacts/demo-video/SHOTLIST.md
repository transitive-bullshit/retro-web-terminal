# Retro Terminal promo — shared shot list

18 seconds, 1920 × 1080, 16:9, 60 fps. The three versions share footage, cut points, copy, and music. Each editor creates the graphics and animation natively.

| Time | Frames | Picture | Text |
| --- | --- | --- | --- |
| 0–3 s | 0–179 | Amber dashboard; full monitor, subtle push | A real retro terminal. In your browser |
| 3–7.2 s | 180–431 | Green shell: `ls`, `cat samples/telemetry.csv`, then `printf` | GREEN PHOSPHOR · Real shell, retro vibes |
| 7.2–10.8 s | 432–647 | Color CRT: `tree`, then `demo` and the animated color dashboard | COLOR CRT · WebGL, React, custom themes |
| 10.8–14.4 s | 648–863 | Dark React code card, quick entrance, readable hold | Drop it into React. · React component · MIT licensed |
| 14.4–18 s | 864–1079 | GitHub call to action, held through the last frame | Try the terminal · github.com/transitive-bullshit/retro-web-terminal · Live demo · retro-web-terminal.vercel.app |

The prompt mark followed by **retro / terminal** remains as a breadcrumb at the top in every scene. There is no separate detail shot.

## React excerpt

```text
import { RetroTerminal } from 'retro-web-terminal'
import 'retro-web-terminal/styles.css'

<RetroTerminal
  theme='amber'
  style={{ height: 420 }}
  onReady={(term) => term.write('Hello, world.\r\n')}
/>
```

This is the literal on-screen component excerpt, not a full application file.

## Picture and sound

The original olive, ivory, amber, and green project palette carries into the title cards. Terminal footage stays sharp, without additional blur. All versions use the user-provided Lights Burn Dimmer excerpt from 00:18 to 00:36, at the same volume, with a two-second fade in and two-second fade out. There is no added voiceover.

The browser captures use the actual terminal component and demo runtime from the project runtime (`7c41d59` for Amber/Green; `5f29006` for Color CRT), with the original monitor frame and an enlarged 18 px font for video legibility. This is a temporary camera layout, not a recording of the complete site interface. Shell input is paced through the real demo session's input method; the resulting command output is real.

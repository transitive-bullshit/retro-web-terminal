# Retro Terminal — three native edits

Three 18-second, 1920 × 1080, 60 fps promos, built from the same real terminal footage and shot list. Each editor created its own titles, React excerpt, transitions, and GitHub ending.

Open [the comparison player](compare.html) and switch versions at the same timestamp. The scene buttons jump to the amber dashboard, green shell, Color CRT, React snippet, and CTA.

| Version | Visual character | What this run showed | Native render time |
| --- | --- | --- | --- |
| [Hyperframes](retro-terminal-hyperframes.mp4) | Bold headline and CTA; large code card | HTML/CSS/GSAP made layout iteration direct. Built-in layout and contrast checks were useful. | 54.62 s |
| [DaVinci Resolve](retro-terminal-davinci.mp4) | Spacious, centered type; simpler code treatment | Fast native export, but substantially more automation work to build editable Fusion titles through this Mac's bridge. | 16.72 s |
| [Remotion](retro-terminal-remotion.mp4) | Compact typography and consistent React composition | Straightforward frame timing and reusable components. Native audio timing needed a delivery correction. | 46.63 s |

These are single-run export measurements on the same Apple M3 Pro, with different native quality and concurrency settings. They exclude setup and final soundtrack replacement, so they are not a general renderer benchmark.

My visual pick for this short promo is **Hyperframes**: the larger CTA reads especially well at a smaller viewing size. **Remotion** is the easiest fit for continuing to maintain the edit alongside this React project. Resolve produced a fully editable native project, but its current automation bridge required the most intervention.

## Revised edit and approved soundtrack

The revised edit removes the detail shot, adds a Color CRT scene that runs `tree` and then `demo`, uses the requested captions, and carries the prompt breadcrumb through every scene.

All three use **Lights Burn Dimmer**, excerpt **00:18–00:36**, with a two-second fade in and a two-second fade out. The encoded soundtrack is identical across versions. Every decoded picture is unchanged from its editor's render.

The amber shot was re-recorded after the first capture advanced the dashboard clock too slowly. The replacement retains the existing faster processor waveform and advances six on-screen seconds in six seconds of video. All versions use that corrected take.

## Editable projects

Download [editable-projects.zip](editable-projects.zip). It contains the three native projects, shared source clips, the prepared audio excerpt, font notices, and install/render or relink instructions. The [Resolve DRP](retro-terminal-davinci.drp) is also available separately. Its media can be relinked to the bundle's `shared` folder.

For portable browser playback, run `node serve.mjs` from this folder and open [the local player](http://127.0.0.1:4180/compare.html). The server supports video seeking and binds only to the local computer.

See [the shot list](SHOTLIST.md) and [media provenance](PROVENANCE.md) for timing, sources, and the capture setup. All final files are H.264/AAC MP4 with fast-start metadata; the video streams contain exactly 1,080 frames. Full decoding, key-scene readability, last-frame holds, and audio consistency were checked. No video was posted to X.

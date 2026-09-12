export const home = '/home/visitor'

export const seedFiles = {
  [`${home}/welcome.txt`]: `RETRO TERMINAL
A little phosphor, a little noise, a lot of character.

This is a self-contained browser playground. Everything you see on the
diagnostics dashboard is sample data, not a reading from your computer.

Try:
  ls
  cat welcome.txt
  cd themes && ls
  cat ../samples/telemetry.csv | head -5
  echo "hello, future" > notes.txt
  cat notes.txt
  demo

Files and the working directory last for this visit. Reset or reload starts fresh.
Exported variables and shell functions reset between command submissions.
There is no server, native process, network access or Python runtime here.
`,
  [`${home}/themes/amber.txt`]: `AMBER
Warm monochrome phosphor, soft bloom and the faintest glass distortion.
Inspired by the instruments that made tomorrow feel possible.
Choose Amber in the controls, then try the dashboard with: demo
`,
  [`${home}/themes/green.txt`]: `GREEN PHOSPHOR
A deep green screen with a bright, persistent trace.
Let a moving signal leave a little history behind.
Choose Green Phosphor in the controls, then try: demo
`,
  [`${home}/themes/color.txt`]: `COLOR CRT
Full ANSI color through a fine phosphor mask.
Cyan traces, warm highlights and subtle color separation.
Choose Color CRT in the controls, then try: demo
`,
  [`${home}/docs/commands.txt`]: `EXPLORING
ls, tree, cd, pwd, cat, head, tail, grep, sort, uniq, wc

MAKING THINGS
echo, printf, touch, mkdir, cp, mv, rm
Pipes (|), redirection (> and >>), quotes and shell expressions work.

THIS PLAYGROUND
demo          open the sample diagnostics dashboard
help          list available shell commands
clear         clear the screen
Ctrl+C        interrupt a command or discard the current line
Ctrl+L        clear the screen and redraw the prompt
Up / Down     browse command history
Tab           complete simple file and directory paths

Paste inserts text into the prompt; Enter submits it.
The prompt scrolls horizontally for long commands.
Filesystem edits last until Reset or reload. Exports/functions do not persist.
Output is buffered until a command finishes; this is not a live PTY.
`,
  [`${home}/samples/telemetry.csv`]: `second,cpu_percent,memory_gb,network_kbps
0,32.1,5.8,721
1,38.5,5.9,812
2,41.2,6.0,943
3,49.4,6.1,1102
4,45.0,6.1,982
5,37.8,6.0,831
6,29.7,5.9,744
7,34.6,5.8,792
8,42.3,5.9,914
9,51.8,6.0,1086
`,
  [`${home}/samples/boot.log`]: `[00:00.000] PHOSPHOR/01 diagnostic loop initialized
[00:00.024] Virtual sensors calibrated
[00:00.051] Character display online
[00:00.072] Signal history allocated
[00:00.094] Sample telemetry stream ready
[00:00.128] All systems nominal
`
}

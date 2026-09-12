# Demo runtime

The playground opens in PHOSPHOR / 01, an original ANSI/Unicode diagnostics dashboard. All readings and events are generated sample data. The browser shell uses `just-bash/browser` with a seeded in-memory filesystem; it needs no server.

## Dashboard and shell controls

| View | Input | Action |
| --- | --- | --- |
| Dashboard | `q` or Ctrl+C | Open the shell |
| Dashboard | `p` or Space | Pause/resume sample telemetry |
| Dashboard | `1`, `2`, `3` | Select processor, memory, or uplink history |
| Shell | `demo` | Return to the dashboard |
| Shell | Up / Down | Browse the last 200 submitted commands |
| Shell | Left / Right, Home / End | Move within the command |
| Shell | Ctrl+A / Ctrl+E | Move to the beginning/end |
| Shell | Backspace / Delete | Remove a character |
| Shell | Ctrl+U / Ctrl+K / Ctrl+W | Delete before cursor, after cursor, or previous word |
| Shell | Tab | Complete simple unquoted file/directory paths |
| Shell | Ctrl+C | Discard the current line or interrupt execution |
| Shell | Ctrl+L | Clear the screen and redraw the prompt |
| Shell | Cmd+K | Submit `clear` at an idle prompt, replacing any draft command |

Long commands scroll horizontally while editing and appear in full when submitted. Bracketed paste inserts text, including newlines, without submitting it; Enter executes the complete script. Path completion reads directory entries and does not evaluate shell expressions. Quoted filenames work when executing commands.

The dashboard adjusts its chart height to keep meters, history, events, and keyboard hints visible in short desktop terminals. Narrow terminals use stacked metrics and add history/events when space permits. Its animation pauses while hidden, and leaving the dashboard stops its timer.

## Files and commands

The initial working directory is `/home/visitor`:

```text
/home/visitor/
├── welcome.txt
├── docs/
│   └── commands.txt
├── themes/
│   ├── amber.txt
│   ├── green.txt
│   └── color.txt
└── samples/
    ├── telemetry.csv
    └── boot.log
```

Use familiar commands such as `ls`, `tree`, `cd`, `pwd`, `cat`, `head`, `tail`, `grep`, `sort`, `uniq`, and `wc`. Create and edit files with `echo`, `printf`, `touch`, `mkdir`, `cp`, `mv`, `rm`, and redirection. Pipes, quotes, and shell expressions are handled by just-bash. `help` lists the shell's available commands.

```bash
ls
cat welcome.txt
cd themes && ls
cat ../samples/telemetry.csv | head -5
printf "hello, future\n" > "my notes.txt"
cat "my notes.txt"
pwd
cd -
demo
```

## Session behavior and limits

Filesystem changes, working directory, and prompt history last for this visit. Reload starts fresh. Exported variables and shell functions reset between submissions. Each submitted script executes once; the adapter carries forward its resulting working directory and previous-directory value.

Output is buffered until execution completes, with stdout followed by stderr. This is a command-line REPL, without a live PTY, interactive full-screen editors, native processes, network commands, Python, Node, or SQLite. Compressed `rg -z` searches are also unavailable because the upstream browser bundle references Node zlib for that option. The adapter limits each execution to 2,000 commands, 10,000 loop iterations, and 256 KiB of output, alongside just-bash's other default limits.

Cancellation is cooperative. Completed filesystem changes remain; canceled results cannot write stale output into a later prompt or dashboard. Subsequent executions wait for earlier work to settle before accessing the shared filesystem.

The dashboard uses the terminal's alternate screen. Exiting restores the shell screen, cursor, autowrap, and bracketed-paste mode. Disposal stops timers, removes its visibility listener, aborts shell work, and restores terminal modes. Theme changes do not recreate this session.

The implementation lives in [`apps/demo/src/runtime/`](../apps/demo/src/runtime/). Its entry point, `createDemoSession(port)`, accepts terminal output and size callbacks and exposes input, resize, mode changes/subscriptions, and disposal. The reusable terminal package does not include this demo runtime.

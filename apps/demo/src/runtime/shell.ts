import { BrowserShell } from './engine'
import { home } from './files'
import type { DemoPort } from './types'

const esc = '\x1b['
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
const split = (text: string) =>
  Array.from(segmenter.segment(text), (part) => part.segment)
const visible = (text: string) =>
  text.replaceAll('\n', '↵').replaceAll('\t', ' ')

function cellWidth(text: string) {
  let width = 0
  for (const char of split(text)) {
    const point = char.codePointAt(0) ?? 0
    const wide =
      point >= 0x1100 &&
      (point <= 0x115f ||
        point === 0x2329 ||
        point === 0x232a ||
        (point >= 0x2e80 && point <= 0xa4cf) ||
        (point >= 0xac00 && point <= 0xd7a3) ||
        (point >= 0xf900 && point <= 0xfaff) ||
        (point >= 0xfe10 && point <= 0xfe6f) ||
        (point >= 0xff00 && point <= 0xff60) ||
        (point >= 0xffe0 && point <= 0xffe6) ||
        point >= 0x1f000)
    width += wide ? 2 : 1
  }
  return width
}

function toTerminal(text: string) {
  return text.replace(/\r?\n/g, '\r\n')
}

export function createShell(port: DemoPort, openDashboard: () => void) {
  const engine = new BrowserShell()
  let active = false
  let disposed = false
  let welcomed = false
  let line: string[] = []
  let cursor = 0
  let viewportStart = 0
  let history: string[] = []
  let historyIndex = 0
  let draft = ''
  let escape = ''
  let pasting = false
  let paste = ''
  let controller: AbortController | undefined
  let revision = 0
  let cols = port.getSize().cols

  const write = (text: string) => {
    if (active && !disposed) port.write(text)
  }
  const prompt = () => {
    const cwd = engine.getCwd()
    let path =
      cwd === home
        ? '~'
        : cwd.startsWith(home + '/')
          ? '~' + cwd.slice(home.length)
          : cwd
    const available = Math.max(1, cols - 7)
    if (path.length > available)
      path = '…' + path.slice(-Math.max(1, available - 1))
    return path + ' ❯ '
  }
  const draw = () => {
    if (!active || disposed || controller) return
    const label = prompt()
    const available = Math.max(1, cols - cellWidth(label) - 1)
    viewportStart = Math.min(viewportStart, cursor)
    while (
      viewportStart < cursor &&
      cellWidth(visible(line.slice(viewportStart, cursor).join(''))) >=
        available
    ) {
      viewportStart++
    }
    let end = viewportStart
    while (
      end < line.length &&
      cellWidth(visible(line.slice(viewportStart, end + 1).join(''))) <=
        available
    )
      end++
    const shown = visible(line.slice(viewportStart, end).join(''))
    const column =
      cellWidth(label) +
      cellWidth(visible(line.slice(viewportStart, cursor).join(''))) +
      1
    write(
      '\r' +
        esc +
        '2K' +
        esc +
        '38;5;81m' +
        label +
        esc +
        '0m' +
        shown +
        esc +
        column +
        'G'
    )
  }
  const resetLine = () => {
    line = []
    cursor = 0
    viewportStart = 0
    historyIndex = history.length
    draft = ''
    revision++
  }
  const insert = (text: string) => {
    // eslint-disable-next-line no-control-regex -- Pasted terminal controls must remain inert.
    const cleaned = text.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    const before = line.slice(0, cursor).join('') + cleaned
    line = split(before + line.slice(cursor).join(''))
    cursor = split(before).length
    revision++
    draw()
  }
  const interrupt = () => {
    controller?.abort()
    controller = undefined
    resetLine()
    write('^C\r\n')
    draw()
  }
  const submit = (command = line.join('')) => {
    // The submitted command remains in the terminal scrollback, including its untruncated text.
    write(
      '\r' +
        esc +
        '2K' +
        esc +
        '38;5;81m' +
        prompt() +
        esc +
        '0m' +
        toTerminal(command) +
        '\r\n'
    )
    if (command.trim() && command !== history.at(-1)) {
      history.push(command)
      if (history.length > 200) history = history.slice(-200)
    }
    resetLine()
    if (!command.trim()) return draw()
    if (command.trim() === 'demo') return openDashboard()
    const current = new AbortController()
    controller = current
    void engine
      .run(command, current.signal)
      .then((result) => {
        if (
          controller !== current ||
          current.signal.aborted ||
          !active ||
          disposed
        )
          return
        const output = result.stdout + result.stderr
        if (output)
          write(toTerminal(output) + (output.endsWith('\n') ? '' : '\r\n'))
      })
      .catch((err: unknown) => {
        if (
          controller !== current ||
          current.signal.aborted ||
          !active ||
          disposed
        )
          return
        write(
          'Shell: ' +
            (err instanceof Error ? err.message : String(err)) +
            '\r\n'
        )
      })
      .finally(() => {
        if (controller !== current || !active || disposed) return
        controller = undefined
        write(esc + '0m' + esc + '?25h' + esc + '?7h' + esc + '?2004h')
        draw()
      })
  }
  const browseHistory = (direction: number) => {
    if (historyIndex === history.length) draft = line.join('')
    historyIndex = Math.max(
      0,
      Math.min(history.length, historyIndex + direction)
    )
    line = split(
      historyIndex === history.length ? draft : (history[historyIndex] ?? '')
    )
    cursor = line.length
    viewportStart = 0
    revision++
    draw()
  }
  const complete = async () => {
    const before = line.slice(0, cursor).join('')
    // Basic path completion intentionally avoids evaluating shell expressions.
    const match = /(?:^|\s)([^\s"'\\|;&<>]*)$/.exec(before)
    if (!match) return
    const token = match[1] ?? ''
    if (token === '~') return insert('/')
    const snapshot = ++revision
    const candidates = await engine.complete(token)
    if (
      snapshot !== revision ||
      !active ||
      disposed ||
      controller ||
      !candidates.length
    )
      return
    const basename = token.slice(token.lastIndexOf('/') + 1)
    let common = candidates[0] ?? ''
    for (const candidate of candidates.slice(1)) {
      while (!candidate.startsWith(common)) common = common.slice(0, -1)
    }
    if (common.length > basename.length) {
      const suffix = common
        .slice(basename.length)
        .replace(/([^a-zA-Z0-9_./-])/g, '\\$1')
      insert(
        suffix + (candidates.length === 1 && !common.endsWith('/') ? ' ' : '')
      )
    } else if (candidates.length > 1) {
      write('\r\n' + candidates.join('  ') + '\r\n')
      draw()
    }
  }
  const control = (key: string) => {
    if (key === '\x03') return interrupt()
    if (controller) return
    if (key === '\r' || key === '\n') return submit()
    if (key === '\t') {
      void complete().catch(() => {})
      return
    }
    if (key === '\x1b[A') return browseHistory(-1)
    if (key === '\x1b[B') return browseHistory(1)
    if (key === '\x1b[C' || key === '\x06')
      cursor = Math.min(line.length, cursor + 1)
    else if (key === '\x1b[D' || key === '\x02')
      cursor = Math.max(0, cursor - 1)
    else if (
      key === '\x01' ||
      key === '\x1b[H' ||
      key === '\x1bOH' ||
      key === '\x1b[1~' ||
      key === '\x1b[7~'
    )
      cursor = 0
    else if (
      key === '\x05' ||
      key === '\x1b[F' ||
      key === '\x1bOF' ||
      key === '\x1b[4~' ||
      key === '\x1b[8~'
    )
      cursor = line.length
    else if (key === '\x7f' || key === '\b') {
      if (cursor > 0) line.splice(--cursor, 1)
    } else if (key === '\x1b[3~' || key === '\x04') line.splice(cursor, 1)
    else if (key === '\x15') {
      line.splice(0, cursor)
      cursor = 0
    } else if (key === '\x0b') line.splice(cursor)
    else if (key === '\x17') {
      const previous = line
        .slice(0, cursor)
        .join('')
        .replace(/\s*\S+\s*$/, '')
      const start = split(previous).length
      line.splice(start, cursor - start)
      cursor = start
    } else if (key === '\x0c') write(esc + '2J' + esc + 'H')
    else return
    revision++
    draw()
  }

  return {
    clear() {
      if (!active || disposed || controller) return
      submit('clear')
    },
    enter() {
      if (disposed) return
      active = true
      cols = port.getSize().cols
      write(esc + '?25h' + esc + '?7h' + esc + '?2004h')
      if (!welcomed) {
        welcomed = true
        write(
          esc + '38;5;81m' + 'RETRO TERMINAL / BROWSER SHELL' + esc + '0m\r\n'
        )
        write('A small Unix playground. Try ls, cat welcome.txt, or demo.\r\n')
        write(
          'Files last for this visit · buffered output · Ctrl+C interrupts\r\n\r\n'
        )
      }
      draw()
    },
    leave() {
      active = false
      controller?.abort()
      controller = undefined
      escape = ''
      pasting = false
      paste = ''
      revision++
    },
    input(data: string) {
      if (!active || disposed) return
      for (const char of data) {
        if (pasting) {
          paste += char
          if (paste.endsWith(esc + '201~')) {
            const text = paste
              .slice(0, -(esc + '201~').length)
              .replace(/\r\n?/g, '\n')
            pasting = false
            paste = ''
            if (!controller) insert(text)
          }
          continue
        }
        if (char === '\x03') {
          escape = ''
          interrupt()
          continue
        }
        if (escape) {
          escape += char
          if (escape === esc + '200~') {
            escape = ''
            pasting = true
          } else if (escape.length > 2 && /[A-Za-z~]$/.test(escape)) {
            control(escape)
            escape = ''
          } else if (
            escape.length > 20 ||
            (escape.length === 2 && char !== '[' && char !== 'O')
          ) {
            escape = ''
          }
          continue
        }
        if (char === '\x1b') escape = char
        else if (char.charCodeAt(0) < 32 || char === '\x7f') control(char)
        else if (!controller) insert(char)
      }
    },
    resize(nextCols: number) {
      cols = nextCols
      draw()
    },
    dispose() {
      active = false
      disposed = true
      controller?.abort()
      controller = undefined
      revision++
    }
  }
}

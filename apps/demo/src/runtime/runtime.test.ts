import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDashboard, dashboardLines } from './dashboard'
import { BrowserShell } from './engine'
import { home } from './files'
import { createDemoSession } from './index'
import type { DemoPort, DemoSession } from './types'

// eslint-disable-next-line no-control-regex -- Strip ANSI sequences for text assertions.
const ansi = /\x1b\[[0-?]*[ -/]*[@-~]/g
const plain = (text: string) => text.replace(ansi, '')
const run = (shell: BrowserShell, command: string) =>
  shell.run(command, new AbortController().signal)

function harness() {
  const chunks: string[] = []
  const size = { cols: 92, rows: 30 }
  const port: DemoPort = {
    write: (data) => {
      chunks.push(data)
    },
    getSize: () => size
  }
  return {
    port,
    size,
    chunks,
    output: () => plain(chunks.join('')),
    clear: () => {
      chunks.length = 0
    }
  }
}

const sessions: DemoSession[] = []
afterEach(() => {
  for (const session of sessions) session.dispose()
  sessions.length = 0
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('browser shell', () => {
  it('carries the final working directory and executes file changes once', async () => {
    const shell = new BrowserShell()
    expect(
      (await run(shell, 'cd themes; echo once >> count.txt')).exitCode
    ).toBe(0)
    expect(shell.getCwd()).toBe(home + '/themes')
    expect((await run(shell, 'pwd; cat count.txt')).stdout).toBe(
      home + '/themes\nonce\n'
    )
    await run(shell, 'cd ../samples')
    expect((await run(shell, 'cd -; pwd')).stdout).toBe(
      home + '/themes\n' + home + '/themes\n'
    )
  })

  it('supports quoted files, pipes, redirection and visit-scoped state', async () => {
    const shell = new BrowserShell()
    await run(shell, 'printf "beta\\nalpha\\nbeta\\n" > "my notes.txt"')
    const result = await run(shell, 'cat "my notes.txt" | sort | uniq')
    expect(result.stdout).toBe('alpha\nbeta\n')
    await run(shell, 'export RETRO_VALUE=old; hello() { echo hello; }')
    expect(
      (await run(shell, 'printf "%s" "$RETRO_VALUE"; hello')).exitCode
    ).toBe(127)
    expect((await run(shell, 'cat welcome.txt')).stdout).toContain(
      'sample data'
    )
    const fresh = new BrowserShell()
    expect((await run(fresh, 'cat "my notes.txt"')).exitCode).not.toBe(0)
  })

  it('completes paths through the filesystem without executing expressions', async () => {
    const shell = new BrowserShell()
    expect(await shell.complete('th')).toEqual(['themes/'])
    await run(shell, 'cd themes')
    expect(await shell.complete('../samples/te')).toEqual(['telemetry.csv'])
    expect(await shell.complete('$(touch injected)')).toEqual([])
    expect((await run(shell, 'test -e injected')).exitCode).not.toBe(0)
  })

  it('interrupts cooperatively and serializes following filesystem work', async () => {
    const shell = new BrowserShell()
    await run(shell, 'echo ready')
    const controller = new AbortController()
    const interrupted = shell
      .run('sleep 0.08; echo late > late.txt', controller.signal)
      .catch((err: unknown) => err)
    setTimeout(() => controller.abort(), 10)
    const next = run(shell, 'test -e late.txt && cat late.txt; echo resumed')
    expect(await interrupted).toBeInstanceOf(Error)
    expect((await next).stdout).toBe('resumed\n')
  })
})

describe('demo session', () => {
  it('restores the shell screen and modes, then stops dashboard timers on exit and disposal', () => {
    vi.useFakeTimers()
    const terminal = harness()
    const session = createDemoSession(terminal.port)
    sessions.push(session)
    const changes = vi.fn<(mode: string) => void>()
    session.subscribe(changes)
    expect(session.getMode()).toBe('dashboard')
    expect(terminal.chunks.join('')).toContain('\x1b[?1049h')
    expect(terminal.output()).toContain('SAMPLE DATA')
    vi.advanceTimersByTime(250)
    session.input('q')
    expect(session.getMode()).toBe('shell')
    expect(terminal.chunks.join('')).toContain('\x1b[?1049l')
    expect(terminal.chunks.join('')).toContain('\x1b[?2004h')
    terminal.clear()
    vi.advanceTimersByTime(1000)
    expect(terminal.chunks).toEqual([])
    session.input('demo\r')
    expect(session.getMode()).toBe('dashboard')
    expect(changes.mock.calls.map(([mode]) => mode)).toEqual([
      'shell',
      'dashboard'
    ])
    session.dispose()
    terminal.clear()
    vi.advanceTimersByTime(1000)
    session.input('q')
    session.resize(30, 10)
    expect(terminal.chunks).toEqual([])
  })

  it('allows editing, history, completion and resize without losing a command', async () => {
    const terminal = harness()
    const session = createDemoSession(terminal.port)
    sessions.push(session)
    session.showShell()
    terminal.clear()
    session.input('echo ac\x1b[Db\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('abc\r\n'))
    terminal.clear()
    session.input('\x1b[A')
    session.resize(24, 10)
    session.input('\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('abc\r\n'))
    terminal.clear()
    session.input('cat wel\t')
    await vi.waitFor(() => expect(terminal.output()).toContain('welcome.txt'))
    session.input('\r')
    await vi.waitFor(() =>
      expect(terminal.output()).toContain('A little phosphor')
    )
  })

  it('inserts bracketed multiline paste and only executes it on Enter', async () => {
    const terminal = harness()
    const session = createDemoSession(terminal.port)
    sessions.push(session)
    session.showShell()
    terminal.clear()
    session.input('\x1b[20')
    session.input(
      '0~echo first > pasted.txt\necho second >> pasted.txt\x1b[201~'
    )
    expect(terminal.output()).toContain('↵')
    expect(terminal.output()).not.toContain('first\r\n')
    session.input('\r')
    await vi.waitFor(() =>
      expect(terminal.chunks).toContain('\x1b[0m\x1b[?25h\x1b[?7h\x1b[?2004h')
    )
    terminal.clear()
    session.input('cat pasted.txt\r')
    await vi.waitFor(() =>
      expect(terminal.output()).toContain('first\r\nsecond\r\n')
    )
  })

  it('cancels a command with Ctrl+C and keeps the next prompt usable', async () => {
    const terminal = harness()
    const session = createDemoSession(terminal.port)
    sessions.push(session)
    session.showShell()
    session.input('echo ready\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('ready\r\n'))
    session.input('sleep 0.08; echo canceled\r')
    session.input('\x03')
    expect(terminal.chunks).toContain('^C\r\n')
    terminal.clear()
    session.input('echo cafe\u0301\x7ff\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('caff\r\n'))
    expect(terminal.chunks).not.toContain('canceled\r\n')
  })

  it('suppresses canceled output across shell and dashboard transitions', async () => {
    const terminal = harness()
    const session = createDemoSession(terminal.port)
    sessions.push(session)
    session.showShell()
    session.input('echo ready\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('ready\r\n'))
    session.input('sleep 0.08; echo stale-output\r')
    session.showDashboard()
    terminal.clear()
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(terminal.output()).not.toContain('stale-output')
    session.showShell()
    terminal.clear()
    session.input('echo restored\r')
    await vi.waitFor(() => expect(terminal.chunks).toContain('restored\r\n'))
  })
})

describe('sample dashboard', () => {
  it('fits common and narrow terminal sizes and includes a rolling event log', () => {
    for (const [cols, rows] of [
      [92, 30],
      [80, 24],
      [112, 22],
      [80, 20],
      [80, 17],
      [30, 22],
      [45, 20],
      [30, 12],
      [2, 2]
    ]) {
      const lines = dashboardLines(cols!, rows!, 180, 0, false).map(plain)
      expect(lines).toHaveLength(rows!)
      expect(lines.every((line) => Array.from(line).length <= cols! - 1)).toBe(
        true
      )
    }
    const normal = dashboardLines(80, 24, 180, 0, false).map(plain).join('\n')
    expect(normal).toContain('EVENT LOG')
    expect(normal).toContain('00:')
    expect(normal).toContain('›')
  })

  it('retains meters, history, signal status and events in short desktop terminals', () => {
    for (const rows of [17, 20, 21, 22, 23, 24, 30]) {
      const lines = dashboardLines(80, rows, 180, 0, false).map(plain)
      const text = lines.join('\n')
      for (const label of [
        'PROCESSOR',
        'MEMORY',
        'UPLINK',
        'PROCESSOR HISTORY',
        'SIGNAL INTEGRITY',
        'FRAME SYNC',
        'EVENT LOG',
        'NOW',
        '›'
      ]) {
        expect(text).toContain(label)
      }
      expect(lines.at(-1)).toContain('SHELL')
      expect(lines.find((line) => line.includes('EVENT LOG'))).not.toContain(
        'NOW'
      )
      expect(
        lines.filter((line) => line.includes('│')).length
      ).toBeGreaterThanOrEqual(2)
    }
  })

  it('fills a narrow terminal with all metrics and uses extra height for history and events', () => {
    const text = dashboardLines(32, 22, 180, 0, false).map(plain).join('\n')
    for (const label of [
      'PROCESSOR',
      'MEMORY',
      'UPLINK',
      'PROCESSOR HISTORY',
      'EVENT LOG',
      '›'
    ]) {
      expect(text).toContain(label)
    }
  })

  it('pauses and resumes its timers when the document is hidden', () => {
    vi.useFakeTimers()
    const document = Object.assign(new EventTarget(), { hidden: false })
    vi.stubGlobal('document', document)
    const terminal = harness()
    const dashboard = createDashboard(terminal.port)
    dashboard.enter()
    terminal.clear()
    document.hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(1000)
    expect(terminal.chunks).toEqual([])
    document.hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(125)
    expect(terminal.chunks.length).toBeGreaterThan(0)
    dashboard.input('p')
    terminal.clear()
    vi.advanceTimersByTime(1000)
    expect(terminal.chunks).toEqual([])
    dashboard.input('2')
    expect(terminal.output()).toContain('02 / MEMORY HISTORY')
    dashboard.dispose()
  })
})

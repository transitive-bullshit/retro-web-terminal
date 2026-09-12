import { createDashboard } from './dashboard'
import { createShell } from './shell'
import type { DemoMode, DemoPort, DemoSession } from './types'

export type { DemoMode, DemoPort, DemoSession } from './types'

export function createDemoSession(port: DemoPort): DemoSession {
  let mode: DemoMode = 'dashboard'
  let disposed = false
  const listeners = new Set<(mode: DemoMode) => void>()
  const dashboard = createDashboard(port)
  const shell = createShell(port, () => session.showDashboard())
  const notify = () => {
    for (const listener of listeners) listener(mode)
  }
  const session: DemoSession = {
    clear() {
      if (!disposed && mode === 'shell') shell.clear()
    },
    input(data) {
      if (disposed) return
      if (mode === 'shell') shell.input(data)
      else if (data === '\x1b') session.showShell()
      else {
        for (const key of data) {
          if (key === 'q' || key === '\x03') {
            session.showShell()
            break
          }
          dashboard.input(key)
        }
      }
    },
    resize(cols, rows) {
      if (disposed) return
      dashboard.resize(cols, rows)
      shell.resize(cols)
    },
    showDashboard() {
      if (disposed || mode === 'dashboard') return
      shell.leave()
      mode = 'dashboard'
      port.write('\x1b[?2004l\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J\x1b[H')
      dashboard.enter()
      notify()
    },
    showShell() {
      if (disposed || mode === 'shell') return
      dashboard.leave()
      port.write('\x1b[0m\x1b[?1049l\x1b[?25h\x1b[?7h')
      mode = 'shell'
      shell.enter()
      notify()
    },
    getMode: () => mode,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    dispose() {
      if (disposed) return
      disposed = true
      dashboard.dispose()
      shell.dispose()
      listeners.clear()
      port.write(
        (mode === 'dashboard' ? '\x1b[?1049l' : '') +
          '\x1b[0m\x1b[?25h\x1b[?7h\x1b[?2004l'
      )
    }
  }
  port.write('\x1b[?2004l\x1b[?1049h\x1b[?25l\x1b[?7l\x1b[2J\x1b[H')
  dashboard.enter()
  return session
}

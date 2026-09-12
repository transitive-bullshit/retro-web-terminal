export type DemoMode = 'dashboard' | 'shell'

export interface DemoPort {
  write: (data: string) => void
  getSize: () => { cols: number; rows: number }
}

export interface DemoSession {
  clear: () => void
  input: (data: string) => void
  resize: (cols: number, rows: number) => void
  dispose: () => void
  showDashboard: () => void
  showShell: () => void
  getMode: () => DemoMode
  subscribe: (listener: (mode: DemoMode) => void) => () => void
}

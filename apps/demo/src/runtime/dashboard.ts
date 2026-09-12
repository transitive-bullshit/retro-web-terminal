import type { DemoPort } from './types'

const esc = '\x1b['
const colors = {
  ink: 252,
  muted: 242,
  line: 238,
  cyan: 81,
  green: 114,
  amber: 221,
  red: 209
}
const metrics = [
  { name: 'PROCESSOR', unit: '%', color: colors.cyan, scale: 100 },
  { name: 'MEMORY', unit: 'GB', color: colors.green, scale: 16 },
  { name: 'UPLINK', unit: 'KB/s', color: colors.amber, scale: 1600 }
] as const
const messages = [
  'Trace buffer synchronized',
  'Checksum verified · frame intact',
  'Sample packet received',
  'Phosphor excitation nominal',
  'Diagnostic sweep complete',
  'Local loopback acknowledged'
]
const blocks = ' ▁▂▃▄▅▆▇█'

interface Cell {
  char: string
  color: number
}

class Screen {
  cells: Cell[][]

  constructor(
    readonly width: number,
    readonly height: number
  ) {
    this.cells = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ char: ' ', color: colors.ink }))
    )
  }

  text(
    x: number,
    y: number,
    text: string,
    color: number = colors.ink,
    max = this.width - x
  ) {
    if (y < 0 || y >= this.height) return
    for (const [index, char] of Array.from(text)
      .slice(0, Math.max(0, max))
      .entries()) {
      const cell = this.cells[y]?.[x + index]
      if (cell) {
        cell.char = char
        cell.color = color
      }
    }
  }

  rule(y: number, x = 1, width = this.width - 2) {
    this.text(x, y, '─'.repeat(Math.max(0, width)), colors.line)
  }

  lines() {
    return this.cells.map((row) => {
      let output = ''
      let color = -1
      for (const cell of row) {
        if (cell.color !== color) {
          output += `${esc}38;5;${cell.color}m`
          color = cell.color
        }
        output += cell.char
      }
      return output + `${esc}0m${esc}K`
    })
  }
}

function sample(metric: number, tick: number) {
  const t = tick / 5
  if (metric === 1)
    return 0.39 + Math.sin(t * 0.19) * 0.045 + Math.sin(t * 0.83) * 0.014
  if (metric === 2) {
    return Math.min(
      0.95,
      0.43 + Math.sin(t * 0.43) * 0.18 + Math.sin(t * 1.43) * 0.11
    )
  }
  return 0.44 + Math.sin(t * 0.67) * 0.15 + Math.sin(t * 1.7) * 0.065
}

function sparkline(metric: number, tick: number, width: number) {
  return Array.from({ length: Math.max(0, width) }, (_, x) => {
    const value = sample(metric, tick - (width - 1 - x) * 2)
    return blocks[Math.max(1, Math.min(8, Math.round(value * 8)))]
  }).join('')
}

function meter(value: number, width: number) {
  const filled = Math.round(value * width)
  return '━'.repeat(filled) + '─'.repeat(Math.max(0, width - filled))
}

function elapsed(tick: number) {
  const seconds = Math.floor(tick / 8)
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`
}

function drawHistory(
  screen: Screen,
  metric: number,
  tick: number,
  left: number,
  top: number,
  width: number,
  height: number,
  color: number
) {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = sample(metric, tick - (width - x - 1) * 2)
      const coverage = value * height - (height - y - 1)
      const level = Math.max(0, Math.min(8, Math.round(coverage * 8)))
      const grid = x % 8 === 0 ? '┊' : y % 3 === 0 ? '·' : ' '
      screen.text(
        left + x,
        top + y,
        level > 0 ? (blocks[level] ?? ' ') : grid,
        level > 0 ? color : colors.line
      )
    }
  }
}

function drawLog(screen: Screen, top: number, count: number, tick: number) {
  screen.rule(top)
  screen.text(2, top, ' EVENT LOG ', colors.muted)
  const event = Math.floor(tick / 24)
  for (let i = 0; i < count; i++) {
    const entry = Math.max(0, event - count + 1 + i)
    screen.text(
      1,
      top + 1 + i,
      `${elapsed(entry * 24)}  ${i === count - 1 ? '›' : '·'} ${messages[entry % messages.length]}`,
      i === count - 1 ? colors.ink : colors.muted
    )
  }
}

export function dashboardLines(
  cols: number,
  rows: number,
  tick: number,
  metric: number,
  paused: boolean
) {
  const width = Math.max(1, Math.floor(cols) - 1)
  const height = Math.max(1, Math.floor(rows))
  const screen = new Screen(width, height)
  const active = metrics[metric] ?? metrics[0]
  const inner = Math.max(0, width - 2)
  const footer = height - 2
  const live = paused ? 'SAMPLE DATA · PAUSED' : 'SAMPLE DATA · LIVE'

  if (width < 42 || height < 17) {
    screen.text(1, 0, 'PHOSPHOR / 01', colors.cyan)
    screen.text(1, 1, live, paused ? colors.amber : colors.green)
    screen.rule(2)
    const cardHeight = height >= 14 ? 3 : height >= 11 ? 2 : 1
    const count = Math.min(3, Math.floor(Math.max(0, footer - 3) / cardHeight))
    for (let index = 0; index < count; index++) {
      const item = metrics[index]!
      const value = sample(index, tick)
      const amount = (value * item.scale).toFixed(index === 2 ? 0 : 1)
      const y = 3 + index * cardHeight
      screen.text(
        1,
        y,
        `${index === metric ? '●' : '○'} ${item.name}  ${amount} ${item.unit}`,
        item.color
      )
      if (cardHeight > 1)
        screen.text(1, y + 1, sparkline(index, tick, inner), item.color)
      if (cardHeight > 2)
        screen.text(1, y + 2, meter(value, inner), colors.muted)
    }
    let nextRow = 3 + count * cardHeight
    const spare = footer - nextRow
    if (spare >= 5) {
      const plotHeight = spare - 5
      screen.text(
        1,
        nextRow,
        `0${metric + 1} / ${active.name} HISTORY`,
        active.color
      )
      drawHistory(
        screen,
        metric,
        tick,
        1,
        nextRow + 1,
        inner,
        plotHeight,
        active.color
      )
      nextRow += plotHeight + 1
    }
    const logCount = Math.min(3, footer - nextRow - 1)
    if (logCount > 0) drawLog(screen, nextRow, logCount, tick)
    else if (footer > nextRow)
      screen.text(
        1,
        nextRow,
        `T+ ${elapsed(tick)}  LOCAL LOOPBACK`,
        colors.muted
      )
    screen.rule(footer)
    screen.text(1, height - 1, 'q shell · p pause · 1/2/3 metric', colors.muted)
    return screen.lines()
  }

  screen.text(1, 0, 'PHOSPHOR / 01', colors.cyan)
  screen.text(
    width - live.length - 1,
    0,
    live,
    paused ? colors.amber : colors.green
  )
  screen.rule(1)
  screen.text(1, 2, 'LOCAL DIAGNOSTICS', colors.muted)
  const clock = `T+ ${elapsed(tick)}`
  screen.text(width - clock.length - 1, 2, clock, colors.muted)

  const compact = height < 26
  const cardTop = compact ? 3 : 4
  const cardWidth = Math.floor(inner / 3)
  for (const [index, item] of metrics.entries()) {
    const x = 1 + index * cardWidth
    const value = sample(index, tick)
    const amount = value * item.scale
    screen.text(
      x,
      cardTop,
      `${index === metric ? '●' : '○'} ${item.name}`,
      item.color,
      cardWidth - 2
    )
    screen.text(
      x,
      cardTop + 1,
      `${amount.toFixed(index === 2 ? 0 : 1)} ${item.unit}`,
      colors.ink,
      cardWidth - 2
    )
    screen.text(
      x,
      cardTop + 2,
      sparkline(index, tick, cardWidth - 3),
      item.color
    )
    screen.text(x, cardTop + 3, meter(value, cardWidth - 3), colors.muted)
  }
  screen.rule(cardTop + 4)
  const historyTop = cardTop + 5
  screen.text(
    1,
    historyTop,
    `0${metric + 1} / ${active.name} HISTORY`,
    active.color
  )

  const hasSidebar = width >= 76
  const plotWidth = hasSidebar ? Math.floor(inner * 0.67) : inner
  const logCount = height < 20 ? 1 : height < 23 ? 2 : 3
  const logTop = footer - logCount - 1
  const plotTop = historyTop + (compact ? 1 : 2)
  const plotHeight = logTop - plotTop - 2
  const plotLeft = 5
  const graphWidth = Math.max(1, plotWidth - 6)

  for (let y = 0; y < plotHeight; y++) {
    const label = y === 0 ? '100' : y === plotHeight - 1 ? '  0' : '   '
    screen.text(1, plotTop + y, label, colors.muted)
    screen.text(4, plotTop + y, '│', colors.line)
  }
  drawHistory(
    screen,
    metric,
    tick,
    plotLeft,
    plotTop,
    graphWidth,
    plotHeight,
    active.color
  )
  const axisY = plotTop + plotHeight
  screen.text(4, axisY, '└' + '─'.repeat(graphWidth), colors.line)
  screen.text(5, axisY + 1, '−30s', colors.muted)
  screen.text(plotLeft + graphWidth - 3, axisY + 1, 'NOW', colors.muted)

  if (hasSidebar) {
    const x = plotWidth + 2
    const sidebar = width - x - 1
    const available = logTop - plotTop
    const statusTop = plotTop + (available >= 5 ? 2 : 1)
    screen.text(x, historyTop, 'SIGNAL INTEGRITY', colors.muted, sidebar)
    screen.text(x, plotTop, '99.98%   NOMINAL', colors.green, sidebar)
    screen.text(x, statusTop, 'FRAME SYNC    LOCKED', colors.muted, sidebar)
    screen.text(x, statusTop + 1, 'PACKET LOSS   0.02%', colors.muted, sidebar)
    if (available >= 6) {
      screen.text(x, logTop - 2, 'LOCAL LOOPBACK', colors.amber, sidebar)
      screen.text(
        x,
        logTop - 1,
        sparkline(2, tick, sidebar),
        colors.amber,
        sidebar
      )
    }
  }

  drawLog(screen, logTop, logCount, tick)
  screen.rule(footer)
  screen.text(
    1,
    height - 1,
    width < 65
      ? 'q shell   p pause   1/2/3 metric'
      : 'q  SHELL    p / SPACE  PAUSE    1 / 2 / 3  METRIC',
    colors.muted
  )
  return screen.lines()
}

export function createDashboard(port: DemoPort) {
  let active = false
  let paused = false
  let tick = 0
  let metric = 0
  let previous: string[] = []
  let timer: ReturnType<typeof setInterval> | undefined
  let size = port.getSize()

  const draw = () => {
    if (!active || (typeof document !== 'undefined' && document.hidden)) return
    const lines = dashboardLines(size.cols, size.rows, tick, metric, paused)
    let output = ''
    for (const [index, line] of lines.entries()) {
      if (line !== previous[index]) output += `${esc}${index + 1};1H${line}`
    }
    previous = lines
    if (output) port.write(output)
  }
  const stopTimer = () => {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }
  const schedule = () => {
    stopTimer()
    if (
      !active ||
      paused ||
      (typeof document !== 'undefined' && document.hidden)
    )
      return
    timer = setInterval(() => {
      tick++
      draw()
    }, 125)
  }
  const visibility = () => {
    schedule()
    draw()
  }
  if (typeof document !== 'undefined')
    document.addEventListener('visibilitychange', visibility)

  return {
    enter() {
      active = true
      previous = []
      size = port.getSize()
      draw()
      schedule()
    },
    leave() {
      active = false
      stopTimer()
      previous = []
    },
    input(data: string) {
      if (data === 'p' || data === ' ') {
        paused = !paused
        schedule()
      } else if (/^[123]$/.test(data)) {
        metric = Number(data) - 1
      }
      draw()
    },
    resize(cols: number, rows: number) {
      size = { cols, rows }
      previous = []
      draw()
    },
    dispose() {
      active = false
      stopTimer()
      if (typeof document !== 'undefined')
        document.removeEventListener('visibilitychange', visibility)
    }
  }
}

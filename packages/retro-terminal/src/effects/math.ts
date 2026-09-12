/** Destination-to-source sampling map. Keep aligned with the final fragment pass. */
export function curvePoint(x: number, y: number, amount: number) {
  const px = x * 2 - 1
  const py = y * 2 - 1
  return {
    x: (px * (1 + amount * py * py) + 1) * 0.5,
    y: (py * (1 + amount * px * px) + 1) * 0.5
  }
}

/** Exponential phosphor decay, independent of the display's frame rate. */
export function decayFactor(
  elapsedSeconds: number,
  decaySeconds: number
): number {
  return Math.exp(-Math.max(0, elapsedSeconds) / Math.max(0.001, decaySeconds))
}

export function colorVector(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255
  ]
}

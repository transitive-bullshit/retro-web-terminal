import { createServer } from 'node:http'
import { open, realpath } from 'node:fs/promises'
import { dirname, extname, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const root = await realpath(dirname(fileURLToPath(import.meta.url)))
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.md': 'text/plain; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.zip': 'application/zip'
}
const insideRoot = (path) => path === root || path.startsWith(root + sep)
const commonHeaders = {
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
}

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || (!match[1] && !match[2]) || size === 0) return null
  const first = match[1] === '' ? null : Number(match[1])
  const last = match[2] === '' ? null : Number(match[2])
  if (
    (first !== null && !Number.isSafeInteger(first)) ||
    (last !== null && !Number.isSafeInteger(last))
  )
    return null
  if (first === null) {
    if (last <= 0) return null
    return { start: Math.max(0, size - last), end: size - 1 }
  }
  if (first >= size || (last !== null && last < first)) return null
  return { start: first, end: Math.min(last ?? size - 1, size - 1) }
}

const server = createServer(async (request, response) => {
  let file
  const finish = (status, extra = {}) => {
    response.writeHead(status, {
      ...commonHeaders,
      'Content-Length': '0',
      ...extra
    })
    response.end()
  }
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      finish(405, { Allow: 'GET, HEAD' })
      return
    }
    let pathname
    try {
      pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
    } catch {
      finish(400)
      return
    }
    if (
      !pathname.startsWith('/') ||
      pathname.includes('\0') ||
      pathname.includes('\\')
    ) {
      finish(400)
      return
    }
    const candidate = resolve(
      root,
      pathname === '/' ? 'compare.html' : '.' + pathname
    )
    if (!insideRoot(candidate)) {
      finish(403)
      return
    }
    const path = await realpath(candidate)
    if (!insideRoot(path)) {
      finish(403)
      return
    }
    // Opening before stat keeps an in-flight response consistent across atomic file replacement.
    file = await open(path, 'r')
    const stat = await file.stat()
    if (!stat.isFile()) {
      finish(404)
      return
    }
    const range = request.headers.range
      ? parseRange(request.headers.range, stat.size)
      : undefined
    if (range === null) {
      finish(416, { 'Content-Range': `bytes */${stat.size}` })
      return
    }
    const start = range?.start ?? 0
    const end = range?.end ?? stat.size - 1
    const headers = {
      ...commonHeaders,
      'Content-Type':
        mime[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(Math.max(0, end - start + 1))
    }
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`
    response.writeHead(range ? 206 : 200, headers)
    if (request.method === 'HEAD' || stat.size === 0) {
      response.end()
      return
    }
    await pipeline(file.createReadStream({ start, end }), response)
  } catch (err) {
    if (response.headersSent) response.destroy()
    else
      finish(
        err.code === 'ENOENT' || err.code === 'ENOTDIR'
          ? 404
          : err.code === 'EACCES'
            ? 403
            : 500
      )
  } finally {
    await file?.close().catch(() => {})
  }
})

server.listen(4180, '127.0.0.1', () => {
  console.log('Comparison player: http://127.0.0.1:4180/compare.html')
})

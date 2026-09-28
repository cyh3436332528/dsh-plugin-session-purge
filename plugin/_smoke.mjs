// Smoke test for the host half. Read-only: exercises /list only.
import { apply, inject } from './lib/index.js'

let route
const ctx = {
  effect: (fn) => fn(),
  webServer: {
    register: (r) => {
      route = r
      return () => {}
    },
  },
}

apply(ctx)

console.log('inject   =', JSON.stringify(inject))
console.log('route    =', route && route.kind, route && route.path)

function fakeRes() {
  const out = { status: 0, headers: null, body: '' }
  return {
    out,
    writeHead(status, headers) {
      out.status = status
      out.headers = headers
    },
    end(text) {
      out.body = text || ''
    },
  }
}

const req = { method: 'GET', url: '/x-session-purge/list' }
const res = fakeRes()
await route.handler(req, res)

console.log('status   =', res.out.status)
const data = JSON.parse(res.out.body)
console.log('ok       =', data.ok)
console.log('sessions =', (data.sessions || []).length)
for (const s of data.sessions || []) {
  console.log(
    '   ',
    s.id,
    '|',
    (s.title || '(no title)').slice(0, 28),
    '|',
    (s.bytes / 1024).toFixed(1) + ' KB',
    '|',
    s.known ? 'conversation' : 'child',
    s.archived ? '| archived' : '',
  )
}

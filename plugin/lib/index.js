/**
 * Host half of dsh-plugin-session-purge.
 *
 * Serves a small same-origin JSON API the browser half calls with fetch():
 *   GET  /x-session-purge/list
 *   POST /x-session-purge/delete   { id, children }  |  { allArchived: true }
 *
 * WHAT "DELETE" MEANS HERE
 *   ~/.dsh/sessions/<workspace-folder>/<sessionId>/       the log      -> removed
 *   ~/.dsh/storages/session_projcache/sessions/<id>.json  cache        -> removed
 *   the workspace registry's membership claim                          -> conditionally
 *   plus, on request, its child (subagent) sessions in the same folder -> removed
 *
 * WHY THE REGISTRY IS ONLY SOMETIMES TOUCHED
 * The sidebar lists the sessions the HOST has live in memory (`ctx.sessions`).
 * `dsh-session`'s SessionStore ties a session's lifetime to the fiber that
 * created it, so a session that is still open stays in that list no matter what
 * happens on disk. Releasing its workspace claim in that state does not remove
 * the row — it re-files the row under 未分组 (the client's bucket for a session
 * no workspace claims). So:
 *
 *   session NOT live  -> files removed + claim released + entities rebuilt
 *                        => the row really disappears
 *   session IS live   -> files removed, claim KEPT
 *                        => the row stays until DSH restarts, and the response
 *                           reports it in `pending` so the UI can say so
 *
 * The registry write goes through its own path (`enqueueOperation` /
 * `requireTable().put()` / `rebuildEntities()` / `setState()`) because
 * `registry.list()` reads in-memory entities, not the file — and `entities` is
 * only rebuilt by `rebuildEntities()`.
 */
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const SESS_ROOT = path.join(HOME, 'sessions')
const PROJ_ROOT = path.join(HOME, 'storages', 'session_projcache', 'sessions')
const WS_FILE = path.join(HOME, 'storages', 'workspace.json')
const BASE = '/x-session-purge'

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'))
  } catch {
    return fallback
  }
}

async function dirSize(dir) {
  let total = 0
  let entries
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      total += await dirSize(p)
    } else {
      try {
        total += (await fsp.stat(p)).size
      } catch {
        /* ignore */
      }
    }
  }
  return total
}

function decodeFolder(name) {
  return name
    .replace(/^-+|-+$/g, '')
    .replace(/~([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/-/g, '\\')
}

async function titleOf(sessionId) {
  const doc = await readJson(path.join(PROJ_ROOT, sessionId + '.json'), null)
  const value =
    doc && doc.record && doc.record.rows && doc.record.rows.title && doc.record.rows.title.val
  return typeof value === 'string' ? value : ''
}

/** Ids the host currently holds live in memory — these cannot be un-listed. */
function liveIds(ctx) {
  const set = new Set()
  try {
    const store = ctx.get('sessions')
    if (store !== undefined) {
      for (const session of store.list()) set.add(String(session.id))
    }
  } catch (error) {
    if (ctx.logger) ctx.logger.warn(`session-purge: cannot read live sessions: ${String(error)}`)
  }
  return set
}

async function scan() {
  const ws = await readJson(WS_FILE, { global: {}, tables: { workspaces: {} } })
  const archived = new Set((ws.global && ws.global.archivedSessionIds) || [])
  const known = new Set()
  const wsOf = new Map()
  const workspaces = (ws.tables && ws.tables.workspaces) || {}
  for (const entry of Object.values(workspaces)) {
    const title = entry.title || entry.path || ''
    for (const id of entry.sessionIds || []) {
      known.add(id)
      wsOf.set(id, title)
    }
  }

  const sessions = []
  let folders = []
  try {
    folders = await fsp.readdir(SESS_ROOT)
  } catch {
    return { ws, sessions }
  }
  for (const folder of folders) {
    let names = []
    try {
      names = await fsp.readdir(path.join(SESS_ROOT, folder))
    } catch {
      continue
    }
    for (const name of names) {
      let st
      try {
        st = await fsp.stat(path.join(SESS_ROOT, folder, name))
      } catch {
        continue
      }
      if (!st.isDirectory()) continue
      sessions.push({
        id: name,
        folder,
        bytes: await dirSize(path.join(SESS_ROOT, folder, name)),
        title: await titleOf(name),
        archived: archived.has(name),
        known: known.has(name),
        // When the session directory was last touched: the only "who is this"
        // signal besides the title, and it costs nothing (the stat is already here).
        mtimeMs: st.mtimeMs,
        ws: wsOf.get(name) || decodeFolder(folder),
      })
    }
  }
  return { ws, sessions }
}

function childrenOf(sessions, parent) {
  return sessions.filter((s) => s.folder === parent.folder && s.id !== parent.id && !s.known)
}

/**
 * Drop one session from the host's in-memory store so the sidebar stops listing
 * it. `dsh-session-query.listSessions()` merges persisted headers with the LIVE
 * store, so deleting the file alone leaves the row while the store still holds
 * the session. `entry.detach()` runs the store's own `detachEntered()` - the same
 * path the owning agent uses on disposal. That method is idempotent (a stale
 * capability returns early) and emits `session/disposed`, which is what tells the
 * rest of the app the session is gone.
 */
function evictLive(ctx, id) {
  try {
    const store = ctx.get('sessions')
    if (store === undefined || !(store.store instanceof Map)) return false
    const entry = store.store.get(id)
    if (entry === undefined || typeof entry.detach !== 'function') return false
    entry.detach()
    return true
  } catch (error) {
    if (ctx.logger) ctx.logger.warn('session-purge: evict failed: ' + String(error))
    return false
  }
}

/**
 * Release the workspace claim for `drop` (everything except `keep`).
 * Returns false when the registry is not reachable.
 */
async function syncRegistry(ctx, drop, keep) {
  const registry = ctx.get('workspaceRegistry')
  if (
    registry === undefined ||
    typeof registry.enqueueOperation !== 'function' ||
    typeof registry.setState !== 'function' ||
    typeof registry.requireState !== 'function' ||
    typeof registry.requireTable !== 'function'
  ) {
    return false
  }
  const shouldDrop = (id) => drop.has(id) && !(keep && keep.has(id))

  await registry.enqueueOperation(async () => {
    const state = registry.requireState()
    const table = registry.requireTable()
    let touched = false
    for (const key of Array.from(table.keys())) {
      const record = table.get(key)
      if (!record || !Array.isArray(record.sessionIds)) continue
      const kept = record.sessionIds.filter((x) => !shouldDrop(x))
      if (kept.length !== record.sessionIds.length) {
        await table.put(key, Object.assign({}, record, { sessionIds: kept }))
        touched = true
      }
    }
    await registry.setState(
      Object.assign({}, state, {
        archivedSessionIds: (state.archivedSessionIds || []).filter((x) => !shouldDrop(x)),
      }),
    )
    // `registry.list()` reads `this.entities`, built only by rebuildEntities().
    // Without this the entities keep the old sessionIds and the row never goes.
    if (touched && typeof registry.rebuildEntities === 'function') {
      registry.rebuildEntities()
    }
  })
  return true
}

/** Fallback: rewrite the durable file when the live registry is unreachable. */
async function rewriteFile(ws, drop, keep) {
  const shouldDrop = (id) => drop.has(id) && !(keep && keep.has(id))
  if (ws.global) {
    ws.global.archivedSessionIds = (ws.global.archivedSessionIds || []).filter(
      (x) => !shouldDrop(x),
    )
  }
  for (const entry of Object.values((ws.tables && ws.tables.workspaces) || {})) {
    entry.sessionIds = (entry.sessionIds || []).filter((x) => !shouldDrop(x))
  }
  await fsp.writeFile(WS_FILE, JSON.stringify(ws, null, 2), 'utf8')
}

async function purge(ctx, ws, targets) {
  const ids = new Set(targets.map((t) => t.id))

  let freed = 0
  for (const t of targets) {
    freed += t.bytes
    await fsp.rm(path.join(SESS_ROOT, t.folder, t.id), { recursive: true, force: true })
    await fsp.rm(path.join(PROJ_ROOT, t.id + '.json'), { force: true })
  }

  // The file deletion only clears the PERSISTED half of the sidebar's list; the
  // in-memory half has to be dropped explicitly. See evictLive().
  for (const id of ids) evictLive(ctx, id)

  const stillLive = liveIds(ctx)
  const keep = new Set()
  const pending = []
  for (const id of ids) {
    if (stillLive.has(id)) {
      keep.add(id)
      pending.push(id)
    }
  }

  let synced = false
  try {
    synced = await syncRegistry(ctx, ids, keep)
  } catch (error) {
    if (ctx.logger) ctx.logger.warn(`session-purge: live registry sync failed: ${String(error)}`)
  }
  if (!synced) await rewriteFile(ws, ids, keep)

  return { freed, synced, pending }
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

async function readBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function makeHandler(ctx) {
  return async function handler(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')
    const route = url.pathname.slice(BASE.length) || '/'
    try {
      if (req.method === 'GET' && route === '/list') {
        const { sessions } = await scan()
        const live = liveIds(ctx)
        for (const s of sessions) s.live = live.has(s.id)
        return send(res, 200, { ok: true, sessions })
      }

      if (req.method === 'POST' && route === '/delete') {
        const body = await readBody(req)
        const { ws, sessions } = await scan()

        if (body.allArchived) {
          const targets = sessions.filter((s) => s.archived)
          const r = await purge(ctx, ws, targets)
          return send(res, 200, {
            ok: true,
            deleted: targets.map((t) => t.id),
            freed: r.freed,
            live: r.synced,
            pending: r.pending,
          })
        }

        const hit = sessions.find((s) => s.id === body.id)
        if (!hit) return send(res, 404, { ok: false, error: '找不到该会话（可能已经删掉了）' })

        const targets = body.children ? [hit].concat(childrenOf(sessions, hit)) : [hit]
        const r = await purge(ctx, ws, targets)
        return send(res, 200, {
          ok: true,
          deleted: targets.map((t) => t.id),
          freed: r.freed,
          live: r.synced,
          pending: r.pending,
        })
      }

      return send(res, 404, { ok: false, error: 'unknown route' })
    } catch (error) {
      return send(res, 500, { ok: false, error: String((error && error.message) || error) })
    }
  }
}

export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() =>
    ctx.webServer.register({ kind: 'prefix', path: BASE, handler: makeHandler(ctx) }),
  )
}

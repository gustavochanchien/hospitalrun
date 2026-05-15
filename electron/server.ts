import { promises as fs } from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { app } from 'electron'

interface BackendConfig {
  url: string
  anonKey: string
}

interface ServerHandle {
  port: number
  server: http.Server
  close: () => Promise<void>
}

interface AppInfo {
  name: string
  version: string
}

interface HubRouterOptions {
  staticRoot: string
  getBackendConfig: () => BackendConfig | null
  appInfo: AppInfo
  /** Optional sub-router (e.g. auth-local) mounted before the static catch-all. */
  authRouter?: Hono
}

const HUB_PORT = 5174 // 5173 reserved for Vite dev server
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let active: ServerHandle | null = null
let cachedBackend: BackendConfig | null = null

/**
 * The renderer pushes its `hr_backend_config` here so we can serve it
 * to LAN clients via /config.json. Without this, devices that browse
 * to the hub would have to enter Supabase credentials themselves.
 */
export function setBackendConfigForLan(cfg: BackendConfig | null): void {
  cachedBackend = cfg
}

export function getCachedBackendConfig(): BackendConfig | null {
  return cachedBackend
}

export function distRoot(): string {
  // In packaged builds this resolves to <resources>/app.asar/dist
  // In dev, dist-electron lives at the repo root next to dist/
  return path.resolve(__dirname, '..', 'dist')
}

export function safeResolveStatic(staticRoot: string, rel: string): string | null {
  // Block obvious traversal attempts before normalizing
  if (rel.includes('..') || rel.includes('\0')) return null
  const full = path.resolve(staticRoot, '.' + rel)
  // Final defense: ensure the resolved path is still inside staticRoot
  const rootWithSep = staticRoot.endsWith(path.sep) ? staticRoot : staticRoot + path.sep
  if (full !== staticRoot && !full.startsWith(rootWithSep)) return null
  return full
}

export function contentTypeFor(ext: string): string {
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.ico': return 'image/x-icon'
    case '.woff2': return 'font/woff2'
    case '.webmanifest': return 'application/manifest+json'
    default: return 'application/octet-stream'
  }
}

/**
 * Build the Hono router. Pure function — no I/O until a request hits it.
 * Tests can call `router.fetch(new Request(...))` directly.
 */
export function createHubRouter(opts: HubRouterOptions): Hono {
  const { staticRoot, getBackendConfig, appInfo } = opts
  const router = new Hono()

  router.get('/config.json', (c) => {
    const cfg = getBackendConfig()
    if (!cfg) {
      return c.json({ mode: 'local-hub' }, 200, { 'cache-control': 'no-store' })
    }
    return c.json({ ...cfg, mode: 'cloud' }, 200, { 'cache-control': 'no-store' })
  })

  router.get('/healthz', (c) =>
    c.json({ ok: true, app: appInfo.name, version: appInfo.version }),
  )

  if (opts.authRouter) {
    router.route('/', opts.authRouter)
  }

  // Static SPA fallthrough — serve staticRoot, then SPA-fallback to index.html
  router.get('*', async (c) => {
    const url = new URL(c.req.url)
    const requested = url.pathname === '/' ? '/index.html' : url.pathname
    let resolved = safeResolveStatic(staticRoot, requested)
    let ext = resolved ? path.extname(resolved) : ''

    let stat: Awaited<ReturnType<typeof fs.stat>> | null = null
    if (resolved) {
      try {
        stat = await fs.stat(resolved)
        if (stat.isDirectory()) stat = null
      } catch {
        stat = null
      }
    }

    if (!stat) {
      // SPA fallback: serve index.html so the client-side router can take over
      resolved = safeResolveStatic(staticRoot, '/index.html')
      ext = '.html'
      if (!resolved) return c.notFound()
      try {
        await fs.stat(resolved)
      } catch {
        return c.notFound()
      }
    }

    const body = await fs.readFile(resolved!)
    return new Response(body, {
      headers: { 'content-type': contentTypeFor(ext) },
    })
  })

  return router
}

export interface StartHubServerOptions {
  authRouter?: Hono
}

export async function startHubServer(opts: StartHubServerOptions = {}): Promise<ServerHandle> {
  if (active) return active

  const router = createHubRouter({
    staticRoot: distRoot(),
    getBackendConfig: () => cachedBackend,
    appInfo: { name: app.getName(), version: app.getVersion() },
    authRouter: opts.authRouter,
  })

  const server = http.createServer(async (req, res) => {
    try {
      const response = await router.fetch(
        new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, {
          method: req.method,
          headers: req.headers as Record<string, string>,
        }),
      )
      res.statusCode = response.status
      response.headers.forEach((v, k) => res.setHeader(k, v))
      const body = Buffer.from(await response.arrayBuffer())
      res.end(body)
    } catch (err) {
      res.statusCode = 500
      res.end(err instanceof Error ? err.message : 'Internal error')
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(HUB_PORT, '0.0.0.0', () => {
      server.off('error', reject)
      resolve()
    })
  })

  const handle: ServerHandle = {
    port: HUB_PORT,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
        active = null
      }),
  }
  active = handle
  return handle
}

export async function stopHubServer(): Promise<void> {
  if (active) await active.close()
}

export function getActivePort(): number | null {
  return active?.port ?? null
}

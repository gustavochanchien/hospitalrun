import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveBackendConfig } from '@/lib/supabase/client'
import { isDesktop, getIPC, openExternal } from '@/lib/desktop/env'
import { setupSchema, normalizeUrl, type SetupFormData } from './setup.schema'

type ProbeResult =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

type HubProbe =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; url: string; hostname: string | null }
  | { status: 'not-found' }

const HUB_DISCOVER_URL = 'http://hospitalrun.local:5174/_discover'
const HUB_APP_NAME = 'HospitalRun'

async function probeServer(url: string, anonKey: string): Promise<ProbeResult> {
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
    })
    if (res.ok) return { status: 'ok' }
    return { status: 'error', message: `Server responded with ${res.status}` }
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not reach server',
    }
  }
}

async function probeLanHub(): Promise<HubProbe> {
  try {
    const res = await fetch(HUB_DISCOVER_URL, { cache: 'no-store' })
    if (!res.ok) return { status: 'not-found' }
    const body = (await res.json()) as {
      app?: unknown
      url?: unknown
      hostname?: unknown
    }
    if (body.app !== HUB_APP_NAME || typeof body.url !== 'string') {
      return { status: 'not-found' }
    }
    return {
      status: 'found',
      url: body.url,
      hostname: typeof body.hostname === 'string' ? body.hostname : null,
    }
  } catch {
    return { status: 'not-found' }
  }
}

interface CloudConnectFormProps {
  onBack?: () => void
  showCreateProjectLink?: boolean
  /**
   * Show a "Find HospitalRun hub on this network" button that probes the
   * advertised mDNS hostname for a local hub. Useful when a tablet/phone
   * lands on the setup page from a non-hub origin and the user doesn't
   * know the hub's IP.
   */
  showFindHub?: boolean
  /**
   * Called after the form successfully saves valid credentials. The
   * caller decides whether to reload or chain into the next step (e.g.
   * Hub mode kicks off `startHub` after this resolves).
   */
  onSaved?: (cfg: { url: string; anonKey: string }) => void | Promise<void>
  submitLabel?: string
}

export function CloudConnectForm({
  onBack,
  showCreateProjectLink = false,
  showFindHub = false,
  onSaved,
  submitLabel = 'Connect',
}: CloudConnectFormProps) {
  const [probe, setProbe] = useState<ProbeResult>({ status: 'idle' })
  const [hubProbe, setHubProbe] = useState<HubProbe>({ status: 'idle' })
  const [saving, setSaving] = useState(false)

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: { url: '', anonKey: '' },
  })

  const onFindHub = async () => {
    setHubProbe({ status: 'searching' })
    setHubProbe(await probeLanHub())
  }

  const openFoundHub = () => {
    if (hubProbe.status !== 'found') return
    window.location.assign(hubProbe.url)
  }

  const onTest = async () => {
    const values = form.getValues()
    const parsed = setupSchema.safeParse(values)
    if (!parsed.success) {
      await form.trigger()
      return
    }
    setProbe({ status: 'idle' })
    const result = await probeServer(normalizeUrl(parsed.data.url), parsed.data.anonKey)
    setProbe(result)
  }

  const onSubmit = async (data: SetupFormData) => {
    const cfg = { url: normalizeUrl(data.url), anonKey: data.anonKey }
    setSaving(true)
    try {
      saveBackendConfig(cfg)
      // Mirror the config to the Electron main process so the LAN
      // server can serve /config.json to other devices in Hub mode.
      if (isDesktop()) {
        await getIPC().setBackendConfig(cfg)
      }
      if (onSaved) {
        await onSaved(cfg)
      } else {
        window.location.assign('/')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {showCreateProjectLink && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-2 font-medium">Need a Supabase project?</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Create a free one, then copy the Project URL and anon key from
            Project Settings → API.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void openExternal('https://supabase.com/dashboard/new')}
          >
            Open Supabase
          </Button>
        </div>
      )}

      {showFindHub && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-2 font-medium">On the clinic's network?</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Scan this network for a HospitalRun hub instead of entering a
            server URL.
          </p>
          {hubProbe.status === 'idle' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void onFindHub()}
              disabled={saving}
            >
              Find hub on this network
            </Button>
          )}
          {hubProbe.status === 'searching' && (
            <p className="text-xs text-muted-foreground">Searching…</p>
          )}
          {hubProbe.status === 'found' && (
            <div className="space-y-2">
              <p className="text-xs">
                Found a HospitalRun hub at{' '}
                <span className="font-mono">{hubProbe.url}</span>.
              </p>
              <Button type="button" size="sm" onClick={openFoundHub}>
                Open hub
              </Button>
            </div>
          )}
          {hubProbe.status === 'not-found' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                No HospitalRun hub found on this network. You can enter
                the server URL below instead.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void onFindHub()}
                disabled={saving}
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="server-url">Server URL</Label>
        <Input
          id="server-url"
          placeholder="https://your-project.supabase.co"
          autoComplete="off"
          {...form.register('url')}
        />
        {form.formState.errors.url && (
          <p className="text-sm text-destructive">{form.formState.errors.url.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="anon-key">Anon key</Label>
        <Input
          id="anon-key"
          placeholder="sb_publishable_..."
          autoComplete="off"
          {...form.register('anonKey')}
        />
        {form.formState.errors.anonKey && (
          <p className="text-sm text-destructive">{form.formState.errors.anonKey.message}</p>
        )}
      </div>

      {probe.status === 'ok' && (
        <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
          Server reachable.
        </div>
      )}
      {probe.status === 'error' && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {probe.message}
        </div>
      )}

      <div className="flex gap-2">
        {onBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
            Back
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onTest}
          disabled={saving}
        >
          Test connection
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

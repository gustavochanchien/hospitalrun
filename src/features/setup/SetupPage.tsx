import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { saveBackendConfig } from '@/lib/supabase/client'
import { setupSchema, normalizeUrl, type SetupFormData } from './setup.schema'

type ProbeResult =
  | { status: 'idle' }
  | { status: 'ok' }
  | { status: 'error'; message: string }

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

export function SetupPage() {
  const [probe, setProbe] = useState<ProbeResult>({ status: 'idle' })

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: { url: '', anonKey: '' },
  })

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

  const onSubmit = (data: SetupFormData) => {
    saveBackendConfig({ url: normalizeUrl(data.url), anonKey: data.anonKey })
    window.location.assign('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Connect to your server</CardTitle>
          <CardDescription>
            Enter the address of the HospitalRun server you want this device to
            use. Your administrator should have provided this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-url">Server URL</Label>
              <Input
                id="server-url"
                placeholder="https://hospitalrun.clinic.lan"
                autoComplete="off"
                {...form.register('url')}
              />
              {form.formState.errors.url && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.url.message}
                </p>
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
                <p className="text-sm text-destructive">
                  {form.formState.errors.anonKey.message}
                </p>
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
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={onTest}
                disabled={form.formState.isSubmitting}
              >
                Test connection
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={form.formState.isSubmitting}
              >
                Connect
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getIPC, type HubInfo } from '@/lib/desktop/env'
import { useAuthStore } from '@/features/auth/auth.store'
import { CloudConnectForm } from './CloudConnectForm'

type Step = 'start' | 'starting' | 'first-user' | 'cloud-prompt' | 'ready' | 'error'

interface HubSetupFlowProps {
  onBack: () => void
}

export function HubSetupFlow({ onBack }: HubSetupFlowProps) {
  const [step, setStep] = useState<Step>('start')
  const [hubInfo, setHubInfo] = useState<HubInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function startHub() {
    setStep('starting')
    setErrorMessage(null)
    try {
      const ipc = getIPC()
      await ipc.setRunMode('hub')
      const info = await ipc.startHub()
      setHubInfo(info)
      setStep('first-user')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }

  if (step === 'start') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Hub mode runs HospitalRun on this computer and serves it to other
          devices on your local network — no internet required. You can
          optionally connect a Supabase project later for cloud backup.
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button className="flex-1" onClick={startHub}>
            Start hub
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'starting') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Starting the clinic hub on this computer…
        </div>
      </div>
    )
  }

  if (step === 'first-user') {
    return <HubFirstUserForm onDone={() => setStep('cloud-prompt')} />
  }

  if (step === 'cloud-prompt') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          <strong>Optional:</strong> Connect a Supabase project to enable cloud
          backup and sync across sites. You can skip this and add it later in
          Settings.
        </div>
        <CloudConnectForm
          submitLabel="Connect Supabase"
          onSaved={() => setStep('ready')}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setStep('ready')}
        >
          Skip for now
        </Button>
      </div>
    )
  }

  if (step === 'ready' && hubInfo) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
          <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">Your clinic hub is ready.</p>
              <p className="mt-1 text-xs">
                Other devices on the same wifi can open this address in a
                browser to use HospitalRun:
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm">
          {hubInfo.url}
        </div>

        <p className="text-xs text-muted-foreground">
          Bookmark this URL on tablets and other laptops in the clinic. The hub
          will start automatically every time you open this app on this
          computer.
        </p>

        <Button
          className="w-full"
          onClick={() => {
            try {
              localStorage.setItem(
                'hr_hub_just_started',
                JSON.stringify({ url: hubInfo.url }),
              )
            } catch {
              // localStorage may be unavailable (private mode); the splash
              // is a nice-to-have, not load-bearing.
            }
            window.location.assign('/')
          }}
        >
          Open HospitalRun
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {errorMessage ?? 'Something went wrong starting the hub.'}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null)
            setStep('start')
          }}
          className="flex-1"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

interface HubFirstUserFormProps {
  onDone: () => void
}

function HubFirstUserForm({ onDone }: HubFirstUserFormProps) {
  const signIn = useAuthStore((s) => s.signIn)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const trimEmail = email.trim().toLowerCase()
    const trimName = fullName.trim()
    if (!trimName) { setError('Full name is required'); return }
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError('Enter a valid email')
      return
    }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    setWorking(true)
    try {
      const res = await fetch('/auth/local/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimEmail, password, role: 'admin', fullName: trimName }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to create account'); return }

      // Sign in to populate the auth store, then continue the wizard.
      const { error: signInErr } = await signIn(trimEmail, password)
      if (signInErr) { setError(signInErr); return }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Create the admin account for this hub. You&apos;ll use these credentials
        to sign in on this computer and on LAN devices.
      </p>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="hfu-name">Full name</Label>
        <Input
          id="hfu-name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={working}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hfu-email">Email</Label>
        <Input
          id="hfu-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={working}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hfu-pw">Password</Label>
        <Input
          id="hfu-pw"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={working}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hfu-pw2">Confirm password</Label>
        <Input
          id="hfu-pw2"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={working}
        />
      </div>

      <Button type="submit" className="w-full" disabled={working}>
        {working ? 'Creating account…' : 'Create admin account'}
      </Button>
    </form>
  )
}

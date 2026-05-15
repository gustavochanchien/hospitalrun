import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('setup')
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
          {t('flow.intro')}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            {t('flow.back')}
          </Button>
          <Button className="flex-1" onClick={startHub}>
            {t('flow.startHub')}
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
          {t('flow.starting')}
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
          <strong>{t('flow.cloudPromptOptional')}</strong> {t('flow.cloudPromptBody')}
        </div>
        <CloudConnectForm
          submitLabel={t('flow.connectSupabase')}
          onSaved={() => setStep('ready')}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setStep('ready')}
        >
          {t('flow.skipForNow')}
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
              <p className="font-medium">{t('flow.readyTitle')}</p>
              <p className="mt-1 text-xs">{t('flow.readyDesc')}</p>
            </div>
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 p-3 font-mono text-sm">
          {hubInfo.url}
        </div>

        <p className="text-xs text-muted-foreground">{t('flow.bookmarkHelp')}</p>

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
          {t('flow.openApp')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
        {errorMessage ?? t('flow.errorFallback')}
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
          {t('flow.back')}
        </Button>
        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null)
            setStep('start')
          }}
          className="flex-1"
        >
          {t('flow.tryAgain')}
        </Button>
      </div>
    </div>
  )
}

interface HubFirstUserFormProps {
  onDone: () => void
}

function HubFirstUserForm({ onDone }: HubFirstUserFormProps) {
  const { t } = useTranslation('setup')
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
    if (!trimName) { setError(t('firstUser.errFullName')); return }
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setError(t('firstUser.errEmail'))
      return
    }
    if (password.length < 8) { setError(t('firstUser.errPassword')); return }
    if (password !== confirmPassword) { setError(t('firstUser.errMismatch')); return }

    setWorking(true)
    try {
      const res = await fetch('/auth/local/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimEmail, password, role: 'admin', fullName: trimName }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) { setError(data.error ?? t('firstUser.errCreate')); return }

      // Sign in to populate the auth store, then continue the wizard.
      const { error: signInErr } = await signIn(trimEmail, password)
      if (signInErr) { setError(signInErr); return }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('firstUser.errNetwork'))
    } finally {
      setWorking(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('firstUser.intro')}</p>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="hfu-name">{t('firstUser.fullName')}</Label>
        <Input
          id="hfu-name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={working}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hfu-email">{t('firstUser.email')}</Label>
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
        <Label htmlFor="hfu-pw">{t('firstUser.password')}</Label>
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
        <Label htmlFor="hfu-pw2">{t('firstUser.confirmPassword')}</Label>
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
        {working ? t('firstUser.creating') : t('firstUser.create')}
      </Button>
    </form>
  )
}

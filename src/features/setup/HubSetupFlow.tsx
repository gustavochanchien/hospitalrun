import { useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getIPC, type HubInfo } from '@/lib/desktop/env'
import { CloudConnectForm } from './CloudConnectForm'

type Step = 'connect' | 'starting' | 'ready' | 'error'

interface HubSetupFlowProps {
  onBack: () => void
}

export function HubSetupFlow({ onBack }: HubSetupFlowProps) {
  const [step, setStep] = useState<Step>('connect')
  const [hubInfo, setHubInfo] = useState<HubInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSaved() {
    setStep('starting')
    setErrorMessage(null)
    try {
      const ipc = getIPC()
      await ipc.setRunMode('hub')
      const info = await ipc.startHub()
      setHubInfo(info)
      setStep('ready')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStep('error')
    }
  }

  if (step === 'connect') {
    return (
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          Hub mode connects to a Supabase project (your data lives there). Once
          connected, this computer hosts the app on your local network so other
          devices can use it — including when the internet drops.
        </div>
        <CloudConnectForm
          onBack={onBack}
          showCreateProjectLink
          submitLabel="Continue"
          onSaved={handleSaved}
        />
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

        <Button className="w-full" onClick={() => window.location.assign('/')}>
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
            setStep('connect')
          }}
          className="flex-1"
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

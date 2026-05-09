import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { isDesktop, getIPC } from '@/lib/desktop/env'
import { ModeChooser, type SetupMode } from './ModeChooser'
import { CloudConnectForm } from './CloudConnectForm'
import { HubSetupFlow } from './HubSetupFlow'

type Screen = 'chooser' | 'solo' | 'hub' | 'cloud-only-web'

export function SetupPage() {
  const desktop = isDesktop()
  const [screen, setScreen] = useState<Screen>(desktop ? 'chooser' : 'cloud-only-web')

  function pickMode(mode: SetupMode) {
    setScreen(mode)
  }

  function back() {
    setScreen('chooser')
  }

  async function handleSoloSaved() {
    // In the desktop app, persist that this install is "solo" so we
    // don't auto-start the hub on next launch. In the web build this
    // call is a no-op because isDesktop() is false.
    if (desktop) {
      try {
        await getIPC().setRunMode('solo')
      } catch {
        // Best-effort — failing here shouldn't block the user from
        // entering the app.
      }
    }
    window.location.assign('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">
            {screen === 'chooser' && 'Welcome to HospitalRun'}
            {screen === 'solo' && 'Connect to Supabase'}
            {screen === 'hub' && 'Set up the clinic hub'}
            {screen === 'cloud-only-web' && 'Connect to your server'}
          </CardTitle>
          <CardDescription>
            {screen === 'chooser' && 'How would you like to run HospitalRun on this computer?'}
            {screen === 'solo' &&
              'Paste your Supabase project URL and anon key. You can find both under Project Settings → API.'}
            {screen === 'hub' &&
              'This computer will host HospitalRun for the clinic. We just need to connect it to a Supabase project once.'}
            {screen === 'cloud-only-web' &&
              'Enter the address of the HospitalRun server you want this device to use.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {screen === 'chooser' && <ModeChooser onPick={pickMode} />}
          {screen === 'solo' && (
            <CloudConnectForm
              onBack={back}
              showCreateProjectLink
              onSaved={handleSoloSaved}
            />
          )}
          {screen === 'hub' && <HubSetupFlow onBack={back} />}
          {screen === 'cloud-only-web' && <CloudConnectForm />}
        </CardContent>
      </Card>
    </div>
  )
}

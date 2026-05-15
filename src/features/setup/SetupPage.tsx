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
import { FirstUserForm } from './FirstUserForm'

type Screen = 'chooser' | 'solo' | 'hub' | 'cloud-only-web' | 'first-user'

export function SetupPage() {
  const desktop = isDesktop()
  const [screen, setScreen] = useState<Screen>(desktop ? 'chooser' : 'cloud-only-web')
  // Tracks where to go back to from the first-user screen.
  const [cloudScreen, setCloudScreen] = useState<'solo' | 'cloud-only-web'>('cloud-only-web')

  function pickMode(mode: SetupMode) {
    setScreen(mode)
  }

  function back() {
    setScreen('chooser')
  }

  function goToFirstUser(from: 'solo' | 'cloud-only-web') {
    setCloudScreen(from)
    setScreen('first-user')
  }

  async function handleSoloSaved() {
    if (desktop) {
      try {
        await getIPC().setRunMode('solo')
      } catch {
        // Best-effort — failing here shouldn't block the user.
      }
    }
    goToFirstUser('solo')
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
            {screen === 'first-user' && 'Create your admin account'}
          </CardTitle>
          <CardDescription>
            {screen === 'chooser' && 'How would you like to run HospitalRun on this computer?'}
            {screen === 'solo' &&
              'Paste your Supabase project URL and anon key. You can find both under Project Settings → API.'}
            {screen === 'hub' &&
              'This computer will host HospitalRun for the clinic. We just need to connect it to a Supabase project once.'}
            {screen === 'cloud-only-web' &&
              'Enter the address of the HospitalRun server you want this device to use.'}
            {screen === 'first-user' &&
              "You're the first person to connect to this server. Set up your admin account to get started."}
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
          {screen === 'cloud-only-web' && (
            <CloudConnectForm
              showFindHub
              onSaved={() => goToFirstUser('cloud-only-web')}
            />
          )}
          {screen === 'first-user' && (
            <FirstUserForm onBack={() => setScreen(cloudScreen)} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

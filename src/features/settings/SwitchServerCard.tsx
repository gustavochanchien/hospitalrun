import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  clearBackendConfig,
  getBackendConfig,
  getSupabase,
} from '@/lib/supabase/client'
import { db } from '@/lib/db'

export function SwitchServerCard() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const config = getBackendConfig()

  async function handleSwitch() {
    try {
      await getSupabase().auth.signOut()
    } catch {
      // Ignore — we're tearing down anyway.
    }
    try {
      await db.delete()
    } catch (err) {
      toast.error(
        `Couldn't clear local data: ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }
    clearBackendConfig()
    window.location.assign('/setup')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Connection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <div className="text-muted-foreground">Connected to</div>
          <code className="block break-all text-xs">{config?.url ?? '(not set)'}</code>
        </div>
        <p className="text-xs text-muted-foreground">
          Switching servers signs you out and clears all local data on this
          device. Any records that haven't finished syncing will be lost.
        </p>
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          Switch Server
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Switch to a different server?"
        description="This signs you out and erases all local data on this device. Unsynced changes will be lost. Continue?"
        confirmLabel="Switch Server"
        onConfirm={handleSwitch}
      />
    </Card>
  )
}

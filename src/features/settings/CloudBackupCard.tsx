import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { Cloud, CloudOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { isDesktop, getIPC } from '@/lib/desktop/env'
import {
  clearBackendConfig,
  getBackendConfig,
  isHubLocalMode,
} from '@/lib/supabase/client'
import { flushSyncQueue, getLastCloudSyncAt } from '@/lib/sync/sync'
import { CloudConnectForm } from '@/features/setup/CloudConnectForm'

export function CloudBackupCard() {
  const [connectOpen, setConnectOpen] = useState(false)
  const [disconnectOpen, setDisconnectOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(() =>
    getLastCloudSyncAt(),
  )

  // Re-read the last-sync timestamp periodically so the relative time
  // stays fresh while the user looks at this card.
  useEffect(() => {
    const id = window.setInterval(() => {
      setLastSyncAt(getLastCloudSyncAt())
    }, 30_000)
    return () => window.clearInterval(id)
  }, [])

  if (!isDesktop()) return null

  const connected = !isHubLocalMode()
  const config = getBackendConfig()

  async function handleSyncNow() {
    setSyncing(true)
    try {
      await flushSyncQueue()
      const at = getLastCloudSyncAt()
      setLastSyncAt(at)
      if (at) {
        toast.success('Synced with cloud')
      } else {
        toast.warning('Sync attempted but cloud was unreachable')
      }
    } catch (err) {
      toast.error(
        `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setSyncing(false)
    }
  }

  async function handleDisconnect() {
    try {
      if (isDesktop()) {
        await getIPC().setBackendConfig(null)
      }
      clearBackendConfig()
      toast.success('Disconnected from cloud. Hub is now local-only.')
      // Reload so the supabase client teardown / `isHubLocalMode` flag
      // settle correctly across the rest of the app.
      window.location.assign('/')
    } catch (err) {
      toast.error(
        `Disconnect failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {connected ? (
            <Cloud className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CloudOff className="h-4 w-4" aria-hidden="true" />
          )}
          Cloud Backup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            <div className="space-y-1 text-sm">
              <div className="text-muted-foreground">Connected to</div>
              <code className="block break-all text-xs">{config?.url}</code>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Last synced: </span>
              <span>
                {lastSyncAt
                  ? `${formatDistanceToNow(new Date(lastSyncAt))} ago`
                  : 'never'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSyncNow()}
                disabled={syncing}
                variant="outline"
              >
                {syncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button
                onClick={() => setDisconnectOpen(true)}
                variant="outline"
              >
                Disconnect
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Local writes flush to cloud Supabase when the hub is online,
              and fall back to LAN-only sync when it isn't. Disconnecting
              reverts the hub to local-only mode.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              This hub is running locally with no cloud backup. Connect a
              Supabase project to mirror writes to the cloud and sync
              across clinic sites.
            </p>
            <Button onClick={() => setConnectOpen(true)}>
              Connect Supabase
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Supabase</DialogTitle>
            <DialogDescription>
              Paste your Supabase project URL and anon key. LAN clients
              will pick up the new config on their next reload.
            </DialogDescription>
          </DialogHeader>
          <CloudConnectForm
            showCreateProjectLink
            onSaved={() => {
              setConnectOpen(false)
              // Reload so the renderer rebuilds the supabase client and
              // hubLocalMode flips off.
              window.location.assign('/')
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect from cloud?"
        description="The hub will revert to local-only mode. Records already saved on Supabase remain there, but new writes will no longer reach the cloud until you reconnect."
        confirmLabel="Disconnect"
        onConfirm={handleDisconnect}
      />
    </Card>
  )
}

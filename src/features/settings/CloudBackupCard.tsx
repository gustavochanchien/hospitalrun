import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('settings')
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
        toast.success(t('cloud.syncSuccess'))
      } else {
        toast.warning(t('cloud.syncUnreachable'))
      }
    } catch (err) {
      toast.error(
        t('cloud.syncError', {
          error: err instanceof Error ? err.message : String(err),
        }),
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
      toast.success(t('cloud.disconnectSuccess'))
      // Reload so the supabase client teardown / `isHubLocalMode` flag
      // settle correctly across the rest of the app.
      window.location.assign('/')
    } catch (err) {
      toast.error(
        t('cloud.disconnectError', {
          error: err instanceof Error ? err.message : String(err),
        }),
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
          {t('cloud.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            <div className="space-y-1 text-sm">
              <div className="text-muted-foreground">{t('cloud.connectedTo')}</div>
              <code className="block break-all text-xs">{config?.url}</code>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{t('cloud.lastSynced')}: </span>
              <span>
                {lastSyncAt
                  ? t('cloud.ago', {
                      distance: formatDistanceToNow(new Date(lastSyncAt)),
                    })
                  : t('cloud.never')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => void handleSyncNow()}
                disabled={syncing}
                variant="outline"
              >
                {syncing ? t('cloud.syncing') : t('cloud.syncNow')}
              </Button>
              <Button
                onClick={() => setDisconnectOpen(true)}
                variant="outline"
              >
                {t('cloud.disconnect')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('cloud.connectedHelp')}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {t('cloud.unconnectedHelp')}
            </p>
            <Button onClick={() => setConnectOpen(true)}>
              {t('cloud.connect')}
            </Button>
          </>
        )}
      </CardContent>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cloud.dialogTitle')}</DialogTitle>
            <DialogDescription>
              {t('cloud.dialogDescription')}
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
        title={t('cloud.confirmTitle')}
        description={t('cloud.confirmDesc')}
        confirmLabel={t('cloud.disconnect')}
        onConfirm={handleDisconnect}
      />
    </Card>
  )
}

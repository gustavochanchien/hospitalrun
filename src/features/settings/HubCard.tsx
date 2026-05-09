import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isDesktop, getIPC, type HubInfo, type BackupStatus } from '@/lib/desktop/env'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

type Mode = 'solo' | 'hub' | null

export function HubCard() {
  const [mode, setMode] = useState<Mode>(null)
  const [hubInfo, setHubInfo] = useState<HubInfo | null>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!isDesktop()) return
    const ipc = getIPC()
    void Promise.all([ipc.getRunMode(), ipc.getHubInfo(), ipc.getBackupStatus()]).then(
      ([m, info, status]) => {
        setMode(m)
        setHubInfo(info)
        setBackupStatus(status)
      },
    )
  }, [])

  if (!isDesktop()) return null

  async function handleBackup() {
    setBusy(true)
    try {
      const result = await getIPC().runBackup()
      if (!result) return
      toast.success(`Backed up ${result.filesCopied.length} files (${formatBytes(result.bytesCopied)})`)
      const status = await getIPC().getBackupStatus()
      setBackupStatus(status)
    } catch (err) {
      toast.error(`Backup failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    try {
      const result = await getIPC().restoreBackup()
      if (!result) return
      toast.success(`Restored ${result.filesRestored.length} files (${formatBytes(result.bytesCopied)}) — hub restarted`)
    } catch (err) {
      toast.error(`Restore failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Desktop hub</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1 text-sm">
          <div>
            <span className="text-muted-foreground">Mode: </span>
            <code>{mode === 'hub' ? 'Hub' : mode === 'solo' ? 'Solo' : '(unknown)'}</code>
          </div>
          {mode === 'hub' && hubInfo && (
            <div>
              <span className="text-muted-foreground">LAN URL: </span>
              <code className="break-all">{hubInfo.url}</code>
              <p className="mt-1 text-xs text-muted-foreground">
                Other devices on this network can open this address in a browser.
              </p>
            </div>
          )}
        </div>

        {mode === 'hub' && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              The hub serves over HTTP. For production deployments with real patient data,
              place the hub behind a reverse proxy (Caddy, nginx) with TLS.
            </span>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Last backup: </span>
            <span>
              {backupStatus?.lastBackupAt
                ? `${formatDistanceToNow(new Date(backupStatus.lastBackupAt))} ago`
                : 'never'}
            </span>
          </div>
          {backupStatus?.lastDestination && (
            <p className="text-xs text-muted-foreground break-all">
              Saved to <code>{backupStatus.lastDestination}</code>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleBackup()} disabled={busy || restoring} variant="outline">
              {busy ? 'Backing up…' : 'Backup hub data now'}
            </Button>
            <Button onClick={() => void handleRestore()} disabled={busy || restoring} variant="outline">
              {restoring ? 'Restoring…' : 'Restore from backup'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Backup saves the LAN sync log, cached profiles, and signing keys to a folder of your
            choice. Restore picks a saved backup folder and restarts the hub automatically.
            Patient records on each device are cached in the browser; cloud Supabase is the
            canonical store.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

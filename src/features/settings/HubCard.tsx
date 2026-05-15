import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { isDesktop, getIPC, type HubInfo, type BackupStatus } from '@/lib/desktop/env'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle } from 'lucide-react'

type Mode = 'solo' | 'hub' | null

export function HubCard() {
  const { t } = useTranslation('settings')
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
      toast.success(
        t('hub.backupSuccess', {
          count: result.filesCopied.length,
          size: formatBytes(result.bytesCopied),
        }),
      )
      const status = await getIPC().getBackupStatus()
      setBackupStatus(status)
    } catch (err) {
      toast.error(
        t('hub.backupError', {
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    try {
      const result = await getIPC().restoreBackup()
      if (!result) return
      toast.success(
        t('hub.restoreSuccess', {
          count: result.filesRestored.length,
          size: formatBytes(result.bytesCopied),
        }),
      )
    } catch (err) {
      toast.error(
        t('hub.restoreError', {
          error: err instanceof Error ? err.message : String(err),
        }),
      )
    } finally {
      setRestoring(false)
    }
  }

  const modeLabel =
    mode === 'hub'
      ? t('hub.modeHub')
      : mode === 'solo'
        ? t('hub.modeSolo')
        : t('hub.modeUnknown')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hub.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1 text-sm">
          <div>
            <span className="text-muted-foreground">{t('hub.mode')}: </span>
            <code>{modeLabel}</code>
          </div>
          {mode === 'hub' && hubInfo && (
            <div>
              <span className="text-muted-foreground">{t('hub.lanUrl')}: </span>
              <code className="break-all">{hubInfo.url}</code>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('hub.lanHelp')}
              </p>
            </div>
          )}
        </div>

        {mode === 'hub' && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{t('hub.httpWarning')}</span>
          </div>
        )}

        <div className="space-y-2 border-t pt-4">
          <div className="text-sm">
            <span className="text-muted-foreground">{t('hub.lastBackup')}: </span>
            <span>
              {backupStatus?.lastBackupAt
                ? t('hub.ago', {
                    distance: formatDistanceToNow(new Date(backupStatus.lastBackupAt)),
                  })
                : t('hub.never')}
            </span>
          </div>
          {backupStatus?.lastDestination && (
            <p className="text-xs text-muted-foreground break-all">
              {t('hub.savedTo')} <code>{backupStatus.lastDestination}</code>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleBackup()} disabled={busy || restoring} variant="outline">
              {busy ? t('hub.backingUp') : t('hub.backupNow')}
            </Button>
            <Button onClick={() => void handleRestore()} disabled={busy || restoring} variant="outline">
              {restoring ? t('hub.restoring') : t('hub.restore')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('hub.help')}</p>
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

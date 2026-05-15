import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getIPC, isDesktop, type UpdateDownloadedPayload } from '@/lib/desktop/env'

export function UpdateAvailableBanner() {
  const [pending, setPending] = useState<UpdateDownloadedPayload | null>(null)
  const [restarting, setRestarting] = useState(false)
  const { t } = useTranslation('common')

  useEffect(() => {
    if (!isDesktop()) return
    const unsubscribe = getIPC().onUpdateDownloaded((info) => {
      setPending(info)
    })
    return unsubscribe
  }, [])

  if (!pending) return null

  const message = pending.version
    ? t('layout.updateAvailableWithVersion', { version: `v${pending.version}` })
    : t('layout.updateAvailable')

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-3 bg-sky-600/95 px-4 py-2 text-sm font-medium text-sky-50 shadow-sm"
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      <span>{message}</span>
      <Button
        size="sm"
        variant="secondary"
        disabled={restarting}
        onClick={() => {
          setRestarting(true)
          void getIPC()
            .installUpdate()
            .catch((err) => {
              console.warn('[updater] installUpdate failed:', err)
              setRestarting(false)
            })
        }}
      >
        {restarting ? t('layout.restarting') : t('layout.restartToUpdate')}
      </Button>
    </div>
  )
}

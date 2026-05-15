import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('settings')

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
        `${t('server.clearError')}: ${err instanceof Error ? err.message : String(err)}`,
      )
      return
    }
    clearBackendConfig()
    window.location.assign('/setup')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('server.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1 text-sm">
          <div className="text-muted-foreground">{t('server.connectedTo')}</div>
          <code className="block break-all text-xs">{config?.url ?? t('server.notSet')}</code>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('server.help')}
        </p>
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          {t('server.switch')}
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('server.confirmTitle')}
        description={t('server.confirmDesc')}
        confirmLabel={t('server.switch')}
        onConfirm={handleSwitch}
      />
    </Card>
  )
}

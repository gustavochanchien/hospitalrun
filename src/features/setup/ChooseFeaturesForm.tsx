import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { FEATURES, FEATURE_METADATA, type Feature } from '@/lib/features'
import type { OrgFeature, UserFeature } from '@/lib/db/schema'

interface Props {
  onDone: () => void
}

/**
 * Setup-wizard step. Asks the admin which optional features to turn on
 * for their org. Writes `org_features` rows for each feature (enabled or
 * not, so a row exists either way) and grants the current user every
 * enabled feature via `user_features`.
 *
 * "Skip" advances without writing anything — all features stay off
 * (the absence of a row is treated as disabled).
 */
export function ChooseFeaturesForm({ onDone }: Props) {
  const { t } = useTranslation('setup')
  const orgId = useAuthStore((s) => s.orgId)
  const userId = useAuthStore((s) => s.user?.id ?? null)

  const [selected, setSelected] = useState<Record<Feature, boolean>>(
    () =>
      Object.fromEntries(FEATURES.map((f) => [f, FEATURE_METADATA[f].defaultOn])) as Record<
        Feature,
        boolean
      >,
  )
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleConfirm() {
    if (!orgId) {
      setError(t('chooseFeatures.errNoOrg'))
      return
    }
    setWorking(true)
    setError(null)
    try {
      const now = new Date().toISOString()
      for (const feature of FEATURES) {
        const enabled = !!selected[feature]
        const orgRow: OrgFeature = {
          id: crypto.randomUUID(),
          orgId,
          feature,
          enabled,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
          _synced: false,
          _deleted: false,
        }
        await dbPut('orgFeatures', orgRow, 'insert')

        if (enabled && userId) {
          const userRow: UserFeature = {
            id: crypto.randomUUID(),
            userId,
            orgId,
            feature,
            granted: true,
            deletedAt: null,
            createdAt: now,
            updatedAt: now,
            _synced: false,
            _deleted: false,
          }
          await dbPut('userFeatures', userRow, 'insert')
        }
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('chooseFeatures.intro')}</p>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="divide-y rounded-md border">
        {FEATURES.map((feature) => {
          const meta = FEATURE_METADATA[feature]
          return (
            <div key={feature} className="flex items-start justify-between gap-4 p-3">
              <div className="space-y-1">
                <Label htmlFor={`setup-${feature}`} className="text-sm font-medium">
                  {t(meta.labelKey, { ns: 'features' })}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t(meta.descriptionKey, { ns: 'features' })}
                </p>
              </div>
              <Switch
                id={`setup-${feature}`}
                checked={!!selected[feature]}
                onCheckedChange={(v) => setSelected((s) => ({ ...s, [feature]: v }))}
                disabled={working}
              />
            </div>
          )
        })}
      </div>

      <p className="text-xs text-muted-foreground">{t('chooseFeatures.changeLater')}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onDone}
          disabled={working}
        >
          {t('chooseFeatures.skip')}
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={() => void handleConfirm()}
          disabled={working}
        >
          {working ? t('chooseFeatures.saving') : t('chooseFeatures.confirm')}
        </Button>
      </div>
    </div>
  )
}

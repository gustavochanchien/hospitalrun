import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { FEATURES, FEATURE_METADATA, type Feature } from '@/lib/features'
import type { OrgFeature } from '@/lib/db/schema'

export function FeaturesCard() {
  const orgId = useAuthStore((s) => s.orgId)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'
  const { t } = useTranslation('features')

  const orgFeatures = useLiveQuery(
    () => (orgId ? db.orgFeatures.where('orgId').equals(orgId).toArray() : []),
    [orgId],
    [],
  )

  const enabledMap = new Map(
    (orgFeatures ?? []).filter((r) => !r._deleted).map((r) => [r.feature, r]),
  )

  async function handleToggle(feature: Feature, next: boolean) {
    if (!orgId || !isAdmin) return
    const existing = enabledMap.get(feature)
    const record: OrgFeature = existing
      ? { ...existing, enabled: next }
      : {
          id: crypto.randomUUID(),
          orgId,
          feature,
          enabled: next,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _synced: false,
          _deleted: false,
        }
    try {
      await dbPut('orgFeatures', record, existing ? 'update' : 'insert')
      toast.success(
        next ? t('toggle.enabled', { feature: t(FEATURE_METADATA[feature].labelKey) }) : t('toggle.disabled', { feature: t(FEATURE_METADATA[feature].labelKey) }),
      )
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('card.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isAdmin ? t('card.description') : t('card.descriptionNonAdmin')}
        </p>
        <div className="divide-y rounded-md border">
          {FEATURES.map((feature) => {
            const meta = FEATURE_METADATA[feature]
            const row = enabledMap.get(feature)
            const checked = !!row?.enabled
            return (
              <div
                key={feature}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="space-y-1">
                  <Label htmlFor={`feature-${feature}`} className="text-sm font-medium">
                    {t(meta.labelKey)}
                  </Label>
                  <p className="text-xs text-muted-foreground">{t(meta.descriptionKey)}</p>
                </div>
                <Switch
                  id={`feature-${feature}`}
                  checked={checked}
                  disabled={!isAdmin || !orgId}
                  onCheckedChange={(v) => void handleToggle(feature, v)}
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

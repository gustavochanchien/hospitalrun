import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { FEATURES, FEATURE_METADATA, type Feature } from '@/lib/features'
import type { UserFeature } from '@/lib/db/schema'

interface Props {
  userId: string
  isUserAdmin: boolean
  canEdit: boolean
}

export function UserFeaturesPopover({ userId, isUserAdmin, canEdit }: Props) {
  const orgId = useAuthStore((s) => s.orgId)
  const { t } = useTranslation('features')

  const orgFeatures = useLiveQuery(
    () => (orgId ? db.orgFeatures.where('orgId').equals(orgId).toArray() : []),
    [orgId],
    [],
  )
  const userGrants = useLiveQuery(
    () =>
      orgId
        ? db.userFeatures
            .where('[userId+orgId+feature]')
            .between([userId, orgId, ''], [userId, orgId, '￿'])
            .toArray()
        : [],
    [userId, orgId],
    [],
  )

  const orgEnabled = new Set(
    (orgFeatures ?? []).filter((r) => r.enabled && !r._deleted).map((r) => r.feature),
  )
  const grantedMap = new Map(
    (userGrants ?? []).filter((r) => !r._deleted).map((r) => [r.feature, r]),
  )
  const availableFeatures = FEATURES.filter((f) => orgEnabled.has(f))
  const grantedCount = isUserAdmin
    ? availableFeatures.length
    : availableFeatures.filter((f) => grantedMap.get(f)?.granted).length

  async function toggle(feature: Feature, next: boolean) {
    if (!orgId || !canEdit) return
    const existing = grantedMap.get(feature)
    const record: UserFeature = existing
      ? { ...existing, granted: next }
      : {
          id: crypto.randomUUID(),
          userId,
          orgId,
          feature,
          granted: next,
          deletedAt: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _synced: false,
          _deleted: false,
        }
    try {
      await dbPut('userFeatures', record, existing ? 'update' : 'insert')
    } catch (err) {
      toast.error(`${err instanceof Error ? err.message : String(err)}`)
    }
  }

  if (availableFeatures.length === 0) {
    return <span className="text-xs text-muted-foreground">{t('user.noneEnabled')}</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={!canEdit && !isUserAdmin}>
          {isUserAdmin ? (
            <Badge variant="secondary" className="text-xs">
              {t('user.adminAll')}
            </Badge>
          ) : (
            t('user.assigned', { count: grantedCount, total: availableFeatures.length })
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div>
          <p className="text-sm font-medium">{t('user.popoverTitle')}</p>
          <p className="text-xs text-muted-foreground">
            {isUserAdmin ? t('user.adminHint') : t('user.popoverHint')}
          </p>
        </div>
        <div className="space-y-2">
          {availableFeatures.map((feature) => {
            const checked = isUserAdmin || !!grantedMap.get(feature)?.granted
            return (
              <div key={feature} className="flex items-center justify-between gap-2">
                <Label
                  htmlFor={`uf-${userId}-${feature}`}
                  className="text-sm"
                >
                  {t(FEATURE_METADATA[feature].labelKey)}
                </Label>
                <Switch
                  id={`uf-${userId}-${feature}`}
                  checked={checked}
                  disabled={isUserAdmin || !canEdit}
                  onCheckedChange={(v) => void toggle(feature, v)}
                />
              </div>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

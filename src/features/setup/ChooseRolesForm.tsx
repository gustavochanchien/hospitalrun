import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { RoleEditor } from '@/features/settings/RoleEditor'
import type { OrgRole } from '@/lib/db/schema'

interface Props {
  onDone: () => void
}

/**
 * Setup-wizard step. Shows the six built-in roles that
 * `bootstrap_current_user` seeded for this org and lets the admin
 * customize permissions or add custom roles before inviting their team.
 *
 * Skip and Continue both advance — the defaults are already in place.
 * The same RoleEditor dialog used in Settings handles edits, so there's
 * one implementation across both surfaces.
 */
export function ChooseRolesForm({ onDone }: Props) {
  const { t } = useTranslation('setup')
  const orgId = useAuthStore((s) => s.orgId)
  const [editing, setEditing] = useState<OrgRole | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const roles = useLiveQuery(
    () =>
      orgId
        ? db.orgRoles
            .where('orgId')
            .equals(orgId)
            .filter((r) => !r._deleted)
            .toArray()
        : [],
    [orgId],
    [],
  )

  const sortedRoles = [...(roles ?? [])].sort((a, b) => {
    if (a.isLocked !== b.isLocked) return a.isLocked ? -1 : 1
    if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  function openEdit(target: OrgRole) {
    setEditing(target)
    setEditorOpen(true)
  }

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('chooseRoles.intro')}</p>

      <div className="divide-y rounded-md border">
        {sortedRoles.map((row) => (
          <div
            key={row.id}
            className="flex items-start justify-between gap-4 p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{row.label}</p>
                {row.isLocked && (
                  <Badge className="text-xs">{t('chooseRoles.locked')}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('chooseRoles.permissionCount', { count: row.permissions.length })}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openEdit(row)}
              disabled={row.isLocked}
            >
              {row.isLocked
                ? t('chooseRoles.view')
                : t('chooseRoles.customize')}
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={openCreate}
        className="w-full"
      >
        {t('chooseRoles.addCustom')}
      </Button>

      <p className="text-xs text-muted-foreground">
        {t('chooseRoles.changeLater')}
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={onDone}
        >
          {t('chooseRoles.skip')}
        </Button>
        <Button type="button" className="flex-1" onClick={onDone}>
          {t('chooseRoles.continue')}
        </Button>
      </div>

      <RoleEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
      />
    </div>
  )
}

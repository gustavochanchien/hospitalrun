import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { PERMISSIONS, type Permission } from '@/lib/permissions'
import type { OrgRole } from '@/lib/db/schema'
import {
  PERMISSION_GROUPS,
  defaultPermissionsForKey,
  saveRole,
  slugifyRoleKey,
} from './roles'

interface RoleEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: OrgRole | null
}

const PERMISSION_SET = new Set<string>(PERMISSIONS)

export function RoleEditor({ open, onOpenChange, editing }: RoleEditorProps) {
  const { t } = useTranslation('settings')
  const orgId = useAuthStore((s) => s.orgId)

  const existingRoles = useLiveQuery(
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

  const [label, setLabel] = useState('')
  const [selected, setSelected] = useState<Set<Permission>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form whenever the dialog opens or the editing target changes.
  useEffect(() => {
    if (!open) return
    setError(null)
    setLabel(editing?.label ?? '')
    const startingPerms = editing?.permissions ?? []
    setSelected(
      new Set(startingPerms.filter((p): p is Permission => PERMISSION_SET.has(p))),
    )
  }, [open, editing])

  const isLocked = !!editing?.isLocked
  const isEditing = !!editing
  const proposedKey = useMemo(() => slugifyRoleKey(label), [label])

  const keyCollision = useMemo(() => {
    if (isEditing) return false
    if (!proposedKey) return false
    return (existingRoles ?? []).some((r) => r.roleKey === proposedKey)
  }, [existingRoles, proposedKey, isEditing])

  function togglePermission(perm: Permission, on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(perm)
      else next.delete(perm)
      return next
    })
  }

  function toggleGroup(perms: Permission[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of perms) {
        if (on) next.add(p)
        else next.delete(p)
      }
      return next
    })
  }

  function resetToDefaults() {
    if (!editing) return
    setSelected(new Set(defaultPermissionsForKey(editing.roleKey)))
  }

  async function handleSave() {
    if (!orgId) return
    if (isLocked) {
      onOpenChange(false)
      return
    }
    const trimmed = label.trim()
    if (!trimmed) {
      setError(t('rolesCard.editor.labelRequired'))
      return
    }
    if (!isEditing) {
      if (!proposedKey) {
        setError(t('rolesCard.editor.labelInvalid'))
        return
      }
      if (keyCollision) {
        setError(t('rolesCard.editor.keyCollision', { key: proposedKey }))
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      await saveRole({
        orgId,
        existing: editing ?? undefined,
        draft: {
          label: trimmed,
          roleKey: editing?.roleKey ?? proposedKey,
          permissions: Array.from(selected),
        },
      })
      toast.success(
        isEditing ? t('rolesCard.editor.updated') : t('rolesCard.editor.created'),
      )
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('rolesCard.editor.editTitle', { label: editing!.label })
              : t('rolesCard.editor.createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isLocked
              ? t('rolesCard.editor.lockedDescription')
              : t('rolesCard.editor.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role-label">{t('rolesCard.editor.labelField')}</Label>
            <Input
              id="role-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={isLocked || submitting}
              placeholder={t('rolesCard.editor.labelPlaceholder')}
            />
            {!isEditing && proposedKey && (
              <p className="text-xs text-muted-foreground">
                {t('rolesCard.editor.keyPreview', { key: proposedKey })}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('rolesCard.editor.permissions')}</Label>
              {isEditing && editing!.isBuiltin && !isLocked && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetToDefaults}
                  disabled={submitting}
                >
                  {t('rolesCard.editor.resetToDefaults')}
                </Button>
              )}
            </div>
            <div className="divide-y rounded-md border">
              {PERMISSION_GROUPS.map((group) => {
                const allOn = group.permissions.every((p) => selected.has(p))
                const someOn = group.permissions.some((p) => selected.has(p))
                return (
                  <div key={group.groupKey} className="p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        id={`group-${group.groupKey}`}
                        checked={allOn ? true : someOn ? 'indeterminate' : false}
                        onCheckedChange={(v) => toggleGroup(group.permissions, v === true)}
                        disabled={isLocked || submitting}
                      />
                      <Label
                        htmlFor={`group-${group.groupKey}`}
                        className="text-sm font-semibold"
                      >
                        {t(`permissionGroups.${group.groupKey}`)}
                      </Label>
                    </div>
                    <div className="ml-6 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selected.has(perm)}
                            onCheckedChange={(v) => togglePermission(perm, v === true)}
                            disabled={isLocked || submitting}
                          />
                          <span>{t(`permissionLabels.${perm}`)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t('rolesCard.editor.cancel')}
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={submitting || isLocked}
          >
            {submitting
              ? t('rolesCard.editor.saving')
              : t('rolesCard.editor.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

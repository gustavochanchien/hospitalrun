import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { supabase } from '@/lib/supabase/client'
import type { OrgRole } from '@/lib/db/schema'
import { RoleEditor } from './RoleEditor'
import { countRoleAssignments, deleteRole } from './roles'

interface DeleteState {
  role: OrgRole
  holderCount: number
  reassignTo: string | null
}

export function RolesCard() {
  const { t } = useTranslation('settings')
  const orgId = useAuthStore((s) => s.orgId)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'

  const [editing, setEditing] = useState<OrgRole | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  if (!isAdmin) return null

  function openCreate() {
    setEditing(null)
    setEditorOpen(true)
  }

  function openEdit(target: OrgRole) {
    setEditing(target)
    setEditorOpen(true)
  }

  async function openDelete(target: OrgRole) {
    if (target.isLocked) return
    const { total } = await countRoleAssignments(target.orgId, target.roleKey)
    setDeleteState({ role: target, holderCount: total, reassignTo: null })
  }

  async function confirmDelete() {
    if (!deleteState) return
    setDeleting(true)
    try {
      const { role: target, holderCount, reassignTo } = deleteState

      if (holderCount > 0) {
        if (!reassignTo) {
          toast.error(t('rolesCard.delete.pickReassignTarget'))
          setDeleting(false)
          return
        }
        // Reassign profiles in Supabase. RLS allows admins to update
        // their own org's profiles. We update Supabase directly because
        // profiles isn't part of the local Dexie sync flow.
        const { error: profilesErr } = await supabase
          .from('profiles')
          .update({ role: reassignTo })
          .eq('org_id', target.orgId)
          .eq('role', target.roleKey)
        if (profilesErr) throw profilesErr

        // Also update pending invites in org_members.
        const { error: membersErr } = await supabase
          .from('org_members')
          .update({ role: reassignTo })
          .eq('org_id', target.orgId)
          .eq('role', target.roleKey)
        if (membersErr) throw membersErr
      }

      await deleteRole(target.id)
      toast.success(t('rolesCard.delete.deleted', { label: target.label }))
      setDeleteState(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setDeleting(false)
    }
  }

  const sortedRoles = [...(roles ?? [])].sort((a, b) => {
    // Lock admin to the top, then built-ins, then custom alphabetical.
    if (a.isLocked !== b.isLocked) return a.isLocked ? -1 : 1
    if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  const otherRoles = deleteState
    ? sortedRoles.filter((r) => r.roleKey !== deleteState.role.roleKey)
    : []

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{t('rolesCard.title')}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('rolesCard.description')}
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          {t('rolesCard.newRole')}
        </Button>
      </CardHeader>
      <CardContent>
        {sortedRoles.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            {t('rolesCard.empty')}
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('rolesCard.columns.label')}</TableHead>
                  <TableHead>{t('rolesCard.columns.type')}</TableHead>
                  <TableHead className="text-right">
                    {t('rolesCard.columns.permissions')}
                  </TableHead>
                  <TableHead className="w-[180px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRoles.map((row) => {
                  const editBtn = (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(row)}
                      disabled={row.isLocked}
                    >
                      {row.isLocked
                        ? t('rolesCard.actions.view')
                        : t('rolesCard.actions.edit')}
                    </Button>
                  )
                  const deleteBtn = (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void openDelete(row)}
                      disabled={row.isLocked}
                    >
                      {t('rolesCard.actions.delete')}
                    </Button>
                  )
                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{row.label}</p>
                          {!row.isBuiltin && (
                            <p className="font-mono text-xs text-muted-foreground">
                              {row.roleKey}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.isLocked ? (
                          <Badge>{t('rolesCard.badges.locked')}</Badge>
                        ) : row.isBuiltin ? (
                          <Badge variant="secondary">{t('rolesCard.badges.builtin')}</Badge>
                        ) : (
                          <Badge variant="outline">{t('rolesCard.badges.custom')}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.permissions.length}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {row.isLocked ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{editBtn}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t('rolesCard.lockedTooltip')}
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>{deleteBtn}</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t('rolesCard.lockedTooltip')}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <>
                              {editBtn}
                              {deleteBtn}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <RoleEditor
        open={editorOpen}
        onOpenChange={(o) => {
          setEditorOpen(o)
          if (!o) setEditing(null)
        }}
        editing={editing}
      />

      <AlertDialog
        open={deleteState !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteState(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('rolesCard.delete.title', { label: deleteState?.role.label ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteState && deleteState.holderCount > 0
                ? t('rolesCard.delete.reassignDescription', {
                    count: deleteState.holderCount,
                  })
                : t('rolesCard.delete.simpleDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteState && deleteState.holderCount > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {t('rolesCard.delete.reassignTo')}
              </label>
              <Select
                value={deleteState.reassignTo ?? ''}
                onValueChange={(v) =>
                  setDeleteState((s) => (s ? { ...s, reassignTo: v } : s))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('rolesCard.delete.reassignPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {otherRoles.map((r) => (
                    <SelectItem key={r.roleKey} value={r.roleKey}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t('rolesCard.delete.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting
                ? t('rolesCard.delete.deleting')
                : t('rolesCard.delete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useLiveQuery } from 'dexie-react-hooks'
import { supabase, isHubLocalMode } from '@/lib/supabase/client'
import { useAuthStore } from '@/features/auth/auth.store'
import { db } from '@/lib/db'
import { isDesktop, getIPC } from '@/lib/desktop/env'

type Role = string

interface RoleOption {
  roleKey: string
  label: string
}

function useOrgRoleOptions(): RoleOption[] {
  const orgId = useAuthStore((s) => s.orgId)
  const rows = useLiveQuery(
    () =>
      orgId
        ? db.orgRoles
            .where('orgId')
            .equals(orgId)
            .filter((r) => !r._deleted)
            .toArray()
            .then((rs) =>
              rs.map((r) => ({ roleKey: r.roleKey, label: r.label })),
            )
        : [],
    [orgId],
    [],
  )
  return rows ?? []
}

interface PendingInvite {
  id: string
  invited_email: string
  role: Role
  invited_at: string
  accepted_at: string | null
}

interface InviteResponse {
  ok?: boolean
  error?: string
  mode?: 'invite' | 'create'
  userId?: string
  email?: string
  detail?: string
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function TeamCard() {
  const { t } = useTranslation('settings')
  const orgId = useAuthStore((s) => s.orgId)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'
  const [isHubMode, setIsHubMode] = useState(false)

  useEffect(() => {
    if (!isDesktop()) return
    void getIPC().getRunMode().then((m) => setIsHubMode(m === 'hub'))
  }, [])

  const [invites, setInvites] = useState<PendingInvite[] | null>(null)

  async function refreshInvites() {
    if (!orgId || isHubLocalMode()) {
      setInvites([])
      return
    }
    const { data, error } = await supabase
      .from('org_members')
      .select('id, invited_email, role, invited_at, accepted_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .order('invited_at', { ascending: false })
    if (error) {
      toast.error(t('team.loadError', { error: error.message }))
      setInvites([])
      return
    }
    setInvites((data ?? []) as PendingInvite[])
  }

  useEffect(() => {
    if (!orgId || !isAdmin) {
      setInvites([])
      return
    }
    void refreshInvites()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, isAdmin])

  async function revokeInvite(id: string, inviteEmail: string) {
    if (isHubLocalMode()) return
    const { error } = await supabase.from('org_members').delete().eq('id', id)
    if (error) {
      toast.error(t('team.revokeError', { error: error.message }))
      return
    }
    toast.success(t('team.revokeSuccess', { email: inviteEmail }))
    setInvites((prev) => prev?.filter((i) => i.id !== id) ?? null)
  }

  if (!isAdmin) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('team.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create">{t('team.tabCreate')}</TabsTrigger>
            {isHubMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TabsTrigger value="invite" disabled>
                      {t('team.tabInvite')}
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {t('team.inviteDisabledTooltip')}
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="invite">{t('team.tabInvite')}</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="create" className="pt-4">
            <CreateUserForm onCreated={refreshInvites} />
          </TabsContent>
          <TabsContent value="invite" className="pt-4">
            <InviteByEmailForm onInvited={refreshInvites} />
          </TabsContent>
        </Tabs>

        <div>
          <h3 className="mb-2 text-sm font-medium">{t('team.pendingTitle')}</h3>
          {invites === null ? (
            <Skeleton className="h-10 w-full" />
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('team.noPending')}</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('team.colEmail')}</TableHead>
                    <TableHead>{t('team.colRole')}</TableHead>
                    <TableHead>{t('team.colInvited')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.invited_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{invite.role}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invite.invited_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            revokeInvite(invite.id, invite.invited_email)
                          }
                        >
                          {t('team.revoke')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useTranslation('settings')
  const getAccessToken = useAuthStore((s) => s.getAccessToken)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const [working, setWorking] = useState(false)
  const [handoff, setHandoff] = useState<{ email: string; password: string } | null>(null)
  const roleOptions = useOrgRoleOptions()

  async function handleCreate() {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      toast.error(t('team.errFullName'))
      return
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      toast.error(t('team.errEmail'))
      return
    }
    if (password.length < 8) {
      toast.error(t('team.errPassword'))
      return
    }
    setWorking(true)
    try {
      if (isHubLocalMode()) {
        const token = getAccessToken()
        const res = await fetch('/auth/local/user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ email: trimmedEmail, password, role: newRole, fullName: trimmedName }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          toast.error(t('team.errCreate', { error: data.error ?? 'Unknown error' }))
          return
        }
      } else {
        const { data, error } = await supabase.functions.invoke<InviteResponse>(
          'invite-member',
          {
            body: {
              mode: 'create',
              email: trimmedEmail,
              role: newRole,
              password,
              fullName: trimmedName,
            },
          },
        )
        const payload = data ?? null
        if (error || payload?.error) {
          const msg = payload?.error ?? error?.message ?? 'Failed'
          toast.error(t('team.errCreate', { error: msg }))
          return
        }
      }
      toast.success(t('team.createSuccess', { email: trimmedEmail }))
      setHandoff({ email: trimmedEmail, password })
      setFullName('')
      setEmail('')
      setPassword('')
      setNewRole('user')
      await onCreated()
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('team.createHelp')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-name">{t('team.fullName')}</Label>
          <Input
            id="create-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-email">{t('team.emailLabel')}</Label>
          <Input
            id="create-email"
            type="email"
            placeholder={t('team.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-password">{t('team.passwordLabel')}</Label>
          <Input
            id="create-password"
            type="text"
            placeholder={t('team.passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-role">{t('team.roleLabel')}</Label>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger id="create-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r.roleKey} value={r.roleKey}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleCreate} disabled={working}>
        {working ? t('team.creating') : t('team.createButton')}
      </Button>

      {handoff && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-medium">{t('team.shareCreds')}</div>
          <div>
            <span className="text-muted-foreground">{t('team.emailLabel')}: </span>
            <code>{handoff.email}</code>
          </div>
          <div>
            <span className="text-muted-foreground">{t('team.passwordField')}: </span>
            <code>{handoff.password}</code>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('team.shareWarning')}
          </p>
        </div>
      )}
    </div>
  )
}

function InviteByEmailForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const { t } = useTranslation('settings')
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('user')
  const [sending, setSending] = useState(false)
  const roleOptions = useOrgRoleOptions()

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error(t('team.errEmail'))
      return
    }
    setSending(true)
    try {
      const { data, error } = await supabase.functions.invoke<InviteResponse>(
        'invite-member',
        {
          body: { mode: 'invite', email: trimmed, role: inviteRole },
        },
      )
      const payload = data ?? null
      if (error || payload?.error) {
        const msg = payload?.error ?? error?.message ?? 'Failed'
        toast.error(t('team.inviteError', { error: msg }))
        return
      }
      toast.success(t('team.inviteSuccess', { email: trimmed }))
      setEmail('')
      await onInvited()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t('team.inviteHelp')}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label htmlFor="invite-email">{t('team.inviteEmailLabel')}</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder={t('team.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
          />
        </div>
        <div className="w-[140px] space-y-2">
          <Label htmlFor="invite-role">{t('team.roleLabel')}</Label>
          <Select value={inviteRole} onValueChange={setInviteRole}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roleOptions.map((r) => (
                <SelectItem key={r.roleKey} value={r.roleKey}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInvite} disabled={sending || !email.trim()}>
          {sending ? t('team.sending') : t('team.sendInvite')}
        </Button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
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
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/features/auth/auth.store'
import { isDesktop, getIPC } from '@/lib/desktop/env'

type Role = 'admin' | 'doctor' | 'nurse' | 'user'

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
    if (!orgId) return
    const { data, error } = await supabase
      .from('org_members')
      .select('id, invited_email, role, invited_at, accepted_at')
      .eq('org_id', orgId)
      .is('accepted_at', null)
      .order('invited_at', { ascending: false })
    if (error) {
      toast.error(`Couldn't load invites: ${error.message}`)
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
    const { error } = await supabase.from('org_members').delete().eq('id', id)
    if (error) {
      toast.error(`Couldn't revoke: ${error.message}`)
      return
    }
    toast.success(`Revoked invite for ${inviteEmail}`)
    setInvites((prev) => prev?.filter((i) => i.id !== id) ?? null)
  }

  if (!isAdmin) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Team Members</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="create">
          <TabsList>
            <TabsTrigger value="create">Create user</TabsTrigger>
            {isHubMode ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <TabsTrigger value="invite" disabled>
                      Invite by email
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Requires SMTP — not available in offline hub mode. Use "Create user" instead.
                </TooltipContent>
              </Tooltip>
            ) : (
              <TabsTrigger value="invite">Invite by email</TabsTrigger>
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
          <h3 className="mb-2 text-sm font-medium">Pending invitations</h3>
          {invites === null ? (
            <Skeleton className="h-10 w-full" />
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending invites.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Invited</TableHead>
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
                          Revoke
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
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newRole, setNewRole] = useState<Role>('user')
  const [working, setWorking] = useState(false)
  const [handoff, setHandoff] = useState<{ email: string; password: string } | null>(null)

  async function handleCreate() {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()
    if (!trimmedName) {
      toast.error('Enter the user\'s full name')
      return
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      toast.error('Enter a valid email')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setWorking(true)
    try {
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
        toast.error(`Create failed: ${msg}`)
        return
      }
      toast.success(`Created ${trimmedEmail}`)
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
      <p className="text-xs text-muted-foreground">
        Create a user account directly — no email required. Share the password
        with them in person or over a secure channel.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="create-name">Full name</Label>
          <Input
            id="create-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-email">Email</Label>
          <Input
            id="create-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-password">Initial password</Label>
          <Input
            id="create-password"
            type="text"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={working}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-role">Role</Label>
          <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
            <SelectTrigger id="create-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
              <SelectItem value="nurse">Nurse</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={handleCreate} disabled={working}>
        {working ? 'Creating…' : 'Create User'}
      </Button>

      {handoff && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-medium">Share these credentials:</div>
          <div>
            <span className="text-muted-foreground">Email: </span>
            <code>{handoff.email}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Password: </span>
            <code>{handoff.password}</code>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This is the only time the password will be shown. Ask the user to
            change it after first login.
          </p>
        </div>
      )}
    </div>
  )
}

function InviteByEmailForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<Role>('user')
  const [sending, setSending] = useState(false)

  async function handleInvite() {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !isValidEmail(trimmed)) {
      toast.error('Enter a valid email')
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
        toast.error(`Invite failed: ${msg}`)
        return
      }
      toast.success(`Invited ${trimmed}`)
      setEmail('')
      await onInvited()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Sends a signup link to the user&apos;s email. Requires SMTP to be
        configured on the server.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[220px] space-y-2">
          <Label htmlFor="invite-email">Email address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
          />
        </div>
        <div className="w-[140px] space-y-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select
            value={inviteRole}
            onValueChange={(v) => setInviteRole(v as Role)}
          >
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="doctor">Doctor</SelectItem>
              <SelectItem value="nurse">Nurse</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleInvite} disabled={sending || !email.trim()}>
          {sending ? 'Sending…' : 'Send Invite'}
        </Button>
      </div>
    </div>
  )
}

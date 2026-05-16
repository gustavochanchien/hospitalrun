import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import { supabase } from '@/lib/supabase/client'
import { ThemeCard } from './ThemeCard'
import { TeamCard } from './TeamCard'
import { SwitchServerCard } from './SwitchServerCard'
import { HubCard } from './HubCard'
import { CloudBackupCard } from './CloudBackupCard'
import { FeaturesCard } from './FeaturesCard'
import { UserFeaturesPopover } from './UserFeaturesPopover'
import { seedFakeData } from '@/lib/demo/seed-org'
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/lib/i18n'
import { useLanguageStore } from './language.store'

export function SettingsPage() {
  const orgId = useAuthStore((s) => s.orgId)
  const role = useAuthStore((s) => s.role)
  const isAdmin = role === 'admin'

  const profiles = useLiveQuery(
    () =>
      orgId
        ? db.table('profiles').where('orgId').equals(orgId).toArray()
        : [],
    [orgId],
  )

  return (
    <div className="space-y-6 p-6">
      <OrgSettingsCard orgId={orgId} isAdmin={isAdmin} />
      <FeaturesCard />
      <LanguageCard />
      <ThemeCard />
      <UserListCard profiles={profiles} isAdmin={isAdmin} />
      <TeamCard />
      <AccountDiagnosticsCard />
      <HubCard />
      <CloudBackupCard />
      <SwitchServerCard />
      <SeedDataCard orgId={orgId} />
    </div>
  )
}

function AccountDiagnosticsCard() {
  const user = useAuthStore((s) => s.user)
  const orgId = useAuthStore((s) => s.orgId)
  const role = useAuthStore((s) => s.role)
  const [bootstrapping, setBootstrapping] = useState(false)

  const loadProfile = useAuthStore((s) => s.loadProfile)

  async function bootstrapAccount() {
    if (!user) return
    setBootstrapping(true)
    try {
      await loadProfile()
      toast.success('Profile reloaded.')
    } catch (err) {
      toast.error(
        `Repair failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setBootstrapping(false)
    }
  }

  async function refreshSession() {
    const { error } = await supabase.auth.refreshSession()
    if (error) {
      toast.error(`Refresh failed: ${error.message}`)
    } else {
      toast.success('Session refreshed')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <span className="text-muted-foreground">User ID: </span>
          <code>{user?.id ?? '(none)'}</code>
        </div>
        <div>
          <span className="text-muted-foreground">Email: </span>
          <code>{user?.email ?? '(none)'}</code>
        </div>
        <div>
          <span className="text-muted-foreground">Org ID: </span>
          <code>{orgId ?? '(missing!)'}</code>
        </div>
        <div>
          <span className="text-muted-foreground">Role: </span>
          <code>{role ?? '(missing!)'}</code>
        </div>
        {!orgId && (
          <p className="text-destructive">
            No org profile loaded. This normally resolves automatically after
            sign-in. If it didn't, click Reload Profile.
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button size="sm" onClick={bootstrapAccount} disabled={bootstrapping || !user}>
            {bootstrapping ? 'Working…' : 'Reload Profile'}
          </Button>
          <Button size="sm" variant="outline" onClick={refreshSession}>
            Refresh Session
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function SeedDataCard({ orgId }: { orgId: string | null }) {
  const [count, setCount] = useState('20')
  const [loading, setLoading] = useState(false)

  async function handleSeed() {
    if (!orgId) {
      toast.error('No org_id in your session — bootstrap your account first.')
      return
    }
    const patients = Number.parseInt(count, 10)
    if (!Number.isFinite(patients) || patients < 1 || patients > 500) {
      toast.error('Enter a patient count between 1 and 500')
      return
    }
    setLoading(true)
    try {
      const result = await seedFakeData(orgId, { patients })
      toast.success(
        `Seeded ${result.patients} patients, ${result.appointments} appointments, ` +
          `${result.labs} labs, ${result.medications} meds, ${result.incidents} incidents`,
      )
    } catch (err) {
      toast.error(`Seed failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo / Fake Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Generate fake patients with appointments, diagnoses, labs, medications, imaging,
          notes, and incidents. Data writes to Dexie and syncs to Supabase for the current
          org.
        </p>
        <div className="flex items-end gap-2">
          <div className="max-w-[140px] space-y-2">
            <Label htmlFor="seed-count">Patient count</Label>
            <Input
              id="seed-count"
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <Button onClick={handleSeed} disabled={loading || !orgId}>
            {loading ? 'Seeding…' : 'Seed Fake Data'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function LanguageCard() {
  const language = useLanguageStore((s) => s.language)
  const setLanguage = useLanguageStore((s) => s.setLanguage)
  const { t } = useTranslation('settings')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('language.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs space-y-2">
          <Label htmlFor="language-select">{t('language.displayLanguage')}</Label>
          <Select
            value={language}
            onValueChange={(lang) => setLanguage(lang as LanguageCode)}
          >
            <SelectTrigger id="language-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('language.help')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function OrgSettingsCard({
  orgId,
  isAdmin,
}: {
  orgId: string | null
  isAdmin: boolean
}) {
  const [org, setOrg] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [loading, setLoading] = useState(!!orgId)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    void supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('id', orgId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          toast.error(`Couldn't load org: ${error.message}`)
          setOrg(null)
        } else {
          setOrg(data)
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orgId])

  async function saveOrg() {
    if (!org || !name.trim()) return
    setSaving(true)
    const trimmed = name.trim()
    const { error } = await supabase
      .from('organizations')
      .update({ name: trimmed })
      .eq('id', org.id)
    setSaving(false)
    if (error) {
      toast.error(`Failed to update org: ${error.message}`)
      return
    }
    setOrg({ ...org, name: trimmed })
    // Mirror to Dexie so other surfaces (sidebar, etc) pick it up.
    void db.table('organizations').update(org.id, { name: trimmed })
    setEditing(false)
    toast.success('Organization name updated')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-64" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {org ? (
          <>
            <div className="space-y-2">
              <Label>Organization Name</Label>
              {editing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="max-w-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={saveOrg} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm">{org.name}</p>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setName(org.name)
                        setEditing(true)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              )}
              {!isAdmin && (
                <p className="text-xs text-muted-foreground">
                  Only admins can rename the organization.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Organization ID</Label>
              <p className="text-xs text-muted-foreground font-mono">{org.id}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No organization loaded. Try Reload Profile in Account Diagnostics
            below.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function UserListCard({
  profiles,
  isAdmin,
}: {
  profiles:
    | { id: string; fullName: string; role: string; createdAt: string }[]
    | undefined
  isAdmin: boolean
}) {
  const currentUserId = useAuthStore((s) => s.user?.id)

  if (profiles === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team members found.
          </p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Features</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => (
                  <UserRow
                    key={profile.id}
                    profile={profile}
                    isAdmin={isAdmin}
                    isCurrentUser={profile.id === currentUserId}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function UserRow({
  profile,
  isAdmin,
  isCurrentUser,
}: {
  profile: { id: string; fullName: string; role: string }
  isAdmin: boolean
  isCurrentUser: boolean
}) {
  const [newRole, setNewRole] = useState(profile.role)
  const [disabled, setDisabled] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleRoleChange() {
    if (newRole === profile.role) return
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profile.id)
    if (error) {
      toast.error('Failed to update role')
    } else {
      toast.success(`Updated ${profile.fullName}'s role to ${newRole}`)
    }
  }

  async function handleToggle(ban: boolean) {
    setToggling(true)
    try {
      const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
        'invite-member',
        { body: { mode: ban ? 'disable' : 'enable', userId: profile.id } },
      )
      if (error || data?.error) {
        toast.error(ban ? 'Failed to disable user' : 'Failed to re-enable user')
      } else {
        setDisabled(ban)
        toast.success(ban ? `Disabled ${profile.fullName} — they can no longer sign in` : `Re-enabled ${profile.fullName}`)
      }
    } finally {
      setToggling(false)
    }
  }

  const roleBadgeVariant =
    profile.role === 'admin'
      ? 'default'
      : profile.role === 'doctor'
        ? 'secondary'
        : 'outline'

  return (
    <TableRow className={disabled ? 'opacity-50' : ''}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-medium">{profile.fullName}</span>
          {isCurrentUser && (
            <Badge variant="outline" className="text-xs">
              You
            </Badge>
          )}
          {disabled && (
            <Badge variant="destructive" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {isAdmin && !isCurrentUser ? (
          <div className="flex items-center gap-2">
            <Select value={newRole} onValueChange={setNewRole} disabled={disabled}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="doctor">Doctor</SelectItem>
                <SelectItem value="nurse">Nurse</SelectItem>
                <SelectItem value="user">User</SelectItem>
              </SelectContent>
            </Select>
            {newRole !== profile.role && !disabled && (
              <Button size="sm" onClick={handleRoleChange}>
                Save
              </Button>
            )}
          </div>
        ) : (
          <Badge variant={roleBadgeVariant}>{profile.role}</Badge>
        )}
      </TableCell>
      <TableCell>
        <UserFeaturesPopover
          userId={profile.id}
          isUserAdmin={profile.role === 'admin'}
          canEdit={isAdmin && !isCurrentUser && !disabled}
        />
      </TableCell>
      <TableCell>
        {isAdmin && !isCurrentUser && (
          disabled ? (
            <Button
              size="sm"
              variant="outline"
              disabled={toggling}
              onClick={() => void handleToggle(false)}
            >
              Re-enable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              disabled={toggling}
              onClick={() => void handleToggle(true)}
            >
              Disable
            </Button>
          )
        )}
      </TableCell>
    </TableRow>
  )
}

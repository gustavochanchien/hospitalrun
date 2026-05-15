import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  TestTubes,
  Pill,
  ScanLine,
  AlertTriangle,
  Settings,
  HeartPulse,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/auth.store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronUp } from 'lucide-react'

const navItems = [
  { key: 'dashboard', to: '/' as const, icon: LayoutDashboard },
  { key: 'patients', to: '/patients' as const, icon: Users },
  { key: 'appointments', to: '/appointments' as const, icon: CalendarDays },
  { key: 'labs', to: '/labs' as const, icon: TestTubes },
  { key: 'medications', to: '/medications' as const, icon: Pill },
  { key: 'imaging', to: '/imaging' as const, icon: ScanLine },
  { key: 'incidents', to: '/incidents' as const, icon: AlertTriangle },
  { key: 'settings', to: '/settings' as const, icon: Settings },
] as const

export function AppSidebar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()
  const { t } = useTranslation('common')

  const initials = user?.email
    ? user.email
        .split('@')[0]
        .split('.')
        .map((p) => p[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2)
    : '?'

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <HeartPulse className="size-5 text-primary" />
          <span className="text-lg font-bold tracking-tight">HospitalRun</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('layout.navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = matchRoute({ to: item.to, fuzzy: true })
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={!!isActive}>
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{t(`nav.${item.key}`)}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{user?.email ?? t('layout.user')}</span>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuItem
                  onClick={async () => {
                    await signOut()
                    await navigate({ to: '/login' })
                  }}
                >
                  {t('layout.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

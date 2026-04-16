import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
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
  { label: 'Dashboard', to: '/' as const, icon: LayoutDashboard },
  { label: 'Patients', to: '/patients' as const, icon: Users },
  { label: 'Appointments', to: '/appointments' as const, icon: CalendarDays },
  { label: 'Labs', to: '/labs' as const, icon: TestTubes },
  { label: 'Medications', to: '/medications' as const, icon: Pill },
  { label: 'Imaging', to: '/imaging' as const, icon: ScanLine },
  { label: 'Incidents', to: '/incidents' as const, icon: AlertTriangle },
  { label: 'Settings', to: '/settings' as const, icon: Settings },
]

export function AppSidebar() {
  const { user, signOut } = useAuthStore()
  const navigate = useNavigate()
  const matchRoute = useMatchRoute()

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
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = matchRoute({ to: item.to, fuzzy: true })
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={!!isActive}>
                      <Link to={item.to}>
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
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
                  <span className="truncate text-sm">{user?.email ?? 'User'}</span>
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
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

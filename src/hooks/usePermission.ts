import { useAuthStore } from '@/features/auth/auth.store'
import { hasPermission, type Permission } from '@/lib/permissions'

export function usePermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.role)
  return hasPermission(role, permission)
}

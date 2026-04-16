import type { ReactNode } from 'react'
import { usePermission } from '@/hooks/usePermission'
import type { Permission } from '@/lib/permissions'

interface PermissionGuardProps {
  permission: Permission
  fallback?: ReactNode
  children: ReactNode
}

export function PermissionGuard({
  permission,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const allowed = usePermission(permission)
  return allowed ? <>{children}</> : <>{fallback}</>
}

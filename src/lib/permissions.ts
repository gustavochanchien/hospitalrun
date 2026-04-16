export const PERMISSIONS = [
  'read:patients',
  'write:patients',
  'read:appointments',
  'write:appointments',
  'delete:appointment',
  'write:allergy',
  'write:diagnosis',
  'read:labs',
  'write:labs',
  'complete:lab',
  'cancel:lab',
  'read:medications',
  'write:medications',
  'complete:medication',
  'cancel:medication',
  'read:imaging',
  'write:imaging',
  'read:incidents',
  'write:incident',
  'resolve:incident',
  'read:incident_widgets',
  'write:care_plan',
  'read:care_plan',
  'write:care_goal',
  'read:care_goal',
  'write:visit',
  'read:visit',
  'write:note',
  'write:related_person',
  'read:settings',
  'write:settings',
] as const

export type Permission = (typeof PERMISSIONS)[number]

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS]

const CLINICAL_PERMISSIONS: Permission[] = [
  'read:patients',
  'write:patients',
  'read:appointments',
  'write:appointments',
  'delete:appointment',
  'write:allergy',
  'write:diagnosis',
  'read:labs',
  'write:labs',
  'complete:lab',
  'cancel:lab',
  'read:medications',
  'write:medications',
  'complete:medication',
  'cancel:medication',
  'read:imaging',
  'write:imaging',
  'read:incidents',
  'write:incident',
  'resolve:incident',
  'read:incident_widgets',
  'write:care_plan',
  'read:care_plan',
  'write:care_goal',
  'read:care_goal',
  'write:visit',
  'read:visit',
  'write:note',
  'write:related_person',
]

const READ_PERMISSIONS: Permission[] = [
  'read:patients',
  'read:appointments',
  'read:labs',
  'read:medications',
  'read:imaging',
  'read:incidents',
  'read:care_plan',
  'read:care_goal',
  'read:visit',
]

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: ALL_PERMISSIONS,
  doctor: CLINICAL_PERMISSIONS,
  nurse: CLINICAL_PERMISSIONS,
  user: READ_PERMISSIONS,
}

export function hasPermission(
  role: string | null,
  permission: Permission,
): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  if (!perms) return false
  return perms.includes(permission)
}

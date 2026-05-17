import { z } from 'zod'
import { ACCESS_ACTIONS, ACCESS_RESOURCE_TYPES } from '@/lib/db/schema'

/**
 * Zod schema for a raw Supabase access_logs row (snake_case). The
 * admin viewer queries Supabase directly, so this validates the wire
 * shape before it's reshaped into the AccessLog camelCase form.
 */
export const accessLogRowSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  user_email: z.string().nullable(),
  user_role: z.string(),
  action: z.enum(ACCESS_ACTIONS),
  resource_type: z.enum(ACCESS_RESOURCE_TYPES),
  resource_id: z.string().uuid().nullable(),
  patient_id: z.string().uuid().nullable(),
  context: z.record(z.string(), z.unknown()).nullable(),
  client_id: z.string().nullable(),
  occurred_at: z.string(),
  created_at: z.string(),
})

export type AccessLogRow = z.infer<typeof accessLogRowSchema>

import { z } from 'zod/v4'

export const setupSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Server URL is required')
    .refine(
      (v) => {
        try {
          const u = new URL(v)
          return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'Must be a valid http(s) URL' },
    ),
  anonKey: z.string().trim().min(20, 'Anon key looks too short'),
})

export type SetupFormData = z.infer<typeof setupSchema>

export function normalizeUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

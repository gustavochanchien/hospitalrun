/**
 * Admin-only query hook that reads access_logs directly from Supabase.
 *
 * This is the one documented exception to the "reads always come from
 * Dexie" rule (CLAUDE.md). access_logs is excluded from hydrate and
 * realtime — admins query Supabase directly because the table is high
 * volume and admin-scoped. RLS enforces admin-only SELECT.
 */
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { fromSupabaseRow } from '@/lib/db/columns'
import type { AccessAction, AccessLog, AccessResourceType } from '@/lib/db/schema'
import { accessLogRowSchema } from './access-log-schema'

export interface AccessLogFilters {
  search: string
  userId: string | null
  action: AccessAction | null
  resourceType: AccessResourceType | null
  from: string | null
  to: string | null
}

export const DEFAULT_FILTERS: AccessLogFilters = {
  search: '',
  userId: null,
  action: null,
  resourceType: null,
  from: null,
  to: null,
}

export const PAGE_SIZE = 50

interface UseAccessLogsResult {
  rows: AccessLog[]
  total: number | null
  isLoading: boolean
  error: string | null
}

export function useAccessLogs(
  filters: AccessLogFilters,
  page: number,
): UseAccessLogsResult {
  const [rows, setRows] = useState<AccessLog[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        let query = supabase
          .from('access_logs')
          .select('*', { count: 'exact' })
          .order('occurred_at', { ascending: false })

        if (filters.userId) query = query.eq('user_id', filters.userId)
        if (filters.action) query = query.eq('action', filters.action)
        if (filters.resourceType) query = query.eq('resource_type', filters.resourceType)
        if (filters.from) query = query.gte('occurred_at', filters.from)
        if (filters.to) query = query.lte('occurred_at', filters.to)
        if (filters.search.trim()) {
          const q = filters.search.trim()
          // Match on the user email or the patient_id text — full PHI
          // search would require joining; admins can refine by user
          // dropdown for now.
          query = query.ilike('user_email', `%${q}%`)
        }

        const offset = page * PAGE_SIZE
        const { data, error: qErr, count } = await query.range(
          offset,
          offset + PAGE_SIZE - 1,
        )
        if (qErr) throw qErr

        const parsed: AccessLog[] = []
        for (const raw of data ?? []) {
          const ok = accessLogRowSchema.safeParse(raw)
          if (!ok.success) continue
          parsed.push(
            fromSupabaseRow('accessLogs', ok.data as Record<string, unknown>) as unknown as AccessLog,
          )
        }
        if (!cancelled) {
          setRows(parsed)
          setTotal(count ?? null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setRows([])
          setTotal(null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    filters.search,
    filters.userId,
    filters.action,
    filters.resourceType,
    filters.from,
    filters.to,
    page,
  ])

  return { rows, total, isLoading, error }
}

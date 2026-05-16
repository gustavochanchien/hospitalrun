import { getSupabase, isHubLocalMode } from '@/lib/supabase/client'

const STORAGE_KEY = 'hr_org_name_cache_v1'

interface Cache {
  orgId: string
  name: string
}

function readCache(): Cache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Cache>
    if (typeof parsed.orgId !== 'string' || typeof parsed.name !== 'string') return null
    return { orgId: parsed.orgId, name: parsed.name }
  } catch {
    return null
  }
}

function writeCache(value: Cache): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // ignore — quota or disabled storage; the PDF will fall back to the i18n default.
  }
}

/**
 * Resolve the current org's display name for PDF headers. Tries the
 * localStorage cache first so the click → download path stays
 * synchronous-feeling, then refreshes from Supabase in the background.
 * Returns an empty string when no source is reachable; the PDF
 * components fall back to a localized brand name.
 */
export async function resolveOrgName(orgId: string | null): Promise<string> {
  if (!orgId) return ''
  const cached = readCache()
  if (cached?.orgId === orgId) {
    // Best-effort refresh, but don't await — return the cached value now.
    void refreshOrgName(orgId)
    return cached.name
  }
  return refreshOrgName(orgId)
}

async function refreshOrgName(orgId: string): Promise<string> {
  if (isHubLocalMode()) {
    // In local-hub mode there is no Supabase org row to read from the
    // client. Cache whatever we already had; HubSetup writes the name
    // server-side and the cloud-backed path will refresh later.
    return readCache()?.name ?? ''
  }
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .maybeSingle()
    if (error || !data?.name) return readCache()?.name ?? ''
    writeCache({ orgId, name: data.name })
    return data.name
  } catch {
    return readCache()?.name ?? ''
  }
}

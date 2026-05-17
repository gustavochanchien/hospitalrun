import { normalizeDrugName } from './normalize'

const CACHE_KEY_PREFIX = 'hr_openfda_label_'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface CacheEntry {
  text: string | null
  cachedAt: number
}

interface OpenFdaLabelResult {
  drug_interactions?: string[]
}

interface OpenFdaResponse {
  results?: OpenFdaLabelResult[]
}

function readCache(key: string): string | null | undefined {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return undefined
    const entry: CacheEntry = JSON.parse(raw)
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      localStorage.removeItem(key)
      return undefined
    }
    return entry.text
  } catch {
    return undefined
  }
}

function writeCache(key: string, text: string | null): void {
  try {
    const entry: CacheEntry = { text, cachedAt: Date.now() }
    localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // localStorage full — silently ignore
  }
}

/**
 * Fetches the drug interaction text from the FDA drug label API.
 * Returns the first paragraph of the "drug_interactions" section, or null if
 * the drug is not found, the request fails, or the caller is offline.
 * Results are cached in localStorage for 7 days.
 */
export async function fetchOpenFdaInteractionText(drugName: string): Promise<string | null> {
  const normalized = normalizeDrugName(drugName)
  const cacheKey = `${CACHE_KEY_PREFIX}${normalized}`

  const cached = readCache(cacheKey)
  if (cached !== undefined) return cached

  try {
    const url = `https://api.fda.gov/drug/label.json?search=openfda.generic_name:"${encodeURIComponent(normalized)}"&limit=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) {
      writeCache(cacheKey, null)
      return null
    }

    const data: OpenFdaResponse = await res.json()
    const text = data.results?.[0]?.drug_interactions?.[0] ?? null
    writeCache(cacheKey, text)
    return text
  } catch {
    // Network error, timeout, or offline — don't cache failures
    return null
  }
}

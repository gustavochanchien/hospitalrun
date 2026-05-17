import { db } from '../db'
import type { CodeSystem } from '../db/schema'

export async function searchCodes(
  system: 'icd10' | 'snomed',
  query: string,
  limit = 20,
): Promise<CodeSystem[]> {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return []

  const results = await db.codeSystems
    .where('system')
    .equals(system)
    .filter((r) => r.searchText.includes(normalized))
    .toArray()

  // Rank: code-prefix matches first, then display-contains, then rest.
  results.sort((a, b) => {
    const aCodePrefix = a.code.toLowerCase().startsWith(normalized)
    const bCodePrefix = b.code.toLowerCase().startsWith(normalized)
    if (aCodePrefix && !bCodePrefix) return -1
    if (!aCodePrefix && bCodePrefix) return 1
    return a.code.localeCompare(b.code)
  })

  return results.slice(0, limit)
}

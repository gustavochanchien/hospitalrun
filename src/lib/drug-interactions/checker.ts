import { normalizeDrugName } from './normalize'

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor'

export interface InteractionResult {
  drug1: string
  drug2: string
  severity: InteractionSeverity
  description: string
}

interface RawInteraction {
  drugs: [string, string]
  severity: InteractionSeverity
  description: string
}

interface InteractionFile {
  interactions: RawInteraction[]
}

// Module-level cache: normalized drug name → list of interactions involving that drug.
let indexCache: Map<string, RawInteraction[]> | null = null
let loadPromise: Promise<void> | null = null

const SEVERITY_ORDER: Record<InteractionSeverity, number> = {
  contraindicated: 0,
  major: 1,
  moderate: 2,
  minor: 3,
}

async function loadIndex(): Promise<void> {
  if (indexCache) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const res = await fetch('/code-sets/drug-interactions.json')
    if (!res.ok) throw new Error(`Failed to load drug interactions (${res.status})`)
    const data: InteractionFile = await res.json()

    const map = new Map<string, RawInteraction[]>()
    for (const interaction of data.interactions) {
      for (const drug of interaction.drugs) {
        const normalized = drug.toLowerCase().trim()
        const list = map.get(normalized) ?? []
        list.push(interaction)
        map.set(normalized, list)
      }
    }

    indexCache = map
  })()

  return loadPromise
}

export async function checkInteractions(medicationNames: string[]): Promise<InteractionResult[]> {
  if (medicationNames.length < 2) return []

  await loadIndex()
  const index = indexCache!

  const results: InteractionResult[] = []
  const seen = new Set<string>()

  const normalized = medicationNames.map((n) => ({
    original: n,
    normalized: normalizeDrugName(n),
  }))

  for (let i = 0; i < normalized.length; i++) {
    const candidates = index.get(normalized[i].normalized) ?? []
    for (const interaction of candidates) {
      const otherNormalized =
        interaction.drugs[0].toLowerCase() === normalized[i].normalized
          ? interaction.drugs[1].toLowerCase()
          : interaction.drugs[0].toLowerCase()

      const matchIdx = normalized.findIndex((m) => m.normalized === otherNormalized)
      if (matchIdx === -1 || matchIdx === i) continue

      // Dedup by sorted drug pair key
      const pairKey = [i, matchIdx].sort().join(':')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      results.push({
        drug1: normalized[i].original,
        drug2: normalized[matchIdx].original,
        severity: interaction.severity,
        description: interaction.description,
      })
    }
  }

  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
  return results
}

/** Exposed for tests to reset the module-level cache. */
export function _resetInteractionCache(): void {
  indexCache = null
  loadPromise = null
}

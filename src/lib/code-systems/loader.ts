import { db } from '../db'
import type { CodeSystem } from '../db/schema'

type CodeSystemType = 'icd10' | 'snomed' | 'vaccine'

const FILE_MAP: Record<CodeSystemType, string> = {
  icd10: '/code-sets/icd10-who.json',
  snomed: '/code-sets/snomed-core.json',
  vaccine: '/code-sets/who-epi-vaccines.json',
}

interface RawCodeEntry {
  code: string
  display: string
}

interface RawCodeFile {
  codes: RawCodeEntry[]
}

// Guards concurrent calls per system — resolves when loaded.
const loading = new Map<CodeSystemType, Promise<void>>()

export async function ensureCodeSystemLoaded(system: CodeSystemType): Promise<void> {
  const inflight = loading.get(system)
  if (inflight) return inflight

  const promise = (async () => {
    const count = await db.codeSystems.where('system').equals(system).count()
    if (count > 0) return

    const res = await fetch(FILE_MAP[system])
    if (!res.ok) throw new Error(`Failed to load code set: ${system} (${res.status})`)

    const raw: RawCodeFile = await res.json()

    const rows: CodeSystem[] = raw.codes.map((entry) => ({
      id: `${system}:${entry.code}`,
      system,
      code: entry.code,
      display: entry.display,
      searchText: `${entry.code} ${entry.display}`.toLowerCase(),
    }))

    await db.codeSystems.bulkPut(rows)
  })()

  loading.set(system, promise)
  try {
    await promise
  } finally {
    loading.delete(system)
  }
}

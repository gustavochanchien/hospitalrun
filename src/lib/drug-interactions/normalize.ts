const DOSAGE_RE = /\s+\d[\d.,]*\s*(mg|mcg|g|ml|%|iu|units?|mmol|mEq)\b.*/i

const SALT_SUFFIXES = [
  ' hydrochloride',
  ' hcl',
  ' sodium',
  ' potassium',
  ' sulfate',
  ' sulphate',
  ' maleate',
  ' tartrate',
  ' citrate',
  ' phosphate',
  ' acetate',
  ' fumarate',
  ' mesylate',
  ' tosylate',
  ' besylate',
  ' bromide',
  ' chloride',
  ' nitrate',
  ' succinate',
]

export function normalizeDrugName(name: string): string {
  let normalized = name.trim().toLowerCase()

  // Strip trailing dosage (e.g. "Aspirin 81mg daily" → "aspirin")
  normalized = normalized.replace(DOSAGE_RE, '')

  // Strip common salt suffixes
  for (const suffix of SALT_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      normalized = normalized.slice(0, normalized.length - suffix.length)
      break
    }
  }

  return normalized.trim()
}

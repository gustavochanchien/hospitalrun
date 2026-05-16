import { db } from './index'

const TABLE_MAP = {
  P: 'patients',
  L: 'labs',
  I: 'imaging',
} as const

/**
 * Generate a sequential human-readable code for an entity.
 * Format: {prefix}-{5-digit-number} e.g. P-00001, L-00042
 *
 * Scans existing records in Dexie to find the highest code
 * for the given prefix and org, then increments.
 */
export async function generateCode(
  prefix: keyof typeof TABLE_MAP,
  orgId: string,
): Promise<string> {
  const tableName = TABLE_MAP[prefix]
  const pattern = new RegExp(`^${prefix}-(\\d+)$`)

  const field = prefix === 'P' ? 'mrn' : 'code'

  const records = await db
    .table(tableName)
    .where('orgId')
    .equals(orgId)
    .toArray()

  let maxNum = 0
  for (const record of records) {
    const value = record[field] as string | null
    if (!value) continue
    const match = pattern.exec(value)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  const next = maxNum + 1
  return `${prefix}-${String(next).padStart(5, '0')}`
}

/**
 * Generate the next invoice number for an org. Format: INV-00001.
 * Scans existing invoices (including soft-deleted) so reused numbers
 * never collide with prior records.
 */
export async function generateInvoiceNumber(orgId: string): Promise<string> {
  const pattern = /^INV-(\d+)$/
  const invoices = await db.invoices
    .where('orgId')
    .equals(orgId)
    .toArray()

  let maxNum = 0
  for (const invoice of invoices) {
    const match = pattern.exec(invoice.invoiceNumber)
    if (match) {
      const num = parseInt(match[1], 10)
      if (num > maxNum) maxNum = num
    }
  }

  return `INV-${String(maxNum + 1).padStart(5, '0')}`
}

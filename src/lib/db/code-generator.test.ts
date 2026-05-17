import { describe, it, expect, beforeEach } from 'vitest'
import { generateCode, generateInvoiceNumber } from './code-generator'
import { db } from './index'
import type { Patient, Lab, Imaging, Invoice } from './schema'

const orgId = 'org-codegen'

beforeEach(async () => {
  await db.transaction(
    'rw',
    db.patients,
    db.labs,
    db.imaging,
    db.invoices,
    async () => {
      await db.patients.clear()
      await db.labs.clear()
      await db.imaging.clear()
      await db.invoices.clear()
    },
  )
})

function baseRecord() {
  return {
    orgId,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _synced: false,
    _deleted: false,
  }
}

describe('generateCode', () => {
  describe('P prefix (patients / MRN)', () => {
    it('returns P-00001 when no patients exist', async () => {
      const code = await generateCode('P', orgId)
      expect(code).toBe('P-00001')
    })

    it('increments from existing MRN', async () => {
      await db.patients.put({
        ...baseRecord(),
        id: crypto.randomUUID(),
        mrn: 'P-00042',
        givenName: 'Jane',
        familyName: 'Doe',
        prefix: null, suffix: null, dateOfBirth: null, sex: null,
        bloodType: null, occupation: null, preferredLanguage: null,
        phone: null, email: null, address: null, isApproximateDateOfBirth: null, status: 'active',
        maritalStatus: null, educationLevel: null, nationalId: null, nationalIdType: null,
        numberOfChildren: null, numberOfHouseholdMembers: null, isHeadOfHousehold: false,
      } as Patient)

      const code = await generateCode('P', orgId)
      expect(code).toBe('P-00043')
    })

    it('ignores patients from other orgs', async () => {
      await db.patients.put({
        ...baseRecord(),
        orgId: 'other-org',
        id: crypto.randomUUID(),
        mrn: 'P-00099',
        givenName: 'Other',
        familyName: 'Person',
        prefix: null, suffix: null, dateOfBirth: null, sex: null,
        bloodType: null, occupation: null, preferredLanguage: null,
        phone: null, email: null, address: null, isApproximateDateOfBirth: null, status: 'active',
        maritalStatus: null, educationLevel: null, nationalId: null, nationalIdType: null,
        numberOfChildren: null, numberOfHouseholdMembers: null, isHeadOfHousehold: false,
      } as Patient)

      const code = await generateCode('P', orgId)
      expect(code).toBe('P-00001')
    })

    it('finds the highest code when multiple exist', async () => {
      const stage16Defaults = {
        maritalStatus: null, educationLevel: null, nationalId: null, nationalIdType: null,
        numberOfChildren: null, numberOfHouseholdMembers: null, isHeadOfHousehold: false,
      } as const
      const patients: Patient[] = [
        { ...baseRecord(), ...stage16Defaults, id: crypto.randomUUID(), mrn: 'P-00003', givenName: 'A', familyName: 'B', prefix: null, suffix: null, dateOfBirth: null, isApproximateDateOfBirth: null, sex: null, bloodType: null, occupation: null, preferredLanguage: null, phone: null, email: null, address: null, status: 'active' },
        { ...baseRecord(), ...stage16Defaults, id: crypto.randomUUID(), mrn: 'P-00010', givenName: 'C', familyName: 'D', prefix: null, suffix: null, dateOfBirth: null, isApproximateDateOfBirth: null, sex: null, bloodType: null, occupation: null, preferredLanguage: null, phone: null, email: null, address: null, status: 'active' },
        { ...baseRecord(), ...stage16Defaults, id: crypto.randomUUID(), mrn: 'P-00007', givenName: 'E', familyName: 'F', prefix: null, suffix: null, dateOfBirth: null, isApproximateDateOfBirth: null, sex: null, bloodType: null, occupation: null, preferredLanguage: null, phone: null, email: null, address: null, status: 'active' },
      ]
      await db.patients.bulkPut(patients)
      const code = await generateCode('P', orgId)
      expect(code).toBe('P-00011')
    })
  })

  describe('L prefix (labs)', () => {
    it('returns L-00001 when no labs exist', async () => {
      const code = await generateCode('L', orgId)
      expect(code).toBe('L-00001')
    })

    it('increments from existing lab code', async () => {
      await db.labs.put({
        ...baseRecord(),
        id: crypto.randomUUID(),
        code: 'L-00005',
        type: 'Blood Panel',
        patientId: 'p1',
        visitId: null,
        requestedBy: null,
        requestedAt: new Date().toISOString(),
        completedAt: null,
        canceledAt: null,
        status: 'requested',
        result: null,
        notes: null,
      } as Lab)

      const code = await generateCode('L', orgId)
      expect(code).toBe('L-00006')
    })
  })

  describe('invoice numbers', () => {
    it('returns INV-00001 when no invoices exist', async () => {
      const n = await generateInvoiceNumber(orgId)
      expect(n).toBe('INV-00001')
    })

    it('increments from the highest existing invoice number for the org', async () => {
      const invoices: Invoice[] = [
        {
          id: crypto.randomUUID(), orgId, patientId: 'p', visitId: null,
          invoiceNumber: 'INV-00003', status: 'draft',
          issuedAt: null, dueAt: null, currency: 'USD',
          subtotal: 0, tax: 0, discount: 0, total: 0, amountPaid: 0,
          notes: null, deletedAt: null,
          createdAt: '', updatedAt: '', _synced: false, _deleted: false,
        },
        {
          id: crypto.randomUUID(), orgId, patientId: 'p', visitId: null,
          invoiceNumber: 'INV-00012', status: 'paid',
          issuedAt: null, dueAt: null, currency: 'USD',
          subtotal: 0, tax: 0, discount: 0, total: 0, amountPaid: 0,
          notes: null, deletedAt: null,
          createdAt: '', updatedAt: '', _synced: false, _deleted: false,
        },
        {
          id: crypto.randomUUID(), orgId: 'other-org', patientId: 'p', visitId: null,
          invoiceNumber: 'INV-99999', status: 'paid',
          issuedAt: null, dueAt: null, currency: 'USD',
          subtotal: 0, tax: 0, discount: 0, total: 0, amountPaid: 0,
          notes: null, deletedAt: null,
          createdAt: '', updatedAt: '', _synced: false, _deleted: false,
        },
      ]
      await db.invoices.bulkPut(invoices)
      const n = await generateInvoiceNumber(orgId)
      expect(n).toBe('INV-00013')
    })
  })

  describe('I prefix (imaging)', () => {
    it('returns I-00001 when no imaging records exist', async () => {
      const code = await generateCode('I', orgId)
      expect(code).toBe('I-00001')
    })

    it('increments from existing imaging code', async () => {
      await db.imaging.put({
        ...baseRecord(),
        id: crypto.randomUUID(),
        code: 'I-00020',
        type: 'X-Ray',
        patientId: 'p1',
        visitId: null,
        requestedBy: null,
        requestedOn: new Date().toISOString(),
        completedOn: null,
        canceledOn: null,
        status: 'requested',
        notes: null,
        storagePath: null,
      } as Imaging)

      const code = await generateCode('I', orgId)
      expect(code).toBe('I-00021')
    })
  })
})

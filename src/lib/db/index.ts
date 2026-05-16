import Dexie from 'dexie'
import type {
  Patient,
  Visit,
  Appointment,
  Lab,
  Medication,
  Incident,
  Imaging,
  Diagnosis,
  Allergy,
  Note,
  RelatedPerson,
  CareGoal,
  CarePlan,
  PatientHistory,
  OrgFeature,
  UserFeature,
  ChargeItem,
  Invoice,
  InvoiceLineItem,
  Payment,
  SyncQueueEntry,
} from './schema'

export class HospitalRunDB extends Dexie {
  patients!: Dexie.Table<Patient, string>
  visits!: Dexie.Table<Visit, string>
  appointments!: Dexie.Table<Appointment, string>
  labs!: Dexie.Table<Lab, string>
  medications!: Dexie.Table<Medication, string>
  incidents!: Dexie.Table<Incident, string>
  imaging!: Dexie.Table<Imaging, string>
  diagnoses!: Dexie.Table<Diagnosis, string>
  allergies!: Dexie.Table<Allergy, string>
  notes!: Dexie.Table<Note, string>
  relatedPersons!: Dexie.Table<RelatedPerson, string>
  careGoals!: Dexie.Table<CareGoal, string>
  carePlans!: Dexie.Table<CarePlan, string>
  patientHistory!: Dexie.Table<PatientHistory, string>
  orgFeatures!: Dexie.Table<OrgFeature, string>
  userFeatures!: Dexie.Table<UserFeature, string>
  chargeItems!: Dexie.Table<ChargeItem, string>
  invoices!: Dexie.Table<Invoice, string>
  invoiceLineItems!: Dexie.Table<InvoiceLineItem, string>
  payments!: Dexie.Table<Payment, string>
  syncQueue!: Dexie.Table<SyncQueueEntry, number>

  constructor() {
    super('hospitalrun')

    this.version(1).stores({
      patients: 'id, orgId, mrn, familyName, status, _synced',
      visits: 'id, orgId, patientId, status, _synced',
      appointments: 'id, orgId, patientId, startTime, status, _synced',
      labs: 'id, orgId, patientId, visitId, status, _synced',
      medications: 'id, orgId, patientId, visitId, status, _synced',
      incidents: 'id, orgId, status, _synced',
      imaging: 'id, orgId, patientId, visitId, status, _synced',
      diagnoses: 'id, orgId, patientId, _synced',
      allergies: 'id, orgId, patientId, _synced',
      notes: 'id, orgId, patientId, _synced',
      relatedPersons: 'id, orgId, patientId, _synced',
      careGoals: 'id, orgId, patientId, achievementStatus, _synced',
      carePlans: 'id, orgId, patientId, status, _synced',
      patientHistory: 'id, orgId, patientId, changedAt',
      syncQueue: '++seq, tableName, recordId, operation, createdAt',
    })

    // v2: add visitId index to diagnoses + notes (episodes-of-care scoping).
    this.version(2)
      .stores({
        diagnoses: 'id, orgId, patientId, visitId, _synced',
        notes: 'id, orgId, patientId, visitId, _synced',
      })
      .upgrade(async (tx) => {
        await tx
          .table('diagnoses')
          .toCollection()
          .modify((row) => {
            if (row.visitId === undefined) row.visitId = null
          })
        await tx
          .table('notes')
          .toCollection()
          .modify((row) => {
            if (row.visitId === undefined) row.visitId = null
          })
      })

    // v3: feature flags (per-org enable + per-user grant).
    this.version(3).stores({
      orgFeatures: 'id, orgId, feature, [orgId+feature], _synced',
      userFeatures: 'id, userId, orgId, feature, [userId+orgId+feature], [orgId+feature], _synced',
    })

    // v4: billing & invoicing (charge_items, invoices, invoice_line_items, payments).
    this.version(4).stores({
      chargeItems: 'id, orgId, code, active, _synced',
      invoices: 'id, orgId, patientId, visitId, status, invoiceNumber, _synced',
      invoiceLineItems: 'id, orgId, invoiceId, chargeItemId, _synced',
      payments: 'id, orgId, invoiceId, patientId, receivedAt, _synced',
    })
  }
}

export const db = new HospitalRunDB()

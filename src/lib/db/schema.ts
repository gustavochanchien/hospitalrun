export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface Profile {
  id: string
  orgId: string
  role: string
  fullName: string
  createdAt: string
}

export interface Patient {
  id: string
  orgId: string
  mrn: string | null
  prefix: string | null
  givenName: string
  familyName: string
  suffix: string | null
  dateOfBirth: string | null
  sex: 'male' | 'female' | 'other' | 'unknown' | null
  bloodType: string | null
  occupation: string | null
  preferredLanguage: string | null
  phone: string | null
  email: string | null
  address: Record<string, string> | null
  maritalStatus: 'single' | 'partnered' | 'married' | 'separated' | 'divorced' | 'widowed' | null
  educationLevel: 'none' | 'primary' | 'secondary' | 'tertiary' | 'unknown' | null
  nationalId: string | null
  nationalIdType: string | null
  numberOfChildren: number | null
  numberOfHouseholdMembers: number | null
  isHeadOfHousehold: boolean
  isApproximateDateOfBirth: boolean | null
  status: 'active' | 'inactive' | 'deceased'
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Visit {
  id: string
  orgId: string
  patientId: string
  type: string | null
  status:
    | 'planned'
    | 'arrived'
    | 'triaged'
    | 'in-progress'
    | 'on-leave'
    | 'finished'
    | 'cancelled'
  reason: string | null
  location: string | null
  startDatetime: string | null
  endDatetime: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Appointment {
  id: string
  orgId: string
  patientId: string
  type: string | null
  startTime: string
  endTime: string
  location: string | null
  reason: string | null
  requestedBy: string | null
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Lab {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  code: string | null
  type: string
  status: 'requested' | 'completed' | 'canceled'
  requestedBy: string | null
  requestedAt: string
  completedAt: string | null
  canceledAt: string | null
  result: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Medication {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  name: string
  status:
    | 'draft'
    | 'active'
    | 'on hold'
    | 'canceled'
    | 'completed'
    | 'entered in error'
    | 'stopped'
    | 'unknown'
  intent: string | null
  priority: string | null
  quantity: string | null
  requestedBy: string | null
  startDate: string | null
  endDate: string | null
  notes: string | null
  inventoryItemId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Incident {
  id: string
  orgId: string
  reportedBy: string | null
  reportedOn: string
  patientId: string | null
  department: string | null
  category: string | null
  categoryItem: string | null
  description: string
  status: 'reported' | 'resolved'
  resolvedOn: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Imaging {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  code: string | null
  type: string
  status: 'requested' | 'completed' | 'canceled'
  requestedBy: string | null
  requestedOn: string
  completedOn: string | null
  canceledOn: string | null
  notes: string | null
  storagePath: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Diagnosis {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  icdCode: string | null
  description: string
  status:
    | 'active'
    | 'recurrence'
    | 'relapse'
    | 'inactive'
    | 'remission'
    | 'resolved'
    | null
  diagnosedAt: string | null
  diagnosedBy: string | null
  onsetDate: string | null
  abatementDate: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Allergy {
  id: string
  orgId: string
  patientId: string
  allergen: string
  reaction: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
  notedAt: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Vital {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  recordedAt: string
  recordedBy: string | null
  heightCm: number | null
  weightKg: number | null
  temperatureC: number | null
  heartRate: number | null
  respiratoryRate: number | null
  systolic: number | null
  diastolic: number | null
  oxygenSat: number | null
  painScale: number | null
  headCircumferenceCm: number | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Note {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  content: string
  authorId: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface RelatedPerson {
  id: string
  orgId: string
  patientId: string
  givenName: string
  familyName: string
  relationship: string | null
  phone: string | null
  email: string | null
  address: Record<string, string> | null
  linkedPatientId: string | null
  isPrimaryContact: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface CareGoal {
  id: string
  orgId: string
  patientId: string
  description: string
  status:
    | 'proposed'
    | 'planned'
    | 'accepted'
    | 'active'
    | 'on-hold'
    | 'completed'
    | 'cancelled'
    | 'rejected'
    | null
  startDate: string | null
  targetDate: string | null
  achievementStatus:
    | 'in-progress'
    | 'improving'
    | 'worsening'
    | 'no-change'
    | 'not-achieving'
    | 'sustaining'
    | 'achieved'
    | 'no-progress'
    | 'not-attainable'
  priority: 'low' | 'medium' | 'high' | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface CarePlan {
  id: string
  orgId: string
  patientId: string
  title: string
  description: string | null
  diagnosisId: string | null
  intent: 'proposal' | 'plan' | 'order' | 'option' | null
  startDate: string | null
  endDate: string | null
  status:
    | 'draft'
    | 'active'
    | 'on-hold'
    | 'revoked'
    | 'completed'
    | 'entered-in-error'
    | 'unknown'
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface PatientHistory {
  id: string
  orgId: string
  patientId: string
  changedBy: string | null
  changedAt: string
  fieldName: string
  oldValue: string | null
  newValue: string | null
}

export const ACCESS_ACTIONS = [
  'view',
  'list',
  'search',
  'export',
  'print',
  'create',
  'update',
  'delete',
] as const
export type AccessAction = (typeof ACCESS_ACTIONS)[number]

export const ACCESS_RESOURCE_TYPES = [
  'patient',
  'visit',
  'appointment',
  'lab',
  'medication',
  'imaging',
  'incident',
  'diagnosis',
  'allergy',
  'vital',
  'note',
  'related_person',
  'care_goal',
  'care_plan',
  'invoice',
  'payment',
  'inventory_item',
] as const
export type AccessResourceType = (typeof ACCESS_RESOURCE_TYPES)[number]

export interface AccessLog {
  id: string
  orgId: string
  userId: string | null
  userEmail: string | null
  userRole: string
  action: AccessAction
  resourceType: AccessResourceType
  resourceId: string | null
  patientId: string | null
  context: Record<string, unknown> | null
  clientId: string | null
  occurredAt: string
  createdAt: string
  _synced: boolean
}

export interface OrgFeature {
  id: string
  orgId: string
  feature: string
  enabled: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface UserFeature {
  id: string
  userId: string
  orgId: string
  feature: string
  granted: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

/**
 * Per-org role definition. Built-in rows are seeded by
 * `bootstrap_current_user`; admin has `isLocked = true` and cannot be
 * edited or deleted. `roleKey` is unique within an org (auto-slugged
 * from the label on create, immutable thereafter).
 */
export interface OrgRole {
  id: string
  orgId: string
  roleKey: string
  label: string
  permissions: string[]
  isBuiltin: boolean
  isLocked: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface ChargeItem {
  id: string
  orgId: string
  code: string
  name: string
  description: string | null
  unitAmount: number
  currency: string
  active: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Invoice {
  id: string
  orgId: string
  patientId: string
  visitId: string | null
  invoiceNumber: string
  status: 'draft' | 'issued' | 'partial' | 'paid' | 'void'
  issuedAt: string | null
  dueAt: string | null
  currency: string
  subtotal: number
  tax: number
  discount: number
  total: number
  amountPaid: number
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface InvoiceLineItem {
  id: string
  orgId: string
  invoiceId: string
  chargeItemId: string | null
  description: string
  quantity: number
  unitAmount: number
  amount: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface Payment {
  id: string
  orgId: string
  invoiceId: string
  patientId: string
  amount: number
  method: 'cash' | 'card' | 'bank-transfer' | 'insurance' | 'other'
  receivedAt: string
  reference: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface InventoryItem {
  id: string
  orgId: string
  sku: string
  name: string
  description: string | null
  unit: string
  onHand: number
  reorderLevel: number
  unitCost: number
  currency: string
  active: boolean
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export type InventoryTransactionKind =
  | 'receive'
  | 'dispense'
  | 'adjust'
  | 'transfer'
  | 'waste'

export interface InventoryTransaction {
  id: string
  orgId: string
  inventoryItemId: string
  kind: InventoryTransactionKind
  quantity: number
  unitCost: number | null
  reference: string | null
  patientId: string | null
  medicationId: string | null
  occurredAt: string
  recordedBy: string | null
  notes: string | null
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  _synced: boolean
  _deleted: boolean
}

export interface SyncQueueEntry {
  seq?: number
  tableName: string
  recordId: string
  operation: 'insert' | 'update' | 'delete'
  createdAt: string
}

/** Map of Dexie table name → TypeScript interface */
export type TableMap = {
  patients: Patient
  visits: Visit
  appointments: Appointment
  labs: Lab
  medications: Medication
  incidents: Incident
  imaging: Imaging
  diagnoses: Diagnosis
  allergies: Allergy
  vitals: Vital
  notes: Note
  relatedPersons: RelatedPerson
  careGoals: CareGoal
  carePlans: CarePlan
  patientHistory: PatientHistory
  accessLogs: AccessLog
  orgFeatures: OrgFeature
  userFeatures: UserFeature
  orgRoles: OrgRole
  chargeItems: ChargeItem
  invoices: Invoice
  invoiceLineItems: InvoiceLineItem
  payments: Payment
  inventoryItems: InventoryItem
  inventoryTransactions: InventoryTransaction
  syncQueue: SyncQueueEntry
}

export type SyncableTable = Exclude<keyof TableMap, 'syncQueue' | 'patientHistory'>

/**
 * Tables whose records carry PHI. Writes through `dbPut`/`dbDelete` to
 * these tables auto-emit an `access_logs` audit entry. Keep in sync with
 * the HIPAA-protected resource types in `ACCESS_RESOURCE_TYPES`.
 */
export interface CodeSystem {
  id: string       // `${system}:${code}` — stable key
  system: 'icd10' | 'snomed'
  code: string
  display: string
  searchText: string  // `${code} ${display}` lowercased for prefix/contains scan
}

export const PHI_TABLES = [
  'patients',
  'visits',
  'appointments',
  'labs',
  'medications',
  'imaging',
  'incidents',
  'diagnoses',
  'allergies',
  'vitals',
  'notes',
  'relatedPersons',
  'careGoals',
  'carePlans',
] as const satisfies readonly SyncableTable[]
export type PhiTable = (typeof PHI_TABLES)[number]

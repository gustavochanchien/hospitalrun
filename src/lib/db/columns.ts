import type { SyncableTable } from './schema'

/**
 * Maps Dexie camelCase field names → Supabase snake_case column names
 * for each syncable table. Used by the sync engine and hydration.
 */

const patientColumns = {
  id: 'id',
  orgId: 'org_id',
  mrn: 'mrn',
  prefix: 'prefix',
  givenName: 'given_name',
  familyName: 'family_name',
  suffix: 'suffix',
  dateOfBirth: 'date_of_birth',
  sex: 'sex',
  bloodType: 'blood_type',
  occupation: 'occupation',
  preferredLanguage: 'preferred_language',
  phone: 'phone',
  email: 'email',
  address: 'address',
  maritalStatus: 'marital_status',
  educationLevel: 'education_level',
  nationalId: 'national_id',
  nationalIdType: 'national_id_type',
  numberOfChildren: 'number_of_children',
  numberOfHouseholdMembers: 'number_of_household_members',
  isHeadOfHousehold: 'is_head_of_household',
  status: 'status',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const visitColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  type: 'type',
  status: 'status',
  reason: 'reason',
  location: 'location',
  startDatetime: 'start_datetime',
  endDatetime: 'end_datetime',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const appointmentColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  type: 'type',
  startTime: 'start_time',
  endTime: 'end_time',
  location: 'location',
  requestedBy: 'requested_by',
  status: 'status',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const labColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  visitId: 'visit_id',
  code: 'code',
  type: 'type',
  status: 'status',
  requestedBy: 'requested_by',
  requestedAt: 'requested_at',
  completedAt: 'completed_at',
  canceledAt: 'canceled_at',
  result: 'result',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const medicationColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  visitId: 'visit_id',
  name: 'name',
  status: 'status',
  intent: 'intent',
  priority: 'priority',
  quantity: 'quantity',
  requestedBy: 'requested_by',
  startDate: 'start_date',
  endDate: 'end_date',
  notes: 'notes',
  inventoryItemId: 'inventory_item_id',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const incidentColumns = {
  id: 'id',
  orgId: 'org_id',
  reportedBy: 'reported_by',
  reportedOn: 'reported_on',
  patientId: 'patient_id',
  department: 'department',
  category: 'category',
  categoryItem: 'category_item',
  description: 'description',
  status: 'status',
  resolvedOn: 'resolved_on',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const imagingColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  visitId: 'visit_id',
  code: 'code',
  type: 'type',
  status: 'status',
  requestedBy: 'requested_by',
  requestedOn: 'requested_on',
  completedOn: 'completed_on',
  canceledOn: 'canceled_on',
  notes: 'notes',
  storagePath: 'storage_path',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const diagnosisColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  icdCode: 'icd_code',
  description: 'description',
  status: 'status',
  diagnosedAt: 'diagnosed_at',
  diagnosedBy: 'diagnosed_by',
  onsetDate: 'onset_date',
  abatementDate: 'abatement_date',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const allergyColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  allergen: 'allergen',
  reaction: 'reaction',
  severity: 'severity',
  notedAt: 'noted_at',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const vitalColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  visitId: 'visit_id',
  recordedAt: 'recorded_at',
  recordedBy: 'recorded_by',
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  temperatureC: 'temperature_c',
  heartRate: 'heart_rate',
  respiratoryRate: 'respiratory_rate',
  systolic: 'systolic',
  diastolic: 'diastolic',
  oxygenSat: 'oxygen_sat',
  painScale: 'pain_scale',
  headCircumferenceCm: 'head_circumference_cm',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const noteColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  content: 'content',
  authorId: 'author_id',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const relatedPersonColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  givenName: 'given_name',
  familyName: 'family_name',
  relationship: 'relationship',
  phone: 'phone',
  email: 'email',
  address: 'address',
  linkedPatientId: 'linked_patient_id',
  isPrimaryContact: 'is_primary_contact',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const careGoalColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  description: 'description',
  status: 'status',
  startDate: 'start_date',
  targetDate: 'target_date',
  achievementStatus: 'achievement_status',
  priority: 'priority',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const carePlanColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  title: 'title',
  description: 'description',
  intent: 'intent',
  startDate: 'start_date',
  endDate: 'end_date',
  status: 'status',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const orgFeatureColumns = {
  id: 'id',
  orgId: 'org_id',
  feature: 'feature',
  enabled: 'enabled',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const userFeatureColumns = {
  id: 'id',
  userId: 'user_id',
  orgId: 'org_id',
  feature: 'feature',
  granted: 'granted',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const orgRoleColumns = {
  id: 'id',
  orgId: 'org_id',
  roleKey: 'role_key',
  label: 'label',
  permissions: 'permissions',
  isBuiltin: 'is_builtin',
  isLocked: 'is_locked',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const chargeItemColumns = {
  id: 'id',
  orgId: 'org_id',
  code: 'code',
  name: 'name',
  description: 'description',
  unitAmount: 'unit_amount',
  currency: 'currency',
  active: 'active',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const invoiceColumns = {
  id: 'id',
  orgId: 'org_id',
  patientId: 'patient_id',
  visitId: 'visit_id',
  invoiceNumber: 'invoice_number',
  status: 'status',
  issuedAt: 'issued_at',
  dueAt: 'due_at',
  currency: 'currency',
  subtotal: 'subtotal',
  tax: 'tax',
  discount: 'discount',
  total: 'total',
  amountPaid: 'amount_paid',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const invoiceLineItemColumns = {
  id: 'id',
  orgId: 'org_id',
  invoiceId: 'invoice_id',
  chargeItemId: 'charge_item_id',
  description: 'description',
  quantity: 'quantity',
  unitAmount: 'unit_amount',
  amount: 'amount',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const paymentColumns = {
  id: 'id',
  orgId: 'org_id',
  invoiceId: 'invoice_id',
  patientId: 'patient_id',
  amount: 'amount',
  method: 'method',
  receivedAt: 'received_at',
  reference: 'reference',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const inventoryItemColumns = {
  id: 'id',
  orgId: 'org_id',
  sku: 'sku',
  name: 'name',
  description: 'description',
  unit: 'unit',
  onHand: 'on_hand',
  reorderLevel: 'reorder_level',
  unitCost: 'unit_cost',
  currency: 'currency',
  active: 'active',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

const accessLogColumns = {
  id: 'id',
  orgId: 'org_id',
  userId: 'user_id',
  userEmail: 'user_email',
  userRole: 'user_role',
  action: 'action',
  resourceType: 'resource_type',
  resourceId: 'resource_id',
  patientId: 'patient_id',
  context: 'context',
  clientId: 'client_id',
  occurredAt: 'occurred_at',
  createdAt: 'created_at',
} as const

const inventoryTransactionColumns = {
  id: 'id',
  orgId: 'org_id',
  inventoryItemId: 'inventory_item_id',
  kind: 'kind',
  quantity: 'quantity',
  unitCost: 'unit_cost',
  reference: 'reference',
  patientId: 'patient_id',
  medicationId: 'medication_id',
  occurredAt: 'occurred_at',
  recordedBy: 'recorded_by',
  notes: 'notes',
  deletedAt: 'deleted_at',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const

export const columnMap: Record<SyncableTable, Record<string, string>> = {
  patients: patientColumns,
  visits: visitColumns,
  appointments: appointmentColumns,
  labs: labColumns,
  medications: medicationColumns,
  incidents: incidentColumns,
  imaging: imagingColumns,
  diagnoses: diagnosisColumns,
  allergies: allergyColumns,
  vitals: vitalColumns,
  notes: noteColumns,
  relatedPersons: relatedPersonColumns,
  careGoals: careGoalColumns,
  carePlans: carePlanColumns,
  orgFeatures: orgFeatureColumns,
  userFeatures: userFeatureColumns,
  orgRoles: orgRoleColumns,
  chargeItems: chargeItemColumns,
  invoices: invoiceColumns,
  invoiceLineItems: invoiceLineItemColumns,
  payments: paymentColumns,
  inventoryItems: inventoryItemColumns,
  inventoryTransactions: inventoryTransactionColumns,
  accessLogs: accessLogColumns,
}

/** Dexie table name → Supabase table name */
export const supabaseTableName: Record<SyncableTable, string> = {
  patients: 'patients',
  visits: 'visits',
  appointments: 'appointments',
  labs: 'labs',
  medications: 'medications',
  incidents: 'incidents',
  imaging: 'imaging',
  diagnoses: 'diagnoses',
  allergies: 'allergies',
  vitals: 'vitals',
  notes: 'notes',
  relatedPersons: 'related_persons',
  careGoals: 'care_goals',
  carePlans: 'care_plans',
  orgFeatures: 'org_features',
  userFeatures: 'user_features',
  orgRoles: 'org_roles',
  chargeItems: 'charge_items',
  invoices: 'invoices',
  invoiceLineItems: 'invoice_line_items',
  payments: 'payments',
  inventoryItems: 'inventory_items',
  inventoryTransactions: 'inventory_transactions',
  accessLogs: 'access_logs',
}

/** Convert a Dexie record (camelCase) to a Supabase row (snake_case) */
export function toSupabaseRow(
  tableName: SyncableTable,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const map = columnMap[tableName]
  const row: Record<string, unknown> = {}
  for (const [camel, snake] of Object.entries(map)) {
    if (camel in record) {
      row[snake] = record[camel]
    }
  }
  return row
}

/** Convert a Supabase row (snake_case) to a Dexie record (camelCase) */
export function fromSupabaseRow(
  tableName: SyncableTable,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const map = columnMap[tableName]
  const reverseMap = Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]))
  const record: Record<string, unknown> = {}
  for (const [snake, camel] of Object.entries(reverseMap)) {
    if (snake in row) {
      record[camel] = row[snake]
    }
  }
  return record
}

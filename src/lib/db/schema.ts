export interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface Profile {
  id: string
  orgId: string
  role: 'admin' | 'user' | 'nurse' | 'doctor'
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
  notes: Note
  relatedPersons: RelatedPerson
  careGoals: CareGoal
  carePlans: CarePlan
  patientHistory: PatientHistory
  syncQueue: SyncQueueEntry
}

export type SyncableTable = Exclude<keyof TableMap, 'syncQueue' | 'patientHistory'>

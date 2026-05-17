import type { Patient } from '@/lib/db/schema'
import { diffFields, type FieldChange } from '@/lib/db/write'
import type { PatientFormValues } from './patient.schema'

type PatientDataFields = Omit<
  Patient,
  | 'id'
  | 'orgId'
  | 'mrn'
  | 'isApproximateDateOfBirth'
  | 'status'
  | 'deletedAt'
  | 'createdAt'
  | 'updatedAt'
  | '_synced'
  | '_deleted'
>

export function formToPatientFields(data: PatientFormValues): PatientDataFields {
  return {
    prefix: data.prefix || null,
    givenName: data.givenName,
    familyName: data.familyName,
    suffix: data.suffix || null,
    dateOfBirth: data.dateOfBirth || null,
    sex: data.sex ?? null,
    bloodType: data.bloodType || null,
    maritalStatus: data.maritalStatus ?? null,
    educationLevel: data.educationLevel ?? null,
    nationalId: data.nationalId || null,
    nationalIdType: data.nationalIdType || null,
    numberOfChildren: data.numberOfChildren ? Number(data.numberOfChildren) : null,
    numberOfHouseholdMembers: data.numberOfHouseholdMembers
      ? Number(data.numberOfHouseholdMembers)
      : null,
    isHeadOfHousehold: data.isHeadOfHousehold ?? false,
    occupation: data.occupation || null,
    preferredLanguage: data.preferredLanguage || null,
    phone: data.phone || null,
    email: data.email || null,
    address: data.address ?? null,
  }
}

const SCALAR_TRACKED_FIELDS: readonly (keyof Patient)[] = [
  'prefix',
  'givenName',
  'familyName',
  'suffix',
  'dateOfBirth',
  'sex',
  'bloodType',
  'maritalStatus',
  'educationLevel',
  'nationalId',
  'nationalIdType',
  'numberOfChildren',
  'numberOfHouseholdMembers',
  'isHeadOfHousehold',
  'occupation',
  'preferredLanguage',
  'phone',
  'email',
] as const

export const TRACKED_PATIENT_FIELDS: readonly string[] = [
  ...SCALAR_TRACKED_FIELDS.map(String),
  'address',
]

/**
 * Diff old vs new patient state for HIPAA history tracking.
 * Object-valued fields (`address`) are JSON-stringified so the generic
 * `diffFields` doesn't reduce them to `[object Object]`.
 */
export function diffPatientFields(
  previous: Patient,
  next: Patient,
): FieldChange[] {
  const changes = diffFields(previous, next, SCALAR_TRACKED_FIELDS)
  const oldAddr = JSON.stringify(previous.address ?? null)
  const newAddr = JSON.stringify(next.address ?? null)
  if (oldAddr !== newAddr) {
    changes.push({ fieldName: 'address', oldValue: oldAddr, newValue: newAddr })
  }
  return changes
}

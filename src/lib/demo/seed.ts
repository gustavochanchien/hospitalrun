import { faker } from '@faker-js/faker'
import { db } from '@/lib/db'
import { useAuthStore } from '@/features/auth/auth.store'
import type {
  Patient,
  Appointment,
  Diagnosis,
  Allergy,
  Medication,
  OrgRole,
} from '@/lib/db/schema'
import type { Session, User } from '@supabase/supabase-js'
import { BUILTIN_ROLE_DEFAULTS, BUILTIN_ROLE_KEYS } from '@/lib/permissions'

export const DEMO_ORG_ID = 'demo-org-00000000-0000-0000-0000-000000000001'
const SEED_FLAG_KEY = 'hospitalrun-demo-seeded-v1'
const DEMO_ROLE_KEY = 'hospitalrun-demo-role-v1'

export const DEMO_ROLES = ['admin', 'doctor', 'nurse', 'user'] as const
export type DemoRole = (typeof DEMO_ROLES)[number]

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === 'true'
}

export function getDemoRole(): DemoRole {
  const stored = localStorage.getItem(DEMO_ROLE_KEY)
  return (DEMO_ROLES as readonly string[]).includes(stored ?? '')
    ? (stored as DemoRole)
    : 'admin'
}

export function setDemoRole(role: DemoRole): void {
  localStorage.setItem(DEMO_ROLE_KEY, role)
  useAuthStore.setState({ role })
}

/**
 * Seed the 6 built-in role rows into Dexie for the demo org. Idempotent
 * — safe to call on every load. Runs outside the SEED_FLAG_KEY gate so
 * existing demo users get the rows added when the feature ships.
 */
export async function seedDemoRoles(): Promise<void> {
  const now = new Date().toISOString()
  const orgRoles: OrgRole[] = BUILTIN_ROLE_KEYS.map((key) => ({
    id: `${DEMO_ORG_ID}:${key}`,
    orgId: DEMO_ORG_ID,
    roleKey: key,
    label: BUILTIN_ROLE_DEFAULTS[key].label,
    permissions: [...BUILTIN_ROLE_DEFAULTS[key].permissions],
    isBuiltin: true,
    isLocked: key === 'admin',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    _synced: true,
    _deleted: false,
  }))
  // Merge: keep permission edits the admin made, but always sync the
  // built-in label (so default-label renames in code propagate to
  // existing demo users). Inserts missing rows.
  await db.transaction('rw', db.orgRoles, async () => {
    for (const row of orgRoles) {
      const existing = await db.orgRoles.get(row.id)
      if (!existing) {
        await db.orgRoles.put(row)
      } else if (existing.label !== row.label) {
        await db.orgRoles.update(row.id, { label: row.label, updatedAt: now })
      }
    }
  })
}

export async function seedDemoData(patientCount = 25): Promise<void> {
  // Role seeding runs every time — see seedDemoRoles.
  await seedDemoRoles()
  if (localStorage.getItem(SEED_FLAG_KEY)) return

  faker.seed(42)
  const now = new Date().toISOString()

  const patients: Patient[] = Array.from({ length: patientCount }, (_, i) => {
    const sex = faker.helpers.arrayElement(['male', 'female'] as const)
    return {
      id: faker.string.uuid(),
      orgId: DEMO_ORG_ID,
      mrn: `P-${String(i + 1).padStart(5, '0')}`,
      prefix: faker.helpers.arrayElement([null, 'Mr.', 'Ms.', 'Dr.']),
      givenName: faker.person.firstName(sex),
      familyName: faker.person.lastName(),
      suffix: null,
      dateOfBirth: faker.date
        .birthdate({ min: 1, max: 95, mode: 'age' })
        .toISOString()
        .split('T')[0],
      sex,
      bloodType: faker.helpers.arrayElement(['A+', 'O+', 'B+', 'AB+', 'A-', 'O-', null]),
      occupation: faker.person.jobTitle(),
      preferredLanguage: faker.helpers.arrayElement(['English', 'Spanish', 'French', null]),
      phone: faker.phone.number(),
      email: faker.internet.email(),
      address: {
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state({ abbreviated: true }),
        zip: faker.location.zipCode(),
      },
      maritalStatus: faker.helpers.arrayElement(['single', 'married', 'partnered', 'widowed', null] as const),
      educationLevel: faker.helpers.arrayElement(['primary', 'secondary', 'tertiary', 'unknown', null] as const),
      nationalId: null,
      nationalIdType: null,
      numberOfChildren: faker.helpers.arrayElement([0, 1, 2, 3, null]),
      numberOfHouseholdMembers: faker.helpers.arrayElement([1, 2, 3, 4, 5, null]),
      isHeadOfHousehold: faker.datatype.boolean(0.3),
      isApproximateDateOfBirth: false,
      status: faker.helpers.weightedArrayElement([
        { value: 'active', weight: 8 },
        { value: 'inactive', weight: 1 },
        { value: 'deceased', weight: 1 },
      ]),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      _synced: true,
      _deleted: false,
    }
  })

  const appointments: Appointment[] = patients.flatMap((p) =>
    Array.from({ length: faker.number.int({ min: 0, max: 3 }) }, () => ({
      id: faker.string.uuid(),
      orgId: DEMO_ORG_ID,
      patientId: p.id,
      type: faker.helpers.arrayElement(['Checkup', 'Follow-up', 'Consultation', 'Procedure']),
      startTime: faker.date.soon({ days: 30 }).toISOString(),
      endTime: faker.date.soon({ days: 30 }).toISOString(),
      location: `Room ${faker.number.int({ min: 100, max: 400 })}`,
      reason: faker.lorem.sentence(),
      requestedBy: null,
      status: faker.helpers.arrayElement(['scheduled', 'completed', 'cancelled'] as const),
      notes: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      _synced: true,
      _deleted: false,
    })),
  )

  const diagnoses: Diagnosis[] = patients.flatMap((p) =>
    Array.from({ length: faker.number.int({ min: 0, max: 2 }) }, () => ({
      id: faker.string.uuid(),
      orgId: DEMO_ORG_ID,
      patientId: p.id,
      visitId: null,
      icdCode: faker.helpers.arrayElement(['E11.9', 'I10', 'J45.909', 'M54.5', 'F41.1']),
      description: faker.helpers.arrayElement([
        'Type 2 diabetes mellitus',
        'Essential hypertension',
        'Asthma, unspecified',
        'Low back pain',
        'Generalized anxiety disorder',
      ]),
      status: 'active',
      diagnosedAt: faker.date.past({ years: 3 }).toISOString(),
      diagnosedBy: null,
      onsetDate: null,
      abatementDate: null,
      notes: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      _synced: true,
      _deleted: false,
    })),
  )

  const allergies: Allergy[] = patients
    .filter(() => faker.datatype.boolean(0.4))
    .map((p) => ({
      id: faker.string.uuid(),
      orgId: DEMO_ORG_ID,
      patientId: p.id,
      allergen: faker.helpers.arrayElement(['Penicillin', 'Peanuts', 'Latex', 'Shellfish', 'Aspirin']),
      reaction: faker.helpers.arrayElement(['Rash', 'Anaphylaxis', 'Swelling', 'Hives']),
      severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'] as const),
      notedAt: faker.date.past({ years: 5 }).toISOString(),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      _synced: true,
      _deleted: false,
    }))

  const medications: Medication[] = patients.flatMap((p) =>
    Array.from({ length: faker.number.int({ min: 0, max: 2 }) }, () => ({
      id: faker.string.uuid(),
      orgId: DEMO_ORG_ID,
      patientId: p.id,
      visitId: null,
      name: faker.helpers.arrayElement(['Lisinopril 10mg', 'Metformin 500mg', 'Atorvastatin 20mg', 'Albuterol Inhaler', 'Sertraline 50mg']),
      status: 'active',
      intent: 'order',
      priority: 'routine',
      quantity: '30',
      requestedBy: null,
      startDate: faker.date.recent({ days: 90 }).toISOString(),
      endDate: null,
      notes: null,
      inventoryItemId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      _synced: true,
      _deleted: false,
    })),
  )

  await db.transaction(
    'rw',
    [db.patients, db.appointments, db.diagnoses, db.allergies, db.medications],
    async () => {
      await db.patients.bulkPut(patients)
      await db.appointments.bulkPut(appointments)
      await db.diagnoses.bulkPut(diagnoses)
      await db.allergies.bulkPut(allergies)
      await db.medications.bulkPut(medications)
    },
  )

  localStorage.setItem(SEED_FLAG_KEY, new Date().toISOString())
}

export function applyDemoAuth(): void {
  useAuthStore.setState({
    user: { id: 'demo-user', email: 'demo@hospitalrun.app' } as unknown as User,
    session: { user: { id: 'demo-user' } } as unknown as Session,
    orgId: DEMO_ORG_ID,
    role: getDemoRole(),
    isLoading: false,
  })
}

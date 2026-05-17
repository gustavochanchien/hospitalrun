import { faker } from '@faker-js/faker'
import { dbPut } from '@/lib/db/write'
import type {
  Patient,
  Appointment,
  Diagnosis,
  Allergy,
  Medication,
  Lab,
  Imaging,
  Incident,
  Note,
  RelatedPerson,
} from '@/lib/db/schema'

export interface SeedCounts {
  patients: number
  appointmentsPerPatient: [number, number]
  diagnosesPerPatient: [number, number]
  medsPerPatient: [number, number]
  labsPerPatient: [number, number]
  imagingPerPatient: [number, number]
  notesPerPatient: [number, number]
  incidents: number
}

const DEFAULTS: SeedCounts = {
  patients: 20,
  appointmentsPerPatient: [0, 3],
  diagnosesPerPatient: [0, 2],
  medsPerPatient: [0, 2],
  labsPerPatient: [0, 2],
  imagingPerPatient: [0, 1],
  notesPerPatient: [0, 3],
  incidents: 8,
}

const APPT_TYPES = ['Checkup', 'Follow-up', 'Consultation', 'Procedure', 'Walk-in']
const DRUGS = [
  'Lisinopril 10mg',
  'Metformin 500mg',
  'Atorvastatin 20mg',
  'Albuterol Inhaler',
  'Sertraline 50mg',
  'Amoxicillin 500mg',
  'Ibuprofen 400mg',
]
const LAB_TYPES = ['CBC', 'Metabolic Panel', 'Lipid Panel', 'HbA1c', 'Urinalysis', 'TSH']
const IMAGING_TYPES = ['Chest X-Ray', 'Abdominal CT', 'Brain MRI', 'Knee X-Ray', 'Ultrasound']
const ALLERGENS = ['Penicillin', 'Peanuts', 'Latex', 'Shellfish', 'Aspirin', 'Sulfa drugs']
const ICD = [
  { code: 'E11.9', desc: 'Type 2 diabetes mellitus' },
  { code: 'I10', desc: 'Essential hypertension' },
  { code: 'J45.909', desc: 'Asthma, unspecified' },
  { code: 'M54.5', desc: 'Low back pain' },
  { code: 'F41.1', desc: 'Generalized anxiety disorder' },
  { code: 'K21.9', desc: 'GERD without esophagitis' },
]
const INCIDENT_CATEGORIES = [
  { cat: 'Medication', item: 'Wrong dose' },
  { cat: 'Fall', item: 'From bed' },
  { cat: 'Equipment', item: 'Device failure' },
  { cat: 'Infection', item: 'Hospital-acquired' },
]

function count([min, max]: [number, number]): number {
  return faker.number.int({ min, max })
}

export interface SeedResult {
  patients: number
  appointments: number
  diagnoses: number
  allergies: number
  medications: number
  labs: number
  imaging: number
  notes: number
  relatedPersons: number
  incidents: number
}

export async function seedFakeData(
  orgId: string,
  overrides: Partial<SeedCounts> = {},
): Promise<SeedResult> {
  const cfg = { ...DEFAULTS, ...overrides }
  const result: SeedResult = {
    patients: 0,
    appointments: 0,
    diagnoses: 0,
    allergies: 0,
    medications: 0,
    labs: 0,
    imaging: 0,
    notes: 0,
    relatedPersons: 0,
    incidents: 0,
  }

  const patientIds: string[] = []

  for (let i = 0; i < cfg.patients; i++) {
    const sex = faker.helpers.arrayElement(['male', 'female'] as const)
    const patientId = faker.string.uuid()
    patientIds.push(patientId)

    const patient: Patient = {
      id: patientId,
      orgId,
      mrn: null,
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
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    }
    await dbPut('patients', patient, 'insert')
    result.patients++

    for (let j = 0; j < count(cfg.appointmentsPerPatient); j++) {
      const start = faker.date.soon({ days: 30 })
      const end = new Date(start.getTime() + 30 * 60 * 1000)
      const appt: Appointment = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        type: faker.helpers.arrayElement(APPT_TYPES),
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: `Room ${faker.number.int({ min: 100, max: 400 })}`,
        reason: faker.lorem.sentence(),
        requestedBy: null,
        status: faker.helpers.arrayElement(['scheduled', 'completed', 'cancelled'] as const),
        notes: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('appointments', appt, 'insert')
      result.appointments++
    }

    for (let j = 0; j < count(cfg.diagnosesPerPatient); j++) {
      const pick = faker.helpers.arrayElement(ICD)
      const dx: Diagnosis = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        visitId: null,
        icdCode: pick.code,
        description: pick.desc,
        status: 'active',
        diagnosedAt: faker.date.past({ years: 3 }).toISOString(),
        diagnosedBy: null,
        onsetDate: null,
        abatementDate: null,
        notes: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('diagnoses', dx, 'insert')
      result.diagnoses++
    }

    if (faker.datatype.boolean(0.4)) {
      const allergy: Allergy = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        allergen: faker.helpers.arrayElement(ALLERGENS),
        reaction: faker.helpers.arrayElement(['Rash', 'Anaphylaxis', 'Swelling', 'Hives']),
        severity: faker.helpers.arrayElement(['mild', 'moderate', 'severe'] as const),
        notedAt: faker.date.past({ years: 5 }).toISOString(),
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('allergies', allergy, 'insert')
      result.allergies++
    }

    for (let j = 0; j < count(cfg.medsPerPatient); j++) {
      const med: Medication = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        visitId: null,
        name: faker.helpers.arrayElement(DRUGS),
        status: faker.helpers.arrayElement(['active', 'completed', 'stopped'] as const),
        intent: 'order',
        priority: 'routine',
        quantity: String(faker.number.int({ min: 10, max: 90 })),
        requestedBy: null,
        startDate: faker.date.recent({ days: 90 }).toISOString(),
        endDate: null,
        notes: null,
        inventoryItemId: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('medications', med, 'insert')
      result.medications++
    }

    for (let j = 0; j < count(cfg.labsPerPatient); j++) {
      const status = faker.helpers.arrayElement(['requested', 'completed', 'canceled'] as const)
      const requestedAt = faker.date.recent({ days: 30 }).toISOString()
      const lab: Lab = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        visitId: null,
        code: null,
        type: faker.helpers.arrayElement(LAB_TYPES),
        status,
        requestedBy: null,
        requestedAt,
        completedAt: status === 'completed' ? new Date().toISOString() : null,
        canceledAt: status === 'canceled' ? new Date().toISOString() : null,
        result: status === 'completed' ? faker.lorem.sentence() : null,
        numericValue:
          status === 'completed'
            ? Number(faker.number.float({ min: 1, max: 200, fractionDigits: 1 }).toFixed(1))
            : null,
        unit: status === 'completed' ? faker.helpers.arrayElement(['mg/dL', 'mmol/L', 'g/L', '%']) : null,
        notes: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('labs', lab, 'insert')
      result.labs++
    }

    for (let j = 0; j < count(cfg.imagingPerPatient); j++) {
      const status = faker.helpers.arrayElement(['requested', 'completed', 'canceled'] as const)
      const img: Imaging = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        visitId: null,
        code: null,
        type: faker.helpers.arrayElement(IMAGING_TYPES),
        status,
        requestedBy: null,
        requestedOn: faker.date.recent({ days: 30 }).toISOString(),
        completedOn: status === 'completed' ? new Date().toISOString() : null,
        canceledOn: status === 'canceled' ? new Date().toISOString() : null,
        notes: null,
        storagePath: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('imaging', img, 'insert')
      result.imaging++
    }

    for (let j = 0; j < count(cfg.notesPerPatient); j++) {
      const note: Note = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        visitId: null,
        content: faker.lorem.paragraph(),
        authorId: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('notes', note, 'insert')
      result.notes++
    }

    if (faker.datatype.boolean(0.5)) {
      const rp: RelatedPerson = {
        id: faker.string.uuid(),
        orgId,
        patientId,
        givenName: faker.person.firstName(),
        familyName: faker.person.lastName(),
        relationship: faker.helpers.arrayElement(['Spouse', 'Parent', 'Child', 'Sibling']),
        phone: faker.phone.number(),
        email: faker.internet.email(),
        address: null,
        linkedPatientId: null,
        isPrimaryContact: false,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      }
      await dbPut('relatedPersons', rp, 'insert')
      result.relatedPersons++
    }
  }

  for (let i = 0; i < cfg.incidents; i++) {
    const pick = faker.helpers.arrayElement(INCIDENT_CATEGORIES)
    const status = faker.helpers.arrayElement(['reported', 'resolved'] as const)
    const reportedOn = faker.date.recent({ days: 60 }).toISOString()
    const incident: Incident = {
      id: faker.string.uuid(),
      orgId,
      reportedBy: faker.person.fullName(),
      reportedOn,
      patientId: faker.helpers.arrayElement([null, ...patientIds]),
      department: faker.helpers.arrayElement(['ER', 'ICU', 'Pediatrics', 'Surgery', 'Radiology']),
      category: pick.cat,
      categoryItem: pick.item,
      description: faker.lorem.sentences(2),
      status,
      resolvedOn: status === 'resolved' ? new Date().toISOString() : null,
      deletedAt: null,
      createdAt: '',
      updatedAt: '',
      _synced: false,
      _deleted: false,
    }
    await dbPut('incidents', incident, 'insert')
    result.incidents++
  }

  return result
}

import { z } from 'zod'

export const BLOOD_TYPES = [
  'A+',
  'A-',
  'AB+',
  'AB-',
  'B+',
  'B-',
  'O+',
  'O-',
  'unknown',
] as const

export const MARITAL_STATUSES = [
  'single',
  'partnered',
  'married',
  'separated',
  'divorced',
  'widowed',
] as const

export const EDUCATION_LEVELS = [
  'none',
  'primary',
  'secondary',
  'tertiary',
  'unknown',
] as const

export const patientFormSchema = z.object({
  prefix: z.string().max(20).optional().or(z.literal('')),
  givenName: z.string().min(1, 'First name is required').max(100),
  familyName: z.string().min(1, 'Last name is required').max(100),
  suffix: z.string().max(20).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  isApproximateDateOfBirth: z.boolean().optional(),
  sex: z.enum(['male', 'female', 'other', 'unknown']).optional(),
  bloodType: z.enum(BLOOD_TYPES).optional().nullable(),
  maritalStatus: z.enum(MARITAL_STATUSES).optional().nullable(),
  educationLevel: z.enum(EDUCATION_LEVELS).optional().nullable(),
  nationalId: z.string().max(60).optional().or(z.literal('')),
  nationalIdType: z.string().max(40).optional().or(z.literal('')),
  numberOfChildren: z
    .string()
    .regex(/^\d*$/, 'Must be a non-negative integer')
    .refine((v) => v === '' || Number(v) <= 50, 'Must be 50 or fewer')
    .optional()
    .or(z.literal('')),
  numberOfHouseholdMembers: z
    .string()
    .regex(/^\d*$/, 'Must be a non-negative integer')
    .refine((v) => v === '' || Number(v) <= 50, 'Must be 50 or fewer')
    .optional()
    .or(z.literal('')),
  isHeadOfHousehold: z.boolean().optional(),
  occupation: z.string().max(100).optional().or(z.literal('')),
  preferredLanguage: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().max(30).optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z
    .object({
      street: z.string().optional().or(z.literal('')),
      city: z.string().optional().or(z.literal('')),
      state: z.string().optional().or(z.literal('')),
      zip: z.string().optional().or(z.literal('')),
    })
    .optional(),
})

export type PatientFormValues = z.infer<typeof patientFormSchema>

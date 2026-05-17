import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { subYears } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BLOOD_TYPES,
  EDUCATION_LEVELS,
  MARITAL_STATUSES,
  patientFormSchema,
  type PatientFormValues,
} from './patient.schema'
import type { Patient } from '@/lib/db/schema'

interface PatientFormProps {
  defaultValues?: Partial<PatientFormValues>
  onSubmit: (data: PatientFormValues) => Promise<void>
  patient?: Patient
}

const NATIONAL_ID_TYPE_SUGGESTIONS = [
  'national_id',
  'voter_id',
  'refugee_card',
  'passport',
  'community_card',
]

export function PatientForm({ defaultValues, onSubmit, patient }: PatientFormProps) {
  const { t } = useTranslation('patient')
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      prefix: '',
      givenName: '',
      familyName: '',
      suffix: '',
      dateOfBirth: '',
      isApproximateDateOfBirth: false,
      bloodType: undefined,
      maritalStatus: null,
      educationLevel: null,
      nationalId: '',
      nationalIdType: '',
      numberOfChildren: '',
      numberOfHouseholdMembers: '',
      isHeadOfHousehold: false,
      occupation: '',
      preferredLanguage: '',
      phone: '',
      email: '',
      address: { street: '', city: '', state: '', zip: '' },
      ...defaultValues,
    },
  })

  const sex = watch('sex')
  const bloodType = watch('bloodType')
  const maritalStatus = watch('maritalStatus')
  const educationLevel = watch('educationLevel')
  const isApproxDob = watch('isApproximateDateOfBirth')
  const isHeadOfHousehold = watch('isHeadOfHousehold')
  const [approxAge, setApproxAge] = useState('')

  function handleApproxAgeChange(value: string) {
    setApproxAge(value)
    const age = parseFloat(value)
    if (!isNaN(age) && age >= 0) {
      const dob = subYears(new Date(), age).toISOString().split('T')[0]
      setValue('dateOfBirth', dob)
    }
  }

  function handleUnknownDobChange(checked: boolean) {
    setValue('isApproximateDateOfBirth', checked)
    if (!checked) {
      setValue('dateOfBirth', '')
      setApproxAge('')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      {/* Personal Info */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.personalInfo')}</h3>
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="prefix">{t('fields.prefix')}</Label>
            <Input id="prefix" placeholder="Mr." {...register('prefix')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="givenName">{t('form.givenNameRequired')}</Label>
            <Input
              id="givenName"
              placeholder="John"
              {...register('givenName')}
            />
            {errors.givenName && (
              <p className="text-sm text-destructive">
                {errors.givenName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="familyName">{t('form.familyNameRequired')}</Label>
            <Input
              id="familyName"
              placeholder="Doe"
              {...register('familyName')}
            />
            {errors.familyName && (
              <p className="text-sm text-destructive">
                {errors.familyName.message}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="suffix">{t('fields.suffix')}</Label>
            <Input id="suffix" placeholder="Jr." {...register('suffix')} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="dateOfBirth">{t('fields.dateOfBirth')}</Label>
            {isApproxDob ? (
              <Input
                id="approxAge"
                type="number"
                min="0"
                max="150"
                placeholder={t('form.approxAgePlaceholder')}
                value={approxAge}
                onChange={(e) => handleApproxAgeChange(e.target.value)}
              />
            ) : (
              <Input
                id="dateOfBirth"
                type="date"
                {...register('dateOfBirth')}
              />
            )}
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="unknown-dob"
                checked={isApproxDob ?? false}
                onCheckedChange={(checked) =>
                  handleUnknownDobChange(checked === true)
                }
              />
              <Label htmlFor="unknown-dob" className="text-sm font-normal text-muted-foreground cursor-pointer">
                {t('form.dobUnknown')}
              </Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="sex">{t('fields.sex')}</Label>
            <Select
              value={sex ?? ''}
              onValueChange={(v) =>
                setValue(
                  'sex',
                  v as 'male' | 'female' | 'other' | 'unknown',
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger id="sex">
                <SelectValue placeholder={t('form.selectSex')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t('sex.male')}</SelectItem>
                <SelectItem value="female">{t('sex.female')}</SelectItem>
                <SelectItem value="other">{t('sex.other')}</SelectItem>
                <SelectItem value="unknown">{t('sex.unknown')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="maritalStatus">{t('fields.maritalStatus')}</Label>
            <Select
              value={maritalStatus ?? ''}
              onValueChange={(v) =>
                setValue(
                  'maritalStatus',
                  v as (typeof MARITAL_STATUSES)[number],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger id="maritalStatus">
                <SelectValue placeholder={t('form.selectMaritalStatus')} />
              </SelectTrigger>
              <SelectContent>
                {MARITAL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`maritalStatus.${s}` as `maritalStatus.${(typeof MARITAL_STATUSES)[number]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bloodType">{t('fields.bloodType')}</Label>
            <Select
              value={bloodType ?? ''}
              onValueChange={(v) =>
                setValue(
                  'bloodType',
                  v as (typeof BLOOD_TYPES)[number] | null,
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger id="bloodType">
                <SelectValue placeholder={t('form.selectBloodType')} />
              </SelectTrigger>
              <SelectContent>
                {BLOOD_TYPES.map((bt) => (
                  <SelectItem key={bt} value={bt}>
                    {bt === 'unknown' ? t('sex.unknown') : bt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.contactInfo')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">{t('fields.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder={t('form.phonePlaceholder')}
              {...register('phone')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address.street">{t('fields.street')}</Label>
            <Input
              id="address.street"
              placeholder="123 Main St"
              {...register('address.street')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address.city">{t('fields.city')}</Label>
            <Input
              id="address.city"
              placeholder="Anytown"
              {...register('address.city')}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address.state">{t('fields.state')}</Label>
            <Input
              id="address.state"
              placeholder="CA"
              {...register('address.state')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address.zip">{t('fields.zip')}</Label>
            <Input
              id="address.zip"
              placeholder="12345"
              {...register('address.zip')}
            />
          </div>
        </div>
      </div>

      {/* Identification */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.identificationInfo')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="nationalId">{t('fields.nationalId')}</Label>
            <Input id="nationalId" {...register('nationalId')} />
            {errors.nationalId && (
              <p className="text-sm text-destructive">{errors.nationalId.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="nationalIdType">{t('fields.nationalIdType')}</Label>
            <Input
              id="nationalIdType"
              list="national-id-types"
              placeholder={t('form.idTypePlaceholder')}
              {...register('nationalIdType')}
            />
            <datalist id="national-id-types">
              {NATIONAL_ID_TYPE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* Background */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.backgroundInfo')}</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="occupation">{t('fields.occupation')}</Label>
            <Input
              id="occupation"
              placeholder="Engineer"
              {...register('occupation')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredLanguage">{t('fields.preferredLanguage')}</Label>
            <Input
              id="preferredLanguage"
              placeholder="English"
              {...register('preferredLanguage')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="educationLevel">{t('fields.educationLevel')}</Label>
            <Select
              value={educationLevel ?? ''}
              onValueChange={(v) =>
                setValue(
                  'educationLevel',
                  v as (typeof EDUCATION_LEVELS)[number],
                  { shouldValidate: true },
                )
              }
            >
              <SelectTrigger id="educationLevel">
                <SelectValue placeholder={t('form.selectEducationLevel')} />
              </SelectTrigger>
              <SelectContent>
                {EDUCATION_LEVELS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {t(`educationLevel.${e}` as `educationLevel.${(typeof EDUCATION_LEVELS)[number]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Household */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.householdInfo')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="numberOfChildren">{t('fields.numberOfChildren')}</Label>
            <Input
              id="numberOfChildren"
              type="number"
              min="0"
              max="50"
              placeholder={t('form.numberOfChildrenPlaceholder')}
              {...register('numberOfChildren')}
            />
            {errors.numberOfChildren && (
              <p className="text-sm text-destructive">{errors.numberOfChildren.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="numberOfHouseholdMembers">{t('fields.numberOfHouseholdMembers')}</Label>
            <Input
              id="numberOfHouseholdMembers"
              type="number"
              min="0"
              max="50"
              placeholder={t('form.numberOfHouseholdMembersPlaceholder')}
              {...register('numberOfHouseholdMembers')}
            />
            {errors.numberOfHouseholdMembers && (
              <p className="text-sm text-destructive">{errors.numberOfHouseholdMembers.message}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="isHeadOfHousehold"
            checked={isHeadOfHousehold ?? false}
            onCheckedChange={(checked) =>
              setValue('isHeadOfHousehold', checked === true, { shouldValidate: true })
            }
          />
          <Label htmlFor="isHeadOfHousehold" className="text-sm font-normal cursor-pointer">
            {t('form.isHeadOfHouseholdHelp')}
          </Label>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting
          ? t('form.saving')
          : patient
            ? t('updatePatient')
            : t('createPatient')}
      </Button>
    </form>
  )
}

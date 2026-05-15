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
import { BLOOD_TYPES, patientFormSchema, type PatientFormValues } from './patient.schema'
import type { Patient } from '@/lib/db/schema'

interface PatientFormProps {
  defaultValues?: Partial<PatientFormValues>
  onSubmit: (data: PatientFormValues) => Promise<void>
  patient?: Patient
}

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
  const isApproxDob = watch('isApproximateDateOfBirth')
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
      {/* Name Fields */}
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

        <div className="grid gap-4 sm:grid-cols-3">
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

      {/* Contact Fields */}
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

      {/* Other Fields */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">{t('form.other')}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
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

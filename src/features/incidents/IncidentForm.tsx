import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { incidentFormSchema, type IncidentFormValues } from './incident.schema'

interface IncidentFormProps {
  defaultValues?: Partial<IncidentFormValues>
  onSubmit: (data: IncidentFormValues) => Promise<void>
}

export function IncidentForm({ defaultValues, onSubmit }: IncidentFormProps) {
  const { t } = useTranslation('incidents')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      description: '',
      department: '',
      category: '',
      categoryItem: '',
      patientId: '',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="description">{t('form.description')} *</Label>
          <Textarea
            id="description"
            placeholder={t('form.descriptionPlaceholder')}
            rows={4}
            {...register('description')}
          />
          {errors.description?.message && (
            <p className="text-sm text-destructive">
              {t(errors.description.message as 'validation.descriptionRequired')}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">{t('form.department')}</Label>
            <Input
              id="department"
              placeholder={t('form.departmentPlaceholder')}
              {...register('department')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">{t('form.category')}</Label>
            <Input
              id="category"
              placeholder={t('form.categoryPlaceholder')}
              {...register('category')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="categoryItem">{t('form.categoryItem')}</Label>
            <Input
              id="categoryItem"
              placeholder={t('form.categoryItemPlaceholder')}
              {...register('categoryItem')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientId">{t('form.patientId')}</Label>
            <Input
              id="patientId"
              placeholder={t('form.patientIdPlaceholder')}
              {...register('patientId')}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('form.saving') : t('form.report')}
      </Button>
    </form>
  )
}

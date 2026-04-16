import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
          <Label htmlFor="description">Description *</Label>
          <Textarea
            id="description"
            placeholder="Describe the incident..."
            rows={4}
            {...register('description')}
          />
          {errors.description && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              placeholder="e.g. Emergency"
              {...register('department')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              placeholder="e.g. Safety"
              {...register('category')}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="categoryItem">Category Item</Label>
            <Input
              id="categoryItem"
              placeholder="e.g. Fall"
              {...register('categoryItem')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patientId">Patient ID (optional)</Label>
            <Input
              id="patientId"
              placeholder="Patient ID"
              {...register('patientId')}
            />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Report Incident'}
      </Button>
    </form>
  )
}

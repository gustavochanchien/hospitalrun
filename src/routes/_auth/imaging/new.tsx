import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'
import { ImagingForm } from '@/features/imaging/ImagingForm'
import { dbPut } from '@/lib/db/write'
import { generateCode } from '@/lib/db/code-generator'
import { useAuthStore } from '@/features/auth/auth.store'
import type { ImagingFormValues } from '@/features/imaging/imaging.schema'

export const Route = createFileRoute('/_auth/imaging/new')({
  component: NewImagingPage,
})

function NewImagingPage() {
  const navigate = useNavigate()

  async function handleSubmit(data: ImagingFormValues) {
    const { orgId, user } = useAuthStore.getState()
    const id = crypto.randomUUID()
    const code = data.code || (await generateCode('I', orgId ?? ''))

    await dbPut(
      'imaging',
      {
        id,
        orgId: orgId ?? '',
        patientId: data.patientId,
        visitId: null,
        code,
        type: data.type,
        status: 'requested' as const,
        requestedBy: (user?.user_metadata?.full_name as string) ?? user?.id ?? null,
        requestedOn: new Date().toISOString(),
        completedOn: null,
        canceledOn: null,
        notes: data.notes || null,
        storagePath: null,
        deletedAt: null,
        createdAt: '',
        updatedAt: '',
        _synced: false,
        _deleted: false,
      },
      'insert',
    )

    toast.success('Imaging request created')
    await navigate({ to: '/imaging/$imagingId', params: { imagingId: id } })
  }

  return (
    <>
      <PageHeader
        title="New Imaging Request"
        breadcrumbs={[
          { label: 'Imaging', to: '/imaging' },
          { label: 'New Request' },
        ]}
      />
      <div className="p-6">
        <ImagingForm onSubmit={handleSubmit} />
      </div>
    </>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { ImagingListPage } from '@/features/imaging/ImagingListPage'

export const Route = createFileRoute('/_auth/imaging/')({
  component: ImagingPage,
})

function ImagingPage() {
  return (
    <>
      <PageHeader
        title="Imaging"
        breadcrumbs={[{ label: 'Imaging' }]}
        actions={
          <PermissionGuard permission="write:imaging">
            <Button asChild>
              <Link to="/imaging/new">New Request</Link>
            </Button>
          </PermissionGuard>
        }
      />
      <ImagingListPage />
    </>
  )
}

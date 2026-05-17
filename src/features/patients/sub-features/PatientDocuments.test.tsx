import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientDocuments } from './PatientDocuments'

const orgId = 'org-docs'
const patientId = 'patient-docs-1'

let mockLocalHub = false
const uploadFile = vi.fn<(orgId: string, id: string, file: File) => Promise<string>>(
  async () => 'storage/path/file.png',
)
const getSignedUrl = vi.fn<(path: string) => Promise<string>>(
  async () => 'https://signed.example/file.png',
)
const removeFile = vi.fn<(path: string) => Promise<void>>(async () => {})

vi.mock('@/lib/supabase/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/supabase/client')>(
    '@/lib/supabase/client',
  )
  return {
    ...actual,
    isHubLocalMode: () => mockLocalHub,
  }
})

vi.mock('@/lib/supabase/documents', () => ({
  uploadPatientDocumentFile: (orgId: string, id: string, file: File) =>
    uploadFile(orgId, id, file),
  getPatientDocumentSignedUrl: (path: string) => getSignedUrl(path),
  removePatientDocumentFile: (path: string) => removeFile(path),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  mockLocalHub = false
  await db.transaction(
    'rw',
    db.patientDocuments,
    db.patients,
    db.syncQueue,
    db.orgRoles,
    async () => {
      await db.patientDocuments.clear()
      await db.patients.clear()
      await db.syncQueue.clear()
      await db.orgRoles.clear()
    },
  )
  useAuthStore.setState({
    user: { id: 'nurse-1' } as never,
    session: null,
    orgId,
    role: 'nurse',
    isLoading: false,
  })
  await dbPut(
    'patients',
    {
      id: patientId,
      orgId,
      mrn: 'MRN-DOC',
      givenName: 'Doc',
      familyName: 'Test',
      sex: 'male',
      dateOfBirth: '2024-01-01',
      status: 'active',
      deletedAt: null,
    } as never,
    'insert',
  )
})

function makeFile(name = 'consent.pdf', type = 'application/pdf', size = 1024) {
  const file = new File([new Uint8Array(size)], name, { type })
  return file
}

describe('PatientDocuments', () => {
  it('renders the empty state when no documents exist', async () => {
    render(<PatientDocuments patientId={patientId} />)
    expect(await screen.findByText(/no documents uploaded/i)).toBeInTheDocument()
  })

  it('rejects submit when no file is chosen', async () => {
    const user = userEvent.setup()
    render(<PatientDocuments patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /upload document/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/choose a file/i)
    expect(await db.patientDocuments.count()).toBe(0)
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('uploads a document and writes a Dexie record (round-trip)', async () => {
    const user = userEvent.setup()
    render(<PatientDocuments patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /upload document/i }))
    const dialog = await screen.findByRole('dialog')

    const file = makeFile('referral.pdf', 'application/pdf', 2048)
    const fileInput = within(dialog).getByLabelText(/^file$/i) as HTMLInputElement
    await user.upload(fileInput, file)

    // Title defaults to the filename; tweak it.
    const titleInput = within(dialog).getByLabelText(/^title$/i) as HTMLInputElement
    await user.clear(titleInput)
    await user.type(titleInput, 'Cardiology referral')

    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    await waitFor(async () => {
      expect(await db.patientDocuments.count()).toBe(1)
    })
    expect(uploadFile).toHaveBeenCalledTimes(1)
    const [row] = await db.patientDocuments.toArray()
    expect(row).toMatchObject({
      patientId,
      orgId,
      title: 'Cardiology referral',
      category: 'other',
      mimeType: 'application/pdf',
      sizeBytes: 2048,
      storagePath: 'storage/path/file.png',
      uploadedBy: 'nurse-1',
    })
  })

  it('hides the upload button in local-hub mode', async () => {
    mockLocalHub = true
    await dbPut(
      'patientDocuments',
      {
        id: 'doc-existing',
        orgId,
        patientId,
        visitId: null,
        category: 'scan',
        title: 'Old X-ray',
        description: null,
        storagePath: 'org/old/x.png',
        mimeType: 'image/png',
        sizeBytes: 512,
        uploadedBy: 'nurse-1',
        uploadedAt: new Date().toISOString(),
        deletedAt: null,
      } as never,
      'insert',
    )

    render(<PatientDocuments patientId={patientId} />)

    expect(await screen.findByText('Old X-ray')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /upload document/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/uploads are disabled in local-hub mode/i)).toBeInTheDocument()
  })

  it('opens a preview dialog that fetches a signed URL', async () => {
    const user = userEvent.setup()
    await dbPut(
      'patientDocuments',
      {
        id: 'doc-img',
        orgId,
        patientId,
        visitId: null,
        category: 'scan',
        title: 'Chest X-ray',
        description: null,
        storagePath: 'org/img/chest.png',
        mimeType: 'image/png',
        sizeBytes: 1234,
        uploadedBy: 'nurse-1',
        uploadedAt: new Date().toISOString(),
        deletedAt: null,
      } as never,
      'insert',
    )

    render(<PatientDocuments patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /^preview$/i }))

    await waitFor(() => {
      expect(getSignedUrl).toHaveBeenCalledWith('org/img/chest.png')
    })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Chest X-ray')).toBeInTheDocument()
  })

  it('soft-deletes a document and removes the storage object', async () => {
    const user = userEvent.setup()
    await dbPut(
      'patientDocuments',
      {
        id: 'doc-del',
        orgId,
        patientId,
        visitId: null,
        category: 'other',
        title: 'Old fax',
        description: null,
        storagePath: 'org/del/fax.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 100,
        uploadedBy: 'nurse-1',
        uploadedAt: new Date().toISOString(),
        deletedAt: null,
      } as never,
      'insert',
    )

    render(<PatientDocuments patientId={patientId} />)
    await user.click(await screen.findByRole('button', { name: /^delete$/i }))
    // ConfirmDialog renders the "Delete" confirm action button.
    const confirmButton = await screen.findByRole('button', { name: /^delete$/i })
    await user.click(confirmButton)

    await waitFor(() => {
      expect(removeFile).toHaveBeenCalledWith('org/del/fax.pdf')
    })
    await waitFor(async () => {
      const remaining = await db.patientDocuments
        .where({ patientId })
        .filter((d) => !d._deleted)
        .count()
      expect(remaining).toBe(0)
    })
  })

  it('denies access when the role lacks read:documents', async () => {
    await db.orgRoles.add({
      id: 'role-locked',
      orgId,
      roleKey: 'locked',
      label: 'Locked',
      permissions: ['read:patients'],
      isBuiltin: false,
      isLocked: false,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _synced: true,
      _deleted: false,
    } as never)
    useAuthStore.setState((s) => ({ ...s, role: 'locked' }))

    render(<PatientDocuments patientId={patientId} />)

    expect(
      await screen.findByText(/do not have permission to view documents/i),
    ).toBeInTheDocument()
  })
})

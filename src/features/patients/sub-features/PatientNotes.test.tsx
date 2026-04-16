import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/components/rich-text-editor', async () => {
  const actual =
    await vi.importActual<typeof import('@/components/rich-text-editor')>(
      '@/components/rich-text-editor',
    )
  return {
    ...actual,
    RichTextEditor: ({
      id,
      value,
      onChange,
      placeholder,
    }: {
      id?: string
      value: string
      onChange: (v: string) => void
      placeholder?: string
    }) => (
      <textarea
        id={id}
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
  }
})
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/lib/db'
import { dbPut } from '@/lib/db/write'
import { useAuthStore } from '@/features/auth/auth.store'
import { PatientNotes } from './PatientNotes'

const orgId = 'org-notes'
const patientId = 'patient-notes-1'

beforeEach(async () => {
  await db.transaction('rw', db.notes, db.syncQueue, async () => {
    await db.notes.clear()
    await db.syncQueue.clear()
  })
  useAuthStore.setState({
    user: { id: 'author-1' } as never,
    session: null,
    orgId,
    role: 'doctor',
    isLoading: false,
  })
})

describe('PatientNotes', () => {
  it('renders empty state when no notes exist', async () => {
    render(<PatientNotes patientId={patientId} />)
    await waitFor(() => {
      expect(screen.getByText(/no notes found/i)).toBeInTheDocument()
    })
  })

  it('lists notes for the patient sorted newest first', async () => {
    await dbPut(
      'notes',
      {
        id: 'n-old',
        orgId,
        patientId,
        content: 'Older note',
        authorId: 'author-1',
        deletedAt: null,
      },
      'insert',
    )
    // Force the timestamp distinction
    await db.notes.update('n-old', {
      createdAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T10:00:00.000Z',
    })

    await dbPut(
      'notes',
      {
        id: 'n-new',
        orgId,
        patientId,
        content: 'Newer note',
        authorId: 'author-1',
        deletedAt: null,
      },
      'insert',
    )
    await db.notes.update('n-new', {
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
    })

    render(<PatientNotes patientId={patientId} />)

    await waitFor(() => {
      expect(screen.getByText('Newer note')).toBeInTheDocument()
      expect(screen.getByText('Older note')).toBeInTheDocument()
    })

    const newer = screen.getByText('Newer note')
    const older = screen.getByText('Older note')
    expect(newer.compareDocumentPosition(older) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('creates a note via the dialog and stamps the author', async () => {
    const user = userEvent.setup()
    render(<PatientNotes patientId={patientId} />)

    await user.click(await screen.findByRole('button', { name: /new note/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/enter clinical note/i), '  Patient stable.  ')
    await user.click(within(dialog).getByRole('button', { name: /create note/i }))

    await waitFor(() => {
      expect(screen.getByText('Patient stable.')).toBeInTheDocument()
    })

    const stored = await db.notes.toArray()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      content: 'Patient stable.',
      authorId: 'author-1',
      orgId,
      patientId,
    })
  })

  it('scopes notes to the supplied visitId and stamps new notes with it', async () => {
    await dbPut(
      'notes',
      {
        id: 'n-visit-a',
        orgId,
        patientId,
        visitId: 'visit-a',
        content: 'Visit A note',
        authorId: null,
        deletedAt: null,
      },
      'insert',
    )
    await dbPut(
      'notes',
      {
        id: 'n-visit-b',
        orgId,
        patientId,
        visitId: 'visit-b',
        content: 'Visit B note',
        authorId: null,
        deletedAt: null,
      },
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientNotes patientId={patientId} visitId="visit-a" />)

    await waitFor(() => {
      expect(screen.getByText('Visit A note')).toBeInTheDocument()
    })
    expect(screen.queryByText('Visit B note')).not.toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: /new note/i }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/enter clinical note/i), 'Scoped to A')
    await user.click(within(dialog).getByRole('button', { name: /create note/i }))

    await waitFor(() => {
      expect(screen.getByText('Scoped to A')).toBeInTheDocument()
    })
    const created = await db.notes.where({ patientId }).toArray()
    const fresh = created.find((n) => n.content === 'Scoped to A')
    expect(fresh?.visitId).toBe('visit-a')
  })

  it('soft-deletes a note after confirming', async () => {
    await dbPut(
      'notes',
      {
        id: 'n-del',
        orgId,
        patientId,
        content: 'To delete',
        authorId: null,
        deletedAt: null,
      },
      'insert',
    )

    const user = userEvent.setup()
    render(<PatientNotes patientId={patientId} />)

    await waitFor(() => expect(screen.getByText('To delete')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /^delete$/i }))
    const confirm = await screen.findByRole('alertdialog')
    await user.click(within(confirm).getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(screen.queryByText('To delete')).not.toBeInTheDocument()
    })

    const stored = await db.notes.get('n-del')
    expect(stored?._deleted).toBe(true)
  })
})

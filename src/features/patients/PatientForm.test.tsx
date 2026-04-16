import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PatientForm } from './PatientForm'

describe('PatientForm', () => {
  it('renders required fields', () => {
    render(<PatientForm onSubmit={vi.fn()} />)
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create patient/i })).toBeInTheDocument()
  })

  it('shows "Update Patient" button when editing an existing patient', () => {
    const mockPatient = {
      id: '1', orgId: 'o1', givenName: 'Jane', familyName: 'Doe',
      mrn: null, prefix: null, suffix: null, dateOfBirth: null, isApproximateDateOfBirth: null,
      sex: null, bloodType: null, occupation: null, preferredLanguage: null, phone: null,
      email: null, address: null, status: 'active' as const,
      deletedAt: null, createdAt: '', updatedAt: '', _synced: false, _deleted: false,
    }
    render(
      <PatientForm
        patient={mockPatient}
        defaultValues={{ givenName: 'Jane', familyName: 'Doe' }}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /update patient/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty required fields on submit', async () => {
    const user = userEvent.setup()
    render(<PatientForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /create patient/i }))

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument()
      expect(screen.getByText('Last name is required')).toBeInTheDocument()
    })
  })

  it('shows both required field errors simultaneously on empty submit', async () => {
    const user = userEvent.setup()
    render(<PatientForm onSubmit={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /create patient/i }))

    await waitFor(() => {
      const errors = screen.getAllByText(/required/i)
      expect(errors.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('calls onSubmit with form data when valid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<PatientForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText(/first name/i), 'Alice')
    await user.type(screen.getByLabelText(/last name/i), 'Smith')
    await user.click(screen.getByRole('button', { name: /create patient/i }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
      expect(onSubmit.mock.calls[0][0]).toMatchObject({
        givenName: 'Alice',
        familyName: 'Smith',
      })
    })
  })

  it('does not call onSubmit when form is invalid', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<PatientForm onSubmit={onSubmit} />)

    await user.click(screen.getByRole('button', { name: /create patient/i }))

    await waitFor(() => {
      expect(screen.getByText('First name is required')).toBeInTheDocument()
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('populates fields with defaultValues when editing', () => {
    render(
      <PatientForm
        defaultValues={{ givenName: 'Bob', familyName: 'Jones', email: 'bob@example.com' }}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByDisplayValue('Bob')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Jones')).toBeInTheDocument()
    expect(screen.getByDisplayValue('bob@example.com')).toBeInTheDocument()
  })
})

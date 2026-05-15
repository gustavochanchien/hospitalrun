import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const invoke = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invoke(...args) },
    from: (...args: unknown[]) => from(...args),
  },
  isHubLocalMode: vi.fn(() => false),
}))

vi.mock('@/features/auth/auth.store', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({ orgId: 'org-1', role: 'admin', getAccessToken: () => 'test-token' }),
}))

import { TeamCard } from './TeamCard'

function stubListInvites(rows: unknown[] = []) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null })
  const isNull = vi.fn().mockReturnValue({ order })
  const eq = vi.fn().mockReturnValue({ is: isNull })
  const select = vi.fn().mockReturnValue({ eq })
  return { select }
}

describe('TeamCard', () => {
  beforeEach(() => {
    invoke.mockReset()
    from.mockReset()
    from.mockImplementation(() => stubListInvites())
  })

  it('shows the create-user form by default', async () => {
    render(<TeamCard />)
    expect(await screen.findByLabelText(/full name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/initial password/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create user/i }),
    ).toBeInTheDocument()
  })

  it('invokes invite-member with mode=invite when using the email tab', async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null })

    const user = userEvent.setup()
    render(<TeamCard />)
    await user.click(screen.getByRole('tab', { name: /invite by email/i }))
    await user.type(
      await screen.findByLabelText(/email address/i),
      'new@example.com',
    )
    await user.click(screen.getByRole('button', { name: /send invite/i }))

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('invite-member', {
        body: { mode: 'invite', email: 'new@example.com', role: 'user' },
      })
    })
  })

  it('invokes invite-member with mode=create from the create-user form', async () => {
    invoke.mockResolvedValue({
      data: { ok: true, mode: 'create', userId: 'u-1' },
      error: null,
    })

    const user = userEvent.setup()
    render(<TeamCard />)
    await user.type(await screen.findByLabelText(/full name/i), 'Ada Lovelace')
    await user.type(screen.getByLabelText(/^email$/i), 'ada@example.com')
    await user.type(
      screen.getByLabelText(/initial password/i),
      'correct-horse-battery',
    )
    await user.click(screen.getByRole('button', { name: /create user/i }))

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('invite-member', {
        body: {
          mode: 'create',
          email: 'ada@example.com',
          role: 'user',
          password: 'correct-horse-battery',
          fullName: 'Ada Lovelace',
        },
      })
    })
  })

  it('rejects clearly invalid emails before calling the function', async () => {
    const user = userEvent.setup()
    render(<TeamCard />)
    await user.click(screen.getByRole('tab', { name: /invite by email/i }))
    await user.type(await screen.findByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /send invite/i }))
    expect(invoke).not.toHaveBeenCalled()
  })
})

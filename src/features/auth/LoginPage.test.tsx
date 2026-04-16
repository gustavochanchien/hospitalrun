import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

const signIn = vi.fn()
const signUp = vi.fn()
vi.mock('./auth.store', () => ({
  useAuthStore: () => ({ signIn, signUp }),
}))

const { LoginPage } = await import('./LoginPage')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage — sign in mode', () => {
  it('renders the sign-in form by default', () => {
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('shows validation error for short password', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), '123')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => {
      expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument()
    })
    expect(signIn).not.toHaveBeenCalled()
  })

  it('navigates to / on successful sign in', async () => {
    signIn.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123456')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith('a@b.com', 'pw123456')
      expect(navigate).toHaveBeenCalledWith({ to: '/' })
    })
  })

  it('shows error banner and does not navigate on failed sign in', async () => {
    signIn.mockResolvedValue({ error: 'Invalid credentials' })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123456')
    await user.click(screen.getByRole('button', { name: /^sign in$/i }))
    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    })
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('LoginPage — sign up mode', () => {
  it('switches to sign-up mode when the toggle is clicked', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  it('requires full name in sign-up mode', async () => {
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123456')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText(/full name is required/i)).toBeInTheDocument()
    })
    expect(signUp).not.toHaveBeenCalled()
  })

  it('returns to sign-in mode after successful sign up', async () => {
    signUp.mockResolvedValue({ error: null })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByLabelText(/full name/i), 'Alice Smith')
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123456')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith('a@b.com', 'pw123456', 'Alice Smith')
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })
  })

  it('shows error banner on failed sign up', async () => {
    signUp.mockResolvedValue({ error: 'Email already registered' })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.click(screen.getByRole('button', { name: /^sign up$/i }))
    await user.type(screen.getByLabelText(/full name/i), 'Alice Smith')
    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'pw123456')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument()
    })
  })
})

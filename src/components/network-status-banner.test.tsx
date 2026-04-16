import { describe, it, expect, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { NetworkStatusBanner } from './network-status-banner'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

describe('NetworkStatusBanner', () => {
  afterEach(() => {
    setOnline(true)
  })

  it('renders nothing when online', () => {
    setOnline(true)
    const { container } = render(<NetworkStatusBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the offline message when offline', () => {
    setOnline(false)
    render(<NetworkStatusBanner />)
    expect(screen.getByRole('status')).toHaveTextContent(/offline/i)
  })

  it('toggles visibility on online/offline events', () => {
    setOnline(true)
    render(<NetworkStatusBanner />)
    expect(screen.queryByRole('status')).toBeNull()

    act(() => setOnline(false))
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => setOnline(true))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

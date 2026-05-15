import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useHubReadyToast } from './useHubReadyToast'

const toastSuccess = vi.fn()
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}))

const STORAGE_KEY = 'hr_hub_just_started'

beforeEach(() => {
  toastSuccess.mockReset()
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('useHubReadyToast', () => {
  it('does nothing when the localStorage flag is absent', () => {
    renderHook(() => useHubReadyToast())
    expect(toastSuccess).not.toHaveBeenCalled()
  })

  it('fires a success toast and clears the flag when present', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ url: 'http://192.168.1.50:5174' }),
    )
    renderHook(() => useHubReadyToast())
    expect(toastSuccess).toHaveBeenCalledTimes(1)
    const [title, opts] = toastSuccess.mock.calls[0] as [
      string,
      { description?: string },
    ]
    expect(title).toMatch(/clinic hub is running/i)
    expect(opts.description).toContain('http://192.168.1.50:5174')
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('falls back to a generic description when the payload has no url', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}))
    renderHook(() => useHubReadyToast())
    const [, opts] = toastSuccess.mock.calls[0] as [
      string,
      { description?: string },
    ]
    expect(opts.description).toMatch(/Other devices/i)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('handles malformed JSON without throwing and still clears the flag', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    renderHook(() => useHubReadyToast())
    expect(toastSuccess).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('does not fire twice across separate mounts after the flag is cleared', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url: 'http://x' }))
    const first = renderHook(() => useHubReadyToast())
    first.unmount()
    renderHook(() => useHubReadyToast())
    expect(toastSuccess).toHaveBeenCalledTimes(1)
  })
})

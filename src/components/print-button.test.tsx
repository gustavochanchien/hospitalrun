import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrintButton } from './print-button'

const useFeatureEnabledMock = vi.fn<(feature: string) => boolean>()
vi.mock('@/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (feature: string) => useFeatureEnabledMock(feature),
  useEnabledFeatures: () => [],
}))

const printMock = vi.fn()
beforeEach(() => {
  useFeatureEnabledMock.mockReset()
  printMock.mockReset()
  window.print = printMock
})

describe('PrintButton', () => {
  it('hides when pdf-export feature is disabled', () => {
    useFeatureEnabledMock.mockReturnValue(false)
    const { container } = render(<PrintButton />)
    expect(container).toBeEmptyDOMElement()
  })

  it('calls window.print() when clicked', async () => {
    useFeatureEnabledMock.mockReturnValue(true)
    const user = userEvent.setup()
    render(<PrintButton />)
    await user.click(screen.getByRole('button', { name: /print/i }))
    expect(printMock).toHaveBeenCalledOnce()
  })
})

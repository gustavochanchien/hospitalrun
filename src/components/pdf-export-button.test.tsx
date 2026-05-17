import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PdfExportButton } from './pdf-export-button'

const useFeatureEnabledMock = vi.fn<(feature: string) => boolean>()
vi.mock('@/hooks/useFeatureEnabled', () => ({
  useFeatureEnabled: (feature: string) => useFeatureEnabledMock(feature),
  useEnabledFeatures: () => [],
}))

const generatePdfBlobMock = vi.fn<() => Promise<Blob>>()
vi.mock('@/lib/pdf', () => ({
  generatePdfBlob: () => generatePdfBlobMock(),
}))

const createObjectURL = vi.fn(() => 'blob:fake')
const revokeObjectURL = vi.fn()
const originalCreate = URL.createObjectURL
const originalRevoke = URL.revokeObjectURL
const originalAnchorClick = HTMLAnchorElement.prototype.click
const anchorClickMock = vi.fn()

beforeEach(() => {
  useFeatureEnabledMock.mockReset()
  generatePdfBlobMock.mockReset()
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  anchorClickMock.mockClear()
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
  HTMLAnchorElement.prototype.click = anchorClickMock
})

afterEach(() => {
  URL.createObjectURL = originalCreate
  URL.revokeObjectURL = originalRevoke
  HTMLAnchorElement.prototype.click = originalAnchorClick
})

describe('PdfExportButton', () => {
  it('renders nothing when the pdf-export feature is disabled', () => {
    useFeatureEnabledMock.mockReturnValue(false)
    const { container } = render(
      <PdfExportButton filename="thing" buildDocument={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the export button when the feature is enabled', () => {
    useFeatureEnabledMock.mockReturnValue(true)
    render(<PdfExportButton filename="thing" buildDocument={vi.fn()} />)
    expect(screen.getByRole('button', { name: /export pdf/i })).toBeInTheDocument()
  })

  it('downloads a generated blob on click', async () => {
    useFeatureEnabledMock.mockReturnValue(true)
    generatePdfBlobMock.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
    const buildDocument = vi.fn(async () => ({ type: 'Document' }) as never)

    const user = userEvent.setup()
    render(<PdfExportButton filename="patient-summary" buildDocument={buildDocument} />)
    await user.click(screen.getByRole('button', { name: /export pdf/i }))

    await waitFor(() => expect(generatePdfBlobMock).toHaveBeenCalledOnce())
    expect(buildDocument).toHaveBeenCalledOnce()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('surfaces errors via toast and re-enables the button', async () => {
    useFeatureEnabledMock.mockReturnValue(true)
    generatePdfBlobMock.mockRejectedValue(new Error('boom'))
    const buildDocument = vi.fn(async () => ({ type: 'Document' }) as never)

    const user = userEvent.setup()
    render(<PdfExportButton filename="x" buildDocument={buildDocument} />)
    const button = screen.getByRole('button', { name: /export pdf/i })
    await user.click(button)

    await waitFor(() => expect(button).not.toBeDisabled())
  })
})

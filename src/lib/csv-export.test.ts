import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { exportCSV } from './csv-export'

describe('exportCSV', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.fn()
    clickSpy = vi.fn()

    Object.defineProperty(globalThis, 'URL', {
      value: { createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy },
      writable: true,
    })

    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => el)
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el)

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = { tagName: tag.toUpperCase(), click: clickSpy, href: '', download: '' } as unknown as HTMLElement
      return el
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a blob with CSV content', () => {
    exportCSV('test.csv', ['Name', 'Age'], [['Alice', '30'], ['Bob', '25']])
    expect(createObjectURLSpy).toHaveBeenCalledOnce()
    const blob: Blob = createObjectURLSpy.mock.calls[0][0]
    expect(blob.type).toContain('text/csv')
  })

  it('triggers a download by clicking the anchor', () => {
    exportCSV('report.csv', ['Col'], [['val']])
    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('sets the filename on the anchor', () => {
    const createElementSpy = vi.spyOn(document, 'createElement')
    exportCSV('incidents.csv', ['A'], [['1']])
    const anchor = createElementSpy.mock.results[0].value as { download: string }
    expect(anchor.download).toBe('incidents.csv')
  })
})

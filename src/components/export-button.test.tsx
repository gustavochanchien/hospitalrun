import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportButton } from './export-button'

const exportCSV = vi.fn()
vi.mock('@/lib/csv-export', () => ({
  exportCSV: (...args: unknown[]) => exportCSV(...args),
}))

interface Row {
  id: string
  name: string
  count: number
}

const rows: Row[] = [
  { id: '1', name: 'Alpha', count: 3 },
  { id: '2', name: 'Beta, Gamma', count: 7 },
]

const columns = [
  { header: 'Name', accessor: (r: Row) => r.name },
  { header: 'Count', accessor: (r: Row) => String(r.count) },
]

describe('ExportButton', () => {
  beforeEach(() => {
    exportCSV.mockClear()
  })

  it('renders the default label', () => {
    render(<ExportButton filename="Things" rows={rows} columns={columns} />)
    expect(screen.getByRole('button', { name: /csv/i })).toBeInTheDocument()
  })

  it('is disabled when rows are empty', () => {
    render(<ExportButton filename="Things" rows={[]} columns={columns} />)
    expect(screen.getByRole('button', { name: /csv/i })).toBeDisabled()
  })

  it('invokes exportCSV with mapped headers and rows', async () => {
    const user = userEvent.setup()
    render(<ExportButton filename="Things" rows={rows} columns={columns} />)

    await user.click(screen.getByRole('button', { name: /csv/i }))

    expect(exportCSV).toHaveBeenCalledOnce()
    const [filename, headers, data] = exportCSV.mock.calls[0]
    expect(filename).toMatch(/^Things-\d{4}-\d{2}-\d{2}--\d{2}-\d{2}[ap]m\.csv$/i)
    expect(headers).toEqual(['Name', 'Count'])
    expect(data).toEqual([
      ['Alpha', '3'],
      ['Beta, Gamma', '7'],
    ])
  })

  it('honors a custom label', () => {
    render(
      <ExportButton
        filename="Things"
        rows={rows}
        columns={columns}
        label="Download"
      />,
    )
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
  })
})

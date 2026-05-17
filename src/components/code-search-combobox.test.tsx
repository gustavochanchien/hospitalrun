import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeSearchCombobox } from './code-search-combobox'

vi.mock('@/lib/code-systems/loader', () => ({
  ensureCodeSystemLoaded: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/code-systems/search', () => ({
  searchCodes: vi.fn().mockResolvedValue([]),
}))

import { ensureCodeSystemLoaded } from '@/lib/code-systems/loader'
import { searchCodes } from '@/lib/code-systems/search'

const mockLoad = vi.mocked(ensureCodeSystemLoaded)
const mockSearch = vi.mocked(searchCodes)

beforeEach(() => {
  mockLoad.mockResolvedValue(undefined)
  mockSearch.mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CodeSearchCombobox', () => {
  it('renders the placeholder text in the trigger when no value is set', () => {
    render(
      <CodeSearchCombobox
        system="icd10"
        value={null}
        onChange={vi.fn()}
        placeholder="Search ICD-10 codes…"
      />,
    )
    expect(screen.getByText('Search ICD-10 codes…')).toBeInTheDocument()
  })

  it('renders the selected value in the trigger when value is set', () => {
    render(
      <CodeSearchCombobox
        system="icd10"
        value="E11.9"
        displayValue="Type 2 diabetes"
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText('E11.9')).toBeInTheDocument()
    expect(screen.getByText('Type 2 diabetes')).toBeInTheDocument()
  })

  it('does not open popover when disabled', async () => {
    const user = userEvent.setup()
    render(
      <CodeSearchCombobox system="icd10" value={null} onChange={vi.fn()} disabled />,
    )
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('shows loading state while ensureCodeSystemLoaded is pending', async () => {
    let resolve!: () => void
    mockLoad.mockReturnValue(new Promise<void>((r) => { resolve = r }))

    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/loading code list/i)).toBeInTheDocument()
    })

    resolve()
  })

  it('shows error state when loading fails', async () => {
    mockLoad.mockRejectedValue(new Error('network'))

    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument()
    })
  })

  it('shows results after loading completes and query is typed', async () => {
    mockSearch.mockResolvedValue([
      { id: 'icd10:E11.9', system: 'icd10', code: 'E11.9', display: 'Type 2 diabetes mellitus', searchText: 'e11.9 type 2 diabetes mellitus' },
    ])

    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockLoad).toHaveBeenCalledWith('icd10'))

    const input = screen.getByRole('textbox')
    await user.type(input, 'diab')

    await waitFor(() => {
      expect(screen.getByText('E11.9')).toBeInTheDocument()
      expect(screen.getByText('Type 2 diabetes mellitus')).toBeInTheDocument()
    })
  })

  it('calls onChange with code and display when a result is selected', async () => {
    mockSearch.mockResolvedValue([
      { id: 'icd10:I10', system: 'icd10', code: 'I10', display: 'Essential hypertension', searchText: 'i10 essential hypertension' },
    ])

    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockLoad).toHaveBeenCalled())

    await user.type(screen.getByRole('textbox'), 'hyp')

    await waitFor(() => expect(screen.getByText('I10')).toBeInTheDocument())
    await user.click(screen.getByText('I10').closest('button')!)

    expect(onChange).toHaveBeenCalledWith('I10', 'Essential hypertension')
  })

  it('shows "Use as-is" option when query has no exact match', async () => {
    mockSearch.mockResolvedValue([])

    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={vi.fn()} />)

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockLoad).toHaveBeenCalled())

    await user.type(screen.getByRole('textbox'), 'custom')

    await waitFor(() => {
      expect(screen.getByText(/use "custom" as-is/i)).toBeInTheDocument()
    })
  })

  it('calls onChange with typed text when "Use as-is" is clicked', async () => {
    mockSearch.mockResolvedValue([])

    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<CodeSearchCombobox system="icd10" value={null} onChange={onChange} />)

    await user.click(screen.getByRole('button'))
    await waitFor(() => expect(mockLoad).toHaveBeenCalled())

    await user.type(screen.getByRole('textbox'), 'mycode')

    await waitFor(() => expect(screen.getByText(/use "mycode" as-is/i)).toBeInTheDocument())
    await user.click(screen.getByText(/use "mycode" as-is/i))

    expect(onChange).toHaveBeenCalledWith('mycode', 'mycode')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeChooser } from './ModeChooser'

describe('ModeChooser', () => {
  it('renders both Solo and Hub options', () => {
    render(<ModeChooser onPick={vi.fn()} />)
    expect(screen.getByText(/Just this computer/i)).toBeInTheDocument()
    expect(screen.getByText(/Run as a clinic hub/i)).toBeInTheDocument()
  })

  it('calls onPick("solo") when the Solo card is clicked', async () => {
    const onPick = vi.fn()
    render(<ModeChooser onPick={onPick} />)
    await userEvent.click(screen.getByText(/Just this computer/i))
    expect(onPick).toHaveBeenCalledWith('solo')
  })

  it('calls onPick("hub") when the Hub card is clicked', async () => {
    const onPick = vi.fn()
    render(<ModeChooser onPick={onPick} />)
    await userEvent.click(screen.getByText(/Run as a clinic hub/i))
    expect(onPick).toHaveBeenCalledWith('hub')
  })
})

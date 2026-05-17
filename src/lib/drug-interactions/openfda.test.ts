import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenFdaInteractionText } from './openfda'

const CACHE_KEY = 'hr_openfda_label_warfarin'

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('fetchOpenFdaInteractionText', () => {
  it('returns null when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    const result = await fetchOpenFdaInteractionText('warfarin')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await fetchOpenFdaInteractionText('warfarin')
    expect(result).toBeNull()
  })

  it('returns interaction text when found', async () => {
    const mockData = {
      results: [{ drug_interactions: ['Aspirin: increased bleeding risk.'] }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }))

    const result = await fetchOpenFdaInteractionText('warfarin')
    expect(result).toBe('Aspirin: increased bleeding risk.')
  })

  it('caches result in localStorage', async () => {
    const mockData = {
      results: [{ drug_interactions: ['Some interaction text.'] }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    }))

    await fetchOpenFdaInteractionText('warfarin')

    const cached = localStorage.getItem(CACHE_KEY)
    expect(cached).not.toBeNull()
    const parsed = JSON.parse(cached!)
    expect(parsed.text).toBe('Some interaction text.')
    expect(typeof parsed.cachedAt).toBe('number')
  })

  it('returns cached result without calling fetch again', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ drug_interactions: ['Cached text.'] }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await fetchOpenFdaInteractionText('warfarin')
    await fetchOpenFdaInteractionText('warfarin')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-fetches when cache is expired', async () => {
    // Seed an expired cache entry (8 days old)
    const expired = { text: 'old text', cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 }
    localStorage.setItem(CACHE_KEY, JSON.stringify(expired))

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ drug_interactions: ['Fresh text.'] }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchOpenFdaInteractionText('warfarin')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result).toBe('Fresh text.')
  })

  it('returns null when response has no results', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    }))
    const result = await fetchOpenFdaInteractionText('unknowndrug')
    expect(result).toBeNull()
  })
})

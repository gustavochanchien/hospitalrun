import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchImageAsDataUrl } from './index'

const fetchMock = vi.fn<typeof fetch>()
const originalFetch = globalThis.fetch

beforeEach(() => {
  fetchMock.mockReset()
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('fetchImageAsDataUrl', () => {
  it('returns a data URL when the fetch succeeds', async () => {
    // jsdom's Response constructor stringifies a Blob body — work around it by
    // constructing a Response from raw bytes with a Content-Type header.
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    fetchMock.mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    )

    const result = await fetchImageAsDataUrl('https://example.test/image.png')
    expect(result).toBe('data:image/png;base64,3q2+7w==')
  })

  it('returns null on a non-OK response', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 404 }))
    expect(await fetchImageAsDataUrl('https://example.test/missing.png')).toBeNull()
  })

  it('returns null when the fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(await fetchImageAsDataUrl('https://example.test/x.png')).toBeNull()
  })
})

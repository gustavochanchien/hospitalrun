import { describe, it, expect } from 'vitest'
import { normalizeToHtml, sanitizeRichText } from './rich-text-editor'

describe('normalizeToHtml', () => {
  it('wraps plain text in a paragraph', () => {
    expect(normalizeToHtml('hello world')).toBe('<p>hello world</p>')
  })

  it('converts newlines into <br>', () => {
    expect(normalizeToHtml('line 1\nline 2')).toBe('<p>line 1<br>line 2</p>')
  })

  it('passes through existing HTML untouched', () => {
    expect(normalizeToHtml('<p><strong>bold</strong></p>')).toBe(
      '<p><strong>bold</strong></p>',
    )
  })

  it('returns empty string for empty input', () => {
    expect(normalizeToHtml('')).toBe('')
  })
})

describe('sanitizeRichText', () => {
  it('strips script tags', () => {
    const dirty = '<p>hi</p><script>alert(1)</script>'
    const clean = sanitizeRichText(dirty)
    expect(clean).toBe('<p>hi</p>')
    expect(clean).not.toMatch(/script/i)
  })

  it('strips event handlers', () => {
    const clean = sanitizeRichText('<p onclick="alert(1)">text</p>')
    expect(clean).not.toMatch(/onclick/i)
    expect(clean).toContain('text')
  })

  it('preserves allowed formatting', () => {
    const clean = sanitizeRichText(
      '<p><strong>b</strong> <em>i</em> <ul><li>x</li></ul></p>',
    )
    expect(clean).toContain('<strong>b</strong>')
    expect(clean).toContain('<em>i</em>')
    expect(clean).toContain('<li>x</li>')
  })

  it('preserves safe links', () => {
    const clean = sanitizeRichText('<a href="https://example.com">x</a>')
    expect(clean).toContain('href="https://example.com"')
  })

  it('drops javascript: URLs', () => {
    const clean = sanitizeRichText('<a href="javascript:alert(1)">x</a>')
    expect(clean).not.toMatch(/javascript:/i)
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import i18n from '@/lib/i18n'
import { useLanguageStore } from './language.store'

describe('useLanguageStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useLanguageStore.setState({ language: 'en' })
    document.documentElement.lang = 'en'
    document.documentElement.dir = 'ltr'
    void i18n.changeLanguage('en')
  })

  it('defaults to English / ltr', () => {
    expect(useLanguageStore.getState().language).toBe('en')
  })

  it('switches language, persists, and updates <html lang>', () => {
    useLanguageStore.getState().setLanguage('es')

    expect(useLanguageStore.getState().language).toBe('es')
    expect(i18n.language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(document.documentElement.dir).toBe('ltr')

    const stored = JSON.parse(localStorage.getItem('hospitalrun-language') ?? '{}')
    expect(stored.state.language).toBe('es')
  })

  it('applies rtl direction for Arabic', () => {
    useLanguageStore.getState().setLanguage('ar')
    expect(document.documentElement.dir).toBe('rtl')
    expect(document.documentElement.lang).toBe('ar')
  })

  it('re-renders translations after language change', async () => {
    useLanguageStore.getState().setLanguage('es')
    await Promise.resolve()
    expect(i18n.t('actions.save')).toBe('Guardar')

    useLanguageStore.getState().setLanguage('en')
    await Promise.resolve()
    expect(i18n.t('actions.save')).toBe('Save')
  })
})

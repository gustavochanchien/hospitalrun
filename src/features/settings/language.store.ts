import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n, { getDirection, type LanguageCode } from '@/lib/i18n'

interface LanguageState {
  language: LanguageCode
  setLanguage: (lang: LanguageCode) => void
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => {
        set({ language })
        applyLanguage(language)
      },
    }),
    {
      name: 'hospitalrun-language',
      onRehydrateStorage: () => (state) => {
        if (state) applyLanguage(state.language)
      },
    },
  ),
)

function applyLanguage(language: LanguageCode) {
  void i18n.changeLanguage(language)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
    document.documentElement.dir = getDirection(language)
  }
}

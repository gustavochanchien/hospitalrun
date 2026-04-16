import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const NAMESPACES = [
  'common',
  'patient',
  'scheduling',
  'labs',
  'medications',
  'imaging',
  'incidents',
  'settings',
  'dashboard',
] as const

export type Namespace = (typeof NAMESPACES)[number]

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', dir: 'ltr' },
  { code: 'ar', name: 'العربية', dir: 'rtl' },
  { code: 'de', name: 'Deutsch', dir: 'ltr' },
  { code: 'es', name: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'Français', dir: 'ltr' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'it', name: 'Italiano', dir: 'ltr' },
  { code: 'ja', name: '日本語', dir: 'ltr' },
  { code: 'pt-BR', name: 'Português (Brasil)', dir: 'ltr' },
  { code: 'ru', name: 'Русский', dir: 'ltr' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr' },
  { code: 'zh-CN', name: '中文 (简体)', dir: 'ltr' },
] as const

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code']

const modules = import.meta.glob('./locales/*/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, unknown> }
>

const resources: Record<string, Record<string, Record<string, unknown>>> = {}
for (const [path, mod] of Object.entries(modules)) {
  const match = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const [, lang, ns] = match
  if (!NAMESPACES.includes(ns as Namespace)) continue
  resources[lang] ??= {}
  resources[lang][ns] = mod.default
}

export function getDirection(code: string): 'ltr' | 'rtl' {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.dir ?? 'ltr'
}

i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'common',
  ns: [...NAMESPACES],
  interpolation: {
    escapeValue: false,
  },
})

export default i18n

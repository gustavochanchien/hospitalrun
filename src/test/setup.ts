import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import '@/lib/i18n'

// Polyfill ResizeObserver for jsdom (required by Radix UI components like Checkbox, Select)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// Polyfill ResizeObserver for jsdom (required by Radix UI components like Checkbox, Select)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

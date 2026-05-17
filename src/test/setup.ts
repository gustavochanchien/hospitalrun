import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import '@/lib/i18n'

// Polyfill ResizeObserver for jsdom (required by Radix UI components like Checkbox, Select)
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom lacks PointerEvent capture / scrollIntoView; Radix Select uses both.
// Guarded — this setup file is also imported by node-environment suites.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
}

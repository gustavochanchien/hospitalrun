/**
 * Catalog of optional features that can be enabled per org and assigned
 * to individual users. Core clinical features (patients, labs, etc.) are
 * always on and not listed here.
 *
 * To add a feature: append the key here, populate FEATURE_METADATA, and
 * add the matching `i18n` keys under `features` and a route + sidebar
 * entry guarded with `<FeatureGate feature="...">`.
 */

export const FEATURES = ['pdf-export', 'billing', 'inventory', 'vitals', 'trends'] as const

export type Feature = (typeof FEATURES)[number]

export interface FeatureMetadata {
  /** i18n key within the `features` namespace */
  labelKey: string
  /** i18n key for the longer description, within the `features` namespace */
  descriptionKey: string
  /** Whether this feature is on by default when a brand-new org is created */
  defaultOn: boolean
}

export const FEATURE_METADATA: Record<Feature, FeatureMetadata> = {
  'pdf-export': {
    labelKey: 'pdfExport.label',
    descriptionKey: 'pdfExport.description',
    defaultOn: false,
  },
  billing: {
    labelKey: 'billing.label',
    descriptionKey: 'billing.description',
    defaultOn: false,
  },
  inventory: {
    labelKey: 'inventory.label',
    descriptionKey: 'inventory.description',
    defaultOn: false,
  },
  vitals: {
    labelKey: 'vitals.label',
    descriptionKey: 'vitals.description',
    defaultOn: false,
  },
  trends: {
    labelKey: 'trends.label',
    descriptionKey: 'trends.description',
    defaultOn: false,
  },
}

export function isFeature(value: string): value is Feature {
  return (FEATURES as readonly string[]).includes(value)
}

export const THEMES = ['original', 'abyss', 'cappuccino', 'light'] as const
export type Theme = (typeof THEMES)[number]
export const DEFAULT_THEME: Theme = 'original'

export const THEME_LABELS: Record<Theme, string> = {
  original: 'Original',
  abyss: 'Abyss',
  cappuccino: 'Cappuccino',
  light: 'Light',
}

export const DARK_THEMES: ReadonlySet<Theme> = new Set(['abyss', 'cappuccino'])

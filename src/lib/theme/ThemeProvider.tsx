import type { ReactNode } from 'react'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { DEFAULT_THEME, THEMES } from './themes'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      themes={[...THEMES]}
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}

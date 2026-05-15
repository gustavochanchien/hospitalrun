import { useTheme } from 'next-themes'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_THEME,
  THEMES,
  THEME_LABELS,
  type Theme,
} from '@/lib/theme/themes'

const SWATCHES: Record<Theme, { bg: string; primary: string; sidebar: string }> = {
  original: { bg: '#ffffff', primary: '#1abc9c', sidebar: '#243239' },
  abyss: { bg: '#000c18', primary: '#4fc3f7', sidebar: '#000814' },
  cappuccino: { bg: '#2a2520', primary: '#c69c6d', sidebar: '#1f1a16' },
  light: { bg: '#ffffff', primary: '#2563eb', sidebar: '#fafafa' },
}

export function ThemeCard() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation('settings')
  const current = ((theme as Theme | undefined) ?? DEFAULT_THEME) as Theme

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('appearance.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-w-xs space-y-2">
          <Label>{t('appearance.theme')}</Label>
          <Select
            value={current}
            onValueChange={(value) => setTheme(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((name) => (
                <SelectItem key={name} value={name}>
                  <div className="flex items-center gap-2">
                    <ThemeSwatch theme={name} />
                    <span>{THEME_LABELS[name]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t('appearance.help')}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ThemeSwatch({ theme }: { theme: Theme }) {
  const swatch = SWATCHES[theme]
  return (
    <span
      className="inline-flex h-4 w-6 overflow-hidden rounded-sm border"
      aria-hidden="true"
    >
      <span className="block h-full w-1/3" style={{ background: swatch.sidebar }} />
      <span className="block h-full w-1/3" style={{ background: swatch.bg }} />
      <span className="block h-full w-1/3" style={{ background: swatch.primary }} />
    </span>
  )
}

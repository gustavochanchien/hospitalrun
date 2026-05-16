import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'

interface PrintButtonProps {
  disabled?: boolean
  label?: string
}

export function PrintButton({ disabled, label }: PrintButtonProps) {
  return (
    <FeatureGate feature="pdf-export">
      <PrintButtonInner disabled={disabled} label={label} />
    </FeatureGate>
  )
}

function PrintButtonInner({ disabled, label }: PrintButtonProps) {
  const { t } = useTranslation('pdf')
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => window.print()}
    >
      <Printer className="mr-1.5 h-4 w-4" />
      {label ?? t('actions.print')}
    </Button>
  )
}

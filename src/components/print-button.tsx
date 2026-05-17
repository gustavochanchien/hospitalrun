import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'

interface PrintButtonProps {
  disabled?: boolean
  label?: string
  /** Fires before window.print() — used to record a HIPAA `print` audit event. */
  onBeforePrint?: () => void
}

export function PrintButton(props: PrintButtonProps) {
  return (
    <FeatureGate feature="pdf-export">
      <PrintButtonInner {...props} />
    </FeatureGate>
  )
}

function PrintButtonInner({ disabled, label, onBeforePrint }: PrintButtonProps) {
  const { t } = useTranslation('pdf')
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => {
        onBeforePrint?.()
        window.print()
      }}
    >
      <Printer className="mr-1.5 h-4 w-4" />
      {label ?? t('actions.print')}
    </Button>
  )
}

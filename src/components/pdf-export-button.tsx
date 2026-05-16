import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { FeatureGate } from '@/components/ui/feature-gate'
import { generatePdfBlob } from '@/lib/pdf'

interface PdfExportButtonProps {
  /** File stem (without `.pdf`). A `-YYYY-MM-DD.pdf` suffix is appended. */
  filename: string
  /**
   * Produces the document element to render. Called on click so dynamic
   * imports of large `@react-pdf/renderer` Documents stay outside the
   * initial bundle.
   */
  buildDocument: () => Promise<ReactElement<DocumentProps>>
  disabled?: boolean
  label?: string
}

function suggestFilename(stem: string): string {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${stem}-${yyyy}-${mm}-${dd}.pdf`
}

export function PdfExportButton(props: PdfExportButtonProps) {
  return (
    <FeatureGate feature="pdf-export">
      <PdfExportButtonInner {...props} />
    </FeatureGate>
  )
}

function PdfExportButtonInner({
  filename,
  buildDocument,
  disabled,
  label,
}: PdfExportButtonProps) {
  const { t } = useTranslation('pdf')
  const [isGenerating, setIsGenerating] = useState(false)

  async function handleClick() {
    setIsGenerating(true)
    try {
      const element = await buildDocument()
      const blob = await generatePdfBlob(element)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = suggestFilename(filename)
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || isGenerating}
      onClick={() => void handleClick()}
    >
      {isGenerating ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="mr-1.5 h-4 w-4" />
      )}
      {isGenerating ? t('actions.generating') : (label ?? t('actions.exportPdf'))}
    </Button>
  )
}

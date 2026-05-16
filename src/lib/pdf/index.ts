import { pdf } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'

export { pdfTheme, pdfStyles } from './theme'
export { PdfHeader } from './Header'
export { PdfFooter } from './Footer'

/**
 * Render a @react-pdf/renderer Document element to a Blob. Caller is
 * responsible for kicking off the download (e.g. via a temporary anchor
 * or URL.createObjectURL).
 */
export async function generatePdfBlob(
  document: ReactElement<DocumentProps>,
): Promise<Blob> {
  return pdf(document).toBlob()
}

/**
 * Convert a remote image URL into a base64 data URL so it can be
 * embedded directly in a PDF. Returns null on network/security failure;
 * callers should render a placeholder in that case.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const buffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i])
    }
    const mime = blob.type || 'application/octet-stream'
    return `data:${mime};base64,${btoa(binary)}`
  } catch {
    return null
  }
}

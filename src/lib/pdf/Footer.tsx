import { Text, View, StyleSheet } from '@react-pdf/renderer'
import { pdfTheme } from './theme'

const styles = StyleSheet.create({
  footer: {
    position: 'absolute',
    bottom: 18,
    left: pdfTheme.spacing.page,
    right: pdfTheme.spacing.page,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: pdfTheme.colors.border,
    fontSize: pdfTheme.fontSizes.footer,
    color: pdfTheme.colors.muted,
  },
})

interface FooterProps {
  generatedLabel: string
  pageLabel: string
}

export function PdfFooter({ generatedLabel, pageLabel }: FooterProps) {
  return (
    <View style={styles.footer} fixed>
      <Text>{generatedLabel}</Text>
      <Text
        render={({ pageNumber, totalPages }) =>
          pageLabel
            .replace('{{page}}', String(pageNumber))
            .replace('{{total}}', String(totalPages))
        }
      />
    </View>
  )
}

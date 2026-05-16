import { Text, View, StyleSheet } from '@react-pdf/renderer'
import { pdfTheme } from './theme'

const styles = StyleSheet.create({
  header: {
    marginBottom: pdfTheme.spacing.section,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: pdfTheme.colors.border,
  },
  orgName: {
    fontSize: pdfTheme.fontSizes.small,
    color: pdfTheme.colors.muted,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: pdfTheme.fontSizes.title,
    fontFamily: 'Helvetica-Bold',
    color: pdfTheme.colors.text,
    marginTop: 2,
  },
  subtitle: {
    fontSize: pdfTheme.fontSizes.body,
    color: pdfTheme.colors.muted,
    marginTop: 2,
  },
})

interface HeaderProps {
  orgName: string
  title: string
  subtitle?: string
}

export function PdfHeader({ orgName, title, subtitle }: HeaderProps) {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.orgName}>{orgName}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  )
}

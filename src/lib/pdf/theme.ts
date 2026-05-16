import { StyleSheet } from '@react-pdf/renderer'

export const pdfTheme = {
  colors: {
    text: '#111827',
    muted: '#4b5563',
    border: '#d1d5db',
    accent: '#0f766e',
    danger: '#b91c1c',
    background: '#ffffff',
  },
  fontSizes: {
    title: 18,
    heading: 13,
    body: 10,
    small: 9,
    footer: 8,
  },
  spacing: {
    page: 36,
    section: 14,
    row: 4,
  },
} as const

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: pdfTheme.spacing.page,
    paddingBottom: pdfTheme.spacing.page + 18,
    paddingHorizontal: pdfTheme.spacing.page,
    backgroundColor: pdfTheme.colors.background,
    color: pdfTheme.colors.text,
    fontSize: pdfTheme.fontSizes.body,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  section: {
    marginBottom: pdfTheme.spacing.section,
  },
  sectionHeading: {
    fontSize: pdfTheme.fontSizes.heading,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: pdfTheme.colors.border,
    color: pdfTheme.colors.text,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: pdfTheme.spacing.row,
  },
  fieldLabel: {
    width: 110,
    color: pdfTheme.colors.muted,
  },
  fieldValue: {
    flex: 1,
  },
  twoColRow: {
    flexDirection: 'row',
    marginBottom: pdfTheme.spacing.row,
  },
  twoColItem: {
    flex: 1,
    paddingRight: 8,
  },
  body: {
    marginTop: 2,
    color: pdfTheme.colors.text,
  },
  muted: {
    color: pdfTheme.colors.muted,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  listBullet: {
    width: 10,
    color: pdfTheme.colors.muted,
  },
})

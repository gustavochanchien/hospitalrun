import { format } from 'date-fns'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportCSV } from '@/lib/csv-export'

export interface ExportColumn<T> {
  header: string
  accessor: (row: T) => string
}

interface ExportButtonProps<T> {
  filename: string
  rows: T[]
  columns: ExportColumn<T>[]
  label?: string
  disabled?: boolean
}

export function ExportButton<T>({
  filename,
  rows,
  columns,
  label = 'CSV',
  disabled,
}: ExportButtonProps<T>) {
  const isDisabled = disabled || rows.length === 0
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={isDisabled}
      onClick={() => {
        const timestamp = format(new Date(), 'yyyy-MM-dd--hh-mma')
        const headers = columns.map((c) => c.header)
        const data = rows.map((row) => columns.map((c) => c.accessor(row)))
        exportCSV(`${filename}-${timestamp}.csv`, headers, data)
      }}
    >
      <Download className="mr-1.5 h-4 w-4" />
      {label}
    </Button>
  )
}

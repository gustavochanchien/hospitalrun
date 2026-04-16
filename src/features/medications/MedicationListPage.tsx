import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, parseISO } from 'date-fns'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'
import { ExportButton } from '@/components/export-button'
import { MEDICATION_STATUSES, type MedicationStatus } from './medication.schema'

const PAGE_SIZE = 20

function statusVariant(status: MedicationStatus) {
  switch (status) {
    case 'active':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'canceled':
    case 'entered in error':
    case 'stopped':
      return 'destructive' as const
    case 'on hold':
      return 'outline' as const
    default:
      return 'secondary' as const
  }
}

export function MedicationListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const medications = useLiveQuery(
    () => db.medications.filter((m) => !m._deleted).toArray(),
    [],
  )

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  if (medications === undefined || patients === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  }

  const patientNameMap = new Map(
    patients.map((p) => [p.id, `${p.givenName} ${p.familyName}`]),
  )

  const searchLower = search.toLowerCase()
  const filtered = medications.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false
    if (search) {
      const medName = m.name.toLowerCase()
      const patientName = (patientNameMap.get(m.patientId) ?? '').toLowerCase()
      if (!medName.includes(searchLower) && !patientName.includes(searchLower)) {
        return false
      }
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-4 p-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by medication or patient name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v)
            setPage(0)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {MEDICATION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length} medication{filtered.length !== 1 ? 's' : ''}
        </p>
        <ExportButton
          filename="Medications"
          rows={filtered}
          columns={[
            { header: 'Medication Name', accessor: (m) => m.name },
            {
              header: 'Patient',
              accessor: (m) => patientNameMap.get(m.patientId) ?? '',
            },
            { header: 'Status', accessor: (m) => m.status },
            {
              header: 'Quantity',
              accessor: (m) => (m.quantity != null ? String(m.quantity) : ''),
            },
            {
              header: 'Start Date',
              accessor: (m) =>
                m.startDate
                  ? format(parseISO(m.startDate), 'yyyy-MM-dd')
                  : '',
            },
            {
              header: 'End Date',
              accessor: (m) =>
                m.endDate ? format(parseISO(m.endDate), 'yyyy-MM-dd') : '',
            },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'No medications match your search.'
              : 'No medications yet.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/medications/new">Add Your First Medication</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medication Name</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((med) => (
                  <TableRow key={med.id}>
                    <TableCell>
                      <Link
                        to="/medications/$medicationId"
                        params={{ medicationId: med.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {med.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/patients/$patientId"
                        params={{ patientId: med.patientId }}
                        className="text-primary hover:underline"
                      >
                        {patientNameMap.get(med.patientId) ?? 'Unknown'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(med.status)}>
                        {med.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {med.quantity ?? '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {med.startDate
                        ? format(parseISO(med.startDate), 'MMM d, yyyy')
                        : '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {med.endDate
                        ? format(parseISO(med.endDate), 'MMM d, yyyy')
                        : '\u2014'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

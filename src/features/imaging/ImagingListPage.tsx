import { useState, useMemo } from 'react'
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
import type { Patient } from '@/lib/db/schema'
import { ExportButton } from '@/components/export-button'

const PAGE_SIZE = 20

function statusVariant(status: string) {
  switch (status) {
    case 'requested':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'canceled':
      return 'destructive' as const
    default:
      return 'secondary' as const
  }
}

export function ImagingListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const imagingRecords = useLiveQuery(
    () => db.imaging.filter((i) => !i._deleted).toArray(),
    [],
  )

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  const patientMap = useMemo(() => {
    if (!patients) return new Map<string, Patient>()
    const map = new Map<string, Patient>()
    for (const p of patients) {
      map.set(p.id, p)
    }
    return map
  }, [patients])

  if (imagingRecords === undefined || patients === undefined) {
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

  const searchLower = search.toLowerCase()
  const filtered = imagingRecords.filter((img) => {
    if (statusFilter !== 'all' && img.status !== statusFilter) return false
    if (search) {
      const patient = patientMap.get(img.patientId)
      const fullName = patient
        ? `${patient.givenName} ${patient.familyName}`.toLowerCase()
        : ''
      const typeLower = img.type.toLowerCase()
      if (!fullName.includes(searchLower) && !typeLower.includes(searchLower)) {
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
            placeholder="Search by patient name or imaging type..."
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
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="requested">Requested</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length} request{filtered.length !== 1 ? 's' : ''}
        </p>
        <ExportButton
          filename="Imaging"
          rows={filtered}
          columns={[
            {
              header: 'Patient',
              accessor: (img) => {
                const p = patientMap.get(img.patientId)
                return p ? `${p.givenName} ${p.familyName}` : ''
              },
            },
            { header: 'Type', accessor: (img) => img.type },
            { header: 'Code', accessor: (img) => img.code ?? '' },
            { header: 'Status', accessor: (img) => img.status },
            {
              header: 'Requested On',
              accessor: (img) =>
                img.requestedOn
                  ? format(parseISO(img.requestedOn), 'yyyy-MM-dd HH:mm')
                  : '',
            },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'No imaging requests match your search.'
              : 'No imaging requests yet.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/imaging/new">Create Your First Request</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((img) => {
                  const patient = patientMap.get(img.patientId)
                  const patientName = patient
                    ? `${patient.givenName} ${patient.familyName}`
                    : 'Unknown Patient'

                  return (
                    <TableRow key={img.id}>
                      <TableCell>
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: img.patientId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {patientName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/imaging/$imagingId"
                          params={{ imagingId: img.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {img.type}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {img.code ?? '\u2014'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(img.status)}>
                          {img.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(img.requestedOn), 'MMM d, yyyy h:mm a')}
                      </TableCell>
                    </TableRow>
                  )
                })}
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

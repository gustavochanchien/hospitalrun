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

const PAGE_SIZE = 20

export function PatientListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const patients = useLiveQuery(
    () => db.patients.filter((p) => !p._deleted).toArray(),
    [],
  )

  if (patients === undefined) {
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
  const filtered = patients.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (search) {
      const fullName = `${p.givenName} ${p.familyName}`.toLowerCase()
      const mrn = (p.mrn ?? '').toLowerCase()
      if (!fullName.includes(searchLower) && !mrn.includes(searchLower)) {
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
            placeholder="Search by name or MRN..."
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="deceased">Deceased</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length} patient{filtered.length !== 1 ? 's' : ''}
        </p>
        <ExportButton
          filename="Patients"
          rows={filtered}
          columns={[
            {
              header: 'Name',
              accessor: (p) =>
                [p.prefix, p.givenName, p.familyName, p.suffix]
                  .filter(Boolean)
                  .join(' '),
            },
            { header: 'MRN', accessor: (p) => p.mrn ?? '' },
            {
              header: 'Date of Birth',
              accessor: (p) =>
                p.dateOfBirth
                  ? format(parseISO(p.dateOfBirth), 'yyyy-MM-dd')
                  : '',
            },
            { header: 'Sex', accessor: (p) => p.sex ?? '' },
            { header: 'Phone', accessor: (p) => p.phone ?? '' },
            { header: 'Status', accessor: (p) => p.status },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'No patients match your search.'
              : 'No patients yet.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/patients/new">Add Your First Patient</Link>
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>MRN</TableHead>
                  <TableHead>Date of Birth</TableHead>
                  <TableHead>Sex</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <Link
                        to="/patients/$patientId"
                        params={{ patientId: patient.id }}
                        className="font-medium text-primary hover:underline"
                      >
                        {patient.prefix ? `${patient.prefix} ` : ''}
                        {patient.givenName} {patient.familyName}
                        {patient.suffix ? ` ${patient.suffix}` : ''}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.mrn ?? '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.dateOfBirth
                        ? format(parseISO(patient.dateOfBirth), 'MMM d, yyyy')
                        : '\u2014'}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {patient.sex ?? '\u2014'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.phone ?? '\u2014'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={patient.status} />
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

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active'
      ? 'default'
      : status === 'deceased'
        ? 'destructive'
        : 'secondary'
  return <Badge variant={variant}>{status}</Badge>
}

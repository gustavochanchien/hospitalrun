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
    case 'scheduled':
      return 'default' as const
    case 'completed':
      return 'secondary' as const
    case 'cancelled':
      return 'destructive' as const
    case 'no-show':
      return 'outline' as const
    default:
      return 'secondary' as const
  }
}

export function AppointmentListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  const appointments = useLiveQuery(
    () => db.appointments.filter((a) => !a._deleted).toArray(),
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

  if (appointments === undefined || patients === undefined) {
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
  const filtered = appointments.filter((appt) => {
    if (statusFilter !== 'all' && appt.status !== statusFilter) return false
    if (search) {
      const patient = patientMap.get(appt.patientId)
      if (!patient) return false
      const fullName = `${patient.givenName} ${patient.familyName}`.toLowerCase()
      if (!fullName.includes(searchLower)) return false
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
            placeholder="Search by patient name..."
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
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no-show">No Show</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {filtered.length} appointment{filtered.length !== 1 ? 's' : ''}
        </p>
        <ExportButton
          filename="Appointments"
          rows={filtered}
          columns={[
            {
              header: 'Patient',
              accessor: (a) => {
                const p = patientMap.get(a.patientId)
                return p ? `${p.givenName} ${p.familyName}` : ''
              },
            },
            { header: 'Type', accessor: (a) => a.type ?? '' },
            {
              header: 'Date / Time',
              accessor: (a) =>
                a.startTime
                  ? format(parseISO(a.startTime), 'yyyy-MM-dd HH:mm')
                  : '',
            },
            { header: 'Location', accessor: (a) => a.location ?? '' },
            { header: 'Status', accessor: (a) => a.status },
          ]}
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">
            {search || statusFilter !== 'all'
              ? 'No appointments match your search.'
              : 'No appointments yet.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button asChild className="mt-4">
              <Link to="/appointments/new">Schedule Your First Appointment</Link>
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
                  <TableHead>Date / Time</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((appt) => {
                  const patient = patientMap.get(appt.patientId)
                  const patientName = patient
                    ? `${patient.givenName} ${patient.familyName}`
                    : 'Unknown Patient'

                  return (
                    <TableRow key={appt.id}>
                      <TableCell>
                        <Link
                          to="/patients/$patientId"
                          params={{ patientId: appt.patientId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {patientName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {appt.type ?? '\u2014'}
                      </TableCell>
                      <TableCell>
                        <Link
                          to="/appointments/$appointmentId"
                          params={{ appointmentId: appt.id }}
                          className="text-primary hover:underline"
                        >
                          {format(parseISO(appt.startTime), 'MMM d, yyyy h:mm a')}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {appt.location ?? '\u2014'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(appt.status)}>
                          {appt.status}
                        </Badge>
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

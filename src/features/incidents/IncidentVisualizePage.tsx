import { useLiveQuery } from 'dexie-react-hooks'
import { getMonth, getYear, parseISO } from 'date-fns'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { db } from '@/lib/db'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function IncidentVisualizePage() {
  const incidents = useLiveQuery(
    () => db.incidents.filter((i) => !i._deleted).toArray(),
    [],
  )

  if (incidents === undefined) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No incident data to visualize.</p>
      </div>
    )
  }

  const byCategory = groupBy(incidents, (i) => i.category ?? 'Uncategorized')
  const byStatus = groupBy(incidents, (i) => i.status)
  const byDepartment = groupBy(incidents, (i) => i.department ?? 'Unassigned')

  // Monthly trend data
  const currentYear = new Date().getFullYear()
  const monthlyData = MONTHS.map((name, index) => {
    const count = incidents.filter((inc) => {
      try {
        const d = parseISO(inc.reportedOn)
        return getMonth(d) === index && getYear(d) === currentYear
      } catch {
        return false
      }
    }).length
    return { name, count }
  })

  const maxCategory = Math.max(...Object.values(byCategory).map((arr) => arr.length))
  const maxStatus = Math.max(...Object.values(byStatus).map((arr) => arr.length))
  const maxDepartment = Math.max(...Object.values(byDepartment).map((arr) => arr.length))

  return (
    <div className="space-y-6 p-6">
      {/* Monthly Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Trend ({currentYear})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis allowDecimals={false} fontSize={12} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="count"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4 }}
                name="Incidents"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By Category */}
      <Card>
        <CardHeader>
          <CardTitle>By Category</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(byCategory)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([category, items]) => (
              <div key={category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{category}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="h-4 w-full rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary transition-all"
                    style={{
                      width: `${(items.length / maxCategory) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* By Status */}
      <Card>
        <CardHeader>
          <CardTitle>By Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(byStatus)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([status, items]) => (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">{status}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="h-4 w-full rounded bg-muted">
                  <div
                    className="h-4 rounded transition-all"
                    style={{
                      width: `${(items.length / maxStatus) * 100}%`,
                      backgroundColor:
                        status === 'reported'
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--muted-foreground))',
                    }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* By Department */}
      <Card>
        <CardHeader>
          <CardTitle>By Department</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(byDepartment)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([department, items]) => (
              <div key={department} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{department}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                <div className="h-4 w-full rounded bg-muted">
                  <div
                    className="h-4 rounded bg-primary transition-all"
                    style={{
                      width: `${(items.length / maxDepartment) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const key = keyFn(item)
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(item)
  }
  return result
}

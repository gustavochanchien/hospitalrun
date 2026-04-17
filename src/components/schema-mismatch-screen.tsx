interface SchemaMismatchScreenProps {
  reason: 'stale-db' | 'missing-rpc'
}

export function SchemaMismatchScreen({ reason }: SchemaMismatchScreenProps) {
  const headline =
    reason === 'missing-rpc'
      ? 'Database schema not yet installed'
      : 'Database schema is out of date'

  const body =
    reason === 'missing-rpc'
      ? 'The connected Supabase project has not had the HospitalRun schema applied. An administrator needs to run deploy.sql in the Supabase SQL Editor.'
      : 'This version of the HospitalRun app expects a newer database schema than is currently installed. An administrator needs to re-apply deploy.sql with the latest migrations.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md space-y-4 rounded-lg border bg-card p-6 shadow">
        <h1 className="text-xl font-semibold">{headline}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <p className="text-sm text-muted-foreground">
          See the DEPLOY.md guide in the repository for step-by-step instructions.
        </p>
      </div>
    </div>
  )
}

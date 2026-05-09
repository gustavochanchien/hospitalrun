import { Laptop, Network } from 'lucide-react'

export type SetupMode = 'solo' | 'hub'

interface ModeChooserProps {
  onPick: (mode: SetupMode) => void
}

export function ModeChooser({ onPick }: ModeChooserProps) {
  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={() => onPick('solo')}
        className="group rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:bg-accent/50"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Laptop className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Just this computer</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              HospitalRun runs on this device only. Use it the way you would a
              normal app. Good for a single doctor or a personal setup.
            </p>
          </div>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick('hub')}
        className="group rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:bg-accent/50"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-primary/10 p-2 text-primary">
            <Network className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Run as a clinic hub</h3>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Recommended for clinics
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              This computer hosts HospitalRun for the clinic. Tablets and other
              laptops on the same network connect to it from a browser. Keep
              working together even when the internet is down.
            </p>
          </div>
        </div>
      </button>
    </div>
  )
}

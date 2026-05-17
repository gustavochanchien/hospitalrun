import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, Wifi, WifiOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { checkInteractions, type InteractionResult, type InteractionSeverity } from '@/lib/drug-interactions/checker'
import { fetchOpenFdaInteractionText } from '@/lib/drug-interactions/openfda'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { Medication } from '@/lib/db/schema'

interface DrugInteractionAlertProps {
  activeMedications: Medication[]
  highlightMedName?: string
}

const SEVERITY_CLASSES: Record<InteractionSeverity, string> = {
  contraindicated: 'bg-destructive/15 border-destructive/40 text-destructive',
  major: 'bg-orange-50 border-orange-300 text-orange-900 dark:bg-orange-950/30 dark:border-orange-700 dark:text-orange-300',
  moderate: 'bg-yellow-50 border-yellow-300 text-yellow-900 dark:bg-yellow-950/30 dark:border-yellow-700 dark:text-yellow-300',
  minor: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300',
}

const SEVERITY_BADGE_CLASSES: Record<InteractionSeverity, string> = {
  contraindicated: 'bg-destructive text-destructive-foreground',
  major: 'bg-orange-500 text-white',
  moderate: 'bg-yellow-500 text-white',
  minor: 'bg-blue-500 text-white',
}

interface ExpandedRow {
  loading: boolean
  text: string | null
}

export function DrugInteractionAlert({ activeMedications, highlightMedName }: DrugInteractionAlertProps) {
  const { t } = useTranslation('medications')
  const isOnline = useOnlineStatus()
  const [interactions, setInteractions] = useState<InteractionResult[]>([])
  const [expanded, setExpanded] = useState<Record<string, ExpandedRow>>({})

  useEffect(() => {
    let cancelled = false
    checkInteractions(activeMedications.map((m) => m.name)).then((result) => {
      if (!cancelled) setInteractions(result)
    })
    return () => { cancelled = true }
  }, [activeMedications])

  if (interactions.length === 0) return null

  function pairKey(r: InteractionResult) {
    return `${r.drug1}||${r.drug2}`
  }

  function highlightName(name: string) {
    if (highlightMedName && name.toLowerCase() === highlightMedName.toLowerCase()) {
      return <strong>{name}</strong>
    }
    return <span>{name}</span>
  }

  async function toggleExpanded(r: InteractionResult) {
    const key = pairKey(r)
    if (expanded[key]) {
      setExpanded((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    if (!isOnline) {
      setExpanded((prev) => ({ ...prev, [key]: { loading: false, text: null } }))
      return
    }

    setExpanded((prev) => ({ ...prev, [key]: { loading: true, text: null } }))
    const text = await fetchOpenFdaInteractionText(r.drug1)
    setExpanded((prev) => ({ ...prev, [key]: { loading: false, text } }))
  }

  const mostSevere = interactions[0].severity

  return (
    <div
      className={`rounded-md border p-3 mb-4 text-sm space-y-2 ${SEVERITY_CLASSES[mostSevere]}`}
      role="alert"
      aria-label={t('drugInteraction.warningTitle')}
    >
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {t('drugInteraction.warningTitle')}
      </div>

      <div className="space-y-2">
        {interactions.map((r) => {
          const key = pairKey(r)
          const row = expanded[key]
          return (
            <div key={key} className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {highlightName(r.drug1)}
                <span className="text-muted-foreground">↔</span>
                {highlightName(r.drug2)}
                <Badge className={`text-xs ${SEVERITY_BADGE_CLASSES[r.severity]}`}>
                  {t(`drugInteraction.severity.${r.severity}`)}
                </Badge>
              </div>
              <p className="text-xs opacity-80">{r.description}</p>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-xs gap-1"
                onClick={() => toggleExpanded(r)}
              >
                {row ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    {t('drugInteraction.viewLabel')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    {t('drugInteraction.viewLabel')}
                  </>
                )}
              </Button>

              {row && (
                <div className="text-xs mt-1 pl-2 border-l-2 border-current opacity-75">
                  {row.loading ? (
                    <span>Loading…</span>
                  ) : !isOnline ? (
                    <span className="flex items-center gap-1">
                      <WifiOff className="h-3 w-3" />
                      {t('drugInteraction.offlineNote')}
                    </span>
                  ) : row.text ? (
                    <p className="whitespace-pre-wrap">{row.text}</p>
                  ) : (
                    <span className="italic">No prescribing information found.</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs opacity-60 flex items-center gap-1">
        {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
        {t('drugInteraction.dataSource')}
      </p>
    </div>
  )
}

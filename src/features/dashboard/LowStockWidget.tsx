import { Link } from '@tanstack/react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { FeatureGate } from '@/components/ui/feature-gate'
import { db } from '@/lib/db'

const MAX_ROWS = 5

export function LowStockWidget() {
  const { t } = useTranslation('inventory')

  const items = useLiveQuery(
    () => db.inventoryItems.filter((i) => !i._deleted && i.active).toArray(),
    [],
  )

  const lowStock = items
    ? items
        .filter((i) => i.onHand <= i.reorderLevel)
        .sort((a, b) => a.onHand - b.onHand)
    : null

  return (
    <FeatureGate feature="inventory">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="size-4 text-destructive" />
            {t('lowStock.title')}
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/inventory">{t('lowStock.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {lowStock === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('lowStock.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, MAX_ROWS).map((item) => (
                <li key={item.id}>
                  <Link
                    to="/inventory/$itemId"
                    params={{ itemId: item.id }}
                    className="flex items-center justify-between rounded-md border px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.onHand.toFixed(2)} / {item.reorderLevel.toFixed(2)} {item.unit}
                      </p>
                    </div>
                    <Badge variant="destructive">{t('list.status.low')}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </FeatureGate>
  )
}

import { useTranslation } from 'react-i18next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionGuard } from '@/components/ui/permission-guard'
import { PharmacyQueue } from './PharmacyQueue'
import { WalkInDispenseForm } from './WalkInDispenseForm'

export function PharmacyPage() {
  const { t } = useTranslation('pharmacy')

  return (
    <div className="p-6">
      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">{t('tabs.queue')}</TabsTrigger>
          <TabsTrigger value="walkIn">{t('tabs.walkIn')}</TabsTrigger>
        </TabsList>
        <TabsContent value="queue">
          <PermissionGuard
            permission="read:pharmacy_queue"
            fallback={
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t('queue.notAuthorized')}
              </p>
            }
          >
            <PharmacyQueue />
          </PermissionGuard>
        </TabsContent>
        <TabsContent value="walkIn">
          <PermissionGuard
            permission="dispense:medication"
            fallback={
              <p className="p-6 text-center text-sm text-muted-foreground">
                {t('walkIn.notAuthorized')}
              </p>
            }
          >
            <WalkInDispenseForm />
          </PermissionGuard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

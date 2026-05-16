import type { ReactNode } from 'react'
import { useFeatureEnabled } from '@/hooks/useFeatureEnabled'
import type { Feature } from '@/lib/features'

interface FeatureGateProps {
  feature: Feature
  fallback?: ReactNode
  children: ReactNode
}

export function FeatureGate({ feature, fallback = null, children }: FeatureGateProps) {
  const enabled = useFeatureEnabled(feature)
  return enabled ? <>{children}</> : <>{fallback}</>
}

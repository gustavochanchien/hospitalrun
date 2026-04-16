import type { ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Link } from '@tanstack/react-router'

interface BreadcrumbEntry {
  label: string
  to?: string
}

interface PageHeaderProps {
  title: string
  breadcrumbs?: BreadcrumbEntry[]
  actions?: ReactNode
}

export function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b bg-background px-6 py-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-2" />
        <Separator orientation="vertical" className="h-4" />
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1
                return (
                  <span key={crumb.label} className="contents">
                    <BreadcrumbItem>
                      {isLast || !crumb.to ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link to={crumb.to}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </span>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  )
}

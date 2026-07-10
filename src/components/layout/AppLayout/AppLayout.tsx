import type { ReactNode } from 'react'
import Sidebar from '../Sidebar'
import AppHeader from '../AppHeader'
import type { BreadcrumbItem } from '../AppHeader'

export interface AppLayoutProps {
  children: ReactNode
  /** 面包屑导航项 */
  breadcrumbs?: BreadcrumbItem[]
}

const AppLayout = ({ children, breadcrumbs }: AppLayoutProps) => {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <AppHeader breadcrumbs={breadcrumbs} />
        <div className="app-content">{children}</div>
      </main>
    </div>
  )
}

export default AppLayout

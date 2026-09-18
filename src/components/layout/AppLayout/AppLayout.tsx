import type { ReactNode } from 'react'
import Sidebar from '../Sidebar'
import AppHeader from '../AppHeader'
import ProfileOnboarding from '@/components/business/ProfileOnboarding'
import type { BreadcrumbItem } from '../AppHeader'
import TaskContext from '../TaskContext'

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
        <TaskContext />
        <div className="app-content">{children}</div>
      </main>
      <ProfileOnboarding />
    </div>
  )
}

export default AppLayout

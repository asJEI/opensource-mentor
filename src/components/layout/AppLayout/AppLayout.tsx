import { t } from '@/i18n'
import type { ReactNode } from 'react'
import Sidebar from '../Sidebar'
import AppHeader from '../AppHeader'
import ProfileOnboarding from '@/components/business/ProfileOnboarding'
import type { BreadcrumbItem } from '../AppHeader'
import TaskContext from '../TaskContext'
import WorkspaceSyncStatus from '../WorkspaceSyncStatus'
import { useWorkspaceStore } from '@/store/workspace'
import { useUserStore } from '@/store/user'
import { useAppStore } from '@/store/app'

export interface AppLayoutProps {
  children: ReactNode
  /** 面包屑导航项 */
  breadcrumbs?: BreadcrumbItem[]
}

const AppLayout = ({ children, breadcrumbs }: AppLayoutProps) => {
  const sessionChecked = useAppStore((state) => state.sessionChecked)
  const serverUserId = useUserStore((state) => state.serverUserId)
  const workspace = useWorkspaceStore()
  const restoring = !sessionChecked || (serverUserId && (workspace.restoring || workspace.userId !== serverUserId))
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <AppHeader breadcrumbs={breadcrumbs} />
        <TaskContext />
        <WorkspaceSyncStatus />
        <div className="app-content">{restoring ? <p role="status">{t("正在恢复账户与贡献进度…")}</p> : children}</div>
      </main>
      <ProfileOnboarding />
    </div>
  )
}

export default AppLayout

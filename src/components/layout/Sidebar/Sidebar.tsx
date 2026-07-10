import { useNavigate, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { useAppStore, useUserStore, type AppSubPage } from '@/store'

interface NavItem {
  id: AppSubPage | (string & {})
  label: string
  icon: React.ReactNode
  badge?: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const navGroups: NavGroup[] = [
  {
    title: '主菜单',
    items: [
      {
        id: 'dashboard',
        label: '工作台',
        icon: <Icon d="M3 12l9-9 9 9M5 10v10h14V10" />,
      },
      {
        id: 'issues',
        label: 'Issue 推荐',
        icon: <Icon d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
        badge: '新',
      },
      {
        id: 'pr-generator',
        label: 'PR 生成器',
        icon: <Icon d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18M2 2l7.586 7.586M11 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />,
      },
      {
        id: 'code-review',
        label: '代码审查',
        icon: <Icon d="M9 12h6M12 9v6M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c2.39 0 4.68.94 6.36 2.64L21 3v9h-9" />,
      },
    ],
  },
  {
    title: '学习',
    items: [
      {
        id: 'roadmap',
        label: '学习路线',
        icon: <Icon d="M9 20l-5.447-2.724A1 1 0 0 1 3 16.382V5.618a1 1 0 0 1 1.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0 0 21 18.382V7.618a1 1 0 0 0-.553-.894L15 4m0 13V4m0 0L9 7" />,
      },
      {
        id: 'stats',
        label: '成长统计',
        icon: <Icon d="M9 19V13M15 19V5M21 21H3" />,
      },
    ],
  },
  {
    title: '设置',
    items: [
      {
        id: 'settings',
        label: '偏好设置',
        icon: <Icon d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />,
      },
    ],
  },
]

const contributionLevelMap: Record<string, string> = {
  none: '新手贡献者',
  low: '初级贡献者',
  medium: '中级贡献者',
  high: '高级贡献者',
}

const Sidebar = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const setCurrentAppPage = useAppStore((s) => s.setCurrentAppPage)
  const profile = useUserStore((s) => s.profile)

  const getInitials = (name: string) => {
    if (!name) return '?'
    return name
      .split(/[\s-]/)
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  // 从当前路径获取活动页面
  const getActivePage = (): string => {
    const path = location.pathname
    if (path === '/' || path === '/dashboard' || path.startsWith('/dashboard')) return 'dashboard'
    if (path === '/issues' || path.startsWith('/issues')) return 'issues'
    if (path === '/pr-generator' || path.startsWith('/pr-generator')) return 'pr-generator'
    if (path === '/code-review' || path.startsWith('/code-review')) return 'code-review'
    if (path === '/roadmap' || path.startsWith('/roadmap')) return 'roadmap'
    return 'dashboard'
  }

  const activePage = getActivePage()

  const handleNavClick = (id: string) => {
    // 仅在 id 匹配 AppSubPage 时切换，其余项保留为展示用
    const validPages: AppSubPage[] = ['dashboard', 'issues', 'pr-generator', 'code-review', 'roadmap']
    if (validPages.includes(id as AppSubPage)) {
      setCurrentAppPage(id as AppSubPage)
      navigate(id === 'dashboard' ? '/' : `/${id}`)
    }
  }

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-header">
        <span className="app-sidebar-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </span>
        <span className="app-sidebar-title">OpenSource Mentor</span>
      </div>

      <nav className="app-sidebar-nav">
        {navGroups.map((group) => (
          <div key={group.title} className="nav-group">
            <div className="nav-group-label">{group.title}</div>
            {group.items.map((item) => (
              <div
                key={item.id}
                className={clsx('nav-link-item', activePage === item.id && 'active')}
                onClick={() => handleNavClick(item.id)}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.username} />
            ) : (
              getInitials(profile.username)
            )}
          </div>
          <div className="user-info">
            <div className="user-name">{profile.username || '未登录'}</div>
            <div className="user-role">
              {contributionLevelMap[profile.contributionLevel] || '—'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar

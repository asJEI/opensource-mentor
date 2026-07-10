import clsx from 'clsx'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface AppHeaderProps {
  /** 面包屑导航项 */
  breadcrumbs?: BreadcrumbItem[]
  /** 搜索按钮点击回调 */
  onSearch?: () => void
  /** 通知按钮点击回调 */
  onNotification?: () => void
  /** 帮助按钮点击回调 */
  onHelp?: () => void
}

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const HelpIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
)

const AppHeader = ({ breadcrumbs = [], onSearch, onNotification, onHelp }: AppHeaderProps) => {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <nav className="breadcrumbs" aria-label="breadcrumb">
          {breadcrumbs.map((item, index) => {
            const isLast = index === breadcrumbs.length - 1
            return (
              <span key={`${item.label}-${index}`} className="breadcrumb-item">
                {item.href && !isLast ? (
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <span className={clsx(isLast && 'current')}>{item.label}</span>
                )}
                {!isLast && <ChevronRight />}
              </span>
            )
          })}
        </nav>
      </div>

      <div className="app-header-right">
        <button className="icon-btn" onClick={onSearch} aria-label="搜索">
          <SearchIcon />
        </button>
        <button className="icon-btn" onClick={onNotification} aria-label="通知">
          <BellIcon />
          <span className="notif-dot" />
        </button>
        <button className="icon-btn" onClick={onHelp} aria-label="帮助">
          <HelpIcon />
        </button>
      </div>
    </header>
  )
}

export default AppHeader

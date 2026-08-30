import clsx from 'clsx'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface AppHeaderProps {
  /** 面包屑导航项 */
  breadcrumbs?: BreadcrumbItem[]
}

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const AppHeader = ({ breadcrumbs = [] }: AppHeaderProps) => {
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
    </header>
  )
}

export default AppHeader

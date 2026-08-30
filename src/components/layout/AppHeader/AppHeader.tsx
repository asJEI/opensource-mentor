import clsx from 'clsx'

export interface BreadcrumbItem {
  label: string
  href?: string
}

export interface AppHeaderProps {
  /** 面包屑导航项 */
  breadcrumbs?: BreadcrumbItem[]
}

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
                {!isLast && <span className="breadcrumb-sep">/</span>}
              </span>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

export default AppHeader

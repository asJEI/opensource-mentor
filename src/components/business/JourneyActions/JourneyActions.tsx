import { useNavigate } from 'react-router-dom'

export interface JourneyPathItem {
  title: string
  description: string
  path: string
  primary?: boolean
}

export interface JourneyActionsProps {
  title?: string
  description?: string
  paths: JourneyPathItem[]
}

/**
 * Post-analysis multi-path guidance — keeps users in the contribution journey.
 */
export function JourneyActions({
  title = '接下来可以这样做',
  description = '任选一条路径继续，菜单随时可切换。',
  paths,
}: JourneyActionsProps) {
  const navigate = useNavigate()

  return (
    <div className="journey-actions">
      <div className="journey-actions-header">
        <div className="journey-actions-title">{title}</div>
        <div className="journey-actions-desc">{description}</div>
      </div>
      <div className="journey-actions-grid">
        {paths.map((item) => (
          <button
            key={item.path}
            type="button"
            className={
              item.primary
                ? 'journey-action-card journey-action-primary'
                : 'journey-action-card'
            }
            onClick={() => navigate(item.path)}
          >
            <strong>{item.title}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default JourneyActions

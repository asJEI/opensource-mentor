import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'

export interface AiPageErrorProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  showSettingsLink?: boolean
  className?: string
}

/**
 * Shared AI page error recovery: friendly message + retry + settings.
 * Avoids raw Axios / undefined dumps as the primary CTA surface.
 */
export function AiPageError({
  title = '出错了',
  message,
  onRetry,
  retryLabel = '重试',
  showSettingsLink = true,
  className,
}: AiPageErrorProps) {
  const navigate = useNavigate()

  return (
    <div className={className ? `ai-page-error ${className}` : 'ai-page-error'}>
      <h3 className="ai-page-error-title">{title}</h3>
      <p className="ai-page-error-message">{message || '请稍后重试'}</p>
      <div className="ai-page-error-actions">
        {onRetry ? (
          <Button variant="primary" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
        {showSettingsLink ? (
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            检查偏好设置
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default AiPageError

import { useNavigate } from 'react-router-dom'

export interface NextStepCardProps {
  /** 当前步骤序号 */
  currentStep: number
  /** 总步骤数 */
  totalSteps: number
  /** 引导标题 */
  title: string
  /** 引导描述 */
  description: string
  /** 按钮文字 */
  buttonText: string
  /** 跳转路径 */
  nextPath: string
  /** 点击回调（可选） */
  onClick?: () => void
}

/**
 * 下一步引导卡片
 * 在每个核心页面底部显示，引导用户进入下一个步骤
 */
export function NextStepCard({
  currentStep,
  totalSteps,
  title,
  description,
  buttonText,
  nextPath,
  onClick,
}: NextStepCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (onClick) {
      onClick()
      return
    }
    navigate(nextPath)
  }

  return (
    <div className="next-step-card">
      <div className="next-step-content">
        <div className="next-step-badge">
          步骤 {currentStep} / {totalSteps}
        </div>
        <div className="next-step-title">{title}</div>
        <div className="next-step-desc">{description}</div>
      </div>
      <button className="next-step-btn" onClick={handleClick}>
        {buttonText}
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </button>
    </div>
  )
}

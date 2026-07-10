import React from 'react'
import clsx from 'clsx'

/* ========= Spinner ========= */

export interface SpinnerProps {
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 自定义类名 */
  className?: string
}

/**
 * 旋转加载圆环
 */
export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  return (
    <span
      className={clsx('loading-spinner', 'spinner', className)}
      data-size={size}
    />
  )
}

/* ========= LoadingSteps ========= */

export interface LoadingStepsProps {
  /** 步骤名称数组 */
  steps: string[]
  /** 当前步骤索引 */
  currentStep: number
  /** 自定义类名 */
  className?: string
}

/**
 * 步骤式加载动画
 */
export const LoadingSteps: React.FC<LoadingStepsProps> = ({
  steps,
  currentStep,
  className,
}) => {
  return (
    <div className={clsx('loading-state', 'loading-steps', className)}>
      {steps.map((step, index) => {
        const isDone = index < currentStep
        const isActive = index === currentStep

        return (
          <div
            key={index}
            className={clsx('loading-step', {
              active: isActive,
              done: isDone,
            })}
          >
            <span className="loading-step-icon">
              {isActive && <span className="step-spinner" />}
              {isDone && (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width="13"
                  height="13"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {!isActive && !isDone && (
                <span
                  style={{
                    width: '13px',
                    height: '13px',
                    borderRadius: '50%',
                    border: '2px solid var(--rule)',
                    display: 'inline-block',
                  }}
                />
              )}
            </span>
            <span className="loading-step-text">{step}</span>
          </div>
        )
      })}
    </div>
  )
}

export default Spinner

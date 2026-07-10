import React, { useEffect, useCallback } from 'react'
import clsx from 'clsx'

export interface ModalProps {
  /** 是否显示 */
  visible: boolean
  /** 标题 */
  title?: React.ReactNode
  /** 副标题 */
  subtitle?: string
  /** 标题图标 */
  icon?: React.ReactNode
  /** 关闭回调 */
  onClose: () => void
  /** 内容 */
  children: React.ReactNode
  /** 底部内容 */
  footer?: React.ReactNode
  /** 宽度 */
  width?: string | number
  /** 自定义类名 */
  className?: string
}

/**
 * 模态框组件
 */
export const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  width,
  className,
}) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [visible, handleKeyDown])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  if (!visible) return null

  const modalStyle: React.CSSProperties = {}
  if (width !== undefined) {
    modalStyle.maxWidth = typeof width === 'number' ? `${width}px` : width
  }

  return (
    <div
      className={clsx('modal-overlay', { active: visible })}
      onClick={handleOverlayClick}
    >
      <div className={clsx('modal', className)} style={modalStyle}>
        <div className="modal-header">
          <div className="modal-title-group">
            {icon && <div className="modal-icon">{icon}</div>}
            <div>
              {title && <div className="modal-title">{title}</div>}
              {subtitle && <div className="modal-subtitle">{subtitle}</div>}
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="关闭"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export default Modal

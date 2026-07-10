import React from 'react'
import clsx from 'clsx'
import { useToastStore } from '@/store'
import type { ToastMessage } from '@/types'

/* ========= ToastItem ========= */

export interface ToastItemProps {
  toast: ToastMessage
  onClose: (id: string) => void
}

const iconMap: Record<string, React.ReactNode> = {
  success: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  error: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

/**
 * 单条 Toast
 */
export const ToastItem: React.FC<ToastItemProps> = ({ toast, onClose }) => {
  return (
    <div className={clsx('toast', toast.type)}>
      <div className={clsx('toast-icon', toast.type)}>
        {iconMap[toast.type] ?? iconMap.info}
      </div>
      <div className="toast-content">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        {toast.message && <div className="toast-msg">{toast.message}</div>}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onClose(toast.id)}
        aria-label="关闭"
      />
    </div>
  )
}

/* ========= ToastContainer ========= */

/**
 * 全局 Toast 容器
 */
export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts)
  const hideToast = useToastStore((state) => state.hideToast)

  return (
    <div className="toast-container">
      {toasts.map((t: ToastMessage) => (
        <ToastItem key={t.id} toast={t} onClose={hideToast} />
      ))}
    </div>
  )
}

export default ToastContainer

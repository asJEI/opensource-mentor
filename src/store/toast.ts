import { create } from 'zustand'
import type { ToastMessage, ToastType } from '@/types'

/**
 * Toast 通知 Store
 * 管理全局 Toast 消息的显示与隐藏
 */
interface ToastState {
  /** 当前显示的 Toast 消息列表 */
  toasts: ToastMessage[]

  // ---- Actions ----
  /**
   * 显示一个 Toast 消息
   * @param type 消息类型
   * @param title 消息标题
   * @param message 消息内容
   * @param duration 持续时间（毫秒），默认 3000
   * @returns 生成的 toast id
   */
  showToast: (
    type: ToastType,
    title: string,
    message: string,
    duration?: number,
  ) => string
  /** 隐藏指定 id 的 Toast */
  hideToast: (id: string) => void
  /** 清除所有 Toast */
  clearAll: () => void
}

/** 生成唯一 ID */
function generateId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showToast: (type: ToastType, title: string, message: string, duration = 3000) => {
    const id = generateId()
    const toast: ToastMessage = { id, type, title, message, duration }

    set({ toasts: [...get().toasts, toast] })

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        get().hideToast(id)
      }, duration)
    }

    return id
  },

  hideToast: (id: string) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  clearAll: () => {
    set({ toasts: [] })
  },
}))

export default useToastStore

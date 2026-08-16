import { create } from 'zustand'
import type { ToastMessage, ToastType } from '@/types'

/** 应用当前所处的顶级页面 */
export type AppPage = 'landing' | 'app'

/** 应用内的子页面 */
export type AppSubPage =
  | 'dashboard'
  | 'issues'
  | 'pr-generator'
  | 'roadmap'
  | 'code-review'
  | 'ai-mentor'
  | 'settings'

/** 主题类型 */
export type AppTheme = 'light'

/**
 * 全局应用状态 Store
 * 管理应用级别的页面切换、侧边栏状态、主题等
 */
interface AppState {
  /** 当前是首页还是应用内 */
  currentPage: AppPage
  /** 应用内当前页面 */
  currentAppPage: AppSubPage
  /** 侧边栏是否收起 */
  sidebarCollapsed: boolean
  /** 主题（目前只有 light） */
  theme: AppTheme
  /** 当前显示的全局通知 */
  toasts: ToastMessage[]

  // ---- Actions ----
  /** 设置当前顶级页面 */
  setCurrentPage: (page: AppPage) => void
  /** 设置应用内子页面 */
  setCurrentAppPage: (page: AppSubPage) => void
  /** 切换侧边栏收起/展开状态 */
  toggleSidebar: () => void
  /** 设置主题 */
  setTheme: (theme: AppTheme) => void
  /** 显示一个全局通知并返回其 id */
  showToast: (
    type: ToastType,
    title: string,
    message: string,
    duration?: number,
  ) => string
  /** 隐藏指定通知 */
  hideToast: (id: string) => void
  /** 清除全部通知 */
  clearAll: () => void
}

function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'app',
  currentAppPage: 'dashboard',
  sidebarCollapsed: false,
  theme: 'light',
  toasts: [],

  setCurrentPage: (page) => set({ currentPage: page }),

  setCurrentAppPage: (page) => set({ currentAppPage: page }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setTheme: (theme) => set({ theme }),

  showToast: (type, title, message, duration = 3000) => {
    const id = generateToastId()
    const toast: ToastMessage = { id, type, title, message, duration }

    set((state) => ({ toasts: [...state.toasts, toast] }))

    if (duration > 0) {
      setTimeout(() => get().hideToast(id), duration)
    }

    return id
  },

  hideToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },

  clearAll: () => set({ toasts: [] }),
}))

export default useAppStore

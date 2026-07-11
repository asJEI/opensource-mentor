import { create } from 'zustand'

/** 应用当前所处的顶级页面 */
export type AppPage = 'landing' | 'app'

/** 应用内的子页面 */
export type AppSubPage = 'dashboard' | 'issues' | 'pr-generator' | 'roadmap' | 'code-review' | 'ai-mentor'

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

  // ---- Actions ----
  /** 设置当前顶级页面 */
  setCurrentPage: (page: AppPage) => void
  /** 设置应用内子页面 */
  setCurrentAppPage: (page: AppSubPage) => void
  /** 切换侧边栏收起/展开状态 */
  toggleSidebar: () => void
  /** 设置主题 */
  setTheme: (theme: AppTheme) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'app',
  currentAppPage: 'dashboard',
  sidebarCollapsed: false,
  theme: 'light',

  setCurrentPage: (page) => set({ currentPage: page }),

  setCurrentAppPage: (page) => set({ currentAppPage: page }),

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setTheme: (theme) => set({ theme }),
}))

export default useAppStore

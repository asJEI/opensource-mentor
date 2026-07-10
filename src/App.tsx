import { Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Dashboard from '@/pages/Dashboard'
import Issues from '@/pages/Issues'
import PrGenerator from '@/pages/PrGenerator'
import Roadmap from '@/pages/Roadmap'
import CodeReview from '@/pages/CodeReview'
import { ToastContainer } from '@/components/ui'

/**
 * 页面包装组件，添加切换动画
 */
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition" style={{ animation: 'pageIn 0.3s ease' }}>
      {children}
    </div>
  )
}

/**
 * 路由配置组件
 * 使用 react-router-dom 的 Routes/Route 模式
 * 支持页面切换动画和全局 Toast
 * 默认打开即为工作台（Dashboard）
 */
function App() {
  const location = useLocation()

  // 页面切换时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="app">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Dashboard />
            </PageTransition>
          }
        />
        <Route
          path="/dashboard"
          element={<Navigate to="/" replace />}
        />
        <Route
          path="/issues"
          element={
            <PageTransition>
              <Issues />
            </PageTransition>
          }
        />
        <Route
          path="/pr-generator"
          element={
            <PageTransition>
              <PrGenerator />
            </PageTransition>
          }
        />
        <Route
          path="/roadmap"
          element={
            <PageTransition>
              <Roadmap />
            </PageTransition>
          }
        />
        <Route
          path="/code-review"
          element={
            <PageTransition>
              <CodeReview />
            </PageTransition>
          }
        />
      </Routes>

      {/* 全局 Toast 容器 */}
      <ToastContainer />
    </div>
  )
}

export default App

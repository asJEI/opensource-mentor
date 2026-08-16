import { Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'
import Issues from '@/pages/Issues'
import PrGenerator from '@/pages/PrGenerator'
import Roadmap from '@/pages/Roadmap'
import CodeReview from '@/pages/CodeReview'
import AiMentor from '@/pages/AiMentor'
import Settings from '@/pages/Settings'
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
 * 默认打开为落地页（Landing），引导用户了解产品价值后进入应用
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
        {/* 落地页 - 首屏，展示产品价值 */}
        <Route
          path="/"
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          }
        />
        {/* 工作台 / 仓库分析 */}
        <Route
          path="/dashboard"
          element={
            <PageTransition>
              <Dashboard />
            </PageTransition>
          }
        />
        {/* Issue 推荐 */}
        <Route
          path="/issues"
          element={
            <PageTransition>
              <Issues />
            </PageTransition>
          }
        />
        {/* PR 生成器 */}
        <Route
          path="/pr-generator"
          element={
            <PageTransition>
              <PrGenerator />
            </PageTransition>
          }
        />
        {/* 学习路线 */}
        <Route
          path="/roadmap"
          element={
            <PageTransition>
              <Roadmap />
            </PageTransition>
          }
        />
        {/* 代码审查 */}
        <Route
          path="/code-review"
          element={
            <PageTransition>
              <CodeReview />
            </PageTransition>
          }
        />
        {/* Scenario G alias */}
        <Route
          path="/review"
          element={
            <PageTransition>
              <CodeReview />
            </PageTransition>
          }
        />
        {/* AI 导师 */}
        <Route
          path="/ai-mentor"
          element={
            <PageTransition>
              <AiMentor />
            </PageTransition>
          }
        />
        {/* Scenario G alias */}
        <Route
          path="/mentor"
          element={
            <PageTransition>
              <AiMentor />
            </PageTransition>
          }
        />
        {/* 偏好设置 */}
        <Route
          path="/settings"
          element={
            <PageTransition>
              <Settings />
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

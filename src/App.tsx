import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
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
import { authService } from '@/services'
import { useToastStore, useUserStore } from '@/store'

const githubLoginErrorMessages: Record<string, string> = {
  github_oauth_not_configured: 'OAuth 应用尚未配置 Client ID / Secret',
  invalid_oauth_state: '登录状态校验失败，请刷新首页后重新登录',
  token_exchange_failed: 'GitHub 授权码交换失败，请检查 OAuth callback URL',
  incorrect_client_credentials: 'GitHub OAuth Client ID 或 Secret 不正确',
  bad_verification_code: 'GitHub 授权码已失效，请重新点击登录',
  supabase_persistence_failed: 'GitHub 已授权，但写入 Supabase 用户数据失败，请检查表字段、RLS 或 service role key',
  profile_fetch_failed: '读取 GitHub 公开资料失败，请稍后重试',
}

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
  const navigate = useNavigate()
  const applyGitHubOAuthProfile = useUserStore(
    (state) => state.applyGitHubOAuthProfile,
  )
  const applyServerUserState = useUserStore(
    (state) => state.applyServerUserState,
  )
  const showToast = useToastStore((state) => state.showToast)

  // 页面切换时滚动到顶部
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    const githubProfile = authService.consumeGitHubOAuthProfile()
    if (githubProfile) {
      applyGitHubOAuthProfile(githubProfile)
      showToast(
        'success',
        'GitHub 已连接',
        `已读取 ${githubProfile.profile.username} 的公开开发者画像`,
      )
    }

    void authService
      .getMe()
      .then((me) => {
        applyServerUserState({
          githubProfile: me.developerProfile.github_profile ?? githubProfile,
          githubUsername: me.user.githubUsername,
          githubAvatar: me.user.githubAvatar,
          profileSetupStatus: me.developerProfile.profile_setup_status,
          profileConfirmed: me.developerProfile.profile_confirmed,
          openSourceGoal: me.developerProfile.open_source_goal,
          preferredTechStack: me.developerProfile.preferred_tech_stack,
          contributionTimeBudget: me.developerProfile.contribution_time_budget,
          guidancePreference: me.developerProfile.guidance_preference,
        })
      })
      .catch(() => {
        // 未登录或会话过期时静默保留本地兼容数据。
      })

    const params = new URLSearchParams(location.search)
    if (params.get('github_login') === 'success') {
      navigate('/dashboard', { replace: true })
      return
    }

    if (params.get('github_login') === 'error') {
      const reason = params.get('reason')
      showToast(
        'error',
        'GitHub 登录失败',
        reason
          ? (githubLoginErrorMessages[reason] ??
              `登录流程在 ${reason} 阶段失败，请检查对应配置`)
          : '请稍后重试，或检查 GitHub OAuth 配置',
      )
      navigate(location.pathname || '/', { replace: true })
    }
  }, [
    applyGitHubOAuthProfile,
    applyServerUserState,
    location.pathname,
    location.search,
    navigate,
    showToast,
  ])

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

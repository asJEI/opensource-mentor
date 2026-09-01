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
import NotFound from '@/pages/NotFound'
import { ToastContainer } from '@/components/ui'
import { authService, toServerUserState } from '@/services'
import { useToastStore, useUserStore } from '@/store'

const githubLoginErrorMessages: Record<string, string> = {
  oauth_unavailable: 'GitHub 登录暂时不可用，请稍后重试',
  oauth_expired: '本次授权已失效，请从首页重新登录',
  oauth_token_failed: 'GitHub 授权校验失败，请检查 OAuth Client Secret 是否配置正确',
  user_sync_failed: 'GitHub 已授权，但用户数据同步失败，请检查 Supabase 配置',
  session_failed: 'GitHub 已授权，但登录会话创建失败，请检查 SESSION_SECRET 是否已保存并部署',
  profile_fetch_failed: 'GitHub 已授权，但读取 GitHub 用户信息失败，请稍后重试',
  oauth_failed: 'GitHub 登录未完成，请稍后重试',
}

const PROFILE_POLL_INTERVAL_MS = 2000
const PROFILE_POLL_TIMEOUT_MS = 90_000

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
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
    let cancelled = false
    const params = new URLSearchParams(location.search)
    const githubProfile = authService.consumeGitHubOAuthProfile()
    if (githubProfile) {
      applyGitHubOAuthProfile(githubProfile)
      showToast(
        'success',
        'GitHub 已连接',
        `已登录 ${githubProfile.profile.username}，开发者画像将在后台生成`,
      )
    }

    void (async () => {
      try {
        const me = await authService.getMe()
        if (cancelled) return
        applyServerUserState(toServerUserState(me, githubProfile))

        let status = me.developerProfile.profile_status ?? 'pending'
        const startedAt = Date.now()
        while (
          !cancelled &&
          (status === 'pending' || status === 'generating') &&
          Date.now() - startedAt < PROFILE_POLL_TIMEOUT_MS
        ) {
          await sleep(PROFILE_POLL_INTERVAL_MS)
          if (cancelled) return
          const next = await authService.getMe()
          if (cancelled) return
          applyServerUserState(toServerUserState(next, githubProfile))
          status = next.developerProfile.profile_status ?? 'pending'
        }

        if (cancelled) return
        if (status === 'ready' && (me.developerProfile.profile_status === 'pending' || me.developerProfile.profile_status === 'generating')) {
          showToast('success', '开发者画像已就绪', '已根据 GitHub 公开资料生成你的能力画像')
        } else if (status === 'failed') {
          showToast(
            'error',
            '开发者画像生成失败',
            '登录已成功，可稍后在偏好设置重新连接 GitHub',
          )
        }
      } catch {
        // 未登录或会话过期时静默保留本地兼容数据。
      }
    })()

    if (params.get('github_login') === 'success') {
      navigate('/issues', { replace: true })
    } else if (params.get('github_login') === 'error') {
      const reason = params.get('reason')
      showToast(
        'error',
        'GitHub 登录失败',
        reason
          ? (githubLoginErrorMessages[reason] ??
              '登录未完成，请稍后重试')
          : '请稍后重试，或检查 GitHub OAuth 配置',
      )
      navigate(location.pathname || '/', { replace: true })
    }

    return () => {
      cancelled = true
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
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFound />
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

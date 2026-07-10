import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import {
  IssueContextCard,
  ReviewProgress,
  ReviewResultPanel,
  ReviewActionBar,
  NextStepCard,
} from '@/components/business'
import { useCodeReviewStore, useRepositoryStore, useToastStore } from '@/store'

// ==================== 图标组件 ====================
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
)

const FileCodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// ==================== CodeReview 页面 ====================
const CodeReview = () => {
  const navigate = useNavigate()
  const {
    status,
    progress,
    result,
    error,
    selectedIssue,
    activeTab,
    expandedIssueId,
    setPrUrl,
    startReview,
    setActiveTab,
    toggleIssue,
    reset,
  } = useCodeReviewStore()

  const { currentRepo, currentOwner } = useRepositoryStore()
  const showToast = useToastStore((s) => s.showToast)

  // 提交方式：pr 链接 / 粘贴 diff / 上传文件
  const [submitMode, setSubmitMode] = useState<'pr' | 'diff' | 'file'>('pr')
  const [diffContent, setDiffContent] = useState('')
  const [prUrlInput, setPrUrlInput] = useState('')

  const repoName = `${currentOwner || 'microsoft'}/${currentRepo || 'vscode'}`

  // 开始审查
  const handleStartReview = () => {
    if (submitMode === 'pr') {
      if (!prUrlInput.trim()) {
        showToast('error', '请输入 PR 链接', '需要知道你提交的 PR 才能审查哦')
        return
      }
      setPrUrl(prUrlInput.trim())
    } else if (submitMode === 'diff') {
      if (!diffContent.trim()) {
        showToast('error', '请粘贴代码 diff', '需要你的代码变更内容才能审查')
        return
      }
      // diff 模式下用一个模拟的 PR URL（后端 mock 模式下不验证）
      setPrUrl(`diff://${Date.now()}`)
    } else {
      showToast('info', '功能开发中', '文件上传功能即将上线，敬请期待～')
      return
    }
    startReview()
  }

  const handleFixCode = () => {
    showToast('info', '修改指南已生成', 'AI 导师已为你整理好修改清单')
  }

  const handleGeneratePr = () => {
    showToast('success', '正在生成 PR 描述', '即将跳转到 PR 生成器...')
    setTimeout(() => {
      navigate('/pr-generator')
    }, 800)
  }

  // 未选择 Issue 的空状态
  if (!selectedIssue && status === 'idle') {
    return (
      <AppLayout
        breadcrumbs={[
          { label: '工作台' },
          { label: '代码审查' },
        ]}
      >
        <div className="app-page active code-review-page">
          <div className="page-header">
            <div className="page-title-row">
              <div>
                <h1 className="page-title">代码审查</h1>
                <p className="page-subtitle">AI 导师帮你检查代码，确保第一次贡献就高质量通过</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="repo-pill">
                  <CodeIcon />
                  {repoName}
                </span>
                <span className="hero-badge" style={{ marginBottom: 0 }}>
                  <span className="hero-badge-dot" />
                  AI 导师审查
                </span>
              </div>
            </div>
          </div>

          <div className="code-review__empty">
            <div className="empty-state">
              <div className="empty-state__icon">
                <AlertIcon />
              </div>
              <h2>还没有选择 Issue</h2>
              <p>代码审查需要针对具体的 Issue 和你提交的代码进行。</p>
              <p>请先去 Issue 推荐页选一个感兴趣的 Issue，然后点击「去代码审查」。</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/issues')}
              >
                去选择 Issue
              </button>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  const issue = selectedIssue!

  return (
    <AppLayout
      breadcrumbs={[
        { label: '工作台' },
        { label: '代码审查' },
      ]}
    >
      <div className="app-page active code-review-page">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">代码审查</h1>
              <p className="page-subtitle">AI 导师帮你检查代码，确保第一次贡献就高质量通过</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="repo-pill">
                <CodeIcon />
                {repoName}
              </span>
              <span className="hero-badge" style={{ marginBottom: 0 }}>
                <span className="hero-badge-dot" />
                AI 导师审查
              </span>
            </div>
          </div>
        </div>

        {/* Issue 上下文卡片（粘性顶部） */}
        <div className="code-review__issue-context">
          <IssueContextCard
            issue={{
              number: issue.number,
              title: issue.title,
              labels: issue.labels.map((l) => ({ name: l.name, color: l.color })),
              htmlUrl: issue.htmlUrl,
            }}
            repoName={repoName}
            difficulty={
              issue.difficulty === 'easy' ? '入门'
              : issue.difficulty === 'hard' ? '进阶'
              : '中等'
            }
            estimatedTime={issue.estimatedTime ? `${issue.estimatedTime} 小时` : '2-3 小时'}
          />
        </div>

        {/* 初始状态：提交代码表单 */}
        {status === 'idle' && (
          <div className="code-review__submit">
            <div className="submit-card card">
              <div className="submit-card__header">
                <div className="submit-card__title">
                  <UploadIcon />
                  提交你的代码
                </div>
                <div className="submit-card__subtitle">
                  把你为这个 Issue 写的代码交给 AI 导师检查一下吧
                </div>
              </div>

              {/* 提交方式切换 */}
              <div className="submit-modes">
                <button
                  className={submitMode === 'pr' ? 'active' : ''}
                  onClick={() => setSubmitMode('pr')}
                >
                  <LinkIcon />
                  PR 链接
                </button>
                <button
                  className={submitMode === 'diff' ? 'active' : ''}
                  onClick={() => setSubmitMode('diff')}
                >
                  <FileCodeIcon />
                  粘贴 Diff
                </button>
                <button
                  className={submitMode === 'file' ? 'active' : ''}
                  onClick={() => setSubmitMode('file')}
                >
                  <UploadIcon />
                  上传文件
                </button>
              </div>

              {/* PR 链接模式 */}
              {submitMode === 'pr' && (
                <div className="submit-form">
                  <label className="form-label">
                    GitHub PR 链接
                    <span className="form-hint">粘贴你提交的 Pull Request 链接</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="https://github.com/owner/repo/pull/123"
                    value={prUrlInput}
                    onChange={(e) => setPrUrlInput(e.target.value)}
                  />
                  <div className="form-tip">
                    💡 还没提交 PR？可以先「粘贴 Diff」让导师帮你检查一下
                  </div>
                </div>
              )}

              {/* 粘贴 Diff 模式 */}
              {submitMode === 'diff' && (
                <div className="submit-form">
                  <label className="form-label">
                    代码 Diff 内容
                    <span className="form-hint">粘贴 git diff 的输出内容</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder={`diff --git a/src/file.ts b/src/file.ts\nindex abc1234..def5678 100644\n--- a/src/file.ts\n+++ b/src/file.ts\n@@ -1,3 +1,3 @@\n-旧代码\n+新代码`}
                    rows={12}
                    value={diffContent}
                    onChange={(e) => setDiffContent(e.target.value)}
                  />
                  <div className="form-tip">
                    💡 在终端运行 `git diff` 后复制输出粘贴到这里
                  </div>
                </div>
              )}

              {/* 上传文件模式（占位） */}
              {submitMode === 'file' && (
                <div className="submit-form">
                  <div className="upload-placeholder">
                    <UploadIcon />
                    <p>拖拽文件到此处，或</p>
                    <button className="btn btn-secondary" disabled>
                      选择文件
                    </button>
                    <p className="upload-tip">支持 .diff / .patch / .zip 格式（功能开发中）</p>
                  </div>
                </div>
              )}

              {/* 提交按钮 */}
              <div className="submit-actions">
                <button
                  className="btn btn-primary btn-lg"
                  onClick={handleStartReview}
                >
                  🚀 开始 AI 审查
                </button>
                <p className="submit-disclaimer">
                  审查约需 30 秒，AI 导师会从功能性、规范性、安全性等多维度帮你检查
                </p>
              </div>
            </div>
          </div>
        )}

        {/* AI 审查状态（审查中/完成） */}
        {(status === 'queued' || status === 'running') && (
          <div className="code-review__progress">
            <ReviewProgress
              status={status}
              progress={progress}
              error={error}
            />
          </div>
        )}

        {/* 审查结果（完成后显示） */}
        {status === 'completed' && result && (
          <div className="code-review__result">
            <ReviewResultPanel
              result={result}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              expandedIssueId={expandedIssueId}
              onToggleIssue={toggleIssue}
            />
          </div>
        )}

        {/* 失败状态 */}
        {status === 'failed' && (
          <div className="code-review__error">
            <div className="error-state">
              <div className="error-state__icon">⚠️</div>
              <h3>审查遇到了一点问题</h3>
              <p>{error || '请检查网络连接后重试'}</p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  reset()
                }}
              >
                重新提交
              </button>
            </div>
          </div>
        )}

        {/* 底部操作栏（仅审查完成后显示） */}
        {(status === 'completed' || status === 'running' || status === 'queued') && (
          <ReviewActionBar
            status={status}
            onFixCode={handleFixCode}
            onGeneratePr={handleGeneratePr}
          />
        )}

        {/* 下一步引导：审查完成后引导去生成 PR */}
        {status === 'completed' && result && (
          <NextStepCard
            currentStep={3}
            totalSteps={4}
            title="AI 审查完成！"
            description="代码审查已完成，下一步生成专业的 PR 描述，让你的贡献更易被合并"
            buttonText="生成 PR 描述"
            nextPath="/pr-generator"
            onClick={handleGeneratePr}
          />
        )}
      </div>
    </AppLayout>
  )
}

export default CodeReview

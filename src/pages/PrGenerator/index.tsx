import { AppLayout } from '@/components/layout'
import { Card } from '@/components/ui'
import PrTypeSelector from '@/components/business/PrTypeSelector'
import PrResultPanel from '@/components/business/PrResultPanel'
import { usePrStore, useToastStore } from '@/store'
import type { PrType } from '@/types'

// ==================== 图标组件 ====================
const CodeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
)

const FileTextIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
)

const AlertTriangleIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

// ==================== PrGenerator 页面 ====================
const PrGenerator = () => {
  const {
    prType,
    summary,
    linkedIssue,
    prDraft,
    isGenerating,
    error,
    currentOwner,
    currentRepo,
    setPrType,
    setSummary,
    setLinkedIssue,
    generatePr,
  } = usePrStore()
  const showToast = useToastStore((s) => s.showToast)

  const handleTypeSelect = (type: PrType) => {
    setPrType(type)
  }

  const handleGenerate = async () => {
    if (!summary.trim()) {
      showToast('warning', '请填写改动描述', '改动描述是生成 PR 的必要信息')
      return
    }

    const issueNumber = linkedIssue ? parseInt(linkedIssue, 10) : undefined

    await generatePr(issueNumber, summary)

    const state = usePrStore.getState()
    if (state.error) {
      showToast('error', '生成失败', state.error)
    } else if (state.prDraft) {
      showToast('success', 'PR 草稿已生成', 'AI 已为你生成专业的 PR 描述')
    }
  }

  const handleCopy = (_text: string, label: string) => {
    showToast('success', '已复制', `${label} 已复制到剪贴板`)
  }

  // 计算结果面板状态
  const resultStatus = error
    ? 'error' as const
    : isGenerating
      ? 'loading' as const
      : prDraft
        ? 'success' as const
        : 'idle' as const

  return (
    <AppLayout
      breadcrumbs={[
        { label: '工作台' },
        { label: 'PR 生成器' },
      ]}
    >
      <div className="app-page active">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">PR 生成器</h1>
              <p className="page-subtitle">AI 智能生成专业的 Pull Request，一次通过审核</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="repo-pill">
                <CodeIcon />
                {currentOwner}/{currentRepo}
              </span>
              <span className="hero-badge" style={{ marginBottom: 0 }}>
                <span className="hero-badge-dot" />
                AI 驱动生成
              </span>
            </div>
          </div>
        </div>

        {/* 左右两栏布局 */}
        <div className="generator-grid">
          {/* 左侧：Commit Summary Card */}
          <Card
            title="Commit Summary"
            icon={<FileTextIcon />}
            className="commit-summary-card"
          >
            {/* PR 类型选择 */}
            <div className="form-group">
              <label className="form-label">
                PR 类型 <span className="required">*</span>
              </label>
              <PrTypeSelector value={prType} onChange={handleTypeSelect} />
            </div>

            {/* 描述 textarea */}
            <div className="form-group">
              <label className="form-label">
                改动描述 <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                placeholder="简要描述你的改动内容，AI 将基于此生成专业的 PR..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={5}
              />
              <div className="form-hint">描述越详细，生成的 PR 质量越高</div>
            </div>

            {/* 关联 Issue input */}
            <div className="form-group">
              <label className="form-label">关联 Issue</label>
              <input
                type="text"
                className="form-input"
                placeholder="输入 Issue 编号，如：1234"
                value={linkedIssue}
                onChange={(e) => setLinkedIssue(e.target.value)}
              />
              <div className="form-hint">可选，AI 会在 PR 描述中自动关联</div>
            </div>

            {/* 错误提示 */}
            {error && (
              <div
                className="error-message"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  background: 'var(--danger-soft)',
                  color: 'var(--danger)',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '12px',
                  lineHeight: '1.5',
                }}
              >
                <AlertTriangleIcon
                  style={{ width: '16px', height: '16px', flexShrink: 0, marginTop: '1px' }}
                />
                <span>{error}</span>
              </div>
            )}

            {/* 生成按钮 */}
            <button
              className="analyze-btn"
              onClick={handleGenerate}
              disabled={isGenerating || !summary.trim()}
              style={{ marginTop: '8px' }}
            >
              {isGenerating ? (
                <>
                  <span className="btn-spinner" />
                  生成中...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  生成 PR 草稿
                </>
              )}
            </button>
          </Card>

          {/* 右侧：AI 生成结果 Card */}
          <Card
            title="AI 生成结果"
            icon={<SparklesIcon />}
            className="pr-result-card"
          >
            <PrResultPanel
              draft={prDraft}
              status={resultStatus}
              error={error}
              onCopy={handleCopy}
            />
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

export default PrGenerator

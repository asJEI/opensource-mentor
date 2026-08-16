import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'

// ==================== 图标组件 ====================
const SparklesIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
  </svg>
)

const AlertIcon = () => (
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
)

const SearchXIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
    <line x1="8" y1="8" x2="14" y2="14" />
    <line x1="14" y1="8" x2="8" y2="14" />
  </svg>
)

const ClockIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const DoorOpenIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M13 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9" />
    <path d="M14 20V4a2 2 0 0 1 2-2h6v16a2 2 0 0 1-2 2" />
    <circle cx="18" cy="14" r="1" />
  </svg>
)

const BotIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="8" width="18" height="12" rx="3" />
    <path d="M12 2v4" />
    <circle cx="9" cy="14" r="1" />
    <circle cx="15" cy="14" r="1" />
    <path d="M9 18h6" />
  </svg>
)

const TargetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
)

const CodeIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
)

const ZapIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const BookOpenIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const CopyIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

// ==================== Mock 数据 ====================
const painPoints = [
  {
    icon: <SearchXIcon />,
    title: '找不到适合的入门 Issue',
    desc: '面对海量开源项目，不知道从哪里开始，good first issue 标签水很深，新手容易踩坑。',
  },
  {
    icon: <ClockIcon />,
    title: '理解代码库太耗时',
    desc: '大型项目架构复杂，读代码就要花几周，还没开始贡献就已经放弃了。',
  },
  {
    icon: <DoorOpenIcon />,
    title: '贡献门槛高',
    desc: '不了解项目规范、PR 流程、代码风格，第一次提交就被打回，打击信心。',
  },
  {
    icon: <AlertIcon />,
    title: '学习路径不清晰',
    desc: '不知道该学什么、按什么顺序学，东一榔头西一棒子，进步缓慢。',
  },
]

const features = [
  {
    icon: <BotIcon />,
    title: 'AI 仓库分析',
    desc: '智能分析任意 GitHub 仓库的架构、技术栈、难度等级，几分钟内给你一份完整的项目画像。',
  },
  {
    icon: <TargetIcon />,
    title: '个性化 Issue 推荐',
    desc: '基于你的技能栈、兴趣和经验水平，AI 精准匹配最适合你的入门 Issue，告别大海捞针。',
  },
  {
    icon: <CodeIcon />,
    title: 'PR 智能生成',
    desc: '输入你的改动描述，AI 自动生成规范的 PR 标题、描述和检查清单，一次通过审核。',
  },
  {
    icon: <BookOpenIcon />,
    title: '学习路线图',
    desc: '为每个项目定制专属学习路径，从了解项目到提交第一个 PR，循序渐进不迷路。',
  },
  {
    icon: <ZapIcon />,
    title: '代码审查建议',
    desc: '提交前 AI 自动审查你的代码，给出优化建议和潜在问题，让你的 PR 更专业。',
  },
  {
    icon: <SparklesIcon />,
    title: 'Issue 深度解析',
    desc: '看不懂 Issue？AI 帮你拆解背景、涉及文件、修改思路，手把手教你怎么上手。',
  },
]

const workflowSteps = [
  { num: 1, title: '选择项目', desc: '输入 GitHub 仓库地址，开始你的开源之旅' },
  { num: 2, title: 'AI 分析', desc: '智能分析项目架构、技术栈和难度等级' },
  { num: 3, title: '获取推荐', desc: '根据你的能力匹配最适合的入门 Issue' },
  { num: 4, title: '学习路线', desc: '跟随定制化学习路径，逐步掌握项目' },
  { num: 5, title: '生成 PR', desc: 'AI 辅助生成规范的 Pull Request' },
  { num: 6, title: '贡献成功', desc: '提交你的第一个开源贡献，获得成就感' },
]

const previewTabs = [
  { id: 'repo', label: '仓库分析' },
  { id: 'issues', label: 'Issue 推荐' },
  { id: 'pr', label: 'PR 生成器' },
]

// ==================== Section 动画 Hook ====================
function useIntersectionObserver() {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 },
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return { ref, isVisible }
}

// ==================== 动画 Section 包装组件 ====================
function AnimatedSection({
  id,
  children,
  className,
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  const { ref, isVisible } = useIntersectionObserver()

  return (
    <section
      id={id}
      ref={ref}
      className={clsx('section', className, { 'section-visible': isVisible })}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}
    >
      {children}
    </section>
  )
}

// ==================== Hero Section ====================
function HeroSection() {
  const navigate = useNavigate()

  const handleStartFree = () => {
    navigate('/dashboard')
  }

  const handleViewDemo = () => {
    const el = document.getElementById('preview')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const handleQuickDemo = () => {
    navigate('/dashboard')
  }

  return (
    <section className="hero" id="hero">
      {/* 浮动渐变 blob */}
      <div className="hero-bg">
        <div className="hero-blob hero-blob-1" />
        <div className="hero-blob hero-blob-2" />
        <div className="hero-blob hero-blob-3" />
      </div>

      <div className="hero-content">
        {/* 徽章 */}
        <div className="hero-badge">
          <span className="hero-badge-dot" />
          <span>AI 驱动的开源贡献助手</span>
        </div>

        {/* 大标题 */}
        <h1>
          让开源贡献
          <br />
          变得
          <span
            style={{
              background: 'var(--gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            简单又有趣
          </span>
        </h1>

        {/* 副标题 */}
        <p className="hero-desc">
          用 AI 智能分析开源项目、推荐入门 Issue、生成专业 PR，
          <br />
          帮助你从零开始，一步步成为优秀的开源贡献者。
        </p>

        {/* CTA 按钮 */}
        <div className="hero-cta">
          <button
            className="btn btn-primary btn-lg hero-cta-main"
            onClick={handleQuickDemo}
          >
            <span className="hero-cta-main-icon">⚡</span>
            5 分钟体验完整流程
            <ArrowRightIcon />
          </button>
        </div>
        <div className="hero-cta-secondary">
          <button className="btn btn-ghost" onClick={handleStartFree}>
            免费开始
          </button>
          <span className="hero-cta-divider">·</span>
          <button className="btn btn-ghost" onClick={handleViewDemo}>
            查看演示
          </button>
        </div>

        {/* 产品预览图 */}
        <div className="hero-preview">
          <div className="hero-preview-frame">
            <div className="hero-preview-header">
              <span className="hero-preview-dot red" />
              <span className="hero-preview-dot yellow" />
              <span className="hero-preview-dot green" />
              <div className="hero-preview-url">
                opensource-mentor.app/dashboard
              </div>
            </div>
            <div className="hero-preview-body">
              <div className="mock-sidebar">
                <div className="mock-sidebar-item active" />
                <div className="mock-sidebar-item" />
                <div className="mock-sidebar-item" />
                <div className="mock-sidebar-item" />
                <div className="mock-sidebar-item" />
              </div>
              <div className="mock-main">
                <div className="mock-row">
                  <div className="mock-stat" />
                  <div className="mock-stat" />
                  <div className="mock-stat" />
                </div>
                <div className="mock-card tall" />
                <div className="mock-card" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ==================== Why / Pain Points Section ====================
function WhySection() {
  return (
    <AnimatedSection id="why" className="why-section">
      <div className="section-header">
        <span className="section-tag">痛点</span>
        <h2>开源贡献，为什么这么难？</h2>
        <p className="section-desc">
          每个想参与开源的开发者，几乎都会遇到这些问题
        </p>
      </div>

      <div className="pain-grid">
        {painPoints.map((pain, index) => (
          <div
            key={index}
            className="pain-card"
            style={{
              animationDelay: `${index * 0.1}s`,
            }}
          >
            <div className="pain-icon">{pain.icon}</div>
            <h3>{pain.title}</h3>
            <p>{pain.desc}</p>
          </div>
        ))}
      </div>
    </AnimatedSection>
  )
}

// ==================== Features Section ====================
function FeaturesSection() {
  return (
    <AnimatedSection id="features" className="alt">
      <div className="section-header">
        <span className="section-tag">核心功能</span>
        <h2>AI 赋能，全流程助力</h2>
        <p className="section-desc">
          从项目选择到 PR 提交，OpenSource Mentor 陪伴你每一步
        </p>
      </div>

      <div className="features-grid">
        {features.map((feature, index) => (
          <div
            key={index}
            className="feature-card"
            style={{
              animationDelay: `${index * 0.08}s`,
            }}
          >
            <div className="feature-icon">{feature.icon}</div>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </div>
        ))}
      </div>
    </AnimatedSection>
  )
}

// ==================== Workflow Section ====================
function WorkflowSection() {
  return (
    <AnimatedSection id="workflow">
      <div className="section-header">
        <span className="section-tag">工作流程</span>
        <h2>六步开启你的开源之旅</h2>
        <p className="section-desc">简单清晰的流程，让开源贡献不再遥不可及</p>
      </div>

      <div className="workflow-steps">
        {workflowSteps.map((step, index) => (
          <div key={step.num}>
            {index > 0 && (
              <div className="workflow-connector">
                <svg
                  viewBox="0 0 60 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="0" y1="10" x2="50" y2="10" />
                  <polyline points="42 4 50 10 42 16" />
                </svg>
              </div>
            )}
            <div className="workflow-step">
              <div className="workflow-step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </AnimatedSection>
  )
}

// ==================== Product Preview Section ====================
function PreviewSection() {
  const [activeTab, setActiveTab] = useState('repo')

  return (
    <AnimatedSection id="preview" className="alt">
      <div className="section-header">
        <span className="section-tag">产品预览</span>
        <h2>强大功能，一睹为快</h2>
        <p className="section-desc">看看 OpenSource Mentor 能为你做什么</p>
      </div>

      {/* Tabs */}
      <div className="preview-tabs">
        {previewTabs.map((tab) => (
          <button
            key={tab.id}
            className={clsx('preview-tab', activeTab === tab.id && 'active')}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Preview Content */}
      <div className="preview-content">
        {/* 仓库分析面板 */}
        <div
          className={clsx('preview-panel', activeTab === 'repo' && 'active')}
        >
          <div className="preview-panel-inner">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '280px 1fr',
                gap: '24px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <div className="repo-icon">
                    <CodeIcon />
                  </div>
                  <div>
                    <div className="repo-name">vscode</div>
                    <div className="repo-owner">microsoft</div>
                  </div>
                </div>
                <div className="repo-stats">
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">Stars</span>
                    <span className="repo-stat-value">160k+</span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">Issues</span>
                    <span className="repo-stat-value">8,234</span>
                  </div>
                  <div className="repo-stat-row">
                    <span className="repo-stat-label">语言</span>
                    <span className="repo-stat-value">TypeScript</span>
                  </div>
                </div>
                <button className="analyze-btn">
                  <ZapIcon />
                  重新分析
                </button>
              </div>
              <div>
                <div className="ai-summary-text">
                  <strong>AI 摘要：</strong> VS Code
                  是微软推出的开源代码编辑器，基于 Electron 框架构建，采用
                  TypeScript
                  开发。项目架构清晰，核心模块包括编辑器核心、扩展系统、终端集成等。整体难度中等，适合有前端基础的开发者参与。
                </div>
                <div className="ai-metrics-row">
                  <div className="ai-metric">
                    <div className="ai-metric-label">项目难度</div>
                    <div
                      className="ai-metric-value"
                      style={{ color: 'var(--yellow)' }}
                    >
                      中等
                    </div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-label">新手友好</div>
                    <div
                      className="ai-metric-value"
                      style={{ color: 'var(--green)' }}
                    >
                      是
                    </div>
                  </div>
                  <div className="ai-metric">
                    <div className="ai-metric-label">推荐 Issue</div>
                    <div
                      className="ai-metric-value"
                      style={{ color: 'var(--accent)' }}
                    >
                      126 个
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    marginBottom: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  推荐入门 Issue
                </div>
                <div className="suggested-issues-list">
                  <div className="suggested-issue">
                    <div className="suggested-issue-icon">
                      <CheckIcon />
                    </div>
                    <span className="suggested-issue-text">
                      fix: 修复编辑器中光标位置计算错误的问题
                    </span>
                  </div>
                  <div className="suggested-issue">
                    <div className="suggested-issue-icon">
                      <CheckIcon />
                    </div>
                    <span className="suggested-issue-text">
                      docs: 更新中文翻译文档中的术语不一致
                    </span>
                  </div>
                  <div className="suggested-issue">
                    <div className="suggested-issue-icon">
                      <CheckIcon />
                    </div>
                    <span className="suggested-issue-text">
                      feat: 为终端添加自定义背景色支持
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Issue 推荐面板 */}
        <div
          className={clsx('preview-panel', activeTab === 'issues' && 'active')}
        >
          <div className="preview-panel-inner">
            <div className="issues-tabs" style={{ marginBottom: '16px' }}>
              <div className="issues-tab active">
                AI 推荐
                <span className="issues-tab-count">24</span>
              </div>
              <div className="issues-tab">
                新手友好
                <span className="issues-tab-count">18</span>
              </div>
              <div className="issues-tab">
                文档类
                <span className="issues-tab-count">12</span>
              </div>
            </div>
            <div className="issues-list">
              {[
                {
                  title: 'fix: 修复搜索高亮在深色主题下不可见的问题',
                  labels: ['bug', 'good-first'],
                  score: 95,
                  difficulty: 'easy',
                },
                {
                  title: 'feat: 添加对 CSV 文件的语法高亮支持',
                  labels: ['enhancement'],
                  score: 88,
                  difficulty: 'medium',
                },
                {
                  title: 'docs: 修正 API 文档中参数描述错误',
                  labels: ['docs'],
                  score: 92,
                  difficulty: 'easy',
                },
              ].map((issue, i) => (
                <div key={i} className="issue-row">
                  <div className="issue-open-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="issue-main">
                    <div className="issue-title-row">
                      <span className="issue-title">{issue.title}</span>
                      {issue.labels.map((label) => (
                        <span
                          key={label}
                          className={clsx('issue-label', label)}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                    <div className="issue-meta">
                      <span>#1823{i} · opened 3 days ago</span>
                    </div>
                  </div>
                  <div className="issue-ai-info">
                    <div className="ai-confidence">
                      <span className="confidence-score">{issue.score}%</span>
                      <span className="confidence-label">匹配度</span>
                    </div>
                    <button className="explain-btn">
                      <SparklesIcon />
                      为什么推荐
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* PR 生成器面板 */}
        <div className={clsx('preview-panel', activeTab === 'pr' && 'active')}>
          <div className="preview-panel-inner">
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: '24px',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    marginBottom: '12px',
                  }}
                >
                  PR 类型
                </div>
                <div className="type-selector">
                  <div className="type-option selected">
                    <div className="type-radio">
                      <div className="type-radio-inner" />
                    </div>
                    <div className="type-icon-badge bug">
                      <AlertIcon />
                    </div>
                    <div className="type-info">
                      <div className="type-name">Bug Fix</div>
                      <div className="type-desc">修复已知问题</div>
                    </div>
                  </div>
                  <div className="type-option">
                    <div className="type-radio" />
                    <div className="type-icon-badge feature">
                      <ZapIcon />
                    </div>
                    <div className="type-info">
                      <div className="type-name">Feature</div>
                      <div className="type-desc">新增功能特性</div>
                    </div>
                  </div>
                  <div className="type-option">
                    <div className="type-radio" />
                    <div className="type-icon-badge docs">
                      <BookOpenIcon />
                    </div>
                    <div className="type-info">
                      <div className="type-name">Docs</div>
                      <div className="type-desc">文档更新</div>
                    </div>
                  </div>
                </div>
                <button className="analyze-btn" style={{ marginTop: '16px' }}>
                  <SparklesIcon />
                  生成 PR
                </button>
              </div>
              <div className="card">
                <div className="card-header">
                  <div className="card-title">
                    <span className="card-title-icon">
                      <CodeIcon />
                    </span>
                    PR 草稿
                  </div>
                  <button className="copy-btn">
                    <CopyIcon />
                    复制
                  </button>
                </div>
                <div className="card-body">
                  <div style={{ marginBottom: '16px' }}>
                    <div
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--muted)',
                        marginBottom: '6px',
                      }}
                    >
                      标题
                    </div>
                    <div className="pr-title-display">
                      fix: 修复搜索高亮在深色主题下对比度不足的问题
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--muted)',
                      marginBottom: '6px',
                    }}
                  >
                    描述
                  </div>
                  <div className="pr-description">
                    <h4>问题描述</h4>
                    <p>
                      在深色主题下，搜索结果的高亮文字与背景对比度不足，导致难以辨认。
                    </p>
                    <h4>解决方案</h4>
                    <ul>
                      <li>调整深色主题下的高亮背景色</li>
                      <li>增加文字颜色对比度</li>
                      <li>确保 WCAG 2.1 AA 级可访问性标准</li>
                    </ul>
                    <h4>测试</h4>
                    <ul>
                      <li>在深色主题下验证搜索高亮可见性</li>
                      <li>测试多个深色主题变体</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ==================== CTA Section ====================
function CTASection() {
  const navigate = useNavigate()

  const handleStartFree = () => {
    navigate('/dashboard')
  }

  return (
    <section className="cta-section">
      <div className="cta-box">
        <div className="cta-circle cta-circle-1" />
        <div className="cta-circle cta-circle-2" />
        <h2>准备好开始你的开源之旅了吗？</h2>
        <p>加入数万名开发者，用 AI 助力你的开源贡献之路</p>
        <button className="btn btn-primary btn-lg" onClick={handleStartFree}>
          免费开始使用
          <ArrowRightIcon />
        </button>
      </div>
    </section>
  )
}

export {
  HeroSection,
  WhySection,
  FeaturesSection,
  WorkflowSection,
  PreviewSection,
  CTASection,
}

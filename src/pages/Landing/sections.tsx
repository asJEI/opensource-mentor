import { authService } from '@/services'

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.72 0 0 .84-.27 2.75 1.05A9.39 9.39 0 0 1 12 6.97c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .27.18.59.69.49A10.05 10.05 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
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
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
)

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m20 6-11 11-5-5" />
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
    <path d="m16 18 6-6-6-6" />
    <path d="m8 6-6 6 6 6" />
  </svg>
)

const GitPullRequestIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="18" r="3" />
    <path d="M6 9v12" />
    <path d="M18 15V9" />
    <path d="M18 9a3 3 0 0 0-3-3h-1" />
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

const onboardingSteps = [
  {
    title: '读取 GitHub 开发者上下文',
    desc: '先从你的公开仓库、语言和贡献记录理解你现在的能力边界。',
  },
  {
    title: '匹配真正适合的 Issue',
    desc: '不只看 good first issue 标签，而是结合技术栈、改动范围和项目活跃度排序。',
  },
  {
    title: '陪你完成第一次贡献',
    desc: '拆解 Issue、生成学习路线、准备 PR 描述，并在提交前做代码审查。',
  },
]

const productPillars = [
  {
    icon: <TargetIcon />,
    title: '能力画像',
    desc: '把“我是新手/会一点/做过项目”转成可用于推荐的真实偏好。',
  },
  {
    icon: <GitPullRequestIcon />,
    title: 'Issue 匹配',
    desc: '从仓库和 Issue 数据里筛出当前阶段更容易完成、也更值得做的任务。',
  },
  {
    icon: <CodeIcon />,
    title: '贡献陪跑',
    desc: '从理解代码、拆任务到整理 PR，让开源贡献不是一次性 AI Demo。',
  },
]

function useLandingActions() {
  return {
    startWithGithub: () => authService.startGitHubLogin(),
    viewProduct: () => {
      const el = document.getElementById('how-it-works')
      el?.scrollIntoView({ behavior: 'smooth' })
    },
  }
}

function HeroSection() {
  const { startWithGithub, viewProduct } = useLandingActions()

  return (
    <section className="landing-hero" id="hero">
      <div className="landing-hero-copy">
        <div className="landing-kicker">OpenSource Mentor</div>
        <h1>找到适合你的开源 Issue，然后把它做完。</h1>
        <p>
          面向开发者的开源贡献工作台。它会根据你的能力、技术栈和目标，推荐更合适的
          Issue，并把理解项目、拆解任务、准备 PR 的过程串起来。
        </p>

        <div className="landing-actions">
          <button
            type="button"
            className="github-login-button"
            onClick={startWithGithub}
          >
            <GithubIcon />
            使用 GitHub 登录
            <ArrowRightIcon />
          </button>
          <button
            type="button"
            className="landing-secondary-button"
            onClick={viewProduct}
          >
            先了解流程
          </button>
        </div>

        <div className="landing-note">
          仅请求 GitHub 公开资料权限；登录后会读取公开仓库、语言、PR / Issue 等信息生成画像。
        </div>
      </div>

      <div className="landing-terminal" aria-label="OpenSource Mentor workflow preview">
        <div className="terminal-topbar">
          <span />
          <span />
          <span />
          <strong>opensource-mentor</strong>
        </div>
        <div className="terminal-body">
          <div className="terminal-line muted">$ connect github</div>
          <div className="terminal-line success">
            <CheckIcon />
            已识别 TypeScript / React / 文档贡献经验
          </div>
          <div className="terminal-line muted">$ match issues --goal first-pr</div>
          <div className="issue-preview-card">
            <div>
              <span className="issue-tag">推荐</span>
              <span className="issue-tag quiet">docs</span>
            </div>
            <h2>Improve onboarding docs for plugin setup</h2>
            <p>匹配度 92%，预计 1-2 小时，改动范围清晰，维护者近期活跃。</p>
          </div>
          <div className="terminal-line muted">$ mentor explain --next-step</div>
          <div className="terminal-output">
            先复现文档中的步骤，再补充缺失截图和命令说明。PR 描述会自动整理成维护者容易 review 的格式。
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkflowSection() {
  return (
    <section className="landing-section" id="how-it-works">
      <div className="landing-section-header">
        <span>首次进入产品后会发生什么</span>
        <h2>先理解你，再推荐 Issue。</h2>
      </div>

      <div className="onboarding-grid">
        {onboardingSteps.map((step, index) => (
          <article className="onboarding-step" key={step.title}>
            <div className="step-index">{String(index + 1).padStart(2, '0')}</div>
            <h3>{step.title}</h3>
            <p>{step.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function FeaturesSection() {
  return (
    <section className="landing-section landing-section-compact" id="features">
      <div className="landing-section-header">
        <span>项目当前重点</span>
        <h2>从仓库分析，走向贡献匹配。</h2>
      </div>

      <div className="pillar-grid">
        {productPillars.map((pillar) => (
          <article className="pillar-card" key={pillar.title}>
            <div className="pillar-icon">{pillar.icon}</div>
            <h3>{pillar.title}</h3>
            <p>{pillar.desc}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function PreviewSection() {
  return (
    <section className="landing-product-strip" id="preview">
      <div>
        <span>当前可用能力</span>
        <h2>仓库分析、Issue 推荐、路线图、PR 辅助和代码审查已经在产品内串起来。</h2>
      </div>
      <a href="/dashboard" className="landing-inline-link">
        进入工作台
        <ArrowRightIcon />
      </a>
    </section>
  )
}

export { HeroSection, WorkflowSection, FeaturesSection, PreviewSection }

import { Link } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { useRepositoryStore, useRoadmapStore } from '@/store'

const actions = [
  { path: '/dashboard', title: '理解任务', description: '了解项目结构、需求和改动范围。', number: '01' },
  { path: '/roadmap', title: '贡献指南', description: '按章节推进实现，记录完成的步骤。', number: '02' },
  { path: '/code-review', title: '审查改动', description: '检查真实 PR 或 Fork 分支的代码差异。', number: '03' },
  { path: '/pr-generator', title: '准备 PR', description: '根据实际改动，整理标题与提交说明。', number: '04' },
]

export default function Contribution() {
  const issue = useRepositoryStore((state) => state.activeContributionIssue)
  const steps = useRoadmapStore((state) => state.steps)
  const guideKey = useRoadmapStore((state) => state.cacheKey)
  const matches = issue && guideKey.endsWith(`${issue.repository.owner}/${issue.repository.name}#${issue.issueNumber}`)
  const completed = matches ? steps.filter((step) => step.status === 'completed').length : 0
  return (
    <AppLayout breadcrumbs={[{ label: '我的贡献' }]}>
      <div className="app-page active contribution-page">
        <header className="page-header"><h1 className="page-title">我的贡献</h1><p className="page-subtitle">回到当前任务，继续下一步。</p></header>
        {!issue ? (
          <section className="workbench-empty">
            <span className="empty-symbol" aria-hidden="true">{ '{ }' }</span>
            <h2>从一个值得做的任务开始</h2>
            <p>选择 Issue 后，可以在这里继续阅读指南、检查改动和准备 PR。</p>
            <div className="empty-actions"><Link className="btn btn-primary" to="/issues">发现任务</Link><Link className="btn btn-secondary" to="/dashboard">分析指定仓库</Link></div>
          </section>
        ) : (
          <>
            <section className="contribution-current">
              <div><span className="section-caption">当前任务</span><p className="contribution-repo">{issue.repository.fullName} · #{issue.issueNumber}</p><h2>{issue.title}</h2><p>{matches ? `已完成 ${completed} / ${steps.length} 个指南章节` : '贡献指南尚未加载'}</p></div>
              <Link className="btn btn-primary" to="/roadmap">继续贡献</Link>
            </section>
            <nav className="contribution-actions" aria-label="贡献步骤">
              {actions.map((action) => <Link to={action.path} key={action.path}><span>{action.number}</span><div><h3>{action.title}</h3><p>{action.description}</p></div><span aria-hidden="true">→</span></Link>)}
            </nav>
            <div className="contribution-footnote"><span>当前任务保存在此浏览器</span><Link to="/issues">发现其他任务 →</Link></div>
          </>
        )}
      </div>
    </AppLayout>
  )
}

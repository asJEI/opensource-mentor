import { NavLink, useLocation } from 'react-router-dom'
import { useRepositoryStore } from '@/store'

const views = [
  ['/dashboard', '理解任务'],
  ['/roadmap', '贡献指南'],
  ['/ai-mentor', 'AI 导师'],
  ['/code-review', '代码审查'],
  ['/pr-generator', '准备 PR'],
] as const

export default function TaskContext() {
  const issue = useRepositoryStore((state) => state.activeContributionIssue)
  const { pathname } = useLocation()
  if (!issue || pathname === '/issues' || pathname === '/settings' || pathname === '/contribution') return null
  return (
    <section className="task-context" aria-label="当前贡献任务">
      <div className="task-context-heading">
        <div>
          <small>{issue.repository.fullName} · #{issue.issueNumber}</small>
          <strong>{issue.title}</strong>
        </div>
        <a className="task-source" href={`https://github.com/${issue.repository.owner}/${issue.repository.name}/issues/${issue.issueNumber}`} target="_blank" rel="noreferrer">查看 Issue ↗</a>
      </div>
      <nav className="task-tabs" aria-label="任务视图">
        {views.map(([path, label]) => <NavLink key={path} to={path}>{label}</NavLink>)}
      </nav>
    </section>
  )
}

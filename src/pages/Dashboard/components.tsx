import type { RepoAnalysis, DifficultyLevel } from '@/types'
import { parseGitHubRepositoryInput } from '@/utils/githubRepository'
import clsx from 'clsx'

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

const StarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const GitForkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <circle cx="18" cy="6" r="3" />
    <path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9" />
    <path d="M12 12v3" />
  </svg>
)

const IssueIcon = () => (
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

const ArrowUpIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
)

const ArrowDownIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <polyline points="19 12 12 19 5 12" />
  </svg>
)

const RefreshIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
)

const InfoIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
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

// ==================== StatCard 组件 ====================
interface StatCardProps {
  icon: React.ReactNode
  iconClass: string
  label: string
  value: string
  change: string
  changeUp: boolean
}

function StatCard({
  icon,
  iconClass,
  label,
  value,
  change,
  changeUp,
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-label">
        <span className={clsx('stat-label-icon', iconClass)}>{icon}</span>
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className={clsx('stat-change', !changeUp && 'down')}>
        {changeUp ? <ArrowUpIcon /> : <ArrowDownIcon />}
        {change}
      </div>
    </div>
  )
}

// ==================== 工具函数 ====================

/**
 * 解析仓库输入字符串，提取 owner 和 name
 * @param input 支持 "owner/repo" 或 GitHub 仓库链接
 */
function parseRepoInput(input: string): { owner: string; name: string } | null {
  return parseGitHubRepositoryInput(input)
}

/**
 * 从 RepoAnalysis 推导难度等级
 * 根据 beginnerFriendliness 的 level 映射
 */
function deriveDifficulty(analysis: RepoAnalysis): DifficultyLevel {
  const level = analysis.beginnerFriendliness?.level
  if (level === 'very-friendly' || level === 'friendly') return 'easy'
  if (level === 'moderate') return 'medium'
  return 'hard'
}

/**
 * 从 RepoAnalysis 判断是否新手友好
 */
function isBeginnerFriendly(analysis: RepoAnalysis): boolean {
  const level = analysis.beginnerFriendliness?.level
  return (
    level === 'very-friendly' || level === 'friendly' || level === 'moderate'
  )
}

/**
 * 新手友好度等级中文映射
 */
function getFriendlyLabel(level?: string): string {
  const map: Record<string, string> = {
    'very-friendly': '非常友好',
    friendly: '友好',
    moderate: '适中',
    challenging: '有挑战',
    hard: '较难',
  }
  return map[level || ''] || '未知'
}

// ==================== Dashboard 页面 ====================

export {
  AlertIcon,
  BotIcon,
  CheckIcon,
  CodeIcon,
  GitForkIcon,
  InfoIcon,
  IssueIcon,
  RefreshIcon,
  SparklesIcon,
  StarIcon,
  StatCard,
  ZapIcon,
  deriveDifficulty,
  getFriendlyLabel,
  isBeginnerFriendly,
  parseRepoInput,
}

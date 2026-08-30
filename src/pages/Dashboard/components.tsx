import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { RepoAnalysis, DifficultyLevel } from '@/types'
import { parseGitHubRepositoryInput } from '@/utils/githubRepository'

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

const BranchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
)

const PulseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
)

const ExternalIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
)

// ==================== 视觉语言小组件 ====================

/** 编号 + 标签 + 延伸至右侧的细线，全站通用的章节分隔 */
export function SectionRule({
  index,
  label,
  aside,
}: {
  index: string
  label: string
  aside?: ReactNode
}) {
  return (
    <div className="osm-section-head">
      <span className="osm-section-index">{index}</span>
      <span className="osm-section-label">{label}</span>
      <span className="osm-section-rule" />
      {aside && <span className="osm-section-aside">{aside}</span>}
    </div>
  )
}

/** 仓库信息条中的单项数据 */
export function RepoStat({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string
  label?: string
}) {
  return (
    <span className="osm-stat" title={label}>
      {icon}
      {value}
      {label && <span className="osm-stat-label">{label}</span>}
    </span>
  )
}

export type LogState = 'pending' | 'running' | 'done' | 'failed'

const LOG_MARKS: Record<LogState, string> = {
  pending: '[    ]',
  running: '[ ·· ]',
  done: '[ ok ]',
  failed: '[fail]',
}

/** 把 AI 工作过程呈现为终端日志，而不是一个转圈的图标 */
export function LogLine({ state, children }: { state: LogState; children: ReactNode }) {
  return (
    <div className={clsx('osm-log-line', state)}>
      <span className="osm-log-mark">{LOG_MARKS[state]}</span>
      <span className={clsx(state === 'running' && 'osm-log-cursor')}>{children}</span>
    </div>
  )
}

/** 分段式评分仪表：比平滑进度条更像仪器，也更容易读出具体分值 */
export function Meter({
  score,
  max = 10,
  verdict,
  verdictTone = 'brand',
  foot,
}: {
  score: number
  max?: number
  verdict?: string
  verdictTone?: 'good' | 'brand' | 'hard'
  foot?: ReactNode
}) {
  const clamped = Math.max(0, Math.min(max, score))
  const filled = Math.round(clamped)
  const toneClass =
    verdictTone === 'good'
      ? 'osm-meter-good'
      : verdictTone === 'hard'
        ? 'osm-meter-hard'
        : ''
  const verdictColor =
    verdictTone === 'good'
      ? 'var(--ok)'
      : verdictTone === 'hard'
        ? 'var(--warn)'
        : 'var(--brand)'

  return (
    <div className={toneClass}>
      <div className="osm-meter-head">
        <span className="osm-meter-value">
          {clamped.toFixed(1)}
          <small> / {max}</small>
        </span>
        {verdict && (
          <span className="osm-meter-verdict" style={{ color: verdictColor }}>
            {verdict}
          </span>
        )}
      </div>
      <div className="osm-meter-track" role="presentation">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={clsx('osm-meter-seg', i < filled && 'on')} />
        ))}
      </div>
      {foot && <div className="osm-meter-foot">{foot}</div>}
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

/** 项目活跃度等级中文映射 */
function getActivityLabel(level?: string): string {
  const map: Record<string, string> = {
    'very-active': '非常活跃',
    active: '活跃',
    moderate: '一般',
    low: '偏低',
    inactive: '停滞',
  }
  return map[level || ''] || '未知'
}

/** 贡献领域难度中文映射 */
function getAreaDifficultyLabel(difficulty?: string): string {
  const map: Record<string, string> = {
    easy: '入门',
    medium: '中等',
    hard: '进阶',
  }
  return map[difficulty || ''] || '未知'
}

/** 大数字缩写：228431 → 228.4k，让统计条保持等宽对齐 */
function formatCount(value?: number | null): string {
  if (value == null || Number.isNaN(value)) return '--'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1000)}k`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

export {
  AlertIcon,
  ArrowRightIcon,
  BranchIcon,
  CodeIcon,
  ExternalIcon,
  GitForkIcon,
  InfoIcon,
  IssueIcon,
  PulseIcon,
  RefreshIcon,
  StarIcon,
  ZapIcon,
  deriveDifficulty,
  formatCount,
  getActivityLabel,
  getAreaDifficultyLabel,
  getFriendlyLabel,
  isBeginnerFriendly,
  parseRepoInput,
}

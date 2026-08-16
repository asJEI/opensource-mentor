/**
 * 业务组件统一导出入口
 *
 * 使用方式：
 * import { RepoInfoCard, IssueRow, AISummaryCard } from '@/components/business'
 */

// 仓库信息卡片
export { default as RepoInfoCard } from './RepoInfoCard'
export type { RepoInfoCardProps } from './RepoInfoCard'

// AI 分析摘要卡片
export { default as AISummaryCard } from './AISummaryCard'
export type { AISummaryCardProps } from './AISummaryCard'

// Issue 行组件
export { default as IssueRow } from './IssueRow'
export type { IssueRowProps } from './IssueRow'

// Issue 解释弹窗
export { default as IssueExplainModal } from './IssueExplainModal'
export type { IssueExplainModalProps } from './IssueExplainModal'

// PR 类型选择器
export { default as PrTypeSelector } from './PrTypeSelector'
export type { PrTypeSelectorProps } from './PrTypeSelector'

// PR 生成结果面板
export { default as PrResultPanel } from './PrResultPanel'
export type { PrResultPanelProps } from './PrResultPanel'

// 路线图时间轴
export { default as RoadmapTimeline } from './RoadmapTimeline'
export type { RoadmapTimelineProps } from './RoadmapTimeline'

// 进度总览卡片
export { default as ProgressOverview } from './ProgressOverview'
export type { ProgressOverviewProps } from './ProgressOverview'

// 文件目录树
export { default as FileTree } from './FileTree'
export type { FileTreeProps, FileTreeItem } from './FileTree'

// 统计卡片
export { default as StatCard } from './StatCard'
export type { StatCardProps, StatCardVariant } from './StatCard'

// Issue 上下文卡片
export { default as IssueContextCard } from './IssueContextCard'
export type { IssueContextCardProps } from './IssueContextCard'

// 审查进度组件
export { default as ReviewProgress } from './ReviewProgress'
export type { ReviewProgressProps } from './ReviewProgress'

// 审查结果面板
export { default as ReviewResultPanel } from './ReviewResultPanel'
export type { ReviewResultPanelProps } from './ReviewResultPanel'

// 审查问题卡片
export { default as ReviewIssueCard } from './ReviewIssueCard'
export type { ReviewIssueCardProps } from './ReviewIssueCard'

// 审查操作栏
export { default as ReviewActionBar } from './ReviewActionBar'
export type { ReviewActionBarProps } from './ReviewActionBar'

// 下一步引导卡片
export { NextStepCard } from './NextStepCard'

// 分析后多路径引导
export { JourneyActions } from './JourneyActions'

// AI 页面错误恢复
export { AiPageError } from './AiPageError'

// 首次用户画像问卷
export { default as ProfileOnboarding } from './ProfileOnboarding'

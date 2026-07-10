import React from 'react'
import clsx from 'clsx'
import type { RoadmapPhase, RoadmapStepStatus } from '@/types'
import { Button } from '@/components/ui'

export interface RoadmapTimelineProps {
  /** 阶段列表 */
  steps: RoadmapPhase[]
  /** 下一步回调 */
  onNextStep?: () => void
  /** 重置回调 */
  onReset?: () => void
  /** 自定义类名 */
  className?: string
}

const stepIcons: Record<RoadmapStepStatus, React.ReactNode> = {
  pending: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  current: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  completed: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
}

const difficultyLabel: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

/**
 * 路线图时间轴组件
 * 垂直双列时间线，展示学习路线的各个阶段
 */
export const RoadmapTimeline: React.FC<RoadmapTimelineProps> = ({
  steps,
  onNextStep,
  onReset,
  className,
}) => {
  // 计算完成百分比
  const completedCount = steps.filter((s) => s.status === 'completed').length
  const totalCount = steps.length
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <div className={clsx('roadmap-timeline-wrapper', className)}>
      <div className="timeline">
        {/* 中间连接线 */}
        <div className="timeline-line">
          <div className="timeline-line-fill" style={{ height: `${progressPercent}%` }} />
        </div>

        {/* 阶段列表 */}
        {steps.map((phase, index) => {
        const isLeft = index % 2 === 0
        const isCompleted = phase.status === 'completed'
        const isCurrent = phase.status === 'current'

        return (
          <div
            key={phase.id}
            className={clsx('timeline-item', {
              completed: isCompleted,
              current: isCurrent,
            })}
          >
            {/* 节点 */}
            <div className="timeline-node">
              {stepIcons[phase.status]}
            </div>

            {/* 左侧卡片（偶数索引） */}
            {isLeft ? (
              <>
                <div className="timeline-side left">
                  <div className="timeline-card">
                    <div className="card-day-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      阶段 {phase.phase}
                    </div>
                    <h3 className="card-title">{phase.title}</h3>
                    <p className="card-desc">{phase.goal}</p>
                    <div className={clsx('card-difficulty', `difficulty-${phase.difficulty}`)}>
                      难度：{difficultyLabel[phase.difficulty] || phase.difficulty}
                    </div>
                    <ul className="card-tasks">
                      {phase.tasks.map((task) => (
                        <li key={task.id} className={clsx('card-task', task.completed && 'completed')}>
                          <span className="card-task-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span>{task.text}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="card-footer">
                      <span className="card-duration">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {phase.estimatedDuration}
                      </span>
                      {isCurrent && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={onNextStep}
                          className="card-action"
                        >
                          开始学习
                        </Button>
                      )}
                      {isCompleted && (
                        <span className="card-link">
                          已完成
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="timeline-side right" />
              </>
            ) : (
              <>
                <div className="timeline-side left" />
                <div className="timeline-side right">
                  <div className="timeline-card">
                    <div className="card-day-badge">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      阶段 {phase.phase}
                    </div>
                    <h3 className="card-title">{phase.title}</h3>
                    <p className="card-desc">{phase.goal}</p>
                    <div className={clsx('card-difficulty', `difficulty-${phase.difficulty}`)}>
                      难度：{difficultyLabel[phase.difficulty] || phase.difficulty}
                    </div>
                    <ul className="card-tasks">
                      {phase.tasks.map((task) => (
                        <li key={task.id} className={clsx('card-task', task.completed && 'completed')}>
                          <span className="card-task-icon">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          <span>{task.text}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="card-footer">
                      <span className="card-duration">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        {phase.estimatedDuration}
                      </span>
                      {isCurrent && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={onNextStep}
                          className="card-action"
                        >
                          开始学习
                        </Button>
                      )}
                      {isCompleted && (
                        <span className="card-link">
                          已完成
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )
      })}
      </div>

      {/* 底部控制按钮 */}
      {onReset && (
        <div className="roadmap-controls">
          <Button variant="secondary" onClick={onReset}>
            重置进度
          </Button>
        </div>
      )}
    </div>
  )
}

export default RoadmapTimeline

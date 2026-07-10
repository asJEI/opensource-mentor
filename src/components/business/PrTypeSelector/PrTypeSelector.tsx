import React from 'react'
import clsx from 'clsx'
import type { PrType } from '@/types'

export interface PrTypeSelectorProps {
  /** 当前选中的 PR 类型 */
  value: PrType
  /** 类型变化回调 */
  onChange: (type: PrType) => void
  /** 自定义类名 */
  className?: string
}

interface TypeOption {
  type: PrType
  name: string
  desc: string
  icon: React.ReactNode
}

const typeOptions: TypeOption[] = [
  {
    type: 'bug',
    name: 'Bug Fix',
    desc: '修复已知问题或错误',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        <path d="M10.5 2H13.5" />
        <path d="M12 22v-6" />
        <path d="M6 8h12l-1 12H7L6 8z" />
        <line x1="10" y1="12" x2="10.01" y2="12" />
        <line x1="14" y1="12" x2="14.01" y2="12" />
      </svg>
    ),
  },
  {
    type: 'feature',
    name: 'Feature',
    desc: '新增功能或特性改进',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    type: 'docs',
    name: 'Docs',
    desc: '文档更新或补充说明',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
]

/**
 * PR 类型选择器
 * 提供 Bug Fix、Feature、Docs 三种类型的单选
 */
export const PrTypeSelector: React.FC<PrTypeSelectorProps> = ({
  value,
  onChange,
  className,
}) => {
  return (
    <div className={clsx('type-selector', className)}>
      {typeOptions.map((option) => {
        const isSelected = value === option.type
        return (
          <div
            key={option.type}
            className={clsx('type-option', { selected: isSelected, active: isSelected })}
            onClick={() => onChange(option.type)}
          >
            <div className="type-radio">
              <div className="type-radio-inner" />
            </div>
            <div className={clsx('type-icon-badge', option.type)}>
              {option.icon}
            </div>
            <div className="type-info">
              <div className="type-name">{option.name}</div>
              <div className="type-desc">{option.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PrTypeSelector

import type React from 'react'
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
  /** Conventional-commit prefix. Doubles as the visual mark and as a hint at
   *  the prefix the contributor will actually type in the commit. */
  token: string
}

const typeOptions: TypeOption[] = [
  { type: 'bug', name: 'Bug Fix', desc: '修复已知问题或错误', token: 'fix' },
  { type: 'feature', name: 'Feature', desc: '新增功能或特性改进', token: 'feat' },
  { type: 'docs', name: 'Docs', desc: '文档更新或补充说明', token: 'docs' },
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
            <div className="type-info">
              <div className="type-name">
                {option.name}
                <span className={clsx('type-token', option.type)}>
                  {option.token}:
                </span>
              </div>
              <div className="type-desc">{option.desc}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default PrTypeSelector

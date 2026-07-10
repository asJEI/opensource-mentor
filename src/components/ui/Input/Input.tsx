import React from 'react'
import clsx from 'clsx'

export interface InputProps {
  /** 输入框类型 */
  type?: 'text' | 'textarea' | 'select' | 'email'
  /** 值 */
  value: string
  /** 值变化回调 */
  onChange: (value: string) => void
  /** 占位符 */
  placeholder?: string
  /** 标签 */
  label?: string
  /** 提示文字 */
  hint?: string
  /** 是否禁用 */
  disabled?: boolean
  /** textarea 行数 */
  rows?: number
  /** select 选项 */
  options?: Array<{ value: string; label: string }>
  /** 自定义类名 */
  className?: string
}

/**
 * 输入框组件（支持 text / textarea / select / email）
 */
export const Input: React.FC<InputProps> = ({
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  hint,
  disabled = false,
  rows = 4,
  options = [],
  className,
}) => {
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    onChange(e.target.value)
  }

  const renderControl = () => {
    if (type === 'textarea') {
      return (
        <textarea
          className={clsx('form-textarea', className)}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
        />
      )
    }

    if (type === 'select') {
      return (
        <select
          className={clsx('form-select', 'filter-select', className)}
          value={value}
          onChange={handleChange}
          disabled={disabled}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }

    return (
      <input
        type={type}
        className={clsx('form-input', className)}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
      />
    )
  }

  if (!label && !hint) {
    return renderControl()
  }

  return (
    <div className="form-group">
      {label && <label className="form-label">{label}</label>}
      {renderControl()}
      {hint && <div className="form-hint">{hint}</div>}
    </div>
  )
}

export default Input

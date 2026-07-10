import React from 'react'
import clsx from 'clsx'

export interface FileTreeItem {
  /** 文件/目录名称 */
  name: string
  /** 类型 */
  type: 'file' | 'dir'
  /** 缩进层级（1/2/3） */
  indent: number
}

export interface FileTreeProps {
  /** 文件列表 */
  files: FileTreeItem[]
  /** 自定义类名 */
  className?: string
}

/**
 * 文件目录树组件
 * 显示多级缩进的文件/目录列表
 */
export const FileTree: React.FC<FileTreeProps> = ({ files, className }) => {
  return (
    <div className={clsx('file-tree', className)}>
      {files.map((file, index) => (
        <div
          key={index}
          className={clsx(
            'file-item',
            `file-indent-${file.indent}`
          )}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            fontSize: '13px',
            color: 'var(--ink-2)',
            borderRadius: '6px',
            transition: 'background 0.15s',
            paddingLeft: `${(file.indent - 1) * 24 + 12}px`,
          }}
        >
          {file.type === 'dir' ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '16px', height: '16px', color: 'var(--yellow)', flexShrink: 0 }}
            >
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '16px', height: '16px', color: 'var(--muted)', flexShrink: 0 }}
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {file.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default FileTree

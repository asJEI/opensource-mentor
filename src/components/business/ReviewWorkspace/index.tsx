import { useMemo, useState, type ReactNode } from 'react'
import type {
  ReviewChangedFile,
  ReviewIssue,
  ReviewJobArtifacts,
  ReviewResult,
  RiskItem,
} from '@/types'
import { findFilePatch, parseUnifiedDiff } from '@/utils/parseDiff'
import './ReviewWorkspace.css'

export interface ReviewWorkspaceProps {
  result: ReviewResult
  artifacts?: ReviewJobArtifacts | null
  selectedFile: string | null
  onSelectFile: (filename: string) => void
  sourceLabel?: string
  createPrUrl?: string | null
  onOpenCreatePr?: () => void
  onGeneratePrDesc?: () => void
}

function issueCountForFile(issues: ReviewIssue[], filename: string): number {
  return issues.filter((issue) => issue.file === filename).length
}

function riskCountForFile(risks: RiskItem[], filename: string): number {
  return risks.filter((risk) => risk.affectedFiles.includes(filename)).length
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    added: 'A',
    modified: 'M',
    removed: 'D',
    renamed: 'R',
    copied: 'C',
  }
  return map[status] || status.slice(0, 1).toUpperCase() || 'M'
}

function scoreFromResult(result: ReviewResult): number {
  const critical = result.stats.critical * 18
  const high = result.stats.high * 10
  const medium = result.stats.medium * 4
  const low = result.stats.low * 1
  const raw = Math.max(0, 100 - critical - high - medium - low)
  return Math.round(raw)
}

export default function ReviewWorkspace({
  result,
  artifacts,
  selectedFile,
  onSelectFile,
  sourceLabel,
  createPrUrl,
  onOpenCreatePr,
  onGeneratePrDesc,
}: ReviewWorkspaceProps) {
  const files = artifacts?.changedFiles || []
  const [showComments, setShowComments] = useState(true)
  const [openSummary, setOpenSummary] = useState(true)
  const [openRisks, setOpenRisks] = useState(true)
  const [openIssues, setOpenIssues] = useState(true)

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aScore =
        issueCountForFile(result.issues, a.filename) * 10 +
        riskCountForFile(result.risks.risks, a.filename) * 5 +
        a.changes
      const bScore =
        issueCountForFile(result.issues, b.filename) * 10 +
        riskCountForFile(result.risks.risks, b.filename) * 5 +
        b.changes
      return bScore - aScore
    })
  }, [files, result.issues, result.risks.risks])

  const patch = selectedFile
    ? findFilePatch(artifacts || undefined, selectedFile)
    : null
  const hunks = selectedFile ? parseUnifiedDiff(selectedFile, patch) : []
  const fileIssues = selectedFile
    ? result.issues.filter((issue) => issue.file === selectedFile)
    : []
  const commentLines = new Set<number>()
  for (const issue of fileIssues) {
    if (issue.line != null) commentLines.add(issue.line)
  }

  const score = scoreFromResult(result)

  return (
    <div className="review-workspace">
      <div className="review-workspace__toolbar">
        <div className="review-workspace__toolbar-left">
          <div className="review-workspace__title">
            {result.summary.title || 'AI 代码审查'}
          </div>
          {sourceLabel ? (
            <div className="review-workspace__source">{sourceLabel}</div>
          ) : null}
        </div>
        <div className="review-workspace__toolbar-right">
          {createPrUrl ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onOpenCreatePr}
            >
              去开合并申请
            </button>
          ) : null}
          {onGeneratePrDesc ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onGeneratePrDesc}
            >
              生成 PR 描述
            </button>
          ) : null}
        </div>
      </div>

      <div className="review-workspace__body">
        <aside className="review-workspace__files">
          <div className="review-workspace__pane-header">
            变更文件 ({sortedFiles.length})
          </div>
          <div className="review-workspace__file-list">
            {sortedFiles.length === 0 ? (
              <div className="review-workspace__empty">暂无变更文件</div>
            ) : (
              sortedFiles.map((file) => (
                <FileRow
                  key={file.filename}
                  file={file}
                  active={selectedFile === file.filename}
                  issueCount={issueCountForFile(result.issues, file.filename)}
                  onClick={() => onSelectFile(file.filename)}
                />
              ))
            )}
          </div>
        </aside>

        <section className="review-workspace__diff">
          <div className="review-workspace__pane-header review-workspace__pane-header--split">
            <span className="review-workspace__diff-path">
              {selectedFile || '选择左侧文件查看 Diff'}
            </span>
            {fileIssues.length > 0 ? (
              <button
                type="button"
                className="review-workspace__ghost-btn"
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? '隐藏评论' : '显示评论'} ({fileIssues.length})
              </button>
            ) : null}
          </div>
          <div className="review-workspace__diff-scroll">
            {!selectedFile ? (
              <div className="review-workspace__empty">请选择文件</div>
            ) : hunks.length === 0 ? (
              <div className="review-workspace__empty">
                该文件无 Diff 内容（可能是二进制或过大文件）
              </div>
            ) : (
              hunks.map((hunk, hunkIndex) => (
                <div
                  key={`${hunk.header}-${hunkIndex}`}
                  className="review-diff-hunk"
                >
                  <div className="review-diff-hunk__header">{hunk.header}</div>
                  {hunk.lines.map((line, lineIndex) => {
                    const lineNo = line.newLineNumber ?? line.oldLineNumber
                    const hasComment =
                      lineNo != null && commentLines.has(lineNo)
                    return (
                      <div
                        key={`${hunkIndex}-${lineIndex}`}
                        className={`review-diff-line review-diff-line--${line.type}${
                          hasComment ? ' review-diff-line--commented' : ''
                        }`}
                      >
                        <span className="review-diff-line__num">
                          {line.oldLineNumber ?? ''}
                        </span>
                        <span className="review-diff-line__num">
                          {line.newLineNumber ?? ''}
                        </span>
                        <span className="review-diff-line__sign">
                          {line.type === 'added'
                            ? '+'
                            : line.type === 'removed'
                              ? '-'
                              : ' '}
                        </span>
                        <span className="review-diff-line__code">
                          {line.content}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))
            )}

            {showComments && fileIssues.length > 0 ? (
              <div className="review-diff-comments">
                <div className="review-diff-comments__title">本文件审查评论</div>
                {fileIssues.map((issue) => (
                  <div key={issue.id} className="review-diff-comment">
                    <div className="review-diff-comment__meta">
                      <span
                        className={`review-severity review-severity--${issue.severity}`}
                      >
                        {issue.severity}
                      </span>
                      {issue.line != null ? (
                        <span>L{issue.line}</span>
                      ) : null}
                    </div>
                    <div className="review-diff-comment__title">
                      {issue.title}
                    </div>
                    <p>{issue.description || issue.suggestionText}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="review-workspace__panel">
          <div className="review-workspace__pane-header">AI 审查</div>
          <div className="review-workspace__panel-scroll">
            <div className="review-score">
              <div className="review-score__ring" style={{ ['--score' as string]: score }}>
                <span>{score}%</span>
              </div>
              <div>
                <div className="review-score__label">审查通过度</div>
                <div className="review-score__hint">
                  严重 {result.stats.critical} · 高 {result.stats.high} · 中{' '}
                  {result.stats.medium}
                </div>
              </div>
            </div>

            <PanelSection
              title="变更总结"
              open={openSummary}
              onToggle={() => setOpenSummary((v) => !v)}
            >
              <p className="review-panel-text">{result.summary.summary}</p>
              {result.summary.keyChanges.length > 0 ? (
                <>
                  <div className="review-panel-subtitle">核心变更</div>
                  <ul className="review-panel-list">
                    {result.summary.keyChanges.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
              {result.summary.affectedSystems.length > 0 ? (
                <>
                  <div className="review-panel-subtitle">影响模块</div>
                  <div className="review-panel-tags">
                    {result.summary.affectedSystems.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </>
              ) : null}
              {result.summary.architecturalImpact ? (
                <>
                  <div className="review-panel-subtitle">架构影响</div>
                  <p className="review-panel-text">
                    {result.summary.architecturalImpact}
                  </p>
                </>
              ) : null}
            </PanelSection>

            <PanelSection
              title={`风险 (${result.risks.risks.length})`}
              open={openRisks}
              onToggle={() => setOpenRisks((v) => !v)}
            >
              {result.risks.risks.length === 0 ? (
                <p className="review-panel-text">未发现显著风险</p>
              ) : (
                result.risks.risks.map((risk, index) => (
                  <div key={`${risk.description}-${index}`} className="review-risk-card">
                    <div className="review-risk-card__top">
                      <span
                        className={`review-severity review-severity--${risk.severity}`}
                      >
                        {risk.severity}
                      </span>
                      <span>{risk.category}</span>
                    </div>
                    <p>{risk.description}</p>
                    {risk.recommendation ? (
                      <div className="review-risk-card__tip">
                        建议：{risk.recommendation}
                      </div>
                    ) : null}
                    {risk.affectedFiles[0] ? (
                      <button
                        type="button"
                        className="review-workspace__link-btn"
                        onClick={() => onSelectFile(risk.affectedFiles[0])}
                      >
                        回溯文件：{risk.affectedFiles[0]}
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </PanelSection>

            <PanelSection
              title={`问题 (${result.issues.length})`}
              open={openIssues}
              onToggle={() => setOpenIssues((v) => !v)}
            >
              {result.issues.length === 0 ? (
                <p className="review-panel-text">暂无问题</p>
              ) : (
                result.issues.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    className="review-issue-mini"
                    onClick={() => onSelectFile(issue.file)}
                  >
                    <div className="review-issue-mini__top">
                      <span
                        className={`review-severity review-severity--${issue.severity}`}
                      >
                        {issue.severity}
                      </span>
                      <span className="review-issue-mini__file">
                        {issue.file}
                        {issue.line != null ? `:${issue.line}` : ''}
                      </span>
                    </div>
                    <div className="review-issue-mini__title">{issue.title}</div>
                  </button>
                ))
              )}
            </PanelSection>

            {result.tips.length > 0 ? (
              <PanelSection title={`小提示 (${result.tips.length})`} open>
                <ul className="review-panel-list">
                  {result.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

function FileRow({
  file,
  active,
  issueCount,
  onClick,
}: {
  file: ReviewChangedFile
  active: boolean
  issueCount: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`review-file-row${active ? ' is-active' : ''}`}
      onClick={onClick}
      title={file.filename}
    >
      <span
        className={`review-file-row__status review-file-row__status--${file.status}`}
      >
        {statusLabel(file.status)}
      </span>
      <span className="review-file-row__name">{file.filename}</span>
      <span className="review-file-row__stats">
        <span className="is-add">+{file.additions}</span>
        <span className="is-del">-{file.deletions}</span>
      </span>
      {issueCount > 0 ? (
        <span className="review-file-row__badge">{issueCount}</span>
      ) : null}
    </button>
  )
}

function PanelSection({
  title,
  open = true,
  onToggle,
  children,
}: {
  title: string
  open?: boolean
  onToggle?: () => void
  children: ReactNode
}) {
  return (
    <section className="review-panel-section">
      <button
        type="button"
        className="review-panel-section__header"
        onClick={onToggle}
        disabled={!onToggle}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
      </button>
      {open ? <div className="review-panel-section__body">{children}</div> : null}
    </section>
  )
}

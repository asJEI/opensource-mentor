import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Button, Modal } from '@/components/ui'
import { AiPageError, NextStepCard } from '@/components/business'
import { useChatStore, useRepositoryStore, useToastStore } from '@/store'
import { getErrorMessage } from '@/services/errors'
import type { ChatMessage } from '@/types'

// ==================== 图标组件 ====================
function BotIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}

function SparklesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

// ==================== 快捷问题 ====================
const QUICK_QUESTIONS = [
  '这个项目的技术栈是什么？',
  '如何开始贡献代码？',
  '有哪些适合新手的 Issue？',
  '代码风格规范是什么？',
]

// ==================== 消息气泡 ====================
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } catch {
      return ''
    }
  }

  return (
    <div
      className={clsx('chat-message', {
        'chat-message--user': isUser,
        'chat-message--bot': !isUser,
      })}
    >
      <div className="chat-message__avatar">
        {isUser ? <UserIcon /> : <BotIcon />}
      </div>
      <div className="chat-message__content">
        <div className="chat-message__header">
          <span className="chat-message__role">
            {isUser ? '你' : 'AI 导师'}
          </span>
          <span className="chat-message__time">
            {formatTime(message.timestamp)}
          </span>
        </div>
        <div className="chat-message__bubble">
          <p className="chat-message__text">{message.content}</p>
        </div>
        {!isUser && (
          <button
            className="chat-message__copy"
            onClick={handleCopy}
            title="复制内容"
          >
            {copied ? '已复制' : <CopyIcon />}
          </button>
        )}
      </div>
    </div>
  )
}

// ==================== 打字指示器 ====================
function TypingIndicator() {
  return (
    <div className="chat-message chat-message--bot">
      <div className="chat-message__avatar">
        <BotIcon />
      </div>
      <div className="chat-message__content">
        <div className="chat-message__header">
          <span className="chat-message__role">AI 导师</span>
        </div>
        <div className="chat-message__bubble chat-message__bubble--typing">
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== 欢迎页 ====================
function WelcomeState({ onQuickAsk }: { onQuickAsk: (q: string) => void }) {
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const repoName = `${currentOwner}/${currentRepoName}`

  return (
    <div className="chat-welcome">
      <div className="chat-welcome__icon">
        <SparklesIcon />
      </div>
      <h2>你好，我是 AI 导师</h2>
      <p>
        我可以帮你解答关于 <strong>{repoName}</strong> 项目的任何问题，
        包括技术栈、贡献指南、Issue 解析、代码审查建议等。
      </p>
      <div className="chat-welcome__quick">
        <div className="chat-welcome__quick-title">快速提问</div>
        <div className="chat-welcome__quick-list">
          {QUICK_QUESTIONS.map((q, i) => (
            <button
              key={i}
              className="quick-question-btn"
              onClick={() => onQuickAsk(q)}
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ==================== Chat 页面 ====================
const AiMentor = () => {
  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearChat = useChatStore((s) => s.clearChat)
  const setCurrentRepository = useChatStore((s) => s.setCurrentRepository)
  const currentOwner = useRepositoryStore((s) => s.currentOwner)
  const currentRepoName = useRepositoryStore((s) => s.currentRepoName)
  const showToast = useToastStore((s) => s.showToast)

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false) // 切换仓库确认弹窗
  const [pendingRepo, setPendingRepo] = useState<{
    owner: string
    repo: string
  } | null>(null) // 待切换的仓库
  const [originalRepo, setOriginalRepo] = useState<string>('') // 对话对应的原仓库
  const chatCurrentRepo = useChatStore(
    (s) => `${s.currentOwner}/${s.currentRepo}`,
  ) // chat store 中的当前仓库

  // 初始化：同步当前仓库到 chat store
  useEffect(() => {
    setCurrentRepository(currentOwner, currentRepoName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 监听全局仓库变化：如果全局仓库变了，且有聊天记录，弹窗确认
  useEffect(() => {
    const currentRepo = `${currentOwner}/${currentRepoName}`
    // chat store 中的仓库和全局仓库不一致，说明用户切换了仓库
    if (chatCurrentRepo && chatCurrentRepo !== currentRepo) {
      if (messages.length > 0) {
        // 有聊天记录，弹窗确认
        setOriginalRepo(chatCurrentRepo)
        setPendingRepo({ owner: currentOwner, repo: currentRepoName })
        setShowSwitchConfirm(true)
      } else {
        // 没有聊天记录，直接切换
        setCurrentRepository(currentOwner, currentRepoName)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOwner, currentRepoName])

  // 确认切换仓库并清空对话
  const handleConfirmSwitchAndClear = () => {
    if (pendingRepo) {
      setCurrentRepository(pendingRepo.owner, pendingRepo.repo)
      clearChat()
      showToast('success', '已切换仓库', '对话已清空，开始新的对话吧')
    }
    setShowSwitchConfirm(false)
    setPendingRepo(null)
  }

  // 确认切换仓库但保留对话
  const handleConfirmSwitchKeep = () => {
    if (pendingRepo) {
      setCurrentRepository(pendingRepo.owner, pendingRepo.repo)
      showToast('info', '已切换仓库', '历史对话已保留，请注意上下文可能不一致')
    }
    setShowSwitchConfirm(false)
    setPendingRepo(null)
  }

  // 取消切换（关闭弹窗 — 实际仓库已切换，这里仅关闭弹窗）
  const handleCancelSwitch = () => {
    // 即使关闭弹窗，也同步到新仓库
    if (pendingRepo) {
      setCurrentRepository(pendingRepo.owner, pendingRepo.repo)
    }
    setShowSwitchConfirm(false)
    setPendingRepo(null)
  }

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  // 发送消息
  const sendContent = async (rawContent: string) => {
    const content = rawContent.trim()
    if (!content || isStreaming) return

    setInputValue('')
    try {
      await sendMessage(content)
    } catch (err) {
      showToast('error', '发送失败', getErrorMessage(err, '请稍后重试'))
    }
  }

  const handleSend = () => {
    void sendContent(inputValue)
  }

  // 快速提问
  const handleQuickAsk = (question: string) => {
    setInputValue('')
    void sendContent(question)
  }

  // 清空聊天
  const handleClear = () => {
    if (messages.length === 0) return
    clearChat()
    showToast('success', '已清空', '聊天记录已清空')
  }

  // 回车发送
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasMessages = messages.length > 0
  const repoName = `${currentOwner}/${currentRepoName}`

  return (
    <AppLayout breadcrumbs={[{ label: '学习中心' }, { label: 'AI 导师' }]}>
      <div className="app-page active ai-mentor-page">
        {/* 页面标题区 */}
        <div className="page-header">
          <div className="page-title-row">
            <div>
              <h1 className="page-title">
                AI 导师
                <span className="badge badge-info" style={{ marginLeft: 8 }}>
                  Beta
                </span>
              </h1>
              <p className="page-subtitle">
                有任何关于开源贡献的问题？随时问我
              </p>
            </div>
            <div className="header-actions">
              <div className="repo-pill">
                <SparklesIcon />
                {repoName}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={!hasMessages}
              >
                <TrashIcon />
                清空对话
              </Button>
            </div>
          </div>
        </div>

        {/* 聊天区域 */}
        <div className="chat-container">
          <div className="chat-messages">
            {!hasMessages && !isStreaming && (
              <WelcomeState onQuickAsk={handleQuickAsk} />
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isStreaming && <TypingIndicator />}

            {error && (
              <AiPageError
                className="chat-error-panel"
                title="发送失败"
                message={error}
                onRetry={() => useChatStore.setState({ error: null })}
                retryLabel="关闭提示"
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="chat-input-area">
            <div className="chat-input-wrapper">
              <textarea
                className="chat-input"
                placeholder="输入你的问题...（Enter 发送，Shift+Enter 换行）"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isStreaming}
              />
              <button
                className={clsx('chat-send-btn', {
                  disabled: isStreaming || !inputValue.trim(),
                })}
                onClick={handleSend}
                disabled={isStreaming || !inputValue.trim()}
              >
                <SendIcon />
              </button>
            </div>
            <p className="chat-input-hint">
              AI 回复仅供参考，请结合实际情况判断。当前对话基于 {repoName}{' '}
              项目。
            </p>
          </div>
        </div>

        {hasMessages && (
          <NextStepCard
            currentStep={4}
            totalSteps={6}
            title="准备动手了吗？"
            description="带着 Issue 与 Mentor 建议继续做 Code Review，再生成 PR 草稿。"
            buttonText="开始代码审查"
            nextPath="/code-review"
          />
        )}
      </div>

      {/* 切换仓库确认弹窗 */}
      <Modal
        visible={showSwitchConfirm}
        title="已切换仓库"
        icon={
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 24, height: 24 }}
          >
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
        }
        onClose={handleCancelSwitch}
        footer={
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={handleConfirmSwitchKeep}>
              保留对话
            </Button>
            <Button variant="primary" onClick={handleConfirmSwitchAndClear}>
              清空并切换
            </Button>
          </div>
        }
      >
        <p
          style={{
            margin: 0,
            color: 'var(--ink-2)',
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          检测到当前仓库已从{' '}
          <strong style={{ color: 'var(--ink)' }}>{originalRepo || '—'}</strong>{' '}
          切换为{' '}
          <strong style={{ color: 'var(--accent)' }}>
            {pendingRepo ? `${pendingRepo.owner}/${pendingRepo.repo}` : '—'}
          </strong>
          。
        </p>
        <p
          style={{
            margin: '12px 0 0',
            color: 'var(--muted)',
            fontSize: 13,
            lineHeight: 1.6,
          }}
        >
          是否清空之前的对话记录？保留对话可能导致 AI 回复上下文不一致。
        </p>
      </Modal>
    </AppLayout>
  )
}

export default AiMentor

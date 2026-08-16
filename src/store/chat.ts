import { create } from 'zustand'
import type { ChatMessage, Repository, Issue } from '@/types'
import { aiService } from '@/services'
import { getErrorMessage } from '@/services/errors'

/**
 * 生成唯一消息 ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * AI 对话状态 Store
 * 管理 AI 聊天消息、流式传输状态和会话信息
 */
interface ChatState {
  /** 聊天消息列表 */
  messages: ChatMessage[]
  /** 是否正在生成回复 */
  isStreaming: boolean
  /** 当前会话 ID */
  /** 会话 ID（预留：未来可映射 D1 对话历史；当前仅本地态） */
  sessionId: string | null
  /** 错误信息 */
  error: string | null
  /** 当前关联的仓库 owner */
  currentOwner: string
  /** 当前关联的仓库 name */
  currentRepo: string

  // ---- Actions ----
  /**
   * 发送消息并获取 AI 回复
   * 调用 aiService.chat
   * @param content 用户消息内容
   * @param context 上下文信息（仓库、Issue 等）
   */
  sendMessage: (
    content: string,
    context?: { repo?: Repository; issue?: Issue },
  ) => Promise<void>
  /** 设置当前仓库 */
  setCurrentRepository: (owner: string, repo: string) => void
  /** 清空聊天记录 */
  clearChat: () => void
  /** 设置流式传输状态 */
  setStreaming: (value: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  sessionId: null,
  error: null,
  currentOwner: 'microsoft',
  currentRepo: 'vscode',

  sendMessage: async (
    content: string,
    context?: { repo?: Repository; issue?: Issue },
  ) => {
    const { currentOwner, currentRepo, messages } = get()

    // 确定使用的仓库
    const owner = context?.repo?.owner || currentOwner
    const repo = context?.repo?.name || currentRepo

    // 添加用户消息
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      isStreaming: true,
      error: null,
    }))

    try {
      const response = await aiService.chat(owner, repo, messages, content)

      // 添加 AI 回复
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date().toISOString(),
      }

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isStreaming: false,
      }))
    } catch (err) {
      const message = getErrorMessage(err, '消息发送失败，请稍后重试')
      set({ isStreaming: false, error: message })
    }
  },

  setCurrentRepository: (owner: string, repo: string) => {
    set({ currentOwner: owner, currentRepo: repo })
  },

  clearChat: () =>
    set({
      messages: [],
      sessionId: null,
      error: null,
    }),

  setStreaming: (value: boolean) => set({ isStreaming: value }),
}))

export default useChatStore

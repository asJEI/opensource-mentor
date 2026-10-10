import { t } from '@/i18n'
import { useRef, useState } from 'react'
import { aiService } from '@/services'
import type { ChatMessage, GuideMentorContext } from '@/types'

export default function ContextMentor({ context }: { context: GuideMentorContext | null }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)

  const send = async () => {
    const text = input.trim()
    if (!text || !context || sending.current) return
    sending.current = true
    setPending(true)
    setError(null)
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() }
    try {
      const reply = await aiService.chat(context.owner, context.repo, messages, text, context)
      setMessages((previous) => [...previous, userMessage, {
        id: crypto.randomUUID(), role: 'assistant', content: reply.message, timestamp: new Date().toISOString(),
      }])
      setInput('')
    } catch {
      setError(t("暂时未能回答，问题已保留，请稍后重试。"))
    } finally {
      sending.current = false
      setPending(false)
    }
  }

  return (
    <aside className="context-mentor" aria-label={t("当前任务 AI 导师")}>
      <header><h2>{t("AI 导师")}</h2><span>{context?.phaseTitle || t("等待章节就绪")}</span></header>
      <div className="context-mentor-messages" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && <div className="context-mentor-empty"><strong>{t("这一步，哪里需要帮助？")}</strong><p>{context?.currentStepTitle || t("围绕当前任务，理清思路和验证方法。")}</p></div>}
        {messages.slice(-6).map((message) => (
          <div key={message.id} className={`context-message ${message.role}`}>
            <small>{message.role === 'user' ? t("你") : t("AI 导师")}</small>
            <p>{message.content}</p>
          </div>
        ))}
        {pending && <p className="context-mentor-status" role="status">{t("正在结合当前章节回答…")}</p>}
        {error && <p className="context-mentor-error" role="alert">{error}</p>}
      </div>
      <form onSubmit={(event) => { event.preventDefault(); void send() }}>
        <label htmlFor="context-question">{t("询问当前步骤")}</label>
        <textarea id="context-question" value={input} onChange={(event) => setInput(event.target.value)} disabled={pending} placeholder={t("描述你的问题或卡住的地方…")} rows={3} />
        <button className="btn btn-primary" type="submit" disabled={pending || !context || !input.trim()}>{pending ? t("正在回答…") : error ? t("重新提问") : t("提问")}</button>
      </form>
    </aside>
  )
}

import { config } from '../../config'
import type { Repository, ChatMessage, ChatResponse } from '../../types'
import { chatSystemPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import type { AIRuntime } from './types'

export async function chat(
  params: {
    repository: Repository
    messages: ChatMessage[]
    userMessage: string
  },
  runtime: AIRuntime,
): Promise<ChatResponse> {
  const { repository, messages, userMessage } = params

  if (!runtime.client) {
    return mockChat(repository, userMessage)
  }

  try {
    const systemPrompt = chatSystemPrompt({
      repoName: repository.fullName,
      repoDescription: repository.description,
      repoLanguage: repository.language,
      repoStars: repository.stars,
      repoTopics: repository.topics,
    })

    // 构建消息列表：system + 历史消息 + 当前消息
    const openAIMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.slice(-10).map((m) => ({
        role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user' as const, content: userMessage },
    ]

    const { data } = await runtime.client.post('/chat/completions', {
      model: runtime.model,
      messages: openAIMessages,
      temperature: 0.7,
      top_p: 0.9,
    })

    const reply = data.choices?.[0]?.message?.content || ''

    // 从回复中提取相关 Issue 编号
    const relatedIssues = extractIssueNumbers(reply)

    // 简单的置信度估算（基于回复长度和相关性）
    const confidence = Math.min(0.95, 0.5 + reply.length / 2000)

    return {
      message: reply,
      relatedIssues,
      suggestedNextSteps: suggestNextSteps(reply),
      confidence,
    }
  } catch (err) {
    console.error('[AI] chat failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockChat(repository, userMessage)
    }
    throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
  }
}

export function extractIssueNumbers(text: string): number[] {
  const matches = text.match(/#(\d+)/g)
  if (!matches) return []
  const numbers = matches
    .map((m) => parseInt(m.slice(1), 10))
    .filter((n, i, arr) => arr.indexOf(n) === i)
  return numbers.slice(0, 5)
}

export function suggestNextSteps(reply: string): string[] {
  const suggestions: string[] = []
  if (reply.includes('Issue') || reply.includes('issue')) {
    suggestions.push('查看相关的 Issue 详情')
  }
  if (reply.includes('文档') || reply.includes('README')) {
    suggestions.push('阅读项目文档了解更多')
  }
  if (reply.includes('代码') || reply.includes('源码')) {
    suggestions.push('浏览相关代码文件')
  }
  if (reply.includes('贡献') || reply.includes('PR')) {
    suggestions.push('尝试提交第一个 Pull Request')
  }
  suggestions.push('继续提问深入了解')
  return suggestions.slice(0, 3)
}

export function mockChat(repository: Repository, userMessage: string): ChatResponse {
  const repoName = repository.fullName
  const language = repository.language || '该项目'

  const lowerMsg = userMessage.toLowerCase()

  // 简单的关键词匹配 Mock 回复
  if (lowerMsg.includes('你好') || lowerMsg.includes('hi') || lowerMsg.includes('hello') || lowerMsg.includes('开始')) {
    return {
      message: `你好！👋 我是 ${repoName} 的 AI 导师，很高兴认识你！

我可以帮你：
- **了解项目**：解释项目架构、核心模块、技术栈
- **理解 Issue**：帮你分析具体的 Issue，拆解任务
- **学习路线**：为你定制个性化的学习和贡献路线图
- **代码指导**：解答技术问题，提供调试建议
- **PR 帮助**：指导你写好 PR 描述，通过代码审查

你之前有参与过开源项目吗？想从哪里开始了解 ${repoName} 呢？`,
      relatedIssues: [],
      suggestedNextSteps: [
        '查看项目简介和架构',
        '生成个性化学习路线图',
        '浏览适合新人的 Issue',
      ],
      confidence: 0.9,
    }
  }

  if (lowerMsg.includes('架构') || lowerMsg.includes('结构') || lowerMsg.includes('项目介绍')) {
    return {
      message: `${repoName} 是一个用 ${language} 开发的项目。

**项目架构概览：**

🏗️ **整体结构**
- 采用模块化设计，各职责分离
- 核心层提供基础能力
- 功能层实现具体业务逻辑
- 接口层对外提供 API

📁 **主要目录**
- \`src/\` — 核心源代码
- \`docs/\` — 项目文档
- \`tests/\` — 测试用例
- \`examples/\` — 使用示例

🔧 **技术栈**
- 主要语言：${language}
- 构建工具：现代构建系统
- 测试框架：单元测试 + 集成测试

想深入了解哪个模块？我可以带你一步步看代码。`,
      relatedIssues: [],
      suggestedNextSteps: [
        '查看核心模块详解',
        '从入口文件追踪执行流程',
        '尝试搭建本地开发环境',
      ],
      confidence: 0.8,
    }
  }

  if (lowerMsg.includes('issue') || lowerMsg.includes('任务') || lowerMsg.includes('入门')) {
    return {
      message: `好的！参与 ${repoName} 的最好方式就是从解决 Issue 开始。

**新手入门建议：**

🌱 **从 Good First Issue 开始**
- 查找标注为 \`good first issue\` 或 \`beginner\` 的任务
- 这些通常是维护者专门为新人准备的入门任务
- 难度较低，适合练手

📝 **选择 Issue 的技巧**
1. 选自己感兴趣的领域
2. 从文档类或 Bug 修复类开始
3. 确保有清晰的描述和重现步骤
4. 看有没有人已经在做（避免重复劳动）

🚀 **下一步行动**
- 浏览项目的 Issue 列表
- 找到一个你感兴趣的简单 Issue
- 在评论区说一句 "Can I work on this?"

你想让我帮你推荐一些适合新人的 Issue 吗？`,
      relatedIssues: [],
      suggestedNextSteps: [
        '获取 Issue 推荐列表',
        '查看 good first issue',
        '选择一个 Issue 深入分析',
      ],
      confidence: 0.85,
    }
  }

  if (lowerMsg.includes('路线图') || lowerMsg.includes('学习计划') || lowerMsg.includes('roadmap')) {
    return {
      message: `太棒了！有一个清晰的学习路线图会让你的开源之旅更有方向感。

我可以为你生成一份 ${repoName} 的个性化学习路线图，包括：

📋 **路线图内容**
- **阶段划分**：从入门到精通的 5-6 个阶段
- **学习目标**：每个阶段的具体目标
- **实践任务**：每个阶段推荐的 Issue
- **完成标准**：可量化的验收条件
- **学习资源**：推荐的文档和教程

🎯 **我需要了解**
- 你目前的水平是：
- 🌱 初学者（第一次参与开源）
- 🌿 中级（有一些经验）
- 🌳 高级（经验丰富）

你属于哪个水平呢？或者直接告诉我你的背景，我来定制最合适的路线图！`,
      relatedIssues: [],
      suggestedNextSteps: [
        '生成初学者路线图',
        '生成中级路线图',
        '告诉我你的背景来定制',
      ],
      confidence: 0.88,
    }
  }

  if (lowerMsg.includes('pr') || lowerMsg.includes('pull request') || lowerMsg.includes('提交')) {
    return {
      message: `提交 PR 是开源贡献的核心环节！让我给你一些 ${repoName} 的 PR 最佳实践。

✅ **高质量 PR 的要素**

1. **清晰的标题**
 - 遵循 Conventional Commits 规范
 - 如：\`fix: 修复用户登录超时问题\`

2. **详细的描述**
 - 做了什么？为什么这么做？
 - 如何验证？测试步骤
 - 关联的 Issue 编号

3. **小而专注**
 - 一个 PR 解决一个问题
 - 不要把不相关的改动混在一起
 - 大改动拆分成多个小 PR

4. **测试通过**
 - 本地跑通所有测试
 - 确保代码风格符合规范
 - 添加必要的测试用例

💡 **提 PR 前检查清单**
- [ ] 代码已格式化
- [ ] 所有测试通过
- [ ] 没有无关改动
- [ ] PR 描述清晰完整
- [ ] 关联了相关 Issue

需要我帮你生成一个具体的 PR 草稿吗？`,
      relatedIssues: [],
      suggestedNextSteps: [
        '生成 PR 草稿模板',
        '了解 Code Review 流程',
        '学习如何回应 Review 意见',
      ],
      confidence: 0.82,
    }
  }

  // 默认回复
  return {
    message: `这是个很好的问题！关于 ${repoName}，我可以从多个角度帮你。

你可以试着问我：
- "这个项目的架构是怎样的？"
- "有什么适合新人的 Issue 吗？"
- "帮我生成学习路线图"
- "怎么提交第一个 PR？"
- "帮我解释 #123 这个 Issue"

或者直接告诉我你现在遇到了什么问题，我们一起来解决！

你现在最想了解什么呢？`,
    relatedIssues: [],
    suggestedNextSteps: [
      '了解项目架构',
      '寻找入门 Issue',
      '生成学习路线图',
    ],
    confidence: 0.7,
  }
}

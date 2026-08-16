import { config } from '../../config'
import type { IssueExplain, Repository, Issue } from '../../types'
import { issueExplainPrompt } from '../../utils/prompts'
import { AppError } from '../../utils/errors'
import { parseJsonSafely, validateExplainResult } from './parsers'
import { callLLM } from './providers'
import type { AIRuntime } from './types'

export async function explainIssue(
  repository: Repository,
  issue: Issue,
  runtime: AIRuntime,
): Promise<IssueExplain> {
  if (!runtime.client) {
    return mockExplain(repository, issue)
  }

  try {
    const prompt = issueExplainPrompt({
      repoName: repository.fullName,
      repoDescription: repository.description,
      repoLanguage: repository.language,
      issueTitle: issue.title,
      issueBody: issue.body,
      issueLabels: issue.labels.map((l) => l.name),
      issueNumber: issue.number,
    })

    const content = await callLLM(prompt, 0.7, runtime)
    const parsed = parseJsonSafely(content)
    return validateExplainResult(parsed)
  } catch (err) {
    console.error('[AI] explainIssue failed:', (err as Error).message)
    if (!runtime.isCustom && config.nodeEnv === 'development') {
      return mockExplain(repository, issue)
    }
    throw new AppError('AI 服务暂时不可用，请稍后重试', 503)
  }
}

export function mockExplain(repository: Repository, issue: Issue): IssueExplain {
  const isGoodFirstIssue = issue.labels.some(
    (l) =>
      l.name.toLowerCase().includes('good first') ||
      l.name.toLowerCase().includes('beginner') ||
      l.name.toLowerCase().includes('easy'),
  )
  const isDocs = issue.labels.some((l) => l.name.toLowerCase().includes('doc'))
  const language = repository.language || '对应编程语言'

  if (isGoodFirstIssue) {
    return {
      summary: `这是 ${repository.fullName} 仓库的一个"新手友好"Issue，主要涉及${isDocs ? '文档改进' : '简单的功能修复或小优化'}。对于第一次参与开源的开发者来说，这是一个很好的练手机会。`,
      difficulty: 'easy',
      knowledge: [
        `基础的 ${language} 语法知识`,
        'Git 和 GitHub 的基本使用（fork、clone、branch、PR）',
        '如何阅读项目文档和贡献指南',
        '基本的代码调试能力',
      ],
      steps: [
        'Fork 这个仓库到你的 GitHub 账号',
        'Clone 你 fork 的仓库到本地',
        '阅读项目的 README.md 和 CONTRIBUTING.md',
        '搭建本地开发环境，确保项目能正常运行',
        '找到相关代码文件，理解现有逻辑',
        '根据 Issue 需求进行修改',
        '本地测试验证修改是否正确',
        '提交 Pull Request 并等待 Review',
      ],
      estimatedTime: '2-4 小时',
      tips: [
        '提交 PR 前先检查是否有拼写错误或格式问题',
        '如果不确定如何实现，可以在 Issue 下评论提问',
        '参考项目中类似的已有改动，遵循项目的代码风格',
        'PR 描述要写清楚：做了什么、为什么这么做、如何验证',
      ],
    }
  }

  if (isDocs) {
    return {
      summary: `这是 ${repository.fullName} 仓库的一个文档类 Issue，主要涉及文档的补充、修正或改进。文档类 Issue 通常代码改动少，是新人入门开源的好选择。`,
      difficulty: 'easy',
      knowledge: [
        'Markdown 语法基础',
        'Git 和 GitHub 基本操作',
        '阅读理解英文文档的能力',
        '对项目功能的基本了解',
      ],
      steps: [
        'Fork 并 Clone 仓库到本地',
        '找到对应的文档文件',
        '仔细阅读现有文档，理解需要修改的地方',
        '根据 Issue 描述修改文档',
        '在本地预览修改效果',
        '检查拼写和格式',
        '提交 PR，附上修改前后的对比说明',
      ],
      estimatedTime: '1-2 小时',
      tips: [
        '文档修改也要遵循项目的风格和格式',
        '如果是翻译类修改，注意术语的一致性',
        '修改完后可以用 Markdown 预览工具检查格式',
        'PR 标题可以加上 docs: 前缀',
      ],
    }
  }

  return {
    summary: `这是 ${repository.fullName} 仓库的一个${issue.labels.length > 0 ? issue.labels[0].name + '类' : ''}Issue。${issue.body ? issue.body.slice(0, 100) + '...' : '需要先仔细阅读 Issue 描述，理解具体需求和背景。'}`,
    difficulty: 'medium',
    knowledge: [
      `熟练掌握 ${language}`,
      '理解项目的整体架构和模块划分',
      'Git 高级操作（rebase、cherry-pick 等）',
      '单元测试和集成测试的编写',
      '代码 Review 流程和规范',
    ],
    steps: [
      '仔细阅读 Issue 描述，理解需求和背景',
      'Fork 并 Clone 仓库，搭建开发环境',
      '在本地复现问题或理解功能需求',
      '查找相关代码，定位需要修改的位置',
      '设计实现方案，如有疑问在 Issue 中与维护者讨论',
      '编写代码，遵循项目代码风格',
      '添加或更新测试用例',
      '本地运行所有测试确保通过',
      '提交 PR，详细描述改动内容和测试方法',
    ],
    estimatedTime: '4-8 小时',
    tips: [
      '动手写代码前，先理解清楚需求，避免走弯路',
      '如果 Issue 比较复杂，可以先和维护者沟通你的实现思路',
      '保持 PR 小而专注，一个 PR 解决一个问题',
      '提交前运行项目的 lint 和 test，确保 CI 能通过',
      '耐心对待 Review 意见，这是学习成长的好机会',
    ],
  }
}

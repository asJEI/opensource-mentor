import { t } from './locale'
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
    throw new AppError(t("AI 服务暂时不可用，请稍后重试"), 503)
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
  const language = repository.language || t("对应编程语言")

  if (isGoodFirstIssue) {
    return {
      summary: t("这是 {0} 仓库的一个\"新手友好\"Issue，主要涉及{1}。对于第一次参与开源的开发者来说，这是一个很好的练手机会。", [repository.fullName, isDocs ? t("文档改进") : t("简单的功能修复或小优化")]),
      difficulty: 'easy',
      knowledge: [
        t("基础的 {0} 语法知识", [language]),
        t("Git 和 GitHub 的基本使用（fork、clone、branch、PR）"),
        t("如何阅读项目文档和贡献指南"),
        t("基本的代码调试能力"),
      ],
      steps: [
        t("Fork 这个仓库到你的 GitHub 账号"),
        t("Clone 你 fork 的仓库到本地"),
        t("阅读项目的 README.md 和 CONTRIBUTING.md"),
        t("搭建本地开发环境，确保项目能正常运行"),
        t("找到相关代码文件，理解现有逻辑"),
        t("根据 Issue 需求进行修改"),
        t("本地测试验证修改是否正确"),
        t("提交 Pull Request 并等待 Review"),
      ],
      estimatedTime: t("2-4 小时"),
      tips: [
        t("提交 PR 前先检查是否有拼写错误或格式问题"),
        t("如果不确定如何实现，可以在 Issue 下评论提问"),
        t("参考项目中类似的已有改动，遵循项目的代码风格"),
        t("PR 描述要写清楚：做了什么、为什么这么做、如何验证"),
      ],
    }
  }

  if (isDocs) {
    return {
      summary: t("这是 {0} 仓库的一个文档类 Issue，主要涉及文档的补充、修正或改进。文档类 Issue 通常代码改动少，是新人入门开源的好选择。", [repository.fullName]),
      difficulty: 'easy',
      knowledge: [
        t("Markdown 语法基础"),
        t("Git 和 GitHub 基本操作"),
        t("阅读理解英文文档的能力"),
        t("对项目功能的基本了解"),
      ],
      steps: [
        t("Fork 并 Clone 仓库到本地"),
        t("找到对应的文档文件"),
        t("仔细阅读现有文档，理解需要修改的地方"),
        t("根据 Issue 描述修改文档"),
        t("在本地预览修改效果"),
        t("检查拼写和格式"),
        t("提交 PR，附上修改前后的对比说明"),
      ],
      estimatedTime: t("1-2 小时"),
      tips: [
        t("文档修改也要遵循项目的风格和格式"),
        t("如果是翻译类修改，注意术语的一致性"),
        t("修改完后可以用 Markdown 预览工具检查格式"),
        t("PR 标题可以加上 docs: 前缀"),
      ],
    }
  }

  return {
    summary: t("这是 {0} 仓库的一个{1}Issue。{2}", [repository.fullName, issue.labels.length > 0 ? issue.labels[0].name + t("类") : '', issue.body ? issue.body.slice(0, 100) + '...' : t("需要先仔细阅读 Issue 描述，理解具体需求和背景。")]),
    difficulty: 'medium',
    knowledge: [
      t("熟练掌握 {0}", [language]),
      t("理解项目的整体架构和模块划分"),
      t("Git 高级操作（rebase、cherry-pick 等）"),
      t("单元测试和集成测试的编写"),
      t("代码 Review 流程和规范"),
    ],
    steps: [
      t("仔细阅读 Issue 描述，理解需求和背景"),
      t("Fork 并 Clone 仓库，搭建开发环境"),
      t("在本地复现问题或理解功能需求"),
      t("查找相关代码，定位需要修改的位置"),
      t("设计实现方案，如有疑问在 Issue 中与维护者讨论"),
      t("编写代码，遵循项目代码风格"),
      t("添加或更新测试用例"),
      t("本地运行所有测试确保通过"),
      t("提交 PR，详细描述改动内容和测试方法"),
    ],
    estimatedTime: t("4-8 小时"),
    tips: [
      t("动手写代码前，先理解清楚需求，避免走弯路"),
      t("如果 Issue 比较复杂，可以先和维护者沟通你的实现思路"),
      t("保持 PR 小而专注，一个 PR 解决一个问题"),
      t("提交前运行项目的 lint 和 test，确保 CI 能通过"),
      t("耐心对待 Review 意见，这是学习成长的好机会"),
    ],
  }
}

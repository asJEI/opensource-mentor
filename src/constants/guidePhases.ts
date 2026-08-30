/** 贡献指南 7 章标题（与 worker/ai/prompts/roadmap.ts 保持一致） */
export const GUIDE_PHASE_TITLES = [
  '获取项目',
  '环境准备',
  '理解项目',
  '复现 Issue',
  '修改',
  '验证',
  'PR 提交',
] as const

export type GuidePhaseTitle = (typeof GUIDE_PHASE_TITLES)[number]

export const GUIDE_SECTIONS = GUIDE_PHASE_TITLES.map((title, index) => ({
  number: String(index + 1).padStart(2, '0'),
  title,
})) as ReadonlyArray<{ number: string; title: GuidePhaseTitle }>

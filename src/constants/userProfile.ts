import type {
  ContributionInterest,
  ExperienceLevel,
  LearningGoal,
  ProgrammingLanguage,
} from '@/types'

export interface ProfileOption<T extends string> {
  value: T
  label: string
  description?: string
}

export const programmingLanguageOptions: ProfileOption<ProgrammingLanguage>[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'cpp', label: 'C/C++' },
  { value: 'other', label: '其他' },
]

export const experienceLevelOptions: ProfileOption<ExperienceLevel>[] = [
  {
    value: 'beginner',
    label: '第一次接触开源',
    description: '从基本流程和新人友好的任务开始',
  },
  {
    value: 'some_experience',
    label: '写过一些代码',
    description: '掌握基础开发知识，希望开始真实贡献',
  },
  {
    value: 'project_experience',
    label: '有完整项目经验',
    description: '可从更具工程价值的任务开始',
  },
]

export const contributionInterestOptions: ProfileOption<ContributionInterest>[] = [
  { value: 'frontend', label: '前端' },
  { value: 'backend', label: '后端' },
  { value: 'documentation', label: '文档' },
  { value: 'testing', label: '测试' },
  { value: 'devops', label: 'DevOps' },
  { value: 'ai', label: 'AI' },
  { value: 'other', label: '其他' },
]

export const learningGoalOptions: ProfileOption<LearningGoal>[] = [
  { value: 'first_contribution', label: '完成第一次开源贡献' },
  {
    value: 'find_beginner_friendly_issues',
    label: '寻找适合新人的 Issue',
  },
  { value: 'improve_engineering', label: '提升工程能力' },
  { value: 'learn_new_technology', label: '学习新技术' },
]

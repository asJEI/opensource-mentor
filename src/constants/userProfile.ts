import { t } from '@/i18n'
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
  { value: 'other', get label() { return t("其他") } },
]

export const experienceLevelOptions: ProfileOption<ExperienceLevel>[] = [
  {
    value: 'beginner',
    get label() { return t("第一次接触开源") },
    get description() { return t("从基本流程和新人友好的任务开始") },
  },
  {
    value: 'some_experience',
    get label() { return t("写过一些代码") },
    get description() { return t("掌握基础开发知识，希望开始真实贡献") },
  },
  {
    value: 'project_experience',
    get label() { return t("有完整项目经验") },
    get description() { return t("可从更具工程价值的任务开始") },
  },
]

export const contributionInterestOptions: ProfileOption<ContributionInterest>[] = [
  { value: 'frontend', get label() { return t("前端") } },
  { value: 'backend', get label() { return t("后端") } },
  { value: 'documentation', get label() { return t("文档") } },
  { value: 'testing', get label() { return t("测试") } },
  { value: 'devops', label: 'DevOps' },
  { value: 'ai', label: 'AI' },
  { value: 'other', get label() { return t("其他") } },
]

export const learningGoalOptions: ProfileOption<LearningGoal>[] = [
  { value: 'first_contribution', get label() { return t("完成第一次开源贡献") } },
  {
    value: 'find_beginner_friendly_issues',
    get label() { return t("寻找适合新人的 Issue") },
  },
  { value: 'improve_engineering', get label() { return t("提升工程能力") } },
  { value: 'learn_new_technology', get label() { return t("学习新技术") } },
]

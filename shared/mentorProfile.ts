import type { UserProfileContext } from '../src/types/user'
export type MentorProfile = UserProfileContext & {
  locale: 'zh-CN' | 'en-US'
  weeklyHours: number
}
export function validMentorProfile(value: unknown): value is MentorProfile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const p = value as Record<string, unknown>
  const array = (key: string, choices: string[]) => Array.isArray(p[key]) && (p[key] as unknown[]).length <= choices.length && (p[key] as unknown[]).every(v => typeof v === 'string' && choices.includes(v))
  return Object.keys(p).every(k => ['profileSetupStatus', 'programmingLanguages', 'experienceLevel', 'interests', 'goals', 'locale', 'weeklyHours'].includes(k)) &&
    ['completed', 'skipped', 'not_started'].includes(String(p.profileSetupStatus)) &&
    ['beginner', 'some_experience', 'project_experience'].includes(String(p.experienceLevel)) &&
    ['zh-CN', 'en-US'].includes(String(p.locale)) && typeof p.weeklyHours === 'number' && Number.isFinite(p.weeklyHours) && p.weeklyHours >= 0 && p.weeklyHours <= 168 &&
    array('programmingLanguages', ['javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'other']) && array('interests', ['frontend', 'backend', 'documentation', 'testing', 'devops', 'ai', 'other']) && array('goals', ['first_contribution', 'find_beginner_friendly_issues', 'improve_engineering', 'learn_new_technology'])
}

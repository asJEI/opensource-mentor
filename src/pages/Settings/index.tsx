import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Badge, Button, Card } from '@/components/ui'
import { authService } from '@/services'
import { useToastStore, useUserStore } from '@/store'
import type {
  ContributionTimeBudget,
  GitHubDeveloperProfile,
  GuidancePreference,
  LearningGoal,
  OpenSourceGoal,
  ProgrammingLanguage,
} from '@/types'
import {
  AIProviderSettings,
  GitHubApiSettings,
  ProfileIcon,
} from './components'

const goalOptions: Array<{ value: OpenSourceGoal; label: string; legacyGoal: LearningGoal }> = [
  { value: 'ship_first_pr', label: '完成我的第一个 PR', legacyGoal: 'first_contribution' },
  { value: 'improve_skills', label: '提升技术能力', legacyGoal: 'improve_engineering' },
  { value: 'build_github_profile', label: '建设我的 GitHub 作品履历', legacyGoal: 'find_beginner_friendly_issues' },
  { value: 'contribute_liked_projects', label: '参与我喜欢的项目', legacyGoal: 'learn_new_technology' },
  { value: 'long_term_contributor', label: '成为长期贡献者', legacyGoal: 'improve_engineering' },
]

const timeOptions: Array<{ value: ContributionTimeBudget; label: string }> = [
  { value: 'lt_1h', label: '少于 1 小时' },
  { value: '1_3h', label: '1–3 小时' },
  { value: '3_6h', label: '3–6 小时' },
  { value: 'weekend', label: '一个周末' },
  { value: 'no_preference', label: '暂时无偏好' },
]

const guidanceOptions: Array<{ value: GuidancePreference; label: string }> = [
  { value: 'step_by_step', label: '一步一步带我做' },
  { value: 'hints_when_stuck', label: '卡住时给我提示' },
  { value: 'find_good_issues', label: '只帮我找到好 Issue' },
]

const languageAliases: Record<string, ProgrammingLanguage> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  'c++': 'cpp',
  cpp: 'cpp',
  'c/c++': 'cpp',
}

const domainLabels: Record<string, string> = {
  frontend: '前端',
  backend: '后端',
  ai: 'AI',
  devops: 'DevOps',
  docs: '文档',
  documentation: '文档',
  testing: '测试',
}

type PreferenceDraft = {
  openSourceGoal: OpenSourceGoal | ''
  preferredTechStack: string[]
  contributionTimeBudget: ContributionTimeBudget | ''
  guidancePreference: GuidancePreference | ''
}

function normalizeTechStack(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean).slice(0, 16))]
}

function inferProgrammingLanguages(techStack: string[]): ProgrammingLanguage[] {
  return [
    ...new Set(
      techStack
        .map((item) => languageAliases[item.trim().toLowerCase()])
        .filter((item): item is ProgrammingLanguage => Boolean(item)),
    ),
  ]
}

function getOptionLabel<T extends string>(
  value: T | '',
  options: Array<{ value: T; label: string }>,
  fallback = '未填写',
): string {
  if (!value) return fallback
  return options.find((option) => option.value === value)?.label ?? value
}

function getDetectedTechStack(githubProfile: GitHubDeveloperProfile | null): string[] {
  return normalizeTechStack([
    ...(githubProfile?.developerProfile?.languages.map((item) => item.name) ?? []),
    ...(githubProfile?.developerProfile?.frameworks ?? []),
    ...(githubProfile?.languages.map((item) => item.name) ?? []),
  ])
}

function confidenceLabel(confidence?: number): string {
  if (typeof confidence !== 'number') return '暂无'
  return `${Math.round(confidence * 100)}%`
}

const Settings = () => {
  const profile = useUserStore((state) => state.profile)
  const githubProfile = useUserStore((state) => state.githubProfile)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const completeProfileSetup = useUserStore(
    (state) => state.completeProfileSetup,
  )
  const applyServerUserState = useUserStore(
    (state) => state.applyServerUserState,
  )
  const resetProfile = useUserStore((state) => state.resetProfile)
  const showToast = useToastStore((state) => state.showToast)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [customTech, setCustomTech] = useState('')
  const detectedTechStack = useMemo(
    () => getDetectedTechStack(githubProfile),
    [githubProfile],
  )
  const [draft, setDraft] = useState<PreferenceDraft>(() => ({
    openSourceGoal: profile.openSourceGoal,
    preferredTechStack: normalizeTechStack([
      ...profile.preferredTechStack,
      ...detectedTechStack,
    ]),
    contributionTimeBudget: profile.contributionTimeBudget,
    guidancePreference: profile.guidancePreference,
  }))

  const developerProfile = githubProfile?.developerProfile
  const statusLabel = {
    not_started: '待补充',
    completed: '已完成',
    skipped: '已跳过',
  }[profile.profileSetupStatus]

  const statusVariant =
    profile.profileSetupStatus === 'completed'
      ? 'success'
      : profile.profileSetupStatus === 'skipped'
        ? 'default'
        : 'warning'

  const beginEditing = () => {
    setDraft({
      openSourceGoal: profile.openSourceGoal,
      preferredTechStack: normalizeTechStack([
        ...profile.preferredTechStack,
        ...detectedTechStack,
      ]),
      contributionTimeBudget: profile.contributionTimeBudget,
      guidancePreference: profile.guidancePreference,
    })
    setIsEditing(true)
  }

  const toggleTech = (tech: string) => {
    setDraft((current) => ({
      ...current,
      preferredTechStack: current.preferredTechStack.includes(tech)
        ? current.preferredTechStack.filter((item) => item !== tech)
        : normalizeTechStack([...current.preferredTechStack, tech]),
    }))
  }

  const addCustomTech = () => {
    const next = customTech.trim()
    if (!next) return
    setDraft((current) => ({
      ...current,
      preferredTechStack: normalizeTechStack([
        ...current.preferredTechStack,
        next,
      ]),
    }))
    setCustomTech('')
  }

  const handleSave = async () => {
    const legacyGoal =
      goalOptions.find((option) => option.value === draft.openSourceGoal)
        ?.legacyGoal ?? 'first_contribution'
    const nextProfile = {
      programmingLanguages: inferProgrammingLanguages(draft.preferredTechStack),
      experienceLevel: profile.experienceLevel,
      interests: profile.interests,
      goals: [legacyGoal],
      openSourceGoal: draft.openSourceGoal,
      preferredTechStack: draft.preferredTechStack,
      contributionTimeBudget: draft.contributionTimeBudget,
      guidancePreference: draft.guidancePreference,
    }

    if (isAuthenticated) {
      setSaving(true)
      try {
        const me = await authService.updateDeveloperProfile({
          profileSetupStatus: 'completed',
          profileConfirmed: true,
          openSourceGoal: draft.openSourceGoal,
          preferredTechStack: draft.preferredTechStack,
          contributionTimeBudget: draft.contributionTimeBudget,
          guidancePreference: draft.guidancePreference,
        })
        applyServerUserState({
          githubProfile: me.developerProfile.github_profile ?? githubProfile,
          githubUsername: me.user.githubUsername,
          githubAvatar: me.user.githubAvatar,
          profileSetupStatus: me.developerProfile.profile_setup_status,
          profileConfirmed: me.developerProfile.profile_confirmed,
          openSourceGoal: me.developerProfile.open_source_goal,
          preferredTechStack: me.developerProfile.preferred_tech_stack,
          contributionTimeBudget: me.developerProfile.contribution_time_budget,
          guidancePreference: me.developerProfile.guidance_preference,
        })
        showToast('success', '偏好已同步', '已保存到服务端 Developer Profile')
      } catch {
        showToast('error', '保存失败', '服务端暂时无法保存偏好，请稍后重试')
        setSaving(false)
        return
      }
      setSaving(false)
    } else {
      completeProfileSetup(nextProfile)
      showToast('success', '偏好已保存', '访客偏好已保存到当前浏览器')
    }

    completeProfileSetup(nextProfile)
    setIsEditing(false)
  }

  const handleReset = () => {
    if (!window.confirm('确定要重置本地偏好吗？GitHub 登录信息不会被清除。')) return
    resetProfile()
    setIsEditing(false)
    showToast('success', '偏好已重置', '已清空本地贡献偏好，保留 GitHub 账号信息')
  }

  return (
    <AppLayout breadcrumbs={[{ label: '设置' }, { label: '偏好设置' }]}>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">偏好设置</h1>
            <p className="page-subtitle">
              管理 GitHub 公开画像和贡献偏好，让后续 Issue 匹配更贴近你的当前目标。
            </p>
          </div>
        </div>
      </div>

      <div className="settings-content">
        <Card
          className="settings-card"
          title={
            <div className="settings-card-title">
              <span className="settings-card-icon">
                <ProfileIcon />
              </span>
              <span>Developer Profile</span>
              <Badge variant={statusVariant} size="sm">
                {statusLabel}
              </Badge>
            </div>
          }
        >
          {isEditing ? (
            <div className="profile-editor">
              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>开源目标</h2>
                  <span>单选</span>
                </div>
                <div className="experience-option-list">
                  {goalOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={clsx(
                        'experience-option',
                        draft.openSourceGoal === option.value && 'selected',
                      )}
                      aria-pressed={draft.openSourceGoal === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          openSourceGoal: option.value,
                        }))
                      }
                    >
                      <span className="experience-radio" aria-hidden="true" />
                      <span>
                        <strong>{option.label}</strong>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>想使用的技术栈</h2>
                  <span>来自 GitHub 预选，可编辑</span>
                </div>
                {detectedTechStack.length > 0 && (
                  <p className="form-hint">
                    GitHub 识别：{detectedTechStack.join('、')}
                  </p>
                )}
                <div className="profile-tech-stack-list">
                  {draft.preferredTechStack.map((tech) => (
                    <button
                      key={tech}
                      type="button"
                      className="profile-tech-chip"
                      onClick={() => toggleTech(tech)}
                    >
                      {tech}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
                <div className="profile-tech-add-row">
                  <input
                    className="form-input"
                    value={customTech}
                    placeholder="例如：TypeScript、React、Python、Node.js"
                    onChange={(event) => setCustomTech(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addCustomTech()
                      }
                    }}
                  />
                  <Button variant="secondary" onClick={addCustomTech}>
                    添加
                  </Button>
                </div>
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>下一次贡献时间</h2>
                  <span>单选</span>
                </div>
                <div className="profile-option-grid">
                  {timeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={clsx(
                        'profile-option',
                        draft.contributionTimeBudget === option.value &&
                          'selected',
                      )}
                      aria-pressed={draft.contributionTimeBudget === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          contributionTimeBudget: option.value,
                        }))
                      }
                    >
                      <span className="profile-option-check" aria-hidden="true">
                        {draft.contributionTimeBudget === option.value ? '✓' : ''}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>指导方式</h2>
                  <span>单选</span>
                </div>
                <div className="profile-option-grid">
                  {guidanceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={clsx(
                        'profile-option',
                        draft.guidancePreference === option.value && 'selected',
                      )}
                      aria-pressed={draft.guidancePreference === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          guidancePreference: option.value,
                        }))
                      }
                    >
                      <span className="profile-option-check" aria-hidden="true">
                        {draft.guidancePreference === option.value ? '✓' : ''}
                      </span>
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="settings-actions">
                <Button variant="primary" loading={saving} onClick={handleSave}>
                  保存偏好
                </Button>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="profile-summary">
              <section className="settings-inline-panel">
                <div>
                  <h3>GitHub 账号</h3>
                  <p className="form-hint">
                    登录后读取头像、名称、公开仓库、语言、PR / Issue 等公开资料。
                  </p>
                </div>
                <div className="settings-account-preview">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.username} />
                  ) : (
                    <span>?</span>
                  )}
                  <div>
                    <strong>{profile.username || '尚未连接 GitHub'}</strong>
                    <small>{profile.bio || githubProfile?.profile.htmlUrl || '未读取公开资料'}</small>
                  </div>
                </div>
              </section>

              <dl className="profile-summary-grid">
                <div>
                  <dt>能力判断</dt>
                  <dd>
                    {developerProfile
                      ? `${developerProfile.level} · 把握度 ${confidenceLabel(
                          developerProfile.confidence,
                        )}`
                      : '等待 GitHub 画像生成'}
                  </dd>
                </div>
                <div>
                  <dt>开源经验</dt>
                  <dd>
                    {developerProfile?.open_source_experience ?? '暂无判断'}
                  </dd>
                </div>
                <div>
                  <dt>常用语言</dt>
                  <dd>
                    {developerProfile?.languages
                      .map(
                        (item) =>
                          `${item.name}（${item.level}，${confidenceLabel(
                            item.confidence,
                          )}）`,
                      )
                      .join('、') ||
                      githubProfile?.languages
                        .slice(0, 5)
                        .map((item) => item.name)
                        .join('、') ||
                      '暂无'}
                  </dd>
                </div>
                <div>
                  <dt>技术栈 / 框架</dt>
                  <dd>
                    {developerProfile?.frameworks.join('、') ||
                      profile.preferredTechStack.join('、') ||
                      '暂无'}
                  </dd>
                </div>
                <div>
                  <dt>领域方向</dt>
                  <dd>
                    {developerProfile?.domains
                      .map((domain) => domainLabels[domain] ?? domain)
                      .join('、') || '暂无'}
                  </dd>
                </div>
                <div>
                  <dt>公开仓库</dt>
                  <dd>
                    {typeof githubProfile?.profile.publicRepos === 'number'
                      ? `${githubProfile.profile.publicRepos} 个`
                      : '暂无'}
                  </dd>
                </div>
                <div>
                  <dt>你的开源目标</dt>
                  <dd>{getOptionLabel(profile.openSourceGoal, goalOptions)}</dd>
                </div>
                <div>
                  <dt>想使用的技术栈</dt>
                  <dd>{profile.preferredTechStack.join('、') || '未填写'}</dd>
                </div>
                <div>
                  <dt>下一次贡献时间</dt>
                  <dd>
                    {getOptionLabel(profile.contributionTimeBudget, timeOptions)}
                  </dd>
                </div>
                <div>
                  <dt>指导方式</dt>
                  <dd>
                    {getOptionLabel(profile.guidancePreference, guidanceOptions)}
                  </dd>
                </div>
              </dl>

              {developerProfile?.github_summary && (
                <div className="profile-default-notice">
                  {developerProfile.github_summary}
                </div>
              )}

              <div className="settings-actions">
                <Button variant="primary" onClick={beginEditing}>
                  编辑偏好
                </Button>
                <Button variant="secondary" onClick={authService.startGitHubLogin}>
                  {isAuthenticated ? '重新读取 GitHub' : '连接 GitHub'}
                </Button>
                <Button
                  variant="ghost"
                  className="settings-reset-button"
                  onClick={handleReset}
                >
                  重置本地偏好
                </Button>
              </div>
            </div>
          )}
        </Card>
        <AIProviderSettings />
        <GitHubApiSettings />
      </div>
    </AppLayout>
  )
}

export default Settings

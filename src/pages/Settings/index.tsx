import { useState } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Badge, Button, Card } from '@/components/ui'
import {
  DEFAULT_USER_PROFILE,
  useRepositoryStore,
  useToastStore,
  useUserStore,
} from '@/store'
import {
  contributionInterestOptions as interestOptions,
  experienceLevelOptions as experienceOptions,
  learningGoalOptions as goalOptions,
  programmingLanguageOptions as languageOptions,
} from '@/constants/userProfile'
import type { UserProfileFormData } from '@/types'
import {
  AIProviderSettings,
  GitHubApiSettings,
  MultiSelect,
  ProfileIcon,
  getLabels,
  toFormData,
} from './components'

const Settings = () => {
  const profile = useUserStore((state) => state.profile)
  const completeProfileSetup = useUserStore(
    (state) => state.completeProfileSetup,
  )
  const resetProfile = useUserStore((state) => state.resetProfile)
  const showToast = useToastStore((state) => state.showToast)
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<UserProfileFormData>(toFormData)

  const refreshRecommendations = () => {
    const repository = useRepositoryStore.getState()
    void repository.loadRecommendedIssues(
      repository.currentOwner,
      repository.currentRepoName,
    )
  }

  const beginEditing = () => {
    setDraft(toFormData())
    setIsEditing(true)
  }

  const beginRefill = () => {
    setDraft({
      programmingLanguages: [],
      experienceLevel: DEFAULT_USER_PROFILE.experienceLevel,
      interests: [],
      goals: [],
    })
    setIsEditing(true)
  }

  const handleSave = () => {
    completeProfileSetup(draft)
    refreshRecommendations()
    setIsEditing(false)
    showToast('success', '画像已保存', '个人偏好已安全保存到当前浏览器')
  }

  const handleReset = () => {
    if (!window.confirm('确定要重置为纯新手默认画像吗？')) return
    resetProfile()
    refreshRecommendations()
    setIsEditing(false)
    showToast('success', '画像已重置', '已恢复为纯新手默认画像')
  }

  const statusLabel = {
    not_started: '尚未填写',
    completed: '已完成',
    skipped: '已跳过',
  }[profile.profileSetupStatus]

  const statusVariant =
    profile.profileSetupStatus === 'completed'
      ? 'success'
      : profile.profileSetupStatus === 'skipped'
        ? 'default'
        : 'warning'

  return (
    <AppLayout breadcrumbs={[{ label: '设置' }, { label: '偏好设置' }]}>
      <div className="page-header">
        <div className="page-title-row">
          <div>
            <h1 className="page-title">偏好设置</h1>
            <p className="page-subtitle">
              管理你的新手画像，让 Issue 推荐和学习路线更符合当前目标。
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
              <span>新手画像</span>
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
                  <h2>编程语言</h2>
                  <span>可多选</span>
                </div>
                <MultiSelect
                  options={languageOptions}
                  values={draft.programmingLanguages}
                  onChange={(programmingLanguages) =>
                    setDraft((current) => ({
                      ...current,
                      programmingLanguages,
                    }))
                  }
                />
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>开发经验</h2>
                  <span>单选</span>
                </div>
                <div className="experience-option-list">
                  {experienceOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={clsx(
                        'experience-option',
                        draft.experienceLevel === option.value && 'selected',
                      )}
                      aria-pressed={draft.experienceLevel === option.value}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          experienceLevel: option.value,
                        }))
                      }
                    >
                      <span className="experience-radio" aria-hidden="true" />
                      <span>
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>感兴趣的方向</h2>
                  <span>可多选</span>
                </div>
                <MultiSelect
                  options={interestOptions}
                  values={draft.interests}
                  onChange={(interests) =>
                    setDraft((current) => ({ ...current, interests }))
                  }
                />
              </section>

              <section className="profile-field">
                <div className="profile-field-heading">
                  <h2>学习目标</h2>
                  <span>可多选</span>
                </div>
                <MultiSelect
                  options={goalOptions}
                  values={draft.goals}
                  onChange={(goals) =>
                    setDraft((current) => ({ ...current, goals }))
                  }
                />
              </section>

              <div className="settings-actions">
                <Button variant="primary" onClick={handleSave}>
                  保存画像
                </Button>
                <Button variant="secondary" onClick={() => setIsEditing(false)}>
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="profile-summary">
              {profile.profileSetupStatus === 'skipped' && (
                <div className="profile-default-notice">
                  你已跳过问卷，当前使用纯新手默认画像。系统不会假设你掌握特定语言或方向。
                </div>
              )}

              <dl className="profile-summary-grid">
                <div>
                  <dt>编程语言</dt>
                  <dd>
                    {getLabels(
                      profile.programmingLanguages,
                      languageOptions,
                    ).join('、') || '未选择'}
                  </dd>
                </div>
                <div>
                  <dt>开发经验</dt>
                  <dd>
                    {experienceOptions.find(
                      (option) => option.value === profile.experienceLevel,
                    )?.label ?? '第一次接触开源'}
                  </dd>
                </div>
                <div>
                  <dt>感兴趣的方向</dt>
                  <dd>
                    {getLabels(profile.interests, interestOptions).join('、') ||
                      '未选择'}
                  </dd>
                </div>
                <div>
                  <dt>学习目标</dt>
                  <dd>
                    {getLabels(profile.goals, goalOptions).join('、') ||
                      '未选择'}
                  </dd>
                </div>
              </dl>

              <div className="settings-actions">
                <Button variant="primary" onClick={beginEditing}>
                  编辑画像
                </Button>
                <Button variant="secondary" onClick={beginRefill}>
                  重新填写
                </Button>
                <Button
                  variant="ghost"
                  className="settings-reset-button"
                  onClick={handleReset}
                >
                  重置为默认画像
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

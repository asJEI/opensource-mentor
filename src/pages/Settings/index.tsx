import { useState } from 'react'
import clsx from 'clsx'
import { AppLayout } from '@/components/layout'
import { Badge, Button, Card, Input } from '@/components/ui'
import {
  DEFAULT_AI_CONFIG,
  DEFAULT_USER_PROFILE,
  useRepositoryStore,
  useSettingsStore,
  useToastStore,
  useUserStore,
} from '@/store'
import {
  contributionInterestOptions as interestOptions,
  experienceLevelOptions as experienceOptions,
  learningGoalOptions as goalOptions,
  programmingLanguageOptions as languageOptions,
} from '@/constants/userProfile'
import type { ProfileOption as Option } from '@/constants/userProfile'
import { aiService, githubService } from '@/services'
import type {
  AIProvider,
  AIProviderConfig,
  ApiConfigMode,
  UserProfileFormData,
} from '@/types'

const ProfileIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

function toFormData(): UserProfileFormData {
  return {
    programmingLanguages: [
      ...useUserStore.getState().profile.programmingLanguages,
    ],
    experienceLevel: useUserStore.getState().profile.experienceLevel,
    interests: [...useUserStore.getState().profile.interests],
    goals: [...useUserStore.getState().profile.goals],
  }
}

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

function getLabels<T extends string>(
  values: T[],
  options: Option<T>[],
): string[] {
  return values.map(
    (value) => options.find((option) => option.value === value)?.label ?? value,
  )
}

interface MultiSelectProps<T extends string> {
  options: Option<T>[]
  values: T[]
  onChange: (values: T[]) => void
}

function MultiSelect<T extends string>({
  options,
  values,
  onChange,
}: MultiSelectProps<T>) {
  return (
    <div className="profile-option-grid">
      {options.map((option) => {
        const selected = values.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            className={clsx('profile-option', selected && 'selected')}
            aria-pressed={selected}
            onClick={() => onChange(toggleValue(values, option.value))}
          >
            <span className="profile-option-check" aria-hidden="true">
              {selected ? '✓' : ''}
            </span>
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

const ApiIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 12h16" />
    <path d="m14 6 6 6-6 6" />
    <path d="M4 6v12" />
  </svg>
)

function maskSecret(secret?: string): string {
  if (!secret) return '未配置'
  const suffix = secret.slice(-4)
  return `••••••••${suffix}`
}

interface ModeSelectorProps {
  value: ApiConfigMode
  onChange: (mode: ApiConfigMode) => void
  platformLabel: string
  customLabel: string
}

function ModeSelector({
  value,
  onChange,
  platformLabel,
  customLabel,
}: ModeSelectorProps) {
  return (
    <div className="api-mode-selector">
      <button
        type="button"
        className={clsx('api-mode-option', value === 'platform' && 'selected')}
        aria-pressed={value === 'platform'}
        onClick={() => onChange('platform')}
      >
        <strong>{platformLabel}</strong>
        <span>无需填写密钥，由当前部署环境提供</span>
      </button>
      <button
        type="button"
        className={clsx('api-mode-option', value === 'custom' && 'selected')}
        aria-pressed={value === 'custom'}
        onClick={() => onChange('custom')}
      >
        <strong>{customLabel}</strong>
        <span>密钥仅保存在当前浏览器，不写入服务端数据库</span>
      </button>
    </div>
  )
}

const GitHubApiSettings = () => {
  const githubConfig = useSettingsStore((state) => state.githubConfig)
  const updateGitHubConfig = useSettingsStore(
    (state) => state.updateGitHubConfig,
  )
  const clearGitHubToken = useSettingsStore(
    (state) => state.clearGitHubToken,
  )
  const showToast = useToastStore((state) => state.showToast)
  const [token, setToken] = useState(githubConfig.token ?? '')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (githubConfig.mode === 'custom' && !token.trim()) {
      showToast('error', '缺少 Token', '请先填写 GitHub Token')
      return
    }
    setTesting(true)
    try {
      const result = await githubService.testConnection(
        githubConfig.mode === 'custom' ? token.trim() : undefined,
      )
      showToast('success', 'GitHub 连接成功', result.message)
    } catch (error) {
      showToast(
        'error',
        'GitHub 连接失败',
        error instanceof Error ? error.message : '请检查 Token',
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (!token.trim()) {
      showToast('error', '无法保存', 'GitHub Token 不能为空')
      return
    }
    updateGitHubConfig({ mode: 'custom', token: token.trim() })
    showToast('success', 'GitHub 配置已保存', '后续请求将使用你的 Token')
  }

  const handleClear = () => {
    clearGitHubToken()
    setToken('')
    setShowToken(false)
    showToast('success', 'GitHub Token 已清除', '已切换回平台默认 API')
  }

  return (
    <Card
      className="settings-card"
      title={
        <div className="settings-card-title">
          <span className="settings-card-icon">
            <ApiIcon />
          </span>
          <span>GitHub API</span>
          <Badge
            variant={githubConfig.mode === 'custom' ? 'accent' : 'default'}
            size="sm"
          >
            {githubConfig.mode === 'custom' ? '自定义 Token' : '平台默认'}
          </Badge>
        </div>
      }
    >
      <div className="api-settings-body">
        <ModeSelector
          value={githubConfig.mode}
          onChange={(mode) => updateGitHubConfig({ mode })}
          platformLabel="平台默认 GitHub API"
          customLabel="使用自己的 GitHub Token"
        />

        {githubConfig.mode === 'custom' && (
          <div className="api-custom-fields">
            <label className="form-label" htmlFor="github-token">
              GitHub Token
            </label>
            <div className="secret-input-row">
              <input
                id="github-token"
                type={showToken ? 'text' : 'password'}
                className="form-input"
                value={token}
                autoComplete="off"
                placeholder="github_pat_... 或 ghp_..."
                onChange={(event) => setToken(event.target.value)}
              />
              <Button
                variant="secondary"
                onClick={() => setShowToken((current) => !current)}
              >
                {showToken ? '隐藏' : '显示'}
              </Button>
            </div>
            <p className="form-hint">
              当前保存值：{maskSecret(githubConfig.token)}。建议仅授予所需的最小只读权限。
            </p>
          </div>
        )}

        <div className="settings-actions api-settings-actions">
          {githubConfig.mode === 'custom' && (
            <Button variant="primary" onClick={handleSave}>
              保存 Token
            </Button>
          )}
          <Button
            variant="secondary"
            loading={testing}
            onClick={handleTest}
          >
            测试连接
          </Button>
          {githubConfig.token && (
            <Button
              variant="ghost"
              className="settings-reset-button"
              onClick={handleClear}
            >
              清除 Token
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

const AIProviderSettings = () => {
  const aiConfig = useSettingsStore((state) => state.aiConfig)
  const updateAIConfig = useSettingsStore((state) => state.updateAIConfig)
  const clearAIConfig = useSettingsStore((state) => state.clearAIConfig)
  const showToast = useToastStore((state) => state.showToast)
  const [draft, setDraft] = useState<AIProviderConfig>({ ...aiConfig })
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)

  const setMode = (mode: ApiConfigMode) => {
    updateAIConfig({ mode })
    setDraft((current) => ({ ...current, mode }))
  }

  const setProvider = (provider: AIProvider) => {
    setDraft((current) => ({
      ...current,
      provider,
      baseUrl:
        provider === 'deepseek'
          ? 'https://api.deepseek.com'
          : current.provider === 'deepseek'
            ? ''
            : current.baseUrl,
      model:
        provider === 'deepseek'
          ? 'deepseek-chat'
          : current.provider === 'deepseek'
            ? ''
            : current.model,
    }))
  }

  const validateDraft = (): string | null => {
    if (!draft.baseUrl?.startsWith('https://')) return 'Base URL 必须使用 HTTPS'
    if (!draft.apiKey?.trim()) return 'API Key 不能为空'
    if (!draft.model.trim()) return '模型名称不能为空'
    return null
  }

  const handleTest = async () => {
    const testConfig =
      aiConfig.mode === 'platform'
        ? { ...DEFAULT_AI_CONFIG }
        : { ...draft, mode: 'custom' as const }
    if (testConfig.mode === 'custom') {
      const error = validateDraft()
      if (error) {
        showToast('error', '配置不完整', error)
        return
      }
    }

    setTesting(true)
    try {
      const result = await aiService.testConnection(testConfig)
      showToast(
        'success',
        'AI API 连接成功',
        `${result.model ?? testConfig.model}${result.latencyMs ? ` · ${result.latencyMs}ms` : ''}`,
      )
    } catch (error) {
      showToast(
        'error',
        'AI API 连接失败',
        error instanceof Error ? error.message : '请检查 API 配置',
      )
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    const error = validateDraft()
    if (error) {
      showToast('error', '无法保存', error)
      return
    }
    updateAIConfig({ ...draft, mode: 'custom' })
    showToast('success', 'AI API 配置已保存', '后续 AI 请求将使用自定义 Provider')
  }

  const handleClear = () => {
    clearAIConfig()
    setDraft({ ...DEFAULT_AI_CONFIG })
    setShowKey(false)
    showToast('success', 'AI API 配置已清除', '已切换回平台默认 AI API')
  }

  return (
    <Card
      className="settings-card"
      title={
        <div className="settings-card-title">
          <span className="settings-card-icon">
            <ApiIcon />
          </span>
          <span>AI API</span>
          <Badge
            variant={aiConfig.mode === 'custom' ? 'accent' : 'default'}
            size="sm"
          >
            {aiConfig.mode === 'custom' ? '自定义 Provider' : '平台默认'}
          </Badge>
        </div>
      }
    >
      <div className="api-settings-body">
        <ModeSelector
          value={aiConfig.mode}
          onChange={setMode}
          platformLabel="平台默认 AI API"
          customLabel="使用自己的 AI API"
        />

        {aiConfig.mode === 'custom' && (
          <div className="api-custom-fields api-field-grid">
            <Input
              type="select"
              label="Provider"
              value={draft.provider}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                {
                  value: 'openai-compatible',
                  label: 'OpenAI-compatible',
                },
              ]}
              onChange={(value) => setProvider(value as AIProvider)}
            />
            <Input
              label="Base URL"
              value={draft.baseUrl ?? ''}
              placeholder="https://api.example.com/v1"
              onChange={(baseUrl) =>
                setDraft((current) => ({ ...current, baseUrl }))
              }
            />
            <Input
              label="模型"
              value={draft.model}
              placeholder="deepseek-chat"
              onChange={(model) =>
                setDraft((current) => ({ ...current, model }))
              }
            />
            <div className="form-group">
              <label className="form-label" htmlFor="ai-api-key">
                API Key
              </label>
              <div className="secret-input-row">
                <input
                  id="ai-api-key"
                  type={showKey ? 'text' : 'password'}
                  className="form-input"
                  value={draft.apiKey ?? ''}
                  autoComplete="off"
                  placeholder="sk-..."
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      apiKey: event.target.value,
                    }))
                  }
                />
                <Button
                  variant="secondary"
                  onClick={() => setShowKey((current) => !current)}
                >
                  {showKey ? '隐藏' : '显示'}
                </Button>
              </div>
              <p className="form-hint">
                当前保存值：{maskSecret(aiConfig.apiKey)}
              </p>
            </div>
          </div>
        )}

        <div className="settings-actions api-settings-actions">
          {aiConfig.mode === 'custom' && (
            <Button variant="primary" onClick={handleSave}>
              保存 AI 配置
            </Button>
          )}
          <Button
            variant="secondary"
            loading={testing}
            onClick={handleTest}
          >
            测试连接
          </Button>
          {aiConfig.apiKey && (
            <Button
              variant="ghost"
              className="settings-reset-button"
              onClick={handleClear}
            >
              清除配置
            </Button>
          )}
        </div>

        <p className="api-security-note">
          MVP 阶段密钥仅保存在当前浏览器 localStorage，并按请求临时发送；服务端不会永久保存。请只在可信设备上使用。
        </p>
      </div>
    </Card>
  )
}

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
        <GitHubApiSettings />
        <AIProviderSettings />
      </div>
    </AppLayout>
  )
}

export default Settings

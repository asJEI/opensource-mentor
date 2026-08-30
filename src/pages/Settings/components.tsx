import { useState } from 'react'
import clsx from 'clsx'
import { Badge, Button, Card, Input } from '@/components/ui'
import {
  DEFAULT_AI_CONFIG,
  useSettingsStore,
  useToastStore,
  useUserStore,
} from '@/store'
import type { ProfileOption as Option } from '@/constants/userProfile'
import { aiService, authService, githubService } from '@/services'
import { getConnectionErrorMessage } from '@/services/connectionErrors'
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
        <span>配置保存在当前浏览器，按请求临时发送，服务端不持久化</span>
      </button>
    </div>
  )
}

type ConnectionStatus =
  'idle' | 'unconfigured' | 'testing' | 'success' | 'failure'

const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: '待测试',
  unconfigured: '未配置',
  testing: '测试中…',
  success: '连接成功',
  failure: '连接失败',
}

function ConnectionStatusBadge({
  status,
  detail,
}: {
  status: ConnectionStatus
  detail?: string
}) {
  return (
    <div
      className={clsx('connection-status', `connection-status-${status}`)}
      role="status"
    >
      <Badge
        variant={
          status === 'success'
            ? 'success'
            : status === 'failure'
              ? 'danger'
              : status === 'testing'
                ? 'info'
                : status === 'unconfigured'
                  ? 'warning'
                  : 'default'
        }
        size="sm"
      >
        {CONNECTION_STATUS_LABEL[status]}
      </Badge>
      {detail ? (
        <span className="connection-status-detail">{detail}</span>
      ) : null}
    </div>
  )
}

const DEEPSEEK_MODELS = [
  { value: 'deepseek-v4-flash', label: 'deepseek-v4-flash（推荐）' },
  { value: 'deepseek-v4-pro', label: 'deepseek-v4-pro' },
]

const PROVIDER_HINTS: Record<AIProvider, string> = {
  deepseek: '默认 Base URL 为 https://api.deepseek.com，一般无需修改。',
  openai: '使用 OpenAI 官方 endpoint，主要填写 API Key 与模型。',
  orcarouter:
    'OrcaRouter 使用 OpenAI Compatible 接口，默认 Base URL 为 https://api.orcarouter.ai/v1，模型名通常形如 deepseek/deepseek-chat。',
  'openai-compatible':
    '适用于 OpenRouter、代理或本地兼容服务，需同时填写 Base URL、Key 与模型。',
}

function defaultBaseUrl(provider: AIProvider): string {
  if (provider === 'deepseek') return 'https://api.deepseek.com'
  if (provider === 'openai') return 'https://api.openai.com/v1'
  if (provider === 'orcarouter') return 'https://api.orcarouter.ai/v1'
  return ''
}

function defaultModel(provider: AIProvider): string {
  if (provider === 'deepseek') return 'deepseek-v4-flash'
  if (provider === 'openai') return 'gpt-4o-mini'
  if (provider === 'orcarouter') return 'deepseek/deepseek-chat'
  return ''
}

const GitHubApiSettings = () => {
  const githubConfig = useSettingsStore((state) => state.githubConfig)
  const profile = useUserStore((state) => state.profile)
  const githubProfile = useUserStore((state) => state.githubProfile)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const logout = useUserStore((state) => state.logout)
  const updateGitHubConfig = useSettingsStore(
    (state) => state.updateGitHubConfig,
  )
  const clearGitHubToken = useSettingsStore((state) => state.clearGitHubToken)
  const showToast = useToastStore((state) => state.showToast)
  const [token, setToken] = useState(githubConfig.token ?? '')
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>(
    githubConfig.mode === 'custom' && !githubConfig.token
      ? 'unconfigured'
      : 'idle',
  )
  const [statusDetail, setStatusDetail] = useState<string | undefined>()

  const handleTest = async () => {
    if (githubConfig.mode === 'custom' && !token.trim()) {
      setStatus('unconfigured')
      setStatusDetail('请先填写 GitHub Token')
      showToast('error', '缺少 Token', '请先填写 GitHub Token')
      return
    }
    setTesting(true)
    setStatus('testing')
    setStatusDetail(undefined)
    try {
      const result = await githubService.testConnection(
        githubConfig.mode === 'custom' ? token.trim() : undefined,
      )
      setStatus('success')
      setStatusDetail(result.account || result.message)
      showToast('success', 'GitHub 连接成功', result.message)
    } catch (error) {
      const message = getConnectionErrorMessage(error, '请检查 Token')
      setStatus('failure')
      setStatusDetail(message)
      showToast('error', 'GitHub 连接失败', message)
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
    setStatus('idle')
    setStatusDetail(undefined)
    showToast('success', 'GitHub 配置已保存', '后续请求将使用你的 Token')
  }

  const handleClear = () => {
    clearGitHubToken()
    setToken('')
    setShowToken(false)
    setStatus('idle')
    setStatusDetail(undefined)
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
          <span>GitHub 账号与 API</span>
          <Badge
            variant={isAuthenticated ? 'success' : 'default'}
            size="sm"
          >
            {isAuthenticated ? '已连接账号' : '未登录'}
          </Badge>
        </div>
      }
    >
      <div className="api-settings-body">
        <section className="settings-inline-panel">
          <div>
            <h3>GitHub 账号</h3>
            <p className="form-hint">
              用于生成你的开发者画像：头像、名称、公开仓库、语言、PR / Issue
              和第三方贡献线索。
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
              <small>
                {githubProfile?.developerProfile
                  ? `${githubProfile.developerProfile.level} · 能力判断把握度 ${Math.round(
                      githubProfile.developerProfile.confidence * 100,
                    )}%`
                  : isAuthenticated
                    ? '已读取公开资料'
                    : '点击登录后生成结构化 Developer Profile'}
              </small>
            </div>
          </div>
          <div className="settings-actions api-settings-actions">
            <Button variant="primary" onClick={authService.startGitHubLogin}>
              {isAuthenticated ? '重新连接 GitHub' : '使用 GitHub 登录'}
            </Button>
            {isAuthenticated && (
              <Button variant="ghost" onClick={logout}>
                退出当前设备
              </Button>
            )}
          </div>
        </section>

        <p className="form-hint api-section-lead">
          账号登录只负责识别用户和生成画像；公共仓库分析默认继续使用平台
          GitHub API 额度，普通用户无需配置自己的 Token。
        </p>

        <ModeSelector
          value={githubConfig.mode}
          onChange={(mode) => {
            updateGitHubConfig({ mode })
            setStatus(
              mode === 'custom' && !token.trim() ? 'unconfigured' : 'idle',
            )
            setStatusDetail(undefined)
          }}
          platformLabel="平台 GitHub API（推荐）"
          customLabel="高级：使用自己的 GitHub Token"
        />

        {githubConfig.mode === 'platform' && (
          <p className="api-warning-note">
            当前由部署环境的 PLATFORM_GITHUB_TOKEN 提供公共仓库分析额度。即使你已登录
            GitHub，也不需要额外填写个人 Token。
          </p>
        )}

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
              当前保存值：{maskSecret(githubConfig.token)}。仅在需要调试或更高个人额度时使用；
              不建议申请私有仓库权限。
            </p>
          </div>
        )}

        <ConnectionStatusBadge status={status} detail={statusDetail} />

        <div className="settings-actions api-settings-actions">
          {githubConfig.mode === 'custom' && (
            <Button variant="primary" onClick={handleSave}>
              保存 Token
            </Button>
          )}
          <Button variant="secondary" loading={testing} onClick={handleTest}>
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

        <p className="api-security-note">
          GitHub 登录不等于上传个人 Token。自定义 Token 只保存在当前浏览器，
          经请求头临时发送，服务端不持久化。
        </p>
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
  const [showAdvanced, setShowAdvanced] = useState(
    aiConfig.provider === 'openai-compatible',
  )
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<ConnectionStatus>(
    aiConfig.mode === 'custom' && !aiConfig.apiKey ? 'unconfigured' : 'idle',
  )
  const [statusDetail, setStatusDetail] = useState<string | undefined>()

  const setMode = (mode: ApiConfigMode) => {
    updateAIConfig({ mode })
    setDraft((current) => ({ ...current, mode }))
    setStatus(
      mode === 'custom' && !(draft.apiKey || aiConfig.apiKey)
        ? 'unconfigured'
        : 'idle',
    )
    setStatusDetail(undefined)
  }

  const setProvider = (provider: AIProvider) => {
    setDraft((current) => ({
      ...current,
      provider,
      baseUrl: defaultBaseUrl(provider) || current.baseUrl,
      model:
        defaultModel(provider) ||
        (provider === 'openai-compatible' ? current.model : ''),
    }))
    setShowAdvanced(provider === 'openai-compatible')
    setStatus('idle')
    setStatusDetail(undefined)
  }

  const validateDraft = (): string | null => {
    if (!draft.apiKey?.trim()) return 'API Key 不能为空'
    if (!draft.model.trim()) return '模型名称不能为空'
    if (draft.provider === 'openai-compatible') {
      if (!draft.baseUrl?.startsWith('https://')) {
        return 'Base URL 必须使用 HTTPS'
      }
    } else if (draft.baseUrl && !draft.baseUrl.startsWith('https://')) {
      return 'Base URL 必须使用 HTTPS'
    }
    return null
  }

  const handleTest = async () => {
    const testConfig =
      aiConfig.mode === 'platform'
        ? { ...DEFAULT_AI_CONFIG, mode: 'platform' as const }
        : {
            ...draft,
            mode: 'custom' as const,
            baseUrl:
              draft.baseUrl?.trim() ||
              defaultBaseUrl(draft.provider) ||
              undefined,
          }
    if (testConfig.mode === 'custom') {
      const error = validateDraft()
      if (error) {
        setStatus('unconfigured')
        setStatusDetail(error)
        showToast('error', '配置不完整', error)
        return
      }
    }

    setTesting(true)
    setStatus('testing')
    setStatusDetail(undefined)
    try {
      const result = await aiService.testConnection(testConfig)
      const detail = `${result.model ?? testConfig.model}${
        result.latencyMs ? ` · ${result.latencyMs}ms` : ''
      }`
      setStatus('success')
      setStatusDetail(detail)
      showToast('success', 'AI API 连接成功', detail)
    } catch (error) {
      const message = getConnectionErrorMessage(error, '请检查 API 配置')
      setStatus('failure')
      setStatusDetail(message)
      showToast('error', 'AI API 连接失败', message)
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
    updateAIConfig({
      ...draft,
      mode: 'custom',
      baseUrl:
        draft.baseUrl?.trim() || defaultBaseUrl(draft.provider) || undefined,
    })
    setStatus('idle')
    setStatusDetail(undefined)
    showToast(
      'success',
      'AI API 配置已保存',
      '后续 AI 请求将使用自定义 Provider',
    )
  }

  const handleClear = () => {
    clearAIConfig()
    setDraft({ ...DEFAULT_AI_CONFIG })
    setShowKey(false)
    setShowAdvanced(false)
    setStatus('idle')
    setStatusDetail(undefined)
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
          <span>AI 服务</span>
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
              label="服务商"
              value={draft.provider}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'orcarouter', label: 'OrcaRouter' },
                {
                  value: 'openai-compatible',
                  label: 'OpenAI Compatible',
                },
              ]}
              onChange={(value) => setProvider(value as AIProvider)}
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

            {draft.provider === 'deepseek' ? (
              <Input
                type="select"
                label="模型"
                value={draft.model}
                options={DEEPSEEK_MODELS}
                onChange={(model) =>
                  setDraft((current) => ({ ...current, model }))
                }
              />
            ) : (
              <Input
                label="模型"
                value={draft.model}
                placeholder={
                  draft.provider === 'openai'
                    ? 'gpt-4o-mini'
                    : draft.provider === 'orcarouter'
                      ? 'deepseek/deepseek-chat'
                    : 'your-model-name'
                }
                onChange={(model) =>
                  setDraft((current) => ({ ...current, model }))
                }
              />
            )}

            {draft.provider === 'openai-compatible' ? (
              <Input
                label="Base URL"
                value={draft.baseUrl ?? ''}
                placeholder="https://api.example.com/v1"
                onChange={(baseUrl) =>
                  setDraft((current) => ({ ...current, baseUrl }))
                }
              />
            ) : (
              <div className="form-group api-advanced-toggle">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setShowAdvanced((current) => !current)}
                >
                  {showAdvanced ? '收起高级设置' : '高级设置：Base URL'}
                </button>
                {showAdvanced && (
                  <Input
                    label="Base URL"
                    value={draft.baseUrl ?? defaultBaseUrl(draft.provider)}
                    placeholder={defaultBaseUrl(draft.provider)}
                    onChange={(baseUrl) =>
                      setDraft((current) => ({ ...current, baseUrl }))
                    }
                  />
                )}
              </div>
            )}

            <p className="form-hint api-provider-hint">
              {PROVIDER_HINTS[draft.provider]}
            </p>
          </div>
        )}

        <ConnectionStatusBadge status={status} detail={statusDetail} />

        <div className="settings-actions api-settings-actions">
          {aiConfig.mode === 'custom' && (
            <Button variant="primary" onClick={handleSave}>
              保存 AI 配置
            </Button>
          )}
          <Button variant="secondary" loading={testing} onClick={handleTest}>
            测试连接
          </Button>
          {(aiConfig.apiKey || aiConfig.mode === 'custom') && (
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
          配置保存在当前浏览器。密钥通过请求头临时发送，请求结束后不落库、不写日志。
        </p>
      </div>
    </Card>
  )
}

export {
  AIProviderSettings,
  GitHubApiSettings,
  MultiSelect,
  ProfileIcon,
  getLabels,
  toFormData,
}

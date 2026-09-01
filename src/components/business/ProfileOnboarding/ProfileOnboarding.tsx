import { useMemo, useState, useEffect } from 'react'
import clsx from 'clsx'
import { Button, Modal } from '@/components/ui'
import { authService, toServerUserState } from '@/services'
import { useToastStore, useUserStore } from '@/store'
import type {
  ContributionTimeBudget,
  GuidancePreference,
  LearningGoal,
  OpenSourceGoal,
  ProgrammingLanguage,
} from '@/types'

const TOTAL_STEPS = 4

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

const guidanceOptions: Array<{ value: GuidancePreference; label: string; desc: string }> = [
  { value: 'step_by_step', label: '一步一步带我做', desc: '适合第一次贡献或想降低卡住概率。' },
  { value: 'hints_when_stuck', label: '卡住时给我提示', desc: '保留自主探索，只在关键点获得帮助。' },
  { value: 'find_good_issues', label: '只帮我找到好 Issue', desc: '适合已经熟悉开源流程的开发者。' },
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

const SparklesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
    <path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14Z" />
    <path d="m19 13-.9 2.1L16 16l2.1.9L19 19l.9-2.1L22 16l-2.1-.9L19 13Z" />
  </svg>
)

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]
}

function inferProgrammingLanguages(techStack: string[]): ProgrammingLanguage[] {
  const mapped = techStack
    .map((item) => languageAliases[item.trim().toLowerCase()])
    .filter((item): item is ProgrammingLanguage => Boolean(item))
  return [...new Set(mapped)]
}

function normalizeTechStack(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean).slice(0, 16))]
}

const ProfileOnboarding = () => {
  const profile = useUserStore((state) => state.profile)
  const githubProfile = useUserStore((state) => state.githubProfile)
  const isAuthenticated = useUserStore((state) => state.isAuthenticated)
  const completeProfileSetup = useUserStore((state) => state.completeProfileSetup)
  const applyServerUserState = useUserStore((state) => state.applyServerUserState)
  const skipProfileSetup = useUserStore((state) => state.skipProfileSetup)
  const showToast = useToastStore((state) => state.showToast)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [openSourceGoal, setOpenSourceGoal] = useState<OpenSourceGoal | ''>(profile.openSourceGoal)
  const [techStack, setTechStack] = useState<string[]>(() =>
    normalizeTechStack([
      ...profile.preferredTechStack,
      ...(githubProfile?.developerProfile?.languages.map((item) => item.name) ?? []),
      ...(githubProfile?.developerProfile?.frameworks ?? []),
    ]),
  )
  const [customTech, setCustomTech] = useState('')
  const [timeBudget, setTimeBudget] = useState<ContributionTimeBudget | ''>(profile.contributionTimeBudget)
  const [guidancePreference, setGuidancePreference] = useState<GuidancePreference | ''>(profile.guidancePreference)

  const visible = profile.profileSetupStatus === 'not_started'
  const detectedTechStack = useMemo(
    () =>
      normalizeTechStack([
        ...(githubProfile?.developerProfile?.languages.map((item) => item.name) ?? []),
        ...(githubProfile?.developerProfile?.frameworks ?? []),
      ]),
    [githubProfile],
  )

  useEffect(() => {
    if (detectedTechStack.length === 0) return
    setTechStack((current) =>
      current.length > 0
        ? current
        : normalizeTechStack([...profile.preferredTechStack, ...detectedTechStack]),
    )
  }, [detectedTechStack, profile.preferredTechStack])

  const persistSetupStatus = async (
    payload: Parameters<typeof authService.updateDeveloperProfile>[0],
  ) => {
    if (!isAuthenticated) return
    const me = await authService.updateDeveloperProfile(payload)
    applyServerUserState(
      toServerUserState(me, useUserStore.getState().githubProfile),
    )
  }

  const handleSkip = () => {
    skipProfileSetup()
    showToast(
      'info',
      '已跳过偏好补充',
      '推荐将只依据 GitHub 公开画像，准确度会低一些；随时可在偏好设置补充',
    )
    void persistSetupStatus({ profileSetupStatus: 'skipped' }).catch(() => {
      showToast('error', '同步失败', '已在本地跳过，稍后可在偏好设置再保存一次')
    })
  }

  const addCustomTech = () => {
    const next = customTech.trim()
    if (!next) return
    setTechStack((current) => normalizeTechStack([...current, next]))
    setCustomTech('')
  }

  const handleNext = async () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1)
      return
    }

    const legacyGoal = goalOptions.find((option) => option.value === openSourceGoal)?.legacyGoal ?? 'first_contribution'

    const formData = {
      programmingLanguages: inferProgrammingLanguages(techStack),
      experienceLevel: profile.experienceLevel,
      interests: profile.interests,
      goals: [legacyGoal],
      openSourceGoal,
      preferredTechStack: normalizeTechStack(techStack),
      contributionTimeBudget: timeBudget,
      guidancePreference,
    }

    completeProfileSetup(formData)

    if (!isAuthenticated) {
      showToast('success', '偏好已保存', '访客偏好已保存在当前浏览器')
      return
    }

    setSaving(true)
    try {
      await persistSetupStatus({
        profileSetupStatus: 'completed',
        profileConfirmed: true,
        openSourceGoal,
        preferredTechStack: formData.preferredTechStack,
        contributionTimeBudget: timeBudget,
        guidancePreference,
      })
      showToast('success', '偏好已保存', '已同步到服务端 Developer Profile')
    } catch {
      showToast('error', '同步失败', '偏好已保存在当前浏览器，稍后可在设置页再同步')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      visible={visible}
      onClose={handleSkip}
      width={680}
      className="profile-onboarding-modal"
      icon={<SparklesIcon />}
      title="完善你的开源偏好"
      subtitle="GitHub 只能看出你做过什么，这 4 个问题用来判断你现在想做什么，直接影响 Issue 推荐结果。"
      footer={
        <div className="profile-onboarding-footer">
          <Button variant="ghost" onClick={handleSkip}>稍后再说</Button>
          <div className="profile-onboarding-footer-actions">
            {step > 0 && <Button variant="secondary" onClick={() => setStep((current) => current - 1)}>返回</Button>}
            <Button variant="primary" loading={saving} onClick={handleNext}>{step === TOTAL_STEPS - 1 ? '保存偏好' : '继续'}</Button>
          </div>
        </div>
      }
    >
      <div className="profile-onboarding-progress">
        <div className="profile-onboarding-progress-meta">
          <span>Step {step + 1} / {TOTAL_STEPS}</span>
          <span>约 1 分钟，之后可在偏好设置随时修改</span>
        </div>
        <div className="profile-onboarding-progress-track">
          <span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      <article className="profile-onboarding-card">
        {step === 0 && (
          <section className="profile-onboarding-question">
            <h2>你希望从开源中获得什么？</h2>
            <p>这个答案会决定我们优先匹配“容易完成 / 技术成长 / 长期参与”的哪类 Issue。</p>
            <div className="experience-option-list profile-onboarding-experience">
              {goalOptions.map((option) => (
                <button key={option.value} type="button" className={clsx('experience-option', openSourceGoal === option.value && 'selected')} aria-pressed={openSourceGoal === option.value} onClick={() => setOpenSourceGoal(option.value)}>
                  <span className="experience-radio" aria-hidden="true" />
                  <span><strong>{option.label}</strong></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="profile-onboarding-question">
            <h2>你想使用哪些技术栈？</h2>
            <p>我已根据 GitHub 公开项目预选了一些技术栈。你可以删除不想做的，也可以添加新的。</p>
            {detectedTechStack.length > 0 && <div className="profile-detected-stack">GitHub 识别：{detectedTechStack.join('、')}</div>}
            <div className="profile-tech-stack-list">
              {techStack.map((item) => (
                <button key={item} type="button" className="profile-tech-chip" onClick={() => setTechStack((current) => toggleValue(current, item))}>
                  {item}<span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
            <div className="profile-tech-add-row">
              <input className="form-input" value={customTech} placeholder="例如：TypeScript、React、Python、Node.js" onChange={(event) => setCustomTech(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustomTech() } }} />
              <Button variant="secondary" onClick={addCustomTech}>添加</Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="profile-onboarding-question">
            <h2>你希望下一次贡献投入多少时间？</h2>
            <p>时间偏好会影响 Issue 的范围、复杂度和推荐排序。</p>
            <div className="profile-option-grid">
              {timeOptions.map((option) => (
                <button key={option.value} type="button" className={clsx('profile-option', timeBudget === option.value && 'selected')} aria-pressed={timeBudget === option.value} onClick={() => setTimeBudget(option.value)}>
                  <span className="profile-option-check" aria-hidden="true">{timeBudget === option.value ? '✓' : ''}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="profile-onboarding-question">
            <h2>你希望我提供多少指导？</h2>
            <p>同一个 Issue，可以被拆成“手把手陪跑”或“只给方向”的不同模式。</p>
            <div className="experience-option-list profile-onboarding-experience">
              {guidanceOptions.map((option) => (
                <button key={option.value} type="button" className={clsx('experience-option', guidancePreference === option.value && 'selected')} aria-pressed={guidancePreference === option.value} onClick={() => setGuidancePreference(option.value)}>
                  <span className="experience-radio" aria-hidden="true" />
                  <span><strong>{option.label}</strong><small>{option.desc}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}
      </article>
    </Modal>
  )
}

export default ProfileOnboarding

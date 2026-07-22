import { useState } from 'react'
import clsx from 'clsx'
import { Button, Modal } from '@/components/ui'
import {
  contributionInterestOptions,
  experienceLevelOptions,
  programmingLanguageOptions,
} from '@/constants/userProfile'
import {
  useRepositoryStore,
  useToastStore,
  useUserStore,
} from '@/store'
import type {
  ContributionInterest,
  ExperienceLevel,
  ProgrammingLanguage,
} from '@/types'

const TOTAL_STEPS = 3

function toggleValue<T extends string>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

const SparklesIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
    <path d="m5 14-.9 2.1L2 17l2.1.9L5 20l.9-2.1L8 17l-2.1-.9L5 14Z" />
    <path d="m19 13-.9 2.1L16 16l2.1.9L19 19l.9-2.1L22 16l-2.1-.9L19 13Z" />
  </svg>
)

const ProfileOnboarding = () => {
  const profile = useUserStore((state) => state.profile)
  const completeProfileSetup = useUserStore(
    (state) => state.completeProfileSetup,
  )
  const skipProfileSetup = useUserStore((state) => state.skipProfileSetup)
  const showToast = useToastStore((state) => state.showToast)
  const [step, setStep] = useState(0)
  const [languages, setLanguages] = useState<ProgrammingLanguage[]>(() => [
    ...profile.programmingLanguages,
  ])
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    profile.experienceLevel,
  )
  const [interests, setInterests] = useState<ContributionInterest[]>(() => [
    ...profile.interests,
  ])

  const visible = profile.profileSetupStatus === 'not_started'

  const refreshRecommendations = () => {
    const repository = useRepositoryStore.getState()
    void repository.loadRecommendedIssues(
      repository.currentOwner,
      repository.currentRepoName,
    )
  }

  const handleSkip = () => {
    skipProfileSetup()
    refreshRecommendations()
    showToast(
      'info',
      '已跳过画像设置',
      '当前将使用纯新手默认画像，你可以随时在偏好设置中修改',
    )
  }

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setStep((current) => current + 1)
      return
    }

    completeProfileSetup({
      programmingLanguages: languages,
      experienceLevel,
      interests,
      goals: profile.goals,
    })
    refreshRecommendations()
    showToast('success', '画像设置完成', '你可以随时在偏好设置中修改')
  }

  return (
    <Modal
      visible={visible}
      onClose={handleSkip}
      width={620}
      className="profile-onboarding-modal"
      icon={<SparklesIcon />}
      title="设置你的新手画像"
      subtitle="回答 3 个简单问题，帮助我们了解你的学习起点"
      footer={
        <div className="profile-onboarding-footer">
          <Button variant="ghost" onClick={handleSkip}>
            跳过
          </Button>
          <div className="profile-onboarding-footer-actions">
            {step > 0 && (
              <Button
                variant="secondary"
                onClick={() => setStep((current) => current - 1)}
              >
                返回
              </Button>
            )}
            <Button variant="primary" onClick={handleNext}>
              {step === TOTAL_STEPS - 1 ? '保存画像' : '下一步'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="profile-onboarding-progress">
        <div className="profile-onboarding-progress-meta">
          <span>问题 {step + 1} / {TOTAL_STEPS}</span>
          <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
        </div>
        <div className="profile-onboarding-progress-track">
          <span style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>
      </div>

      {step === 0 && (
        <section className="profile-onboarding-question">
          <h2>你主要使用哪些编程语言？</h2>
          <p>可以选择正在学习的语言，也可以暂不选择。</p>
          <div className="profile-option-grid">
            {programmingLanguageOptions.map((option) => {
              const selected = languages.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  className={clsx('profile-option', selected && 'selected')}
                  aria-pressed={selected}
                  onClick={() =>
                    setLanguages((current) =>
                      toggleValue(current, option.value),
                    )
                  }
                >
                  <span className="profile-option-check" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="profile-onboarding-question">
          <h2>你目前的开发经验如何？</h2>
          <p>请选择最符合当前情况的一项。</p>
          <div className="experience-option-list profile-onboarding-experience">
            {experienceLevelOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={clsx(
                  'experience-option',
                  experienceLevel === option.value && 'selected',
                )}
                aria-pressed={experienceLevel === option.value}
                onClick={() => setExperienceLevel(option.value)}
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
      )}

      {step === 2 && (
        <section className="profile-onboarding-question">
          <h2>你对哪些方向感兴趣？</h2>
          <p>可以多选；暂不确定也可以直接保存。</p>
          <div className="profile-option-grid">
            {contributionInterestOptions.map((option) => {
              const selected = interests.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  className={clsx('profile-option', selected && 'selected')}
                  aria-pressed={selected}
                  onClick={() =>
                    setInterests((current) =>
                      toggleValue(current, option.value),
                    )
                  }
                >
                  <span className="profile-option-check" aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                  <span>{option.label}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </Modal>
  )
}

export default ProfileOnboarding

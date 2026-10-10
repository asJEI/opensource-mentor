import { useUserStore } from '@/store/user'
import { isLocale } from '@shared/locale'

export default function LanguageSwitcher() {
  const locale = useUserStore((state) => state.preferences.language)
  const updatePreferences = useUserStore((state) => state.updatePreferences)
  return (
    <select
      className="language-switcher"
      aria-label={locale === 'zh-CN' ? '界面语言' : 'Interface language'}
      value={locale}
      onChange={(event) => { if (isLocale(event.target.value)) updatePreferences({ language: event.target.value }) }}
    >
      <option value="zh-CN">简体中文</option>
      <option value="en-US">English</option>
    </select>
  )
}

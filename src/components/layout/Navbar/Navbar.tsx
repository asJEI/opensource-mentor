import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAppStore } from '@/store'

const navLinks = [
  { label: '产品特性', href: '#features' },
  { label: '工作流程', href: '#workflow' },
  { label: '产品预览', href: '#preview' },
  { label: '定价', href: '#pricing' },
]

const Navbar = () => {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const setCurrentAppPage = useAppStore((s) => s.setCurrentAppPage)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const el = document.querySelector(href)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }

  const handleStartFree = () => {
    setCurrentPage('app')
    setCurrentAppPage('dashboard')
    navigate('/dashboard')
  }

  return (
    <nav className={clsx('nav', scrolled && 'scrolled')}>
      <a href="#" className="nav-logo">
        <span className="nav-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        </span>
        <span>OpenSource Mentor</span>
      </a>

      <div className="nav-links">
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="nav-link"
            onClick={(e) => handleNavClick(e, link.href)}
          >
            {link.label}
          </a>
        ))}
      </div>

      <div className="nav-right">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          title="即将支持 GitHub 登录；当前为访客模式，配置保存在此设备"
          onClick={() => {
            setCurrentPage('app')
            setCurrentAppPage('settings')
            navigate('/settings')
          }}
        >
          访客模式
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleStartFree}>
          免费开始
        </button>
      </div>
    </nav>
  )
}

export default Navbar

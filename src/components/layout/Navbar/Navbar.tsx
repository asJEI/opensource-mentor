import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { authService } from '@/services'

const navLinks = [
  { label: '流程', href: '#how-it-works' },
  { label: '能力', href: '#features' },
  { label: '产品预览', href: '#preview' },
]

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false)

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
    authService.startGitHubLogin()
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
        <button className="btn btn-primary btn-sm nav-github-login" onClick={handleStartFree}>
          GitHub 登录
        </button>
      </div>
    </nav>
  )
}

export default Navbar

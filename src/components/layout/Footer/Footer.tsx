const footerLinks = {
  product: [
    { label: 'Issue 推荐', href: '/issues' },
    { label: '仓库分析', href: '/dashboard' },
    { label: '贡献指南', href: '/roadmap' },
    { label: 'AI 导师', href: '/ai-mentor' },
    { label: '代码审查', href: '/code-review' },
    { label: 'PR 生成器', href: '/pr-generator' },
  ],
  resources: [
    { label: '项目源码', href: 'https://github.com/asJEI/opensource-mentor' },
    { label: '报告问题', href: 'https://github.com/asJEI/opensource-mentor/issues' },
  ],
}

const socialLinks = [
  {
    label: 'GitHub',
    href: 'https://github.com/asJEI/opensource-mentor',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
      </svg>
    ),
  },
]

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-grid">
          <div className="footer-brand">
            <a href="/" className="nav-logo">
              <span className="nav-logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </span>
              <span>OpenSource Mentor</span>
            </a>
            <p>
              用 AI 助力你的开源之旅。智能分析仓库、推荐 Issue、生成 PR，让开源贡献更高效、更有成就感。
            </p>
          </div>

          <div className="footer-col">
            <h4>产品</h4>
            <ul>
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h4>资源</h4>
            <ul>
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} OpenSource Mentor. All rights reserved.</p>
          <div className="footer-social">
            {socialLinks.map((social) => (
              <a key={social.label} href={social.href} aria-label={social.label} target="_blank" rel="noreferrer">
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer

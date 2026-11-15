import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, AlignLeft, ArrowDownToLine, ArrowRight, ArrowRightLeft, ArrowUpRight, BadgeCheck, Binary, Blend, Braces, Brackets, CalendarClock, CaseSensitive, Check, ChevronDown, ChevronRight, Clock3, Code2, CodeXml, Command, Copy, Database, ExternalLink, FileCode, FileCode2, FileJson2, FilePenLine, FileText, Fingerprint, GitCompareArrows, Globe2, Grid2X2, Hash, Heart, KeyRound, Languages, LayoutDashboard, Link as LinkIcon, Link2, ListChecks, ListX, Menu, Minimize, Minimize2, MonitorPlay, MonitorSmartphone, Moon, MoveLeft, Network, Palette, PanelsTopLeft, Paintbrush, Pipette, Play, QrCode, Regex, ScanSearch, ScanText, Search, Shield, ShieldCheck, Sparkles, Square, Sun, Table2, Terminal, TextQuote, Timer, Type, Unlink, Wrench, X, type LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import toast, { Toaster } from 'react-hot-toast'
import { categories, findTool, type ToolDefinition } from './tools/catalog'
import { processTool, type ToolResult } from './tools/processors'
import { usePreferences } from './state/preferences'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { api, getApiError } from './services/api'
import { useActiveTools, useAvailability } from './state/availability'
import './App.css'

const Editor = lazy(() => import('@monaco-editor/react'))

const iconMap: Record<string, LucideIcon> = {
  Type, ScanText, CaseSensitive, MoveLeft, ListX, AlignLeft, GitCompareArrows, TextQuote,
  Link2, Link: LinkIcon, FileText, Braces, BadgeCheck, Minimize2, Sparkles, Table2, FileJson2, Network,
  Brackets, ListChecks, Code2, Minimize, Paintbrush, CodeXml, Blend, Square, PanelsTopLeft,
  Grid2X2, Binary, Unlink, KeyRound, Languages, Hash, Fingerprint, ShieldCheck, Clock3,
  Timer, CalendarClock, Regex, ScanSearch, Pipette, Palette, QrCode, Globe2,
  MonitorSmartphone, FileCode2, Database, FileCode, ArrowRightLeft, FilePenLine, MonitorPlay,
  Play, Activity, LayoutDashboard, Shield, Terminal, Wrench,
}

function ToolIcon({ name, size = 19 }: { name: string; size?: number }) {
  const Icon = iconMap[name] ?? Wrench
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />
}

function AppFrame() {
  const { theme, setTheme } = usePreferences()
  const activeTools = useActiveTools()
  const setEnabledSlugs = useAvailability((state) => state.setEnabledSlugs)
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const slug = location.pathname.match(/^\/tools\/([^/]+)/)?.[1]
    const tool = slug ? findTool(decodeURIComponent(slug)) : undefined
    const category = location.pathname.startsWith('/category/')
      ? decodeURIComponent(location.pathname.split('/')[2])
      : ''
    const infoTitle = location.pathname === '/privacy-policy'
      ? 'Privacy Policy'
      : location.pathname === '/terms-of-service'
        ? 'Terms of Service'
        : location.pathname === '/disclaimer'
          ? 'Disclaimer'
          : location.pathname === '/contact'
            ? 'Contact Us'
            : ''
    const title = tool
      ? `${tool.name} — DevTools Hub`
      : category
        ? `${category} tools — DevTools Hub`
        : location.pathname === '/tools'
          ? 'All developer tools — DevTools Hub'
          : location.pathname === '/login'
            ? 'Log in — DevTools Hub'
            : location.pathname === '/register'
              ? 'Create account — DevTools Hub'
              : location.pathname === '/admin'
                ? 'Admin — DevTools Hub'
                : infoTitle
                  ? `${infoTitle} — DevTools Hub`
                : 'DevTools Hub — Developer tools, all in one place'
    const description = tool?.description
      ?? (category ? `Browser-local ${category.toLowerCase()} tools for a faster, private developer workflow.` : infoTitle ? `${infoTitle} for DevTools Hub.` : 'A fast, private developer toolkit for formatting, encoding, debugging, and building.')
    document.title = title
    document.querySelector('meta[name="description"]')?.setAttribute('content', description)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', description)
  }, [location.pathname])

  useEffect(() => {
    void api.get<{ tools: Array<{ slug: string }> }>('/tools')
      .then(({ data }) => setEnabledSlugs(data.tools.map((tool) => tool.slug)))
      .catch((error: unknown) => {
        const message = getApiError(error)
        if (!message.includes('requires a configured MongoDB')) console.warn('Tool availability API is unavailable; using the local tool catalog.', message)
      })
  }, [setEnabledSlugs])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((open) => !open)
        setMobileOpen(false)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <div className="app-shell">
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <Link to="/" className="brand-lockup" aria-label="DevTools Hub home" onClick={() => setMobileOpen(false)}>
          <span className="brand-mark"><Command size={19} /></span>
          <span className="brand-name">devtools<span>hub</span></span>
        </Link>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <LayoutDashboard size={17} /> Overview
          </NavLink>
          <NavLink to="/tools" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobileOpen(false)}>
            <Wrench size={17} /> All tools <span className="nav-count">{activeTools.length}</span>
          </NavLink>
        </nav>
        <div className="sidebar-label categories-label">CATEGORIES</div>
        <nav className="category-nav" aria-label="Tool categories">
          {categories.map((category) => (
            <NavLink
              key={category}
              to={`/category/${encodeURIComponent(category)}`}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className={`category-dot dot-${categorySlug(category)}`} />
              {category}
              <span className="nav-count">              {activeTools.filter((tool) => tool.category === category).length}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <span className="privacy-icon"><Shield size={15} /></span>
            <div><strong>Privacy-first</strong><span>Most tools run in your browser.</span></div>
          </div>
          <div className="sidebar-footer">
            <span className="online-dot" /> Browser tools ready
            <span className="version-label">v1.0</span>
          </div>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumbs">
            <Link to="/">Hub</Link><ChevronRight size={14} /><span>{breadcrumb(location.pathname)}</span>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => { setSearchOpen(true); setMobileOpen(false) }} aria-label="Search tools">
              <Search size={16} /><span>Search tools...</span><kbd>Ctrl K</kbd>
            </button>
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'day' : 'night'} mode`}
              aria-pressed={theme === 'dark'}
              title={`Switch to ${theme === 'dark' ? 'day' : 'night'} mode`}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>
        <div className="page-scroll">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tools" element={<ToolDirectory />} />
            <Route path="/category/:category" element={<ToolDirectory />} />
            <Route path="/tools/:slug" element={<ToolPage key={location.pathname} />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/privacy-policy" element={<LegalPage page="privacy" />} />
            <Route path="/terms-of-service" element={<LegalPage page="terms" />} />
            <Route path="/disclaimer" element={<LegalPage page="disclaimer" />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="page-footer">
            <div className="page-footer-top">
              <span>Built for the people who build the web.</span>
              <nav className="footer-links" aria-label="Legal and contact">
                <Link to="/privacy-policy">Privacy Policy</Link>
                <Link to="/terms-of-service">Terms of Service</Link>
                <Link to="/disclaimer">Disclaimer</Link>
                <Link to="/contact">Contact Us</Link>
              </nav>
            </div>
            <span className="footer-copyright">© 2026 DevTools Hub</span>
          </footer>
        </div>
      </main>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
      <Toaster position="bottom-right" toastOptions={{ duration: 2600 }} />
    </div>
  )
}

function categorySlug(category: string) {
  return category.toLowerCase().replace(/[^a-z]+/g, '-')
}

function breadcrumb(path: string) {
  if (path === '/') return 'Overview'
  if (path === '/tools') return 'All tools'
  const toolMatch = path.match(/^\/tools\/([^/]+)/)
  if (toolMatch) return findTool(decodeURIComponent(toolMatch[1]))?.name ?? 'Tool'
  if (path.startsWith('/category/')) return decodeURIComponent(path.split('/')[2])
  if (path === '/login' || path === '/register') return path.slice(1)
  if (path === '/profile') return 'Profile'
  if (path === '/admin') return 'Admin'
  if (path === '/privacy-policy') return 'Privacy Policy'
  if (path === '/terms-of-service') return 'Terms of Service'
  if (path === '/disclaimer') return 'Disclaimer'
  if (path === '/contact') return 'Contact Us'
  return 'Not found'
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}

const legalPages = {
  privacy: {
    title: 'Privacy Policy',
    description: 'What DevTools Hub processes, stores, and shares when you use the site.',
    sections: [
      {
        heading: 'Tool processing',
        paragraphs: [
          'Most tools process text and code in your browser. Their input and output are not uploaded to the DevTools Hub API.',
          'The IP Address Information tool sends the IP address you enter to ipapi.co to retrieve lookup information. Do not use that tool for an address you are not permitted to look up.',
        ],
      },
      {
        heading: 'Accounts and activity',
        paragraphs: [
          'If account services are enabled, the service processes the name and email address you provide and stores a password hash, never your plaintext password. Favorites and recently used tool identifiers may be synced to your account.',
          'Usage activity records the tool identifier, action, and timestamp. Tool inputs, generated passwords, and code are not included in those activity records.',
        ],
      },
      {
        heading: 'Browser storage and session cookies',
        paragraphs: [
          'Theme, favorites, and recent-tool preferences can be stored in this browser using local storage. You can remove this local data through your browser settings.',
          'When you sign in, the API uses an HttpOnly session cookie. Account data is stored in the MongoDB database configured by the site operator.',
        ],
      },
      {
        heading: 'Retention and questions',
        paragraphs: [
          'Local preferences remain in your browser until you clear them. Account and activity data remain in the configured database until the site operator removes it. This app does not currently provide a self-service account deletion control.',
          'A contact email can be configured by the site operator. If the Contact Us page says no support address is configured, contact the operator who provided this deployment.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    description: 'Basic terms for using this developer tools website.',
    sections: [
      {
        heading: 'Using the tools',
        paragraphs: [
          'You may use DevTools Hub for lawful development, learning, and productivity tasks. You are responsible for the content you enter and for checking that your use complies with applicable law and third-party rights.',
          'Do not use the site to disrupt its operation, bypass access controls, or submit content you are not authorized to process.',
        ],
      },
      {
        heading: 'Accounts',
        paragraphs: [
          'If account registration is enabled, keep your credentials secure and provide accurate account details. Administrators may manage account roles and tool availability.',
        ],
      },
      {
        heading: 'Availability and changes',
        paragraphs: [
          'Tools and features may change or become unavailable. The site is provided without a guarantee of uninterrupted availability or suitability for a particular purpose.',
          'Some tools rely on third-party services. Their availability and terms are controlled by those providers.',
        ],
      },
      {
        heading: 'Contact',
        paragraphs: [
          'Use the Contact Us page for the deployment operator’s configured contact method. These terms are general site information and are not a substitute for legal advice.',
        ],
      },
    ],
  },
  disclaimer: {
    title: 'Disclaimer',
    description: 'Important limitations to keep in mind when relying on tool output.',
    sections: [
      {
        heading: 'Verify results',
        paragraphs: [
          'Tools are provided for convenience and may produce incomplete or incorrect results. Review output before using it in production, security-sensitive work, or decisions that affect other people.',
          'Formatting, conversion, validation, and generated values are not a substitute for testing with the systems where you intend to use them.',
        ],
      },
      {
        heading: 'Security and cryptography',
        paragraphs: [
          'The JWT Decoder only displays decoded token content; it does not verify a token signature, issuer, audience, or expiry. Do not treat decoding as authentication.',
          'Hash tools calculate digests for convenience and are not password-storage functions. Do not use MD5 or SHA-1 where collision resistance or modern security is required.',
        ],
      },
      {
        heading: 'Third-party lookup',
        paragraphs: [
          'The IP Address Information tool sends the entered IP address to ipapi.co. Results are supplied by that third party and may be inaccurate or unavailable.',
        ],
      },
      {
        heading: 'No professional advice',
        paragraphs: [
          'DevTools Hub provides general developer utilities, not legal, security, or other professional advice. Use your own judgment and consult a qualified professional when appropriate.',
        ],
      },
    ],
  },
} as const

function LegalPage({ page }: { page: keyof typeof legalPages }) {
  const content = legalPages[page]
  return (
    <article className="page-content legal-page">
      <PageHeading eyebrow="DEVTOOLS HUB" title={content.title} description={content.description} />
      <div className="legal-card">
        {content.sections.map((section) => (
          <section className="legal-section" key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </section>
        ))}
      </div>
    </article>
  )
}

function ContactPage() {
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL?.trim()
  const submitContact = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!contactEmail) return
    const formData = new FormData(event.currentTarget)
    const subject = String(formData.get('subject') ?? '').trim()
    const email = String(formData.get('email') ?? '').trim()
    const message = String(formData.get('message') ?? '').trim()
    const body = `${message}\n\nReply to: ${email}`
    window.location.assign(`mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  return (
    <div className="page-content legal-page">
      <PageHeading eyebrow="GET IN TOUCH" title="Contact Us" description="Send a question or feedback to the site operator." />
      <section className="contact-card">
        <div className="contact-intro">
          <span className="contact-icon"><ExternalLink size={18} /></span>
          <div>
            <h2>Contact the DevTools Hub team</h2>
            <p>Your message opens in your default email app. It is not sent or stored by this website.</p>
          </div>
        </div>
        {contactEmail ? (
          <form className="contact-form" onSubmit={submitContact}>
            <label>Your email<input type="email" name="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
            <label>Subject<input type="text" name="subject" required maxLength={120} placeholder="How can we help?" /></label>
            <label>Message<textarea name="message" required maxLength={5000} rows={6} placeholder="Write your message..." /></label>
            <button type="submit" className="button button-primary">Open email app <ArrowUpRight size={14} /></button>
          </form>
        ) : (
          <p className="contact-not-configured" role="status">No public support email is configured for this deployment. Please contact the person or organization that provided the site.</p>
        )}
      </section>
    </div>
  )
}

function ToolCard({ tool, compact = false }: { tool: ToolDefinition; compact?: boolean }) {
  const favorites = usePreferences((state) => state.favorites)
  const { toggleFavorite } = useAuth()
  const favorite = favorites.includes(tool.slug)
  const changeFavorite = () => {
    void toggleFavorite(tool.slug).catch((error: unknown) => toast.error(getApiError(error, 'Could not save this favorite.')))
  }
  return (
    <article className={`tool-card ${compact ? 'tool-card-compact' : ''}`}>
      <Link to={`/tools/${tool.slug}`} className="tool-card-main">
        <span className={`tool-icon icon-${categorySlug(tool.category)}`}><ToolIcon name={tool.icon} /></span>
        <span className="tool-card-copy">
          <span className="tool-card-title">{tool.name}</span>
          <span className="tool-card-description">{tool.description}</span>
        </span>
        <ArrowUpRight className="tool-card-arrow" size={16} />
      </Link>
      <button
        className={`favorite-button ${favorite ? 'is-favorite' : ''}`}
        aria-label={`${favorite ? 'Remove' : 'Add'} ${tool.name} ${favorite ? 'from' : 'to'} favorites`}
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        onClick={changeFavorite}
      >
        <Heart size={15} fill={favorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}

function Dashboard() {
  const activeTools = useActiveTools()
  const favorites = usePreferences((state) => state.favorites)
  const recent = usePreferences((state) => state.recent)
  const popular = ['json-formatter', 'base64-encoder', 'uuid-generator', 'regex-tester'].map((slug) => findTool(slug)).filter((tool): tool is ToolDefinition => tool !== undefined && activeTools.some((active) => active.slug === tool.slug))
  const recentTools = recent.map((slug) => findTool(slug)).filter((tool): tool is ToolDefinition => tool !== undefined && activeTools.some((active) => active.slug === tool.slug))
  const favoriteTools = favorites.map((slug) => findTool(slug)).filter((tool): tool is ToolDefinition => tool !== undefined && activeTools.some((active) => active.slug === tool.slug))
  return (
    <div className="page-content dashboard-page">
      <section className="welcome-panel">
        <div className="welcome-copy">
          <div className="welcome-eyebrow"><span className="welcome-spark"><Sparkles size={13} /></span> YOUR DEVELOPER WORKSPACE</div>
          <h1>Build better.<br /><span>Ship faster.</span></h1>
          <p>All the little tools that make the big work easier.<br className="desktop-break" /> Fast, private, and ready when you are.</p>
          <div className="welcome-actions">
            <Link to="/tools" className="button button-primary">Explore all tools <ArrowRight size={16} /></Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-terminal">
            <div className="terminal-top"><span /><span /><span /><div>devtools-hub</div></div>
            <div className="terminal-code"><span className="code-muted">01</span> <b>const</b> <i>workflow</i> = &#123;</div>
            <div className="terminal-code"><span className="code-muted">02</span> &nbsp; tools: <em>[</em></div>
            <div className="terminal-code"><span className="code-muted">03</span> &nbsp;&nbsp; <label>"all-in-one"</label>,</div>
            <div className="terminal-code"><span className="code-muted">04</span> &nbsp;&nbsp; <label>"developer-first"</label></div>
            <div className="terminal-code"><span className="code-muted">05</span> &nbsp; <em>]</em>,</div>
            <div className="terminal-code"><span className="code-muted">06</span> &nbsp; friction: <span className="false">false</span></div>
            <div className="terminal-code"><span className="code-muted">07</span> &#125;<span className="cursor-block" /></div>
            <div className="terminal-status"><span /><span>All tools ready</span><code>local-first</code></div>
          </div>
          <div className="floating-chip chip-one"><Braces size={15} /> JSON ready</div>
          <div className="floating-chip chip-two"><span className="chip-check"><Check size={12} /></span> Format complete</div>
        </div>
        <div className="hero-grid-pattern" />
      </section>

      <section className="stats-row" aria-label="Platform statistics">
        <div className="stat-item"><span className="stat-icon blue"><Wrench size={16} /></span><div><strong>{activeTools.length}</strong><span>Tools ready to use</span></div></div>
        <div className="stat-item"><span className="stat-icon violet"><LayoutDashboard size={16} /></span><div><strong>{categories.length}</strong><span>Focused categories</span></div></div>
        <div className="stat-item"><span className="stat-icon green"><Shield size={16} /></span><div><strong>Local-first</strong><span>Most tools run in-browser</span></div></div>
        <div className="stat-item stat-note"><div><strong>No account needed</strong><span>Jump in and get things done.</span></div><ArrowUpRight size={17} /></div>
      </section>

      <section className="section-block">
        <SectionTitle title="Quick access" subtitle="Popular tools, one click away." action={<Link to="/tools" className="text-link">Browse all <ArrowRight size={14} /></Link>} />
        <div className="tool-grid">{popular.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}</div>
      </section>
      {(recentTools.length > 0 || favoriteTools.length > 0) && (
        <div className="dashboard-lower">
          {recentTools.length > 0 && <section className="section-block"><SectionTitle title="Recently used" subtitle="Pick up where you left off." /><div className="compact-tool-list">{recentTools.slice(0, 4).map((tool) => <ToolCard key={tool.slug} tool={tool} compact />)}</div></section>}
          {favoriteTools.length > 0 && <section className="section-block"><SectionTitle title="Your favorites" subtitle="Your personal shortcuts." /><div className="compact-tool-list">{favoriteTools.slice(0, 4).map((tool) => <ToolCard key={tool.slug} tool={tool} compact />)}</div></section>}
        </div>
      )}
      <section className="category-strip">
        <div><div className="eyebrow">PICK UP A TOOL</div><h2>One small thing, done well.</h2><p>Search {activeTools.length} tools for the task in front of you.</p></div>
        <div className="category-pills">{categories.map((category) => <Link key={category} to={`/category/${encodeURIComponent(category)}`} className="category-pill"><span className={`category-dot dot-${categorySlug(category)}`} />{category}<ChevronRight size={13} /></Link>)}</div>
      </section>
    </div>
  )
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-title"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

function ToolDirectory() {
  const { category } = useParams()
  const activeTools = useActiveTools()
  const [query, setQuery] = useState('')
  const selectedCategory = category ? decodeURIComponent(category) : ''
  const filtered = useMemo(() => activeTools.filter((tool) => {
    const matchesCategory = !selectedCategory || tool.category === selectedCategory
    const haystack = `${tool.name} ${tool.description} ${tool.category}`.toLowerCase()
    return matchesCategory && haystack.includes(query.toLowerCase().trim())
  }), [activeTools, selectedCategory, query])
  const grouped = categories.map((item) => [item, filtered.filter((tool) => tool.category === item)] as const).filter(([, list]) => list.length)
  return (
    <div className="page-content directory-page">
      <PageHeading eyebrow="TOOLBOX" title={selectedCategory || 'All tools'} description="Small, focused utilities to keep your workflow moving." action={<span className="result-count">{filtered.length} tools</span>} />
      <div className="directory-search">
      <Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by tool, task, or category..." aria-label="Filter tools" /><kbd>Ctrl K</kbd>
      </div>
      {!selectedCategory && <div className="category-filter">{categories.map((item) => <Link key={item} to={`/category/${encodeURIComponent(item)}`} className="category-filter-chip"><span className={`category-dot dot-${categorySlug(item)}`} />{item}</Link>)}</div>}
      {grouped.length ? grouped.map(([group, list]) => (
        <section className="section-block directory-group" key={group}>
          <SectionTitle title={group} subtitle={`${list.length} ${list.length === 1 ? 'tool' : 'tools'}`} />
          <div className="tool-grid">{list.map((tool) => <ToolCard key={tool.slug} tool={tool} />)}</div>
        </section>
      )) : <div className="empty-state"><Search size={25} /><h2>No tools found</h2><p>Try a different search or explore another category.</p><button className="button button-secondary" onClick={() => setQuery('')}>Clear search</button></div>}
    </div>
  )
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const activeTools = useActiveTools()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const matches = useMemo(() => {
    if (!query.trim()) return activeTools.slice(0, 8)
    const words = query.toLowerCase().trim().split(/\s+/)
    return activeTools.filter((tool) => words.every((word) => `${tool.name} ${tool.category} ${tool.description}`.toLowerCase().includes(word))).slice(0, 10)
  }, [activeTools, query])
  useEffect(() => { inputRef.current?.focus() }, [])
  const openTool = (slug: string) => {
    navigate(`/tools/${slug}`)
    onClose()
  }
  return (
    <div className="search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="search-dialog" role="dialog" aria-modal="true" aria-label="Search developer tools">
        <div className="search-dialog-input"><Search size={19} /><input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }} onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, matches.length - 1)) }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
          if (event.key === 'Enter' && matches[activeIndex]) { event.preventDefault(); openTool(matches[activeIndex].slug) }
        }} placeholder="What are you looking for?" /><kbd>ESC</kbd><button className="icon-button" onClick={onClose} aria-label="Close search"><X size={17} /></button></div>
        <div className="search-dialog-label">{query ? `${matches.length} MATCHING TOOLS` : 'QUICK ACCESS'}</div>
        <div className="search-results">
          {matches.map((tool, index) => <button key={tool.slug} className={`search-result ${activeIndex === index ? 'search-result-active' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => openTool(tool.slug)}>
            <span className={`tool-icon small icon-${categorySlug(tool.category)}`}><ToolIcon name={tool.icon} size={16} /></span>
            <span><strong>{tool.name}</strong><small>{tool.category} · {tool.description}</small></span>
            <kbd>{activeIndex === index ? 'Enter' : ''}</kbd>
          </button>)}
          {!matches.length && <div className="search-empty">No tools match “{query}”. Try another search.</div>}
        </div>
        <div className="search-dialog-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span><span><kbd>↵</kbd> to select</span><span>Made for devs, with care <Sparkles size={12} /></span></div>
      </div>
    </div>
  )
}

const selectOptions = (tool: ToolDefinition) => tool.options ?? []

function ToolPage() {
  const { slug = '' } = useParams()
  const tool = findTool(slug)
  const isEnabled = useAvailability((state) => state.isEnabled(slug))
  const activeTools = useActiveTools()
  const favorites = usePreferences((state) => state.favorites)
  const { recordVisit, toggleFavorite } = useAuth()
  const [input, setInput] = useState(tool?.sample ?? '')
  const [auxiliary, setAuxiliary] = useState(tool?.auxiliarySample ?? '')
  const [choice, setChoice] = useState(tool?.options?.[0] ?? '')
  const [output, setOutput] = useState<ToolResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const editorTheme = usePreferences((state) => state.theme)
  const lastVisited = useRef('')
  const isFavorite = favorites.includes(slug)
  useEffect(() => {
    if (!tool || lastVisited.current === tool.slug) return
    lastVisited.current = tool.slug
    recordVisit(tool.slug)
  }, [tool, recordVisit])

  if (!tool || !isEnabled) return <NotFound />
  const hasEditor = ['code-editor', 'code-formatter', 'javascript-formatter', 'javascript-minifier', 'sql-formatter', 'sql-minifier', 'xml-formatter', 'xml-validator', 'html-live-preview', 'javascript-playground'].includes(tool.slug)
  const language = tool.slug.includes('sql') ? 'sql' : tool.slug.includes('xml') ? 'xml' : tool.slug.includes('html') ? 'html' : choice.toLowerCase() === 'typescript' ? 'typescript' : choice.toLowerCase() === 'json' || tool.slug.startsWith('json') ? 'json' : 'javascript'
  const isPreviewTool = ['html-live-preview', 'javascript-playground'].includes(tool.slug)
  const options = selectOptions(tool)

  const run = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await processTool(tool.slug, input, auxiliary, { choice, indent: choice })
      setOutput(result)
    } catch (caught) {
      setOutput(null)
      setError(caught instanceof Error ? caught.message : 'Something went wrong while processing this input.')
    } finally {
      setBusy(false)
    }
  }
  const reset = () => {
    setInput('')
    setAuxiliary('')
    setOutput(null)
    setError('')
  }
  const copy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output.output)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Clipboard access is unavailable in this browser.')
    }
  }
  const download = () => {
    if (!output) return
    if (output.preview === 'qr') {
      const anchor = document.createElement('a')
      anchor.href = output.output
      anchor.download = `${tool.slug}.png`
      anchor.click()
      toast.success('QR code downloaded')
      return
    }
    const extension = tool.category === 'JSON' || tool.slug.includes('json') ? 'json'
      : tool.slug.includes('html') ? 'html' : tool.slug.includes('css') ? 'css'
        : tool.slug.includes('sql') ? 'sql' : 'txt'
    const blob = new Blob([output.output], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${tool.slug}.${extension}`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Download started')
  }
  const loadSample = () => {
    setInput(tool.sample)
    setAuxiliary(tool.auxiliarySample ?? '')
    setOutput(null)
    setError('')
  }

  return (
    <div className="page-content tool-page">
      <div className="tool-page-heading">
        <div className="tool-heading-main">
          <span className={`tool-icon large icon-${categorySlug(tool.category)}`}><ToolIcon name={tool.icon} size={22} /></span>
          <div><div className="eyebrow">{tool.category}</div><h1>{tool.name}</h1><p>{tool.description}</p></div>
        </div>
        <button className={`button button-secondary favorite-action ${isFavorite ? 'favorited' : ''}`} onClick={() => { void toggleFavorite(tool.slug).catch((caught: unknown) => toast.error(getApiError(caught, 'Could not save this favorite.'))) }}><Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />{isFavorite ? 'Saved' : 'Add to favorites'}</button>
      </div>
      {tool.slug === 'jwt-decoder' && <div className="notice warning-notice"><Shield size={16} /><span><strong>Decode only — not verification.</strong> This tool does not verify the JWT signature or trust the claims.</span></div>}
      {tool.slug === 'ip-lookup' && <div className="notice"><ExternalLink size={16} /><span>This tool sends the entered IP to <strong>ipapi.co</strong>, a third-party lookup service. No API key is required.</span></div>}
      <div className={`workspace-grid ${tool.slug === 'markdown-preview' || tool.slug === 'markdown-editor' ? 'workspace-split' : ''}`}>
        <section className="workspace-panel input-panel">
          <div className="panel-heading"><div><span className="panel-step">01</span><h2>{hasEditor ? 'Editor' : 'Input'}</h2></div><div className="panel-tools"><button className="text-button" onClick={loadSample}>Load sample</button><button className="text-button" onClick={reset}>Clear</button></div></div>
          <div className={`editor-wrap ${hasEditor ? 'monaco-wrap' : ''}`}>
            {hasEditor
              ? <Suspense fallback={<div className="editor-loading">Loading Monaco Editor…</div>}><Editor height="370px" language={language} value={input} onChange={(value) => setInput(value ?? '')} theme={editorTheme === 'dark' ? 'vs-dark' : 'light'} options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', roundedSelection: false, scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, padding: { top: 14 } }} /></Suspense>
              : <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Type or paste your input here..." spellCheck={false} aria-label={`${tool.name} input`} />}
          </div>
          {tool.slug === 'color-picker' && <label className="color-picker-control">Choose a color<input type="color" value={colorInputValue(input)} onChange={(event) => setInput(event.target.value)} /></label>}
          {tool.auxiliaryLabel && <label className="aux-input-label">{tool.auxiliaryLabel}{tool.slug === 'regex-tester' || tool.slug === 'text-diff' || tool.slug.includes('schema') ? <textarea value={auxiliary} onChange={(event) => setAuxiliary(event.target.value)} className="aux-textarea" spellCheck={false} /> : <input value={auxiliary} onChange={(event) => setAuxiliary(event.target.value)} className="aux-inline-input" />}</label>}
          {options.length > 0 && <label className="option-select-label">Options<select value={choice} onChange={(event) => setChoice(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label>}
          {['word-counter', 'character-counter'].includes(tool.slug) && <div className="input-stats"><span>{input.length.toLocaleString()} characters</span><span>{(input.trim().match(/\S+/g) ?? []).length.toLocaleString()} words</span></div>}
          <div className="workspace-actions"><button className="button button-primary run-button" onClick={run} disabled={busy}>{busy ? <span className="spinner" /> : <Sparkles size={15} />}{runLabel(tool.slug)}</button><span className="local-hint">{tool.slug === 'ip-lookup' ? <><ExternalLink size={13} /> Uses ipapi.co</> : <><Shield size={13} /> Processed locally</>}</span></div>
        </section>
        <section className="workspace-panel output-panel">
          <div className="panel-heading"><div><span className="panel-step">02</span><h2>{tool.slug === 'json-validator' || tool.slug === 'xml-validator' ? 'Validation result' : 'Output'}</h2></div><div className="panel-tools"><button className="icon-button small-button" disabled={!output} onClick={copy} aria-label="Copy output" title="Copy output"><Copy size={15} /></button><button className="icon-button small-button" disabled={!output || output.preview === 'qr'} onClick={download} aria-label="Download output" title="Download output"><ArrowDownToLine size={15} /></button></div></div>
          {error ? <div className="error-state"><span className="error-mark">!</span><div><strong>Unable to process input</strong><pre>{error}</pre></div></div> : output ? (
            <div className="output-wrap">
              {output.preview === 'qr' ? <div className="qr-result"><img src={output.output} alt="Generated QR code" /><p>Scan this code to open the encoded content.</p><button className="button button-secondary" onClick={download}>Download PNG</button></div>
                : output.preview === 'json-tree' ? <div className="json-tree"><JsonTree label="root" value={JSON.parse(output.output) as JsonNode} /></div>
                : isMarkdown(tool.slug) ? <div className="markdown-output"><ReactMarkdown>{output.output}</ReactMarkdown></div>
                  : <textarea className="output-textarea" value={output.output} readOnly aria-label={`${tool.name} output`} />}
              {isPreviewTool && <SandboxPreview slug={tool.slug} code={input} />}
              {output && isCssPreviewTool(tool.slug) && <CssPreview code={output.output} />}
            </div>
          ) : isPreviewTool ? <SandboxPreview slug={tool.slug} code={input} /> : <div className="output-empty"><span className="output-empty-icon"><ArrowDownToLine size={20} /></span><strong>Your result will appear here</strong><span>Enter your content, then run the tool.</span></div>}
          <div className="output-meta"><span className={tool.slug === 'ip-lookup' ? 'external-dot' : 'output-live-dot'} />{output ? `${output.output.length.toLocaleString()} output characters` : 'Ready when you are'}<span className={tool.slug === 'ip-lookup' ? 'output-external' : 'output-local'}>{tool.slug === 'ip-lookup' ? 'EXTERNAL' : 'LOCAL'}</span></div>
        </section>
      </div>
      <div className="tool-info-grid">
        <section className="info-card"><div className="info-card-icon"><Activity size={17} /></div><div><h3>How to use</h3><p>Paste or type your content into the input. Adjust the available options, then select <strong>{runLabel(tool.slug)}</strong>. {tool.slug === 'ip-lookup' ? 'The IP address is sent to ipapi.co to complete the lookup.' : 'Your content is processed in this browser and isn’t uploaded.'}</p></div></section>
        <section className="info-card related-card"><div className="info-card-icon"><Wrench size={17} /></div><div><h3>Related tools</h3><div className="related-links">{activeTools.filter((other) => other.category === tool.category && other.slug !== tool.slug).slice(0, 3).map((other) => <Link key={other.slug} to={`/tools/${other.slug}`}>{other.name}<ArrowRight size={13} /></Link>)}</div></div></section>
      </div>
    </div>
  )
}

function isMarkdown(slug: string) {
  return ['markdown-preview', 'markdown-editor'].includes(slug)
}

type JsonNode = null | boolean | number | string | JsonNode[] | { [key: string]: JsonNode }

function JsonTree({ label, value, depth = 0 }: { label: string; value: JsonNode; depth?: number }) {
  const entries = Array.isArray(value)
    ? value.map((child, index) => [String(index), child] as const)
    : value !== null && typeof value === 'object'
      ? Object.entries(value)
      : null
  if (!entries) return <div className="json-tree-leaf"><span className="json-tree-key">{label}</span><span className={`json-value-${value === null ? 'null' : typeof value}`}>{value === null ? 'null' : JSON.stringify(value)}</span></div>
  const kind = Array.isArray(value) ? 'Array' : 'Object'
  return <details className="json-tree-node" open={depth < 2}><summary><span className="json-tree-key">{label}</span><span className="json-tree-type">{kind}</span><span className="json-tree-count">{entries.length} {entries.length === 1 ? 'item' : 'items'}</span></summary><div className="json-tree-children">{entries.map(([key, child]) => <JsonTree key={`${depth}-${key}`} label={key} value={child} depth={depth + 1} />)}</div></details>
}

function runLabel(slug: string) {
  if (slug.includes('generator') || slug === 'uuid-generator' || slug === 'password-generator' || slug === 'qr-generator' || slug === 'unix-timestamp-generator' || slug === 'lorem-ipsum') return 'Generate'
  if (slug.includes('validator') || slug.includes('tester') || slug === 'regex-explainer') return 'Check'
  if (slug === 'ip-lookup') return 'Look up IP'
  if (slug === 'html-live-preview' || slug === 'javascript-playground') return 'Run preview'
  return 'Process'
}

function colorInputValue(value: string) {
  const hex = value.match(/^#?([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (!hex) return '#6366f1'
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`
}

function SandboxPreview({ slug, code }: { slug: string; code: string }) {
  const srcDoc = slug === 'javascript-playground'
    ? `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"><body><script>${code.replace(/<\/script/gi, '<\\/script')}</script></body>`
    : `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><body>${code.replace(/<\/body/gi, '&lt;/body')}</body>`
  return <div className="sandbox-wrap"><div className="sandbox-label"><span className="output-live-dot" /> Isolated preview</div><iframe title="Sandboxed live preview" sandbox="allow-scripts" srcDoc={srcDoc} /></div>
}

function isCssPreviewTool(slug: string) {
  return ['css-gradient-generator', 'box-shadow-generator', 'flexbox-playground', 'css-grid-generator'].includes(slug)
}

function CssPreview({ code }: { code: string }) {
  const declarations = (code.match(/\{([\s\S]*)\}/)?.[1] ?? code).replace(/<\/style/gi, '<\\/style')
  const content = /grid/.test(code)
    ? '<div class="layout"><i>01</i><i>02</i><i>03</i><i>04</i><i>05</i><i>06</i></div>'
    : /flex|justify-content/.test(code)
      ? '<div class="layout"><i>One</i><i>Two</i><i>Three</i></div>'
      : '<div class="sample-card">Live preview</div>'
  const srcDoc = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>body{margin:0;padding:16px;background:#f8fafc;font:13px system-ui;color:#172033}.sample-card{display:grid;min-height:110px;place-items:center;border-radius:12px;background:#6366f1;color:white;font-weight:600;${declarations}}.layout{${declarations}}.layout i{display:grid;min-height:48px;place-items:center;border-radius:6px;background:#7771ef;color:white;font-style:normal}</style>${content}`
  return <div className="sandbox-wrap css-preview"><div className="sandbox-label"><span className="output-live-dot" /> Live CSS preview</div><iframe title="Generated CSS preview" sandbox="" srcDoc={srcDoc} /></div>
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      if (isRegister) await register(String(form.get('name')), String(form.get('email')), String(form.get('password')))
      else await login(String(form.get('email')), String(form.get('password')))
      toast.success(isRegister ? 'Your account is ready.' : 'Welcome back.')
      navigate('/')
    } catch (caught) {
      setError(getApiError(caught, 'Could not authenticate.'))
    } finally {
      setSubmitting(false)
    }
  }
  return <div className="page-content auth-page">
    <div className="auth-card">
      <span className="brand-mark auth-brand"><Command size={20} /></span>
      <div className="eyebrow">DEVTOOLS HUB ACCOUNT</div>
      <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
      <p>{isRegister ? 'Save favorites and sync your recent tools.' : 'Log in to access your saved tools and profile.'}</p>
      <form className="auth-form" onSubmit={submit}>
        {isRegister && <label>Full name<input type="text" name="name" autoComplete="name" required placeholder="Ada Lovelace" /></label>}
        <label>Email address<input type="email" name="email" autoComplete="email" required placeholder="you@example.com" /></label>
        <label>Password<input type="password" name="password" autoComplete={isRegister ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required placeholder="At least 8 characters" /></label>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button type="submit" className="button button-primary auth-submit" disabled={submitting}>{submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'} <ArrowRight size={15} /></button>
      </form>
      <div className="auth-switch">{isRegister ? 'Already have an account?' : 'New to DevTools Hub?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Log in' : 'Create an account'}</Link></div>
      <div className="auth-privacy"><Shield size={14} /> Your tool inputs are never stored in your account.</div>
    </div>
  </div>
}

function ProfilePage() {
  const favorites = usePreferences((state) => state.favorites)
  const recent = usePreferences((state) => state.recent)
  const activeTools = useActiveTools()
  const { user, logout, status } = useAuth()
  const navigate = useNavigate()
  const signOut = async () => {
    try { await logout(); toast.success('You have been logged out.'); navigate('/') }
    catch (error) { toast.error(getApiError(error, 'Could not log out.')) }
  }
  return <div className="page-content"><PageHeading eyebrow="ACCOUNT" title="Your profile" description={user ? 'Your account and saved developer tools.' : 'Your saved tools and recent activity are stored on this device.'} /><div className="profile-summary"><div className="profile-avatar">{user?.name.charAt(0).toUpperCase() ?? 'G'}</div><div><strong>{user?.name ?? 'Guest workspace'}</strong><span>{user?.email ?? (status === 'unavailable' ? 'Account service is unavailable' : 'Local browser preferences')}</span></div>{user ? <button className="button button-secondary" onClick={() => void signOut()}>Log out</button> : <Link to="/register" className="button button-primary">Create account</Link>}</div>{user?.role === 'admin' && <Link to="/admin" className="button button-secondary admin-link">Open admin dashboard <ArrowRight size={14} /></Link>}<SectionTitle title="Saved tools" /><div className="tool-grid">{favorites.length ? favorites.map((slug) => findTool(slug)).filter((tool): tool is ToolDefinition => !!tool && activeTools.some((active) => active.slug === tool.slug)).map((tool) => <ToolCard key={tool.slug} tool={tool} />) : <p className="subtle-copy">Use the heart on any tool to save it here.</p>}</div><div className="profile-recent"><SectionTitle title="Recent tools" /><div className="tool-grid">{recent.length ? recent.map((slug) => findTool(slug)).filter((tool): tool is ToolDefinition => !!tool && activeTools.some((active) => active.slug === tool.slug)).map((tool) => <ToolCard key={tool.slug} tool={tool} />) : <p className="subtle-copy">Tools you open will appear here.</p>}</div></div></div>
}

function AdminPage() {
  const { user, status } = useAuth()
  const setToolEnabled = useAvailability((state) => state.setToolEnabled)
  const [data, setData] = useState<{ stats: { totalUsers: number; activeTools: number; totalTools: number; totalActivity: number }; popularTools: Array<{ name: string; slug: string; category: string; usageCount: number; isActive: boolean }> } | null>(null)
  const [users, setUsers] = useState<Array<{ _id: string; name: string; email: string; role: 'user' | 'admin'; createdAt: string }>>([])
  const [adminTools, setAdminTools] = useState<Array<{ name: string; slug: string; category: string; isActive: boolean; usageCount: number }>>([])
  const [error, setError] = useState('')
  const [view, setView] = useState<'overview' | 'users' | 'tools'>('overview')
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    if (user?.role !== 'admin') return
    let active = true
    void Promise.all([api.get('/admin/stats'), api.get('/admin/tools'), api.get('/admin/users')])
      .then(([stats, toolResult, userResult]) => {
        if (!active) return
        setData(stats.data)
        setAdminTools(toolResult.data.tools)
        setUsers(userResult.data.users)
        setError('')
      })
      .catch((caught: unknown) => {
        if (active) setError(getApiError(caught, 'Could not load administrator data.'))
      })
    return () => { active = false }
  }, [user?.role, refreshKey])
  if (status === 'loading') return <div className="page-content"><p className="subtle-copy">Checking administrator access…</p></div>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <div className="page-content"><PageHeading eyebrow="403 · FORBIDDEN" title="Administrator access required" description="This area is only available to administrator accounts." /><Link to="/profile" className="button button-secondary">Back to profile</Link></div>
  const updateTool = async (slug: string, isActive: boolean) => {
    try {
      const { data: result } = await api.patch(`/admin/tools/${encodeURIComponent(slug)}`, { isActive })
      setAdminTools((existing) => existing.map((tool) => tool.slug === slug ? result.tool : tool))
      setToolEnabled(slug, isActive)
    } catch (caught) { toast.error(getApiError(caught, 'Could not update tool status.')) }
  }
  const updateRole = async (id: string, role: 'user' | 'admin') => {
    try {
      const { data: result } = await api.patch(`/admin/users/${encodeURIComponent(id)}/role`, { role })
      setUsers((existing) => existing.map((item) => item._id === id ? result.user : item))
    } catch (caught) { toast.error(getApiError(caught, 'Could not update user role.')) }
  }
  return <div className="page-content"><PageHeading eyebrow="ADMINISTRATION" title="Platform overview" description="Manage tools, users, and platform activity." action={<button className="button button-secondary" onClick={() => setRefreshKey((key) => key + 1)}>Refresh</button>} />
    {error && <div className="admin-error" role="alert">{error}{error.includes('administrator') && <Link to="/profile">Return to profile</Link>}</div>}
    <div className="admin-tabs">{(['overview', 'users', 'tools'] as const).map((item) => <button key={item} className={view === item ? 'selected' : ''} onClick={() => setView(item)}>{item === 'overview' ? 'Overview' : item === 'users' ? `Users (${users.length})` : `Tools (${adminTools.length})`}</button>)}</div>
    {view === 'overview' && <><div className="admin-stats">{[['Registered users', data?.stats.totalUsers], ['Active tools', data?.stats.activeTools], ['Total tool usage', data?.stats.totalActivity]].map(([label, value]) => <div key={String(label)}><span>{label}</span><strong>{value ?? '—'}</strong><small>Platform statistics from MongoDB</small></div>)}</div><SectionTitle title="Most used tools" /><div className="admin-table"><div className="admin-table-head"><span>Tool</span><span>Category</span><span>Uses</span><span>Status</span></div>{data?.popularTools.map((tool) => <div className="admin-table-row" key={tool.slug}><strong>{tool.name}</strong><span>{tool.category}</span><span>{tool.usageCount}</span><span>{tool.isActive ? 'Active' : 'Disabled'}</span></div>)}</div></>}
    {view === 'users' && <div className="admin-table"><div className="admin-table-head"><span>User</span><span>Email</span><span>Joined</span><span>Role</span></div>{users.map((item) => <div className="admin-table-row" key={item._id}><strong>{item.name}</strong><span>{item.email}</span><span>{new Date(item.createdAt).toLocaleDateString()}</span><select value={item.role} onChange={(event) => void updateRole(item._id, event.target.value as 'user' | 'admin')} disabled={item._id === user.id}><option value="user">User</option><option value="admin">Admin</option></select></div>)}</div>}
    {view === 'tools' && <div className="admin-table"><div className="admin-table-head"><span>Tool</span><span>Category</span><span>Usage</span><span>Availability</span></div>{adminTools.map((tool) => <div className="admin-table-row" key={tool.slug}><strong>{tool.name}</strong><span>{tool.category}</span><span>{tool.usageCount}</span><button className={`status-toggle ${tool.isActive ? 'status-enabled' : ''}`} onClick={() => void updateTool(tool.slug, !tool.isActive)}>{tool.isActive ? 'Active' : 'Disabled'}</button></div>)}</div>}
  </div>
}

function NotFound() {
  return <div className="page-content not-found"><div className="eyebrow">404 · NOT FOUND</div><h1>This page wandered off.</h1><p>The page or tool you’re looking for doesn’t exist.</p><Link to="/tools" className="button button-primary">Browse all tools <ArrowRight size={15} /></Link></div>
}

function App() {
  return <BrowserRouter><AuthProvider><AppFrame /></AuthProvider></BrowserRouter>
}

export default App

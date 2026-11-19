import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, ArrowDown, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown, Clock3, ExternalLink, Eye, Globe2, LayoutDashboard, LogOut, Menu, MousePointer2, Search, Settings2, ShieldCheck, Smartphone, Users, Wrench, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/useAuth'
import { useAvailability } from '../state/availability'
import { api, getApiError } from '../services/api'
import { findTool, tools as toolCatalog } from '../tools/catalog'
import './AdminDashboard.css'

type Section = 'overview' | 'visitors' | 'pages' | 'tools' | 'traffic' | 'audience' | 'search' | 'settings'
type RangeMode = 'today' | '7d' | '30d' | '90d' | 'custom'
type Granularity = 'day' | 'week' | 'month'
type SeriesPoint = { date: string; sessions: number; uniqueVisitors: number; pageViews: number }
type ToolMetric = { slug: string; clicks: number; executions: number; successes: number; failures: number; successRate: number | null }
type ToolTrend = { slug: string; date: string; clicks: number; executions: number }
type PageMetric = { path: string; views: number; uniqueVisitors: number; averageEngagementMs: number }
type DistributionRow = { country?: string; device?: string; browser?: string; operatingSystem?: string; source?: string; sessions: number; visitors?: number }
type AnalyticsReport = {
  range: { start: string; end: string }
  summary: {
    totalVisitors: number
    uniqueVisitors: number
    newVisitors: number
    returningVisitors: number
    pageViews: number
    activeVisitors: number
    toolClicks: number
    toolExecutions: number
    successfulExecutions: number
    failedExecutions: number
    averageSessionDurationMs: number
    bounceRate: number
    completedSessions: number
  }
  series: SeriesPoint[]
  pages: PageMetric[]
  tools: ToolMetric[]
  toolTrends: ToolTrend[]
  trafficSources: DistributionRow[]
  campaigns: Array<{ source: string; medium: string; name: string; sessions: number }>
  audience: {
    countries: DistributionRow[]
    devices: DistributionRow[]
    browsers: DistributionRow[]
    operatingSystems: DistributionRow[]
  }
  search: { searches: number; zeroResultSearches: number; zeroResultRate: number; averageQueryLength: number }
  recentActivity: Array<{ type: string; timestamp: string; path?: string; toolSlug?: string; success?: boolean }>
  methodology: Record<string, string>
}
type AdminSettings = {
  retentionDays: number
  sessionTimeoutMinutes: number
  activeWindowSeconds: number
  countryConfigured: boolean
  googleSearchConsoleConfigured: boolean
}
type SearchConsoleStatus = { configured: boolean; connected: boolean; propertyUrl: string | null; connectedAt: string | null }
type SearchConsoleReport = {
  clicks: number
  impressions: number
  ctr: number
  averagePosition: number
  topQueries: Array<{ query: string; clicks: number; impressions: number; ctr: number; position: number }>
  topPages: Array<{ page: string; clicks: number; impressions: number; ctr: number; position: number }>
}
type ToolAdminItem = { name: string; slug: string; category: string; isActive: boolean; usageCount: number }

const sections: Array<{ id: Section; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'visitors', label: 'Visitors', icon: Users },
  { id: 'pages', label: 'Page analytics', icon: Eye },
  { id: 'tools', label: 'Tool performance', icon: Wrench },
  { id: 'traffic', label: 'Traffic sources', icon: Globe2 },
  { id: 'audience', label: 'Audience & devices', icon: Smartphone },
  { id: 'search', label: 'Search analytics', icon: Search },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

function localDate(date: Date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function defaultRange(mode: RangeMode) {
  const today = new Date()
  const end = localDate(today)
  const days = mode === 'today' ? 0 : mode === '30d' ? 29 : mode === '90d' ? 89 : 6
  const startDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - days))
  return { startDate: localDate(startDate), endDate: end }
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function formatDuration(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m ${remainder}s`
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`
}

function metricValue(value: number | null | undefined) {
  return typeof value === 'number' ? formatNumber(value) : '—'
}

function lineChartPath(points: SeriesPoint[], metric: keyof Pick<SeriesPoint, 'sessions' | 'uniqueVisitors' | 'pageViews'>) {
  const width = 720
  const height = 190
  const inset = 12
  const values = points.map((point) => point[metric])
  const max = Math.max(...values, 1)
  const coords = values.map((value, index) => {
    const x = points.length < 2 ? width / 2 : inset + (index * (width - inset * 2)) / (points.length - 1)
    const y = height - inset - ((value / max) * (height - inset * 2))
    return [x, y] as const
  })
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const first = coords[0]
  const last = coords.at(-1)
  const area = first && last ? `${line} L${last[0]} ${height - inset} L${first[0]} ${height - inset} Z` : ''
  return { line, area, max, width, height }
}

function TrendChart({ points, metric, onMetricChange }: {
  points: SeriesPoint[]
  metric: 'sessions' | 'uniqueVisitors' | 'pageViews'
  onMetricChange: (metric: 'sessions' | 'uniqueVisitors' | 'pageViews') => void
}) {
  const chart = useMemo(() => lineChartPath(points, metric), [metric, points])
  return <section className="admin-panel trend-panel">
    <div className="admin-panel-heading">
      <div><h2>Activity over time</h2><p>First-party visits and page views by day.</p></div>
      <label className="admin-select"><span className="sr-only">Chart metric</span><select value={metric} onChange={(event) => onMetricChange(event.target.value as typeof metric)}><option value="sessions">Visitors (sessions)</option><option value="uniqueVisitors">Unique visitors</option><option value="pageViews">Page views</option></select><ChevronDown size={14} /></label>
    </div>
    {points.length ? <>
      <div className="admin-chart">
        <div className="admin-chart-axis"><span>{formatNumber(chart.max)}</span><span>{formatNumber(Math.round(chart.max / 2))}</span><span>0</span></div>
        <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Selected website activity over time">
          <defs><linearGradient id="admin-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".22" /><stop offset="100%" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
          <path className="admin-chart-area" d={chart.area} />
          <path className="admin-chart-line" d={chart.line} />
        </svg>
      </div>
      <div className="admin-chart-dates"><span>{points[0]?.date}</span><span>{points.at(-1)?.date}</span></div>
    </> : <EmptyState>No activity in this date range.</EmptyState>}
  </section>
}

function MetricCard({ label, value, note, icon: Icon, tone = 'blue' }: {
  label: string
  value: string
  note?: string
  icon: typeof Activity
  tone?: 'blue' | 'green' | 'violet' | 'amber'
}) {
  return <article className="analytics-metric">
    <span className={`analytics-metric-icon tone-${tone}`}><Icon size={17} /></span>
    <span className="analytics-metric-label">{label}</span>
    <strong>{value}</strong>
    {note && <small>{note}</small>}
  </article>
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>
}

function DataTable({ columns, rows, emptyText }: {
  columns: string[]
  rows: ReactNode[][]
  emptyText: string
}) {
  return <div className="admin-table-wrap">
    {rows.length ? <table className="analytics-table">
      <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
    </table> : <EmptyState>{emptyText}</EmptyState>}
  </div>
}

function AdminLogin({ unavailable, onLogin }: { unavailable: boolean; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onLogin(email, password)
    } catch (caught) {
      setError(getApiError(caught, 'Administrator sign-in failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="admin-login">
    <div className="admin-login-card">
      <div className="admin-login-brand"><span className="admin-brand-mark"><ShieldCheck size={19} /></span><span>DevTools Hub <small>PRIVATE ANALYTICS</small></span></div>
      <p className="admin-eyebrow">ADMINISTRATOR ACCESS</p>
      <h1>Sign in to analytics</h1>
      <p className="admin-login-copy">This area is private. Public tools do not require an account.</p>
      {unavailable && <div className="admin-notice" role="status">The account service is currently unavailable. Check the API and MongoDB connection.</div>}
      <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
        <label>Email address<input type="email" autoComplete="username" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <div className="admin-error" role="alert">{error}</div>}
        <button className="admin-primary-button" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}<ArrowUpRight size={15} /></button>
      </form>
      <Link to="/" className="admin-back-link">Return to public tools</Link>
    </div>
  </main>
}

export default function AdminDashboard() {
  const { user, status, login, logout } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [section, setSection] = useState<Section>(() => {
    const requested = searchParams.get('section')
    return sections.some((item) => item.id === requested) ? requested as Section : 'overview'
  })
  const [rangeMode, setRangeMode] = useState<RangeMode>('7d')
  const defaultDates = defaultRange('7d')
  const [startDate, setStartDate] = useState(defaultDates.startDate)
  const [endDate, setEndDate] = useState(defaultDates.endDate)
  const [todayValue] = useState(() => localDate(new Date()))
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [metric, setMetric] = useState<'sessions' | 'uniqueVisitors' | 'pageViews'>('sessions')
  const [report, setReport] = useState<AnalyticsReport | null>(null)
  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [searchConsoleStatus, setSearchConsoleStatus] = useState<SearchConsoleStatus | null>(null)
  const [searchConsoleReport, setSearchConsoleReport] = useState<SearchConsoleReport | null>(null)
  const [adminTools, setAdminTools] = useState<ToolAdminItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const setToolEnabled = useAvailability((state) => state.setToolEnabled)
  const selectedSection = sections.find((item) => item.id === section) ?? sections[0]

  const queryString = useMemo(() => new URLSearchParams({
    startDate,
    endDate,
    granularity,
  }).toString(), [endDate, granularity, startDate])

  useEffect(() => {
    const gscStatus = searchParams.get('gsc')
    if (!gscStatus) return
    if (gscStatus === 'connected') toast.success('Google Search Console connected.')
    else toast.error('Google Search Console could not be connected.')
    const next = new URLSearchParams(searchParams)
    next.delete('gsc')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (status !== 'authenticated' || user?.role !== 'admin') return
    let active = true
    const load = async () => {
      setLoading(true)
      try {
        const [analytics, settingsResult, consoleResult] = await Promise.all([
          api.get<AnalyticsReport>(`/admin/analytics?${queryString}`),
          api.get<AdminSettings>('/admin/settings'),
          api.get<SearchConsoleStatus>('/admin/search-console/status'),
        ])
        if (!active) return
        setReport(analytics.data)
        setSettings(settingsResult.data)
        setSearchConsoleStatus(consoleResult.data)
        setError('')
      } catch (caught) {
        if (active) setError(getApiError(caught, 'Analytics could not be loaded.'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRefreshKey((key) => key + 1)
    }, 30_000)
    return () => {
      active = false
      window.clearInterval(refresh)
    }
  }, [queryString, refreshKey, status, user?.role])

  useEffect(() => {
    if (status !== 'authenticated' || user?.role !== 'admin' || section !== 'search' || !searchConsoleStatus?.connected) {
      return
    }
    let active = true
    void api.get<SearchConsoleReport>(`/admin/search-console/report?${queryString}`)
      .then(({ data }) => { if (active) setSearchConsoleReport(data) })
      .catch((caught: unknown) => {
        if (!active) return
        setSearchConsoleReport(null)
        setError(getApiError(caught, 'Search Console data could not be loaded.'))
      })
    return () => { active = false }
  }, [queryString, section, searchConsoleStatus?.connected, status, user?.role, refreshKey])

  useEffect(() => {
    if (status !== 'authenticated' || user?.role !== 'admin' || section !== 'settings') return
    void api.get<{ tools: ToolAdminItem[] }>('/admin/tools')
      .then(({ data }) => setAdminTools(data.tools))
      .catch((caught: unknown) => toast.error(getApiError(caught, 'Tool settings could not be loaded.')))
  }, [section, status, user?.role])

  const chooseSection = (nextSection: Section) => {
    setSection(nextSection)
    setMobileNavOpen(false)
    const next = new URLSearchParams(searchParams)
    next.set('section', nextSection)
    setSearchParams(next, { replace: true })
  }

  const changeRange = (mode: RangeMode) => {
    setRangeMode(mode)
    if (mode !== 'custom') {
      const dates = defaultRange(mode)
      setStartDate(dates.startDate)
      setEndDate(dates.endDate)
    }
  }

  const beginSearchConsoleConnection = async () => {
    try {
      const { data } = await api.post<{ authorizationUrl: string }>('/admin/search-console/connect')
      window.location.assign(data.authorizationUrl)
    } catch (caught) {
      toast.error(getApiError(caught, 'Google Search Console could not be connected.'))
    }
  }

  const disconnectSearchConsole = async () => {
    if (!window.confirm('Disconnect the saved Google Search Console property?')) return
    try {
      await api.delete('/admin/search-console')
      setSearchConsoleStatus((current) => current ? { ...current, connected: false, connectedAt: null } : null)
      setSearchConsoleReport(null)
      toast.success('Google Search Console disconnected.')
    } catch (caught) {
      toast.error(getApiError(caught, 'Google Search Console could not be disconnected.'))
    }
  }

  const updateTool = async (tool: ToolAdminItem) => {
    try {
      const { data } = await api.patch<{ tool: ToolAdminItem }>(`/admin/tools/${encodeURIComponent(tool.slug)}`, { isActive: !tool.isActive })
      setAdminTools((existing) => existing.map((item) => item.slug === tool.slug ? data.tool : item))
      setToolEnabled(tool.slug, data.tool.isActive)
    } catch (caught) {
      toast.error(getApiError(caught, 'Tool availability could not be updated.'))
    }
  }

  const handleLogin = async (email: string, password: string) => {
    await login(email, password)
  }
  const handleLogout = async () => {
    try {
      await logout()
      navigate('/')
    } catch (caught) {
      toast.error(getApiError(caught, 'Could not sign out.'))
    }
  }

  if (status === 'loading') return <div className="admin-console"><div className="admin-loading"><span className="admin-spinner" />Checking administrator access…</div></div>
  if (!user) return <div className="admin-console"><AdminLogin unavailable={status === 'unavailable'} onLogin={handleLogin} /></div>
  if (user.role !== 'admin') return <div className="admin-console"><main className="admin-access-denied"><ShieldCheck size={28} /><h1>Administrator access required</h1><p>This area is only available to the provisioned site administrator.</p><Link to="/" className="admin-primary-button">Return to public tools</Link></main></div>

  const summary = report?.summary
  const topTools = [...(report?.tools ?? [])].sort((a, b) => b.clicks + b.executions - (a.clicks + a.executions)).slice(0, 5)
  const toolMetricsBySlug = new Map((report?.tools ?? []).map((tool) => [tool.slug, tool]))
  const allToolMetrics = toolCatalog.map((tool) => toolMetricsBySlug.get(tool.slug) ?? { slug: tool.slug, clicks: 0, executions: 0, successes: 0, failures: 0, successRate: null })
  const lowestTools = [...allToolMetrics].sort((a, b) => a.clicks + a.executions - (b.clicks + b.executions)).slice(0, 5)
  const dateLabel = startDate === endDate ? startDate : `${startDate} – ${endDate}`

  return <div className="admin-console">
    <div className="admin-layout">
      {mobileNavOpen && <button className="admin-nav-backdrop" aria-label="Close admin navigation" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`admin-sidebar ${mobileNavOpen ? 'admin-sidebar-open' : ''}`}>
        <Link to="/" className="admin-brand"><span className="admin-brand-mark"><BarChart3 size={18} /></span><span>DevTools Hub<small>ADMIN ANALYTICS</small></span></Link>
        <div className="admin-nav-label">ANALYTICS</div>
        <nav aria-label="Analytics sections">
          {sections.map(({ id, label, icon: Icon }) => <button key={id} className={`admin-nav-item ${section === id ? 'admin-nav-selected' : ''}`} onClick={() => chooseSection(id)}><Icon size={17} /><span>{label}</span>{id === 'overview' && <span className="admin-nav-live" title="Data refreshes automatically" />}</button>)}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-private-note"><ShieldCheck size={15} /><span>Private to your administrator account</span></div>
          <button className="admin-logout-button" onClick={() => void handleLogout()}><LogOut size={15} />Sign out</button>
          <Link to="/" className="admin-public-link">Back to public tools <ArrowUpRight size={13} /></Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <button className="admin-mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open admin navigation"><Menu size={19} /></button>
          <div className="admin-breadcrumb"><span>Analytics</span><span>/</span><strong>{selectedSection.label}</strong></div>
          <div className="admin-header-actions">
            <span className="admin-date-label"><CalendarDays size={14} />{dateLabel}</span>
            <button className="admin-refresh" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}><Activity size={15} />{loading ? 'Updating' : 'Refresh'}</button>
          </div>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div><p className="admin-eyebrow">DEVTOOLS HUB / PRIVATE</p><h1>{section === 'overview' ? 'Analytics overview' : selectedSection.label}</h1><p>{sectionDescription(section)}</p></div>
            <div className="admin-range-control">
              <label><span className="sr-only">Date range</span><select value={rangeMode} onChange={(event) => changeRange(event.target.value as RangeMode)}><option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="custom">Custom range</option></select><ChevronDown size={14} /></label>
              {rangeMode === 'custom' && <div className="admin-custom-range"><input type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Start date" /><span>to</span><input type="date" value={endDate} min={startDate} max={todayValue} onChange={(event) => setEndDate(event.target.value)} aria-label="End date" /></div>}
            </div>
          </div>
          {error && <div className="admin-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
          {!report && loading ? <div className="admin-loading-inline"><span className="admin-spinner" />Loading analytics from MongoDB…</div>
            : !report ? <div className="admin-notice" role="status">Analytics data is unavailable. Confirm MongoDB and the API are configured.</div>
              : <>
                {section === 'overview' && <section>
                  <div className="analytics-metrics-grid">
                    <MetricCard label="Total visitors" value={metricValue(summary?.totalVisitors)} note="Anonymous sessions" icon={Users} />
                    <MetricCard label="Unique visitors" value={metricValue(summary?.uniqueVisitors)} note="Random first-party IDs" icon={Globe2} tone="violet" />
                    <MetricCard label="Page views" value={metricValue(summary?.pageViews)} note="Route visits" icon={Eye} tone="green" />
                    <MetricCard label="Active visitors" value={metricValue(summary?.activeVisitors)} note={`Heartbeat · ${settings?.activeWindowSeconds ?? 60}s window`} icon={Activity} tone="amber" />
                    <MetricCard label="Tool clicks" value={metricValue(summary?.toolClicks)} note="Tool opens, separate from runs" icon={MousePointer2} />
                    <MetricCard label="Successful executions" value={metricValue(summary?.successfulExecutions)} note={`${metricValue(summary?.failedExecutions)} failed`} icon={Check} tone="green" />
                    <MetricCard label="Average session" value={formatDuration(summary?.averageSessionDurationMs ?? 0)} note="Heartbeat-based estimate" icon={Clock3} tone="violet" />
                    <MetricCard label="Bounce rate" value={formatPercent(summary?.bounceRate ?? 0)} note={`${formatNumber(summary?.completedSessions ?? 0)} completed sessions`} icon={ArrowDown} tone="amber" />
                  </div>
                  <TrendChart points={report.series} metric={metric} onMetricChange={setMetric} />
                  <div className="admin-two-column">
                    <section className="admin-panel"><PanelHeading title="Top performing tools" subtitle="Clicks and completed runs in this period." /><DataTable columns={['Tool', 'Clicks', 'Runs', 'Success']} rows={topTools.map((tool) => [findTool(tool.slug)?.name ?? tool.slug, formatNumber(tool.clicks), formatNumber(tool.executions), tool.successRate === null ? '—' : formatPercent(tool.successRate)])} emptyText="Tool activity will appear here." /></section>
                    <section className="admin-panel"><PanelHeading title="Most visited pages" subtitle="Public routes with the most page views." /><DataTable columns={['Page', 'Views', 'Visitors']} rows={report.pages.slice(0, 5).map((page) => [page.path, formatNumber(page.views), formatNumber(page.uniqueVisitors)])} emptyText="Page views will appear here." /></section>
                  </div>
                  <section className="admin-panel"><PanelHeading title="Recent activity" subtitle="Page visits and tool activity. No input text or code is collected." /><ActivityList items={report.recentActivity} /></section>
                </section>}

                {section === 'visitors' && <section>
                  <div className="analytics-metrics-grid visitor-metrics">
                    <MetricCard label="Visitors" value={metricValue(summary?.totalVisitors)} note="Sessions started in this range" icon={Users} />
                    <MetricCard label="Unique" value={metricValue(summary?.uniqueVisitors)} note="Distinct anonymous browser IDs" icon={Globe2} tone="violet" />
                    <MetricCard label="New visitors" value={metricValue(summary?.newVisitors)} note="First seen in selected range" icon={ArrowUpRight} tone="green" />
                    <MetricCard label="Returning" value={metricValue(summary?.returningVisitors)} note="First seen before this range" icon={Activity} tone="amber" />
                    <MetricCard label="Active now" value={metricValue(summary?.activeVisitors)} note="Recent heartbeat, not a live socket" icon={Clock3} />
                  </div>
                  <section className="admin-panel"><div className="admin-panel-heading"><PanelHeading title="Visitor trends" subtitle={report.methodology.totalVisitors} /><label className="admin-select"><span className="sr-only">Visitor grouping</span><select value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select><ChevronDown size={14} /></label></div><TrendChart points={report.series} metric="uniqueVisitors" onMetricChange={() => undefined} /></section>
                  <div className="admin-methodology"><Clock3 size={15} /><div><strong>How active visitors and session duration are estimated</strong><p>{report.methodology.activeVisitors} {report.methodology.averageSessionDuration}</p></div></div>
                  <div className="admin-methodology"><Activity size={15} /><div><strong>Bounce rate definition</strong><p>{report.methodology.bounceRate} It is not a real-time final figure for active sessions.</p></div></div>
                </section>}

                {section === 'pages' && <section className="admin-panel"><PanelHeading title="Page performance" subtitle="Only route paths are recorded; query strings and fragments are discarded." /><DataTable columns={['Page', 'Views', 'Unique visitors', 'Avg. active time']} rows={report.pages.map((page) => [<code key={page.path}>{page.path}</code>, formatNumber(page.views), formatNumber(page.uniqueVisitors), formatDuration(page.averageEngagementMs)])} emptyText="No page views in this period." /><p className="admin-table-note">Active time is based on visible-tab heartbeats and may be lower than elapsed time in a background tab.</p></section>}

                {section === 'tools' && <section className="admin-panel"><PanelHeading title="Tool performance" subtitle="Opens are tracked separately from successful and failed executions." /><DataTable columns={['Tool', 'Category', 'Clicks', 'Executions', 'Successes', 'Failures', 'Success rate']} rows={allToolMetrics.map((tool) => [findTool(tool.slug)?.name ?? tool.slug, findTool(tool.slug)?.category ?? '—', formatNumber(tool.clicks), formatNumber(tool.executions), formatNumber(tool.successes), formatNumber(tool.failures), tool.successRate === null ? '—' : formatPercent(tool.successRate)])} emptyText="No available tools." /><div className="admin-two-column admin-ranking-panels"><RankingPanel title="Most used" rows={topTools.map((tool) => ({ label: findTool(tool.slug)?.name ?? tool.slug, value: tool.clicks + tool.executions }))} /><RankingPanel title="Least used" rows={lowestTools.map((tool) => ({ label: findTool(tool.slug)?.name ?? tool.slug, value: tool.clicks + tool.executions }))} /></div><section className="admin-panel"><PanelHeading title="Tool usage trends" subtitle="Daily, weekly, or monthly activity for the most-used tools." /><DataTable columns={['Date', 'Tool', 'Clicks', 'Executions']} rows={report.toolTrends.slice(0, 50).map((row) => [row.date.slice(0, 10), findTool(row.slug)?.name ?? row.slug, formatNumber(row.clicks), formatNumber(row.executions)])} emptyText="Tool trends will appear after events are recorded." /></section></section>}

                {section === 'traffic' && <section>
                  <div className="admin-two-column"><section className="admin-panel"><PanelHeading title="Traffic source breakdown" subtitle="Campaign parameters take precedence over referrer classification." /><DistributionList rows={report.trafficSources.map((row) => ({ label: titleCase(row.source ?? 'unknown'), value: row.sessions }))} total={report.trafficSources.reduce((sum, row) => sum + row.sessions, 0)} emptyText="Traffic sources will appear here." /></section><section className="admin-panel"><PanelHeading title="Campaign performance" subtitle="UTM source, medium, and campaign values." /><DataTable columns={['Source', 'Medium', 'Campaign', 'Sessions']} rows={report.campaigns.map((row) => [row.source, row.medium || '—', row.name || '—', formatNumber(row.sessions)])} emptyText="No UTM campaign traffic in this period." /></section></div>
                  <div className="admin-methodology"><Globe2 size={15} /><div><strong>Source classification</strong><p>Direct means no referrer; organic includes recognized search engines; social includes common social domains; campaign uses UTM source, medium, or campaign; remaining referrers are referrals. Only the referrer hostname is stored.</p></div></div>
                </section>}

                {section === 'audience' && <section>
                  {!settings?.countryConfigured && <div className="admin-notice"><Globe2 size={15} />Country reporting is unavailable until a trusted reverse proxy country header is configured. Raw IP addresses are never stored.</div>}
                  <div className="admin-two-column">
                    <DistributionPanel title="Countries" rows={report.audience.countries.map((row) => ({ label: row.country === 'unknown' ? 'Unknown / not configured' : row.country ?? 'Unknown', value: row.visitors ?? 0 }))} />
                    <DistributionPanel title="Device categories" rows={report.audience.devices.map((row) => ({ label: titleCase(row.device ?? 'unknown'), value: row.sessions }))} />
                    <DistributionPanel title="Browsers" rows={report.audience.browsers.map((row) => ({ label: row.browser ?? 'Unknown', value: row.sessions }))} />
                    <DistributionPanel title="Operating systems" rows={report.audience.operatingSystems.map((row) => ({ label: row.operatingSystem ?? 'Unknown', value: row.sessions }))} />
                  </div>
                </section>}

                {section === 'search' && <section>
                  <div className="admin-two-column search-overview">
                    <MetricCard label="On-site searches" value={metricValue(report.search.searches)} note="Search interactions; text is not retained" icon={Search} />
                    <MetricCard label="No-result rate" value={formatPercent(report.search.zeroResultRate)} note={`${formatNumber(report.search.zeroResultSearches)} searches returned no tools`} icon={BarChart3} tone="amber" />
                    <MetricCard label="Average query length" value={`${report.search.averageQueryLength} chars`} note="Length only; no search terms stored" icon={Activity} tone="violet" />
                  </div>
                  <SearchConsolePanel
                    status={searchConsoleStatus}
                    report={searchConsoleReport}
                    onConnect={() => void beginSearchConsoleConnection()}
                    onDisconnect={() => void disconnectSearchConsole()}
                  />
                </section>}

                {section === 'settings' && <section>
                  <div className="admin-two-column settings-cards">
                    <SettingsCard label="Anonymous analytics retention" value={`${settings?.retentionDays ?? 180} days`} description="Expired event, visitor, and session records are removed automatically by MongoDB TTL indexes." />
                    <SettingsCard label="Session timeout" value={`${settings?.sessionTimeoutMinutes ?? 30} minutes`} description="Inactivity timeout used to complete sessions and calculate the bounce rate." />
                    <SettingsCard label="Active visitor window" value={`${settings?.activeWindowSeconds ?? 60} seconds`} description="Visitors with a heartbeat during this window are counted as active." />
                    <SettingsCard label="IP address handling" value="Not stored" description="Country can be read from a configured trusted proxy header. The API does not persist raw IP addresses." />
                  </div>
                  <section className="admin-panel tool-settings"><PanelHeading title="Public tool availability" subtitle="All tools remain free; disabling one hides it from the public directory." /><DataTable columns={['Tool', 'Category', 'Availability']} rows={adminTools.map((tool) => [tool.name, tool.category, <button key={tool.slug} className={`admin-status-button ${tool.isActive ? 'is-on' : ''}`} onClick={() => void updateTool(tool)}>{tool.isActive ? 'Available' : 'Disabled'}<span /></button>])} emptyText="Loading tool settings…" /></section>
                  <div className="admin-methodology"><ShieldCheck size={15} /><div><strong>Privacy-first collection</strong><p>Tool inputs, outputs, passwords, full user-agent strings, raw IP addresses, and typed search terms are not recorded. Visitor identifiers are HMAC-hashed by the API.</p></div></div>
                </section>}
              </>}
        </div>
      </main>
    </div>
  </div>
}

function sectionDescription(section: Section) {
  const descriptions: Record<Section, string> = {
    overview: 'A clear view of how visitors find and use your developer tools.',
    visitors: 'Anonymous sessions and heartbeat-based activity estimates.',
    pages: 'Page views and time spent in a visible tab.',
    tools: 'Tool opens and execution outcomes, counted separately.',
    traffic: 'First-party source classification and campaign attribution.',
    audience: 'Coarse country, device, browser, and operating system totals.',
    search: 'Privacy-preserving site search metrics and Google Search Console.',
    settings: 'Tracking behavior, retention, privacy, and public tool availability.',
  }
  return descriptions[section]
}

function PanelHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return <div className="admin-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
}

function ActivityList({ items }: { items: AnalyticsReport['recentActivity'] }) {
  if (!items.length) return <EmptyState>No recent activity for this period.</EmptyState>
  return <div className="activity-list">{items.map((item, index) => <div className="activity-row" key={`${item.timestamp}-${index}`}>
    <span className={`activity-type-icon activity-${item.type}`}><Activity size={14} /></span>
    <div><strong>{activityLabel(item)}</strong><span>{item.path ?? item.toolSlug ?? 'Public site'}</span></div>
    <time dateTime={item.timestamp}>{new Date(item.timestamp).toLocaleString()}</time>
  </div>)}</div>
}

function activityLabel(item: AnalyticsReport['recentActivity'][number]) {
  if (item.type === 'page_view') return 'Page viewed'
  if (item.type === 'tool_click') return `Opened ${findTool(item.toolSlug ?? '')?.name ?? item.toolSlug ?? 'a tool'}`
  if (item.type === 'tool_execution') return `${item.success ? 'Successful' : 'Failed'} run: ${findTool(item.toolSlug ?? '')?.name ?? item.toolSlug ?? 'tool'}`
  if (item.type === 'search') return 'Searched the tool directory'
  return 'Page activity'
}

function RankingPanel({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return <section className="admin-panel"><PanelHeading title={title} /><DistributionList rows={rows} total={rows.reduce((sum, row) => sum + row.value, 0)} emptyText="No tool usage in this period." /></section>
}

function DistributionPanel({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return <section className="admin-panel"><PanelHeading title={title} /><DistributionList rows={rows} total={rows.reduce((sum, row) => sum + row.value, 0)} emptyText="No audience data in this period." /></section>
}

function DistributionList({ rows, total, emptyText }: { rows: Array<{ label: string; value: number }>; total: number; emptyText: string }) {
  if (!rows.length) return <EmptyState>{emptyText}</EmptyState>
  return <div className="distribution-list">{rows.map((row, index) => <div className="distribution-row" key={`${row.label}-${index}`}>
    <div><span>{row.label}</span><strong>{formatNumber(row.value)}</strong></div>
    <span className="distribution-track"><span style={{ width: `${total ? Math.max(2, (row.value / total) * 100) : 0}%` }} /></span>
  </div>)}</div>
}

function SettingsCard({ label, value, description }: { label: string; value: string; description: string }) {
  return <article className="admin-setting-card"><span>{label}</span><strong>{value}</strong><p>{description}</p></article>
}

function SearchConsolePanel({ status, report, onConnect, onDisconnect }: {
  status: SearchConsoleStatus | null
  report: SearchConsoleReport | null
  onConnect: () => void
  onDisconnect: () => void
}) {
  if (!status?.configured) return <section className="admin-panel gsc-panel"><PanelHeading title="Google Search Console" subtitle="Official Google Search Console API · read-only access" /><div className="admin-notice"><ExternalLink size={15} />Not configured yet. Add the OAuth client, callback URL, property URL, and encryption key to the API environment to enable a real connection.</div></section>
  if (!status.connected) return <section className="admin-panel gsc-panel"><PanelHeading title="Google Search Console" subtitle="Official Google Search Console API · read-only access" /><div className="gsc-connection"><span className="gsc-status-dot" /><div><strong>Not connected</strong><p>No Search Console metrics are shown until an administrator connects a verified property.</p></div><button className="admin-primary-button" onClick={onConnect}>Connect Google account <ExternalLink size={14} /></button></div></section>
  return <section className="admin-panel gsc-panel">
    <div className="admin-panel-heading"><div><h2>Google Search Console</h2><p>{status.propertyUrl} · Connected {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : ''}</p></div><button className="admin-secondary-button" onClick={onDisconnect}>Disconnect</button></div>
    {!report ? <div className="admin-loading-inline"><span className="admin-spinner" />Loading verified Search Console data…</div> : <>
      <div className="gsc-metrics"><MetricCard label="Impressions" value={formatNumber(report.impressions)} icon={Eye} /><MetricCard label="Clicks" value={formatNumber(report.clicks)} icon={MousePointer2} tone="green" /><MetricCard label="Average CTR" value={formatPercent(report.ctr * 100)} icon={BarChart3} tone="violet" /><MetricCard label="Avg. position" value={report.averagePosition.toFixed(1)} icon={ArrowUpRight} tone="amber" /></div>
      <div className="admin-two-column"><section><PanelHeading title="Top queries" /><DataTable columns={['Query', 'Clicks', 'Impressions', 'CTR', 'Position']} rows={report.topQueries.map((row) => [row.query, formatNumber(row.clicks), formatNumber(row.impressions), formatPercent(row.ctr * 100), row.position.toFixed(1)])} emptyText="Google returned no query rows for this range." /></section><section><PanelHeading title="Top landing pages" /><DataTable columns={['Page', 'Clicks', 'Impressions', 'CTR', 'Position']} rows={report.topPages.map((row) => [row.page, formatNumber(row.clicks), formatNumber(row.impressions), formatPercent(row.ctr * 100), row.position.toFixed(1)])} emptyText="Google returned no page rows for this range." /></section></div>
      <p className="admin-table-note">Search Console reporting can lag behind today. Metrics are fetched from Google and are not estimated.</p>
    </>}
  </section>
}

function titleCase(value: string) {
  return value.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

import { Outlet, Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, type Theme } from '@/stores/theme'
import { useQuery } from '@tanstack/react-query'
import { useRef, useCallback, useMemo } from 'react'
import { useToastStore } from '@/stores/toast'
import { getErrorMessage } from '@/lib/error'
import { projectApi, type Project } from '@/api/projects'
import {
  Home,
  LayoutDashboard,
  FolderKanban,
  List,
  FileText,
  Shield,
  Settings,
  LogOut,
  ChevronDown,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  Users,
  User,
  BarChart3,
  BookOpen,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import CommandPalette from '@/components/search/CommandPalette'
import QuickIssueModal from '@/components/issue/QuickIssueModal'
import NotificationBell from '@/components/notification/NotificationBell'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useRegisterShortcuts } from '@/hooks/useRegisterShortcuts'
import { useShortcutsStore } from '@/stores/shortcuts'
import ShortcutsHelpModal from '@/components/shortcuts/ShortcutsHelpModal'

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; title: string }[] = [
  { value: 'light', icon: Sun, title: 'Light' },
  { value: 'system', icon: Monitor, title: 'System' },
  { value: 'dark', icon: Moon, title: 'Dark' },
]

export default function AppLayout() {
  const { user, logout, uploadAvatar } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [showProjects, setShowProjects] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickIssueOpen, setQuickIssueOpen] = useState(false)
  const location = useLocation()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Global keyboard shortcut listener
  useKeyboardShortcuts()

  const globalShortcuts = useMemo(() => [
    {
      id: 'global-command-palette',
      keys: 'mod+k',
      label: 'Open command palette',
      category: 'Global' as const,
      handler: () => setCommandPaletteOpen((prev) => !prev),
    },
    {
      id: 'global-quick-issue',
      keys: 'mod+n',
      label: 'Quick issue create',
      category: 'Global' as const,
      handler: () => setQuickIssueOpen((prev) => !prev),
    },
    {
      id: 'global-help',
      keys: '?',
      label: 'Show keyboard shortcuts',
      category: 'Global' as const,
      handler: () => useShortcutsStore.getState().setHelpModalOpen(
        !useShortcutsStore.getState().helpModalOpen
      ),
    },
    {
      id: 'global-escape',
      keys: 'escape',
      label: 'Close panel/modal',
      category: 'Global' as const,
      handler: () => {
        const store = useShortcutsStore.getState()
        if (store.helpModalOpen) {
          store.setHelpModalOpen(false)
        } else if (quickIssueOpen) {
          setQuickIssueOpen(false)
        } else if (commandPaletteOpen) {
          setCommandPaletteOpen(false)
        }
      },
    },
    {
      id: 'nav-board',
      keys: 'g b',
      label: 'Go to Board',
      category: 'Navigation' as const,
      handler: () => { if (projectId) navigate(`/projects/${projectId}/board`) },
    },
    {
      id: 'nav-issues',
      keys: 'g i',
      label: 'Go to Issues',
      category: 'Navigation' as const,
      handler: () => { if (projectId) navigate(`/projects/${projectId}/lists`) },
    },
    {
      id: 'nav-dashboard',
      keys: 'g d',
      label: 'Go to Dashboard',
      category: 'Navigation' as const,
      handler: () => { if (projectId) navigate(`/projects/${projectId}`) },
    },
    {
      id: 'nav-settings',
      keys: 'g s',
      label: 'Go to Settings',
      category: 'Navigation' as const,
      handler: () => { if (projectId) navigate(`/projects/${projectId}/settings`) },
    },
    {
      id: 'nav-specs',
      keys: 'g p',
      label: 'Go to Specs',
      category: 'Navigation' as const,
      handler: () => { if (projectId) navigate(`/projects/${projectId}/specs`) },
    },
  ], [projectId, navigate, commandPaletteOpen, quickIssueOpen])

  useRegisterShortcuts('global', globalShortcuts)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await uploadAvatar(file)
      useToastStore.getState().addToast('Avatar updated successfully')
    } catch (err) {
      useToastStore.getState().addToast(getErrorMessage(err, 'Failed to upload avatar'))
    }
    e.target.value = ''
  }

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.list,
  })

  const currentProject = projects?.find((p) => p.id === projectId || p.key === projectId)

  useEffect(() => {
    if (!showProjects) return
    const handleClick = () => setShowProjects(false)
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [showProjects])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const globalNavItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/standup', icon: MessageCircle, label: 'Standup' },
    ...(user?.isSuperuser ? [
      { to: '/admin', icon: Users, label: 'Admin' },
      { to: '/admin/dashboard', icon: BarChart3, label: 'Team' },
    ] : []),
    { to: '/profile', icon: User, label: 'Profile' },
    { to: '/api-docs', icon: BookOpen, label: 'API Docs' },
  ]

  const projectNavItems = projectId
    ? [
        { to: `/projects/${projectId}`, icon: LayoutDashboard, label: 'Dashboard' },
        { to: `/projects/${projectId}/specs`, icon: FileText, label: 'Specs' },
        { to: `/projects/${projectId}/board`, icon: FolderKanban, label: 'Board' },
        { to: `/projects/${projectId}/lists`, icon: List, label: 'Lists' },
        { to: `/projects/${projectId}/credentials`, icon: Shield, label: 'Credentials' },
        { to: `/projects/${projectId}/settings`, icon: Settings, label: 'Settings' },
      ]
    : []

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className={cn('flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-[width] duration-200', collapsed ? 'w-14' : 'w-60')}>
        {/* Logo */}
        <div className="flex h-14 items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3">
          {!collapsed && (
            <Link to="/" className="text-lg font-bold text-gray-900 dark:text-gray-100">
              BB PM
            </Link>
          )}
          <button
            onClick={() => {
              const next = !collapsed
              setCollapsed(next)
              localStorage.setItem('sidebar-collapsed', String(next))
            }}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Project Selector */}
        {!collapsed ? (
          <div className="border-b border-gray-200 dark:border-gray-700 p-3">
            <button
              onClick={(e) => { e.stopPropagation(); setShowProjects(!showProjects) }}
              className="flex w-full items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            >
              <span className="truncate">
                {currentProject ? `${currentProject.key} - ${currentProject.name}` : 'Select Project'}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </button>
            {showProjects && (
              <div className="mt-1 space-y-0.5">
                {projects?.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate(`/projects/${p.key}/board`)
                      setShowProjects(false)
                    }}
                    className={cn(
                      'flex w-full items-center rounded-md px-3 py-1.5 text-sm',
                      (p.id === projectId || p.key === projectId)
                        ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700',
                    )}
                  >
                    <span className="mr-2 font-mono text-xs text-gray-400 dark:text-gray-500">{p.key}</span>
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
                <button
                  onClick={() => {
                    navigate('/projects/new')
                    setShowProjects(false)
                  }}
                  className="flex w-full items-center rounded-md px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                >
                  + New Project
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center border-b border-gray-200 dark:border-gray-700 py-3">
            <span className="text-xs font-bold text-gray-400 dark:text-gray-500">{currentProject?.key}</span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2">
          {globalNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg text-sm font-medium',
                collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
                location.pathname === item.to
                  ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          ))}
          {projectNavItems.length > 0 && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              {projectNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    'flex items-center rounded-lg text-sm font-medium',
                    collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-3 py-2',
                    location.pathname === item.to
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700',
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        {/* User */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-2">
          {!collapsed ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <NotificationBell />
                <div className="flex items-center gap-1">
                  {/* Theme Toggle */}
                  <div className="flex items-center rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
                    {THEME_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        title={opt.title}
                        className={cn(
                          'rounded-md p-1 transition',
                          theme === opt.value
                            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                            : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300',
                        )}
                      >
                        <opt.icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCommandPaletteOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Search className="h-3 w-3" />
                    <kbd className="rounded bg-gray-200 dark:bg-gray-600 px-1 text-[10px] font-medium">⌘K</kbd>
                  </button>
                </div>
              </div>
              <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden"
                  title="Change avatar"
                >
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    user?.name?.charAt(0).toUpperCase()
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white opacity-0 group-hover:opacity-100 transition">
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </div>
                </button>
                <div className="flex-1 truncate">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</div>
                  <div className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</div>
                </div>
                <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <NotificationBell />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 text-sm font-medium text-primary-700 dark:text-primary-300 overflow-hidden" title={user?.name}>
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  user?.name?.charAt(0).toUpperCase()
                )}
              </div>
              <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Logout">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900">
        <Outlet />
      </main>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      {quickIssueOpen && <QuickIssueModal onClose={() => setQuickIssueOpen(false)} />}
      <ShortcutsHelpModal />
    </div>
  )
}

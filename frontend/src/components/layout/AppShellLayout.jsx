import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FileInput,
  FileText,
  GitBranch,
  Settings,
  History,
  Menu,
  X,
  LogOut,
  User,
  PanelLeft,
  ClipboardList,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  Table2,
  UserCircle2,
  UserCheck,
  BarChart3,
  Timer,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { BrandMark } from '../BrandLogo';

const primaryNav = [
  { to: '/', label: 'Workspace Home', icon: LayoutDashboard, end: true },
  { to: '/generate-srs', label: 'Generate SRS', icon: FileInput },
  { to: '/results', label: 'Processing results', icon: PanelLeft },
  { to: '/srs', label: 'SRS document', icon: FileText },
  { to: '/expert-review', label: 'Expert review', icon: UserCheck },
  { to: '/srs-metrics', label: 'SRS metrics', icon: BarChart3 },
  { to: '/srs-model-run', label: 'Model run', icon: Timer },
  { to: '/textual-usecases', label: 'Textual use cases', icon: ClipboardList },
  { to: '/usecase-diagram', label: 'Use case diagram', icon: GitBranch },
  { to: '/rtm', label: 'RTM matrix', icon: Table2 },
];

const secondaryNav = [
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const AppShellLayout = ({ currentUser, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280;
  });
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth >= 1024;
  });
  const isCollapsed = isDesktop && collapsed;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const pageTitle = useMemo(() => {
    const map = {
      '/': 'Workspace Home',
      '/generate-srs': 'Generate SRS',
      '/textual-usecases': 'Textual use cases',
      '/usecase-diagram': 'Use case diagram',
      '/srs': 'SRS document',
      '/results': 'Processing results',
      '/history': 'History',
      '/settings': 'Settings',
      '/rtm': 'RTM matrix',
      '/profile': 'Profile',
      '/expert-review': 'Expert review',
      '/srs-metrics': 'SRS metrics',
      '/srs-model-run': 'Model run',
    };
    return map[location.pathname] || 'Workspace';
  }, [location.pathname]);

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-gradient-to-br from-stone-100 via-amber-50/70 to-stone-50 text-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 dark:text-zinc-100">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-zinc-900/55 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`
          fixed z-50 inset-y-0 left-0 flex flex-col w-[85vw] max-w-sm overflow-y-auto
          bg-gradient-to-b from-r2d-primaryDark via-r2d-primary to-r2d-primaryDark text-zinc-100 border-r border-white/10 shadow-nav
          transform transition-all duration-200 ease-out
          ${isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'}
          lg:translate-x-0 lg:z-40 lg:h-dvh
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`h-16 flex items-center gap-3 border-b border-white/10 shrink-0 ${isCollapsed ? 'px-3 justify-end' : 'px-4 justify-between'}`}>
          {!isCollapsed && (
            <Link
              to="/"
              onClick={closeMobile}
              className="min-w-0 flex-1 flex flex-col justify-center gap-0.5"
              aria-label="Req2Design home"
            >
              <p className="text-sm font-semibold text-white tracking-tight leading-tight">Req2Design</p>
              <p className="text-[10px] text-zinc-400 leading-tight">AI SRS Engineering</p>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:inline-flex p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5" aria-label="Main">
          {primaryNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeMobile}
              title={label}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors
                ${isCollapsed ? 'justify-center px-2' : ''}
                ${
                  isActive
                    ? 'bg-white/12 text-white shadow-inner border border-white/10'
                    : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-3">
          {!isCollapsed && (
            <p className="px-2.5 pb-2 text-[10px] uppercase tracking-wider text-zinc-400/90 font-semibold">
              Account
            </p>
          )}
          <div className="space-y-0.5 border-t border-white/10 pt-2">
            {secondaryNav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={closeMobile}
                title={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors
                  ${isCollapsed ? 'justify-center px-2' : ''}
                  ${
                    isActive
                      ? 'bg-white/12 text-white shadow-inner border border-white/10'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </NavLink>
            ))}
          </div>
        </div>

      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 min-h-dvh overflow-x-hidden transition-[padding-left] duration-200 ${
          isCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'
        }`}
      >
        <header
          className="sticky top-0 z-30 relative min-h-16 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 lg:px-10 border-b backdrop-blur-md shadow-sm"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-zinc-600 hover:bg-amber-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <div className="inline-flex items-center px-0.5 py-0.5">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.08em] text-r2d-primary dark:text-r2d-accentSoft truncate max-w-[52vw] sm:max-w-none">
                  {pageTitle}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {currentUser && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full border border-zinc-200/90 dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-600">
                <User className="h-3.5 w-3.5" />
                {currentUser.username}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-amber-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  navigate('/start');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-r2d-accent text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-r2d-accent/55 to-transparent" />
        </header>

        <main className="flex-1 w-full p-2 sm:p-4 lg:p-8 flex flex-col overflow-x-hidden">
          <div className="flex-1 rounded-2xl border border-zinc-200/80 bg-white/92 p-3 sm:p-5 lg:p-6 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-700/70 dark:bg-zinc-900/78 dark:shadow-black/30 overflow-x-hidden">
            <Outlet />
          </div>
          <footer className="mt-6 sm:mt-10 pt-5 sm:pt-8 border-t border-zinc-200 dark:border-zinc-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-3">
                <BrandMark className="h-8 w-8 border border-zinc-300/60 dark:border-zinc-600" imgClassName="h-full w-full object-contain" />
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">Req2Design — AI SRS Engineering Platform</p>
              </div>
              <div className="text-right md:text-left space-y-1">
                <p className="font-mono text-[11px] text-zinc-400">© {new Date().getFullYear()} Req2Design</p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default AppShellLayout;

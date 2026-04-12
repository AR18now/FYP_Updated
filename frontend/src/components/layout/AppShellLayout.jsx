import React, { useMemo, useState } from 'react';
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
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const primaryNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/generate-srs', label: 'Generate SRS', icon: FileInput },
  { to: '/results', label: 'Processing results', icon: PanelLeft },
  { to: '/srs', label: 'SRS document', icon: FileText },
  { to: '/expert-review', label: 'Expert review', icon: UserCheck },
  { to: '/srs-metrics', label: 'SRS metrics', icon: BarChart3 },
  { to: '/textual-usecases', label: 'Textual use cases', icon: ClipboardList },
  { to: '/usecase-diagram', label: 'Use case diagram', icon: GitBranch },
  { to: '/rtm', label: 'RTM matrix', icon: Table2 },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const AppShellLayout = ({ currentUser, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = useMemo(() => {
    const map = {
      '/': 'Dashboard',
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
    };
    return map[location.pathname] || 'Workspace';
  }, [location.pathname]);

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen overflow-hidden bg-r2d-surface text-slate-800 dark:bg-r2d-primaryDark dark:text-slate-100">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-r2d-primary/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`
          fixed z-50 inset-y-0 left-0 flex flex-col w-64 overflow-y-auto
          bg-r2d-primary text-slate-100 border-r border-white/10 shadow-nav
          transform transition-all duration-200 ease-out
          ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'}
          lg:translate-x-0 lg:static lg:z-0 lg:sticky lg:top-0 lg:h-screen
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`h-16 flex items-center gap-3 border-b border-white/10 shrink-0 ${collapsed ? 'px-3 justify-between' : 'px-4'}`}>
          <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shadow-lg shrink-0 overflow-hidden border border-white/20">
            <img
              src={`${process.env.PUBLIC_URL}/req2design_logo_clean_2x.png`}
              alt="Req2Design logo"
              className="h-7 w-7 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <Link to="/" className="font-semibold text-white tracking-tight text-sm leading-tight block truncate" onClick={closeMobile}>
                Req2Design
              </Link>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">AI SRS Engineering</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:inline-flex p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
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
                ${collapsed ? 'justify-center px-2' : ''}
                ${
                  isActive
                    ? 'bg-white/12 text-white shadow-inner border border-white/10'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`p-3 border-t border-white/10 text-[10px] text-slate-500 shrink-0 ${collapsed ? 'hidden lg:block' : ''}`}>
          {!collapsed && <p className="px-1 leading-relaxed">IEEE 830 · RAG · Quality metrics</p>}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="sticky top-0 z-30 h-16 flex flex-wrap items-center justify-between gap-3 px-4 lg:px-8 border-b border-r2d-border bg-r2d-surfaceElevated/95 backdrop-blur-md shadow-sm dark:bg-slate-900/95 dark:border-slate-700/80">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              onClick={() => setSidebarOpen((o) => !o)}
              aria-label="Toggle navigation"
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold dark:text-slate-400 hidden sm:block">
                Req2Design – AI SRS Engineering Platform
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold sm:hidden">Req2Design</p>
              <p className="text-sm font-semibold text-r2d-primary truncate dark:text-slate-100">{pageTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentUser && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-r2d-surface px-2.5 py-1 rounded-full border border-r2d-border dark:text-slate-300 dark:bg-slate-800 dark:border-slate-600">
                <User className="h-3.5 w-3.5" />
                {currentUser.username}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-r2d-border text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  navigate('/login');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-r2d-primary text-white hover:bg-r2d-primaryLight dark:bg-r2d-accent dark:hover:bg-blue-600"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-[1680px] w-full mx-auto flex flex-col overflow-y-auto">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="mt-10 pt-8 border-t border-r2d-border dark:border-slate-700">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <p className="font-semibold text-r2d-primary dark:text-slate-200">Req2Design — AI SRS Engineering Platform</p>
                <p className="mt-1 max-w-xl leading-relaxed">
                  Final Year Project · IEEE 830-1998 compliant SRS generation, RAG-assisted context, and verification
                  metrics for software engineers and requirements analysts.
                </p>
              </div>
              <div className="text-right md:text-left space-y-1">
                <p className="font-mono text-[11px] text-slate-400">© {new Date().getFullYear()} Req2Design</p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default AppShellLayout;

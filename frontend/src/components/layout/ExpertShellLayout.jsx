import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Inbox, UserCircle2, Menu, X, LogOut, User, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

/** Expert-only navigation (queue + profile). Routes live under `/expert`. */
const nav = [
  { to: '/expert', label: 'Review queue', icon: Inbox, end: true },
  { to: '/expert/profile', label: 'Profile', icon: UserCircle2, end: false },
];

/** Minimal chrome for reviewers — mirrors author shell patterns but only exposes queue + profile. */
const ExpertShellLayout = ({ currentUser, onLogout }) => {
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
      '/expert': 'Expert review queue',
      '/expert/profile': 'Profile',
    };
    return map[location.pathname] || 'Expert panel';
  }, [location.pathname]);

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-gradient-to-br from-slate-100 via-sky-50/75 to-slate-50 text-zinc-800 dark:from-zinc-950 dark:via-slate-950 dark:to-zinc-950 dark:text-zinc-100">
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      )}

      <aside
        className={`
          fixed z-50 inset-y-0 left-0 flex flex-col overflow-y-auto
          w-[85vw] max-w-sm
          bg-gradient-to-b from-r2d-primaryDark via-r2d-primary to-r2d-primaryDark text-slate-100 border-r border-r2d-primary/30 shadow-nav
          transform transition-all duration-200 ease-out
          ${isCollapsed ? 'lg:w-[76px]' : 'lg:w-64'}
          lg:translate-x-0 lg:z-40 lg:h-dvh
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`h-16 flex items-center gap-3 border-b border-white/10 shrink-0 ${isCollapsed ? 'px-3 justify-end' : 'px-4 justify-between'}`}>
          {!isCollapsed && (
            <Link
              to="/expert"
              onClick={closeMobile}
              className="min-w-0 flex-1 flex flex-col justify-center gap-0.5"
              aria-label="Expert review home"
            >
              <p className="text-sm font-semibold text-white tracking-tight leading-tight">Req2Design</p>
              <p className="text-[10px] text-slate-300/90 leading-tight">Expert reviewer · Human review queue</p>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden lg:inline-flex p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-white/10"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5" aria-label="Expert navigation">
          {nav.map(({ to, label, icon: Icon, end }) => (
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
                    ? 'bg-r2d-accent/25 text-white shadow-inner border border-r2d-accent/30'
                    : 'text-slate-200/90 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {!isCollapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`p-3 border-t border-white/10 text-[10px] text-slate-400/80 shrink-0 ${isCollapsed ? 'hidden lg:block' : ''}`}>
          {!isCollapsed && <p className="px-1 leading-relaxed">Reviewer accounts only</p>}
        </div>
      </aside>

      <div
        className={`flex-1 flex flex-col min-w-0 min-h-dvh overflow-x-hidden bg-slate-100 dark:bg-slate-900 transition-[padding-left] duration-200 ${
          isCollapsed ? 'lg:pl-[76px]' : 'lg:pl-64'
        }`}
      >
        <header
          className="sticky top-0 z-30 relative min-h-16 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2 lg:px-8 border-b backdrop-blur-md shadow-sm"
          style={{ background: 'var(--card)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
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
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-600">
                <User className="h-3.5 w-3.5" />
                {currentUser.username}
              </span>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
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
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg bg-gradient-to-r from-r2d-primary to-r2d-accent text-white hover:from-r2d-primaryLight hover:to-r2d-accent"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-r2d-accent/55 to-transparent" />
        </header>

        <main className="flex-1 w-full p-2 sm:p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ExpertShellLayout;

import React, { useMemo, useState } from 'react';
import { NavLink, Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Inbox, UserCircle2, Menu, X, LogOut, User, Moon, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const nav = [
  { to: '/expert', label: 'Review queue', icon: Inbox, end: true },
  { to: '/expert/profile', label: 'Profile', icon: UserCircle2, end: false },
];

const ExpertShellLayout = ({ currentUser, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = useMemo(() => {
    const map = {
      '/expert': 'Expert review queue',
      '/expert/profile': 'Profile',
    };
    return map[location.pathname] || 'Expert panel';
  }, [location.pathname]);

  const closeMobile = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-dvh overflow-x-hidden bg-slate-950 text-slate-100">
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
          bg-gradient-to-b from-r2d-primaryDark to-slate-950 text-slate-100 border-r border-r2d-primary/30 shadow-nav
          transform transition-all duration-200 ease-out
          ${collapsed ? 'lg:w-[76px]' : 'lg:w-64'}
          lg:translate-x-0 lg:static lg:z-0 lg:sticky lg:top-0 lg:h-screen
          ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className={`h-16 flex items-center gap-3 border-b border-white/10 shrink-0 ${collapsed ? 'px-3 justify-between' : 'px-4'}`}>
          <div className="h-9 w-9 rounded-lg bg-r2d-accent/25 flex items-center justify-center shrink-0 border border-r2d-accent/35">
            <Inbox className="h-5 w-5 text-slate-100" aria-hidden />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <Link to="/expert" className="font-semibold text-white tracking-tight text-sm leading-tight block truncate" onClick={closeMobile}>
                Expert panel
              </Link>
              <p className="text-[10px] text-slate-300/90 mt-0.5 leading-tight">Human review queue</p>
            </div>
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
                ${collapsed ? 'justify-center px-2' : ''}
                ${
                  isActive
                    ? 'bg-r2d-accent/25 text-white shadow-inner border border-r2d-accent/30'
                    : 'text-slate-200/90 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className={`p-3 border-t border-white/10 text-[10px] text-slate-400/80 shrink-0 ${collapsed ? 'hidden lg:block' : ''}`}>
          {!collapsed && <p className="px-1 leading-relaxed">Reviewer accounts only</p>}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh overflow-x-hidden bg-slate-100 dark:bg-slate-900">
        <header className="sticky top-0 z-30 h-16 flex flex-wrap items-center justify-between gap-3 px-4 lg:px-8 border-b border-slate-200 bg-white/95 backdrop-blur-md shadow-sm dark:bg-slate-900/95 dark:border-slate-700/80">
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
              <p className="text-[11px] uppercase tracking-wider text-r2d-primary font-semibold dark:text-r2d-accentSoft hidden sm:block">
                Req2Design · Expert reviewer
              </p>
              <p className="text-sm font-semibold text-slate-900 truncate dark:text-slate-100">{pageTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
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
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-r2d-primary text-white hover:bg-r2d-primaryLight"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 lg:p-8 max-w-[1680px] w-full mx-auto overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ExpertShellLayout;

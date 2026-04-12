import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, LogOut, User } from 'lucide-react';

const Header = ({ theme = 'dark', onToggleTheme, currentUser, onLogout }) => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={`sticky top-0 z-50 relative gradient-bg text-white shadow-lg transition-all duration-300 ${
        isScrolled ? 'shadow-xl' : ''
      }`}
      role="banner"
    >
      <div className="absolute inset-0 opacity-20 bg-grid" aria-hidden="true" />
      <div className="relative container mx-auto px-4 py-4 md:py-6">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link 
            to="/" 
            className="flex items-center space-x-3 group focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600 rounded-lg p-1 transition-transform duration-200 hover:scale-105"
            aria-label="Home - Req2Design"
          >
            <div className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-white/20 flex items-center justify-center shadow-inner group-hover:bg-white/30 transition-colors duration-200">
              <FileText className="h-5 w-5 md:h-6 md:w-6" aria-hidden="true" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl md:text-2xl font-bold leading-tight">Req2Design</h1>
            </div>
            <div className="sm:hidden">
              <h1 className="text-lg font-bold">Req2Design</h1>
            </div>
          </Link>

          {/* User Info & Actions */}
          <div className="flex items-center space-x-3">
            {currentUser && (
              <div className="hidden md:flex items-center space-x-2 px-3 py-2 rounded-lg border border-white/30 bg-white/10">
                <User className="h-4 w-4" aria-hidden="true" />
                <span className="text-sm font-medium text-white">{currentUser.username}</span>
              </div>
            )}
            {currentUser && (
              <button
                onClick={() => {
                  if (onLogout) onLogout();
                  navigate('/start');
                }}
                className="hidden md:inline-flex items-center space-x-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600 transition"
                aria-label="Logout"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="text-white">Logout</span>
              </button>
            )}
          <button
              onClick={onToggleTheme}
              className="hidden md:inline-flex items-center space-x-2 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm font-semibold hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600 transition"
              aria-label="Toggle theme"
          >
              <span className="text-white">{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
          </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

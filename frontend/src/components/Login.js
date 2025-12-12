import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Mail, Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { login, isAuthenticated } from '../utils/auth';

const Login = ({ onLogin, theme = 'dark' }) => {
  const navigate = useNavigate();
  const isDark = theme === 'dark';
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);
  const [formData, setFormData] = useState({
    usernameOrEmail: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = login(formData.usernameOrEmail, formData.password);
      
      if (result.success) {
        if (onLogin) {
          onLogin(result.user);
        }
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, navigate, onLogin]);

  const handleChange = useCallback((e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError(null); // Clear error on input change
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-md">
        <div className={`rounded-2xl shadow-2xl overflow-hidden border ${isDark ? 'border-slate-800 bg-slate-900/90' : 'border-slate-200 bg-white/90'}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white/20 rounded-full">
                <LogIn className="h-10 w-10" aria-hidden="true" />
              </div>
            </div>
            <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-blue-100">Sign in to continue to Req2Design</p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 animate-slide-up">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="usernameOrEmail" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Username or Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="usernameOrEmail"
                    name="usernameOrEmail"
                    type="text"
                    value={formData.usernameOrEmail}
                    onChange={handleChange}
                    required
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder="Enter username or email"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;


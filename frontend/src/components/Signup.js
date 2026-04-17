import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, Link, Navigate, useParams } from 'react-router-dom';
import { UserPlus, Mail, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle, Moon, Sun, Rocket, ArrowRight, UserCheck } from 'lucide-react';
import { BrandFull } from './BrandLogo';
import { signup, isAuthenticated, getCurrentUser, ROLES, validatePasswordPolicy, PASSWORD_POLICY } from '../utils/auth';
import { useTheme } from '../context/ThemeContext';

const Signup = ({ onSignup }) => {
  const { role: roleParam } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const role = roleParam === 'expert' ? ROLES.EXPERT : ROLES.USER;
  const isExpert = role === ROLES.EXPERT;
  const roleInvalid = roleParam !== 'user' && roleParam !== 'expert';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      const u = getCurrentUser();
      const dest = u?.role === ROLES.EXPERT ? '/expert' : '/';
      navigate(dest, { replace: true });
    }
  }, [navigate]);

  const hero = useMemo(
    () =>
      isExpert
        ? {
            badge: 'Expert reviewer',
            title: 'Create a reviewer account',
            body: 'You will only use the expert panel: review queue and feedback—separate from project user accounts.',
            bullets: [{ Icon: Rocket, text: 'Access the shared review queue' }],
          }
        : {
            badge: 'Project user',
            title: 'Create your engineering workspace',
            body: 'Start transforming ambiguous requirements into structured SRS documents, use cases, and diagrams.',
            bullets: [
              { Icon: Rocket, text: 'Fast setup in under a minute' },
              { Icon: ArrowRight, text: 'Direct access to full SRS pipeline' },
            ],
          },
    [isExpert]
  );
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const policy = validatePasswordPolicy(formData.password);
    if (!policy.valid) {
      setError(policy.errors[0]);
      return;
    }

    setIsLoading(true);

    try {
      const result = signup(formData.username, formData.email, formData.password, role);

      if (result.success) {
        if (onSignup) {
          onSignup(result.user);
        }
        navigate(`/login/${roleParam}`);
      } else {
        setError(result.error || 'Signup failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [formData, navigate, onSignup, role, roleParam]);

  const handleChange = useCallback((e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError(null); // Clear error on input change
  }, []);

  const passwordStrength = useCallback(() => {
    const password = formData.password;
    if (!password) return { strength: 0, label: '', color: '' };
    const policy = validatePasswordPolicy(password);
    const checks = policy.checks;
    let strength = 0;
    if (checks.minLength) strength++;
    if (checks.uppercase) strength++;
    if (checks.lowercase) strength++;
    if (checks.number) strength++;
    if (checks.special) strength++;

    if (strength <= 2) return { strength, label: 'Weak', color: 'red', checks };
    if (strength <= 4) return { strength, label: 'Medium', color: 'yellow', checks };
    return { strength, label: 'Strong', color: 'green', checks };
  }, [formData.password]);

  const strength = passwordStrength();

  if (roleInvalid) {
    return <Navigate to="/start" replace />;
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden overflow-y-auto flex items-start md:items-center justify-center p-4 md:p-6 py-8" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="pointer-events-none absolute -top-24 -left-20 h-72 w-72 rounded-full bg-r2d-accent/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-r2d-primary/20 blur-3xl" />
      <button
        type="button"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute top-4 right-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-r2d-border bg-r2d-surfaceElevated/95 px-3 py-2 text-sm text-r2d-primary shadow-sm hover:bg-r2d-surface dark:border-slate-600 dark:bg-slate-800/95 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
        <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-3xl overflow-hidden border shadow-2xl backdrop-blur-xl bg-white/80 dark:bg-slate-900/75 border-slate-200/70 dark:border-slate-700/70">
        <section
          className={`hidden lg:flex flex-col justify-between p-10 text-white ${
            isExpert
              ? 'bg-gradient-to-br from-r2d-primaryDark via-r2d-primary to-slate-900'
              : 'bg-gradient-to-br from-r2d-primary via-r2d-primaryLight to-r2d-accent'
          }`}
        >
          <div>
            <BrandFull className="h-12 w-auto max-w-[220px] object-contain object-left mb-6 drop-shadow-md" alt="Req2Design" />
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
              {hero.badge}
            </div>
            <h2 className="mt-6 text-3xl font-bold leading-tight">{hero.title}</h2>
            <p className="mt-3 text-slate-100/90 text-sm leading-relaxed">{hero.body}</p>
          </div>
          <div className="space-y-3 text-sm">
            {hero.bullets.map(({ Icon, text }, i) => (
              <div key={i} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-slate-100" />
                {text}
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 sm:p-8 md:p-10">
          <div className="max-w-md mx-auto">
            <div className="flex justify-center mb-5 lg:hidden">
              <BrandFull className="h-12 w-auto max-w-[240px] object-contain" alt="Req2Design" />
            </div>
            <h1 className="text-3xl font-bold mb-2 text-r2d-primary dark:text-slate-100 text-center lg:text-left">
              {isExpert ? 'Expert sign up' : 'Create account'}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-7 text-center lg:text-left">
              {isExpert
                ? 'Register separately from project users. You will sign in to the expert panel only.'
                : 'Set up your account and start working on your FYP requirements workflow.'}
            </p>
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
                <label htmlFor="username" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    minLength={3}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder="Choose a username (min 3 characters)"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder="Enter your email"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={PASSWORD_POLICY.minLength}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                    placeholder={`Create a password (min ${PASSWORD_POLICY.minLength} characters)`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {formData.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Password strength:</span>
                      <span className={`text-xs font-medium ${
                        strength.color === 'red' ? 'text-red-600' :
                        strength.color === 'yellow' ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {strength.label}
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          strength.color === 'red' ? 'bg-red-500' :
                          strength.color === 'yellow' ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${(strength.strength / 5) * 100}%` }}
                      />
                    </div>
                    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      {[
                        ['At least 8 characters', strength.checks?.minLength],
                        ['Uppercase letter (A-Z)', strength.checks?.uppercase],
                        ['Lowercase letter (a-z)', strength.checks?.lowercase],
                        ['Number (0-9)', strength.checks?.number],
                        ['Special symbol (!@#$...)', strength.checks?.special],
                      ].map(([label, ok]) => (
                        <li key={label} className={ok ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}>
                          {ok ? '✓' : '•'} {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className={`block text-sm font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    minLength={PASSWORD_POLICY.minLength}
                    className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-r2d-accent focus:border-transparent transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-700 text-slate-100' 
                        : 'bg-white border-slate-200 text-slate-900'
                    } ${
                      formData.confirmPassword && formData.password !== formData.confirmPassword
                        ? 'border-red-500'
                        : formData.confirmPassword && formData.password === formData.confirmPassword
                        ? 'border-green-500'
                        : ''
                    }`}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {formData.confirmPassword && (
                  <div className="mt-2 flex items-center space-x-2">
                    {formData.password === formData.confirmPassword ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
                        <span className="text-xs text-green-600">Passwords match</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
                        <span className="text-xs text-red-600">Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || formData.password !== formData.confirmPassword || !validatePasswordPolicy(formData.password).valid}
                className="w-full bg-gradient-to-r from-r2d-primary to-r2d-accent hover:from-r2d-primaryLight hover:to-r2d-accent disabled:from-gray-400 disabled:to-gray-400 text-white py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 disabled:hover:scale-100 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-r2d-accent focus:ring-offset-2"
              >
                {isLoading ? 'Creating account...' : 'Sign Up'}
              </button>
            </form>

            <div className="mt-6 text-center space-y-2">
              <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                Already have an account?{' '}
                <Link
                  to={`/login/${roleParam}`}
                  className="text-r2d-accent hover:text-r2d-primaryLight font-semibold transition-colors"
                >
                  Sign in
                </Link>
              </p>
              <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                <Link to="/start" className="text-slate-600 dark:text-slate-400 hover:underline">
                  ← Choose user or expert
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Signup;


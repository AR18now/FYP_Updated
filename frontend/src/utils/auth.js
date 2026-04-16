/**
 * Basic authentication utility using localStorage
 * Stores user credentials and session information
 */

const STORAGE_KEYS = {
  USERS: 'req2design_users',
  CURRENT_USER: 'req2design_current_user',
  SESSION: 'req2design_session',
};

export const ROLES = {
  USER: 'user',
  EXPERT: 'expert',
};

const normalizeRole = (r) => (r === ROLES.EXPERT ? ROLES.EXPERT : ROLES.USER);

export const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

export const validatePasswordPolicy = (password) => {
  const p = String(password || '');
  const checks = {
    minLength: p.length >= PASSWORD_POLICY.minLength,
    uppercase: /[A-Z]/.test(p),
    lowercase: /[a-z]/.test(p),
    number: /\d/.test(p),
    special: /[^A-Za-z0-9]/.test(p),
  };
  const errors = [];
  if (!checks.minLength) errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters.`);
  if (!checks.uppercase) errors.push('Password must include at least one uppercase letter.');
  if (!checks.lowercase) errors.push('Password must include at least one lowercase letter.');
  if (!checks.number) errors.push('Password must include at least one number.');
  if (!checks.special) errors.push('Password must include at least one special symbol.');
  return { valid: errors.length === 0, checks, errors };
};

/**
 * Get all registered users
 */
export const getUsers = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USERS);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
};

/**
 * Register a new user (role: 'user' | 'expert')
 */
export const signup = (username, email, password, role = ROLES.USER) => {
  try {
    const users = getUsers();
    const resolvedRole = normalizeRole(role);

    if (users.find((u) => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }

    if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'Email already registered' };
    }

    if (!username || username.trim().length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }

    const policy = validatePasswordPolicy(password);
    if (!policy.valid) {
      return { success: false, error: policy.errors[0] };
    }

    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: resolvedRole,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    return {
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    };
  } catch (error) {
    console.error('Error during signup:', error);
    return { success: false, error: 'Failed to create account. Please try again.' };
  }
};

/**
 * Login — expectedRole must match the account role ('user' | 'expert')
 */
export const login = (usernameOrEmail, password, expectedRole = ROLES.USER) => {
  try {
    const users = getUsers();
    const want = normalizeRole(expectedRole);

    const user = users.find(
      (u) =>
        u.username.toLowerCase() === usernameOrEmail.toLowerCase() ||
        u.email.toLowerCase() === usernameOrEmail.toLowerCase()
    );

    if (!user) {
      return { success: false, error: 'Invalid username/email or password' };
    }

    if (user.password !== password) {
      return { success: false, error: 'Invalid username/email or password' };
    }

    const accountRole = normalizeRole(user.role);

    if (accountRole !== want) {
      if (want === ROLES.USER) {
        return {
          success: false,
          error: 'This account is registered as an expert reviewer. Use the expert sign-in page.',
        };
      }
      return {
        success: false,
        error: 'This account is a project user account. Use the user sign-in page.',
      };
    }

    const session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: accountRole,
      loginTime: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    localStorage.setItem(
      STORAGE_KEYS.CURRENT_USER,
      JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email,
        role: accountRole,
      })
    );

    return {
      success: true,
      user: { id: user.id, username: user.username, email: user.email, role: accountRole },
    };
  } catch (error) {
    console.error('Error during login:', error);
    return { success: false, error: 'Login failed. Please try again.' };
  }
};

/**
 * Logout user
 */
export const logout = () => {
  try {
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    return true;
  } catch (error) {
    console.error('Error during logout:', error);
    return false;
  }
};

/**
 * Check if user is logged in
 */
export const isAuthenticated = () => {
  try {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!session) return false;

    const sessionData = JSON.parse(session);
    return !!sessionData && !!sessionData.userId;
  } catch (error) {
    return false;
  }
};

/**
 * Get current user (includes role)
 */
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!user) return null;
    const parsed = JSON.parse(user);
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get session info
 */
export const getSession = () => {
  try {
    const session = localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!session) return null;
    const parsed = JSON.parse(session);
    return { ...parsed, role: normalizeRole(parsed.role) };
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

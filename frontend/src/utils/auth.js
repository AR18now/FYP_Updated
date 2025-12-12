/**
 * Basic authentication utility using localStorage
 * Stores user credentials and session information
 */

const STORAGE_KEYS = {
  USERS: 'req2design_users',
  CURRENT_USER: 'req2design_current_user',
  SESSION: 'req2design_session'
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
 * Register a new user
 */
export const signup = (username, email, password) => {
  try {
    const users = getUsers();
    
    // Check if username already exists
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { success: false, error: 'Username already exists' };
    }
    
    // Check if email already exists
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'Email already registered' };
    }
    
    // Validate inputs
    if (!username || username.trim().length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Invalid email address' };
    }
    
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    
    // Create new user (in production, password should be hashed)
    const newUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: password, // In production, hash this!
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    
    return { success: true, user: { id: newUser.id, username: newUser.username, email: newUser.email } };
  } catch (error) {
    console.error('Error during signup:', error);
    return { success: false, error: 'Failed to create account. Please try again.' };
  }
};

/**
 * Login user
 */
export const login = (usernameOrEmail, password) => {
  try {
    const users = getUsers();
    
    // Find user by username or email
    const user = users.find(u => 
      (u.username.toLowerCase() === usernameOrEmail.toLowerCase()) ||
      (u.email.toLowerCase() === usernameOrEmail.toLowerCase())
    );
    
    if (!user) {
      return { success: false, error: 'Invalid username/email or password' };
    }
    
    // Check password (in production, compare hashed passwords)
    if (user.password !== password) {
      return { success: false, error: 'Invalid username/email or password' };
    }
    
    // Create session
    const session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      loginTime: new Date().toISOString()
    };
    
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email
    }));
    
    return { success: true, user: { id: user.id, username: user.username, email: user.email } };
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
    // Check if session is still valid (optional: add expiration check)
    return !!sessionData && !!sessionData.userId;
  } catch (error) {
    return false;
  }
};

/**
 * Get current user
 */
export const getCurrentUser = () => {
  try {
    const user = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return user ? JSON.parse(user) : null;
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
    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};


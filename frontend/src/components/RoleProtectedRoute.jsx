import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated, getCurrentUser } from '../utils/auth';

const DEFAULT_ROLE = 'user';

const RoleProtectedRoute = ({ children, allowedRole = 'user' }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/start" replace />;
  }

  const role = getCurrentUser()?.role || DEFAULT_ROLE;

  if (allowedRole === 'user' && role === 'expert') {
    return <Navigate to="/expert" replace />;
  }

  if (allowedRole === 'expert' && role !== 'expert') {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default RoleProtectedRoute;

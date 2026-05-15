import React from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

/** Legacy simple gate; prefer `RoleProtectedRoute` for role-aware redirects. */
const ProtectedRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/start" replace />;
  }
  return children;
};

export default ProtectedRoute;


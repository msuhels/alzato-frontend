import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  // Role guard for admin-only dashboard
  if (location.pathname.startsWith('/dashboard') && user?.role !== 'admin') {
    return <Navigate to="/students" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;

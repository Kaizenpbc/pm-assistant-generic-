import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import AppLayout from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardRouter } from './pages/DashboardRouter';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { ScenarioModelingPage } from './pages/ScenarioModelingPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <AppLayout>{children}</AppLayout> : <Navigate to="/login" replace />;
}

function App() {
  const { isAuthenticated, isLoading, setLoading } = useAuthStore();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 100);
    return () => clearTimeout(timer);
  }, [setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />}
        />

        {/* Protected routes */}
        <Route path="/dashboard" element={<PrivateRoute><DashboardRouter /></PrivateRoute>} />
        <Route path="/project/:id" element={<PrivateRoute><ProjectDetailPage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />
        <Route path="/scenarios" element={<PrivateRoute><ScenarioModelingPage /></PrivateRoute>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;

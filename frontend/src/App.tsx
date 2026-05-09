import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';
import DataAccessPage from '@/pages/DataAccessPage';
import DesktopPage from '@/pages/DesktopPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route path="/" element={
        <ProtectedRoute><DataAccessPage /></ProtectedRoute>
      } />
      <Route path="/carte" element={
        <ProtectedRoute><DesktopPage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
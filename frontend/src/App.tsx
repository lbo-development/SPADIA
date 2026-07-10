import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';
import LoginPage             from '@/pages/LoginPage';
import ResetPasswordPage     from '@/pages/ResetPasswordPage';
import DataAccessPage        from '@/pages/DataAccessPage';
import CartoPage             from '@/pages/CartoPage';
import DatabaseLayout        from '@/pages/database/DatabaseLayout';
import SitesPage             from '@/pages/database/SitesPage';
import InstallationsPage     from '@/pages/database/InstallationsPage';
import PlansPage             from '@/pages/database/PlansPage';
import CalquesPage           from '@/pages/database/CalquesPage';
import DossiersPage          from '@/pages/database/DossiersPage';
import UtilisateursPage      from '@/pages/database/UtilisateursPage';
import MarkersPage           from '@/pages/database/MarkersPage';
import DashboardLayout      from '@/pages/dashboard/DashboardLayout';
import SoumettreAjoutPage   from '@/pages/dashboard/SoumettreAjoutPage';
import ValiderDemandesPage  from '@/pages/dashboard/ValiderDemandesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function ProtectedSubmitRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === ROLES.VIEWER) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ProtectedValidationRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== ROLES.ADMIN_APP && user?.role !== ROLES.ADMIN_DATA) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function ProtectedDatabaseRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== ROLES.ADMIN_APP) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RecoveryRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    if (params.get('type') === 'recovery' && params.get('access_token')) {
      navigate('/reset-password' + window.location.hash, { replace: true });
    }
  }, [location.pathname, navigate]);
  return null;
}

export default function App() {
  const { isAuthenticated } = useAuth();
  return (
    <ErrorBoundary>
    <RecoveryRedirect />
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />

      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route path="/" element={
        <ProtectedRoute><Navigate to="/dashboard" replace /></ProtectedRoute>
      } />

      <Route path="/carte" element={
        <ProtectedRoute><CartoPage /></ProtectedRoute>
      } />

      <Route path="/database" element={
        <ProtectedDatabaseRoute><DatabaseLayout /></ProtectedDatabaseRoute>
      }>
        <Route index element={<Navigate to="sites" replace />} />
        <Route path="sites"         element={<SitesPage />} />
        <Route path="installations" element={<InstallationsPage />} />
        <Route path="plans"         element={<PlansPage />} />
        <Route path="calques"       element={<CalquesPage />} />
        <Route path="dossiers"      element={<DossiersPage />} />
        <Route path="markers"       element={<MarkersPage />} />
        <Route path="utilisateurs"  element={<UtilisateursPage />} />
      </Route>

      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<DataAccessPage />} />
        <Route path="soumettre" element={<ProtectedSubmitRoute><SoumettreAjoutPage /></ProtectedSubmitRoute>} />
        <Route path="valider"   element={<ProtectedValidationRoute><ValiderDemandesPage /></ProtectedValidationRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </ErrorBoundary>
  );
}

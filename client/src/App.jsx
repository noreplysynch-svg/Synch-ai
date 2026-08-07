import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Pricing from './pages/Pricing';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import InstallPWABanner from '@/components/InstallPWABanner';

// Bounces to /login while preserving the query string (?completeSignup=..,
// ?authError=.. etc.) — a plain <Navigate to="/login" /> silently drops it,
// which used to strand new Google/Microsoft sign-ups on a blank login screen.
const RequireAuth = ({ isAuthenticated, children }) => {
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to={{ pathname: '/login', search: location.search }} replace />;
  }
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/login/passwordless" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Protected routes */}
      <Route path="/" element={<RequireAuth isAuthenticated={isAuthenticated}><Chat /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth isAuthenticated={isAuthenticated}><Settings /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth isAuthenticated={isAuthenticated}><Profile /></RequireAuth>} />
      <Route path="/pricing" element={<RequireAuth isAuthenticated={isAuthenticated}><Pricing /></RequireAuth>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
          <InstallPWABanner />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRegisteredRoute({ children }) {
  const { user, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) return null;

  if (!user) {
    return <Navigate to="/register" state={{ from: location }} replace />;
  }

  return children;
}

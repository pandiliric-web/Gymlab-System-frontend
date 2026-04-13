import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdminLogin = identifier.includes('@');

  useEffect(() => {
    if (user?.role === 'admin') {
      const dest =
        from && from !== '/login' && from.startsWith('/') ? from : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [user, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    // Members log in with Customer ID only (no password).
    // Admin logins use email + password.
    const result = await login(identifier, isAdminLogin ? password : '');
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.role === 'admin') {
      navigate(from === '/login' || !from.startsWith('/') ? '/dashboard' : from, { replace: true });
    } else {
      navigate('/member', { replace: true });
    }
  }

  return (
    <main className="page-main">
      <div className="page-shell page-shell--auth">
        <div className="auth-card">
          <header className="page-header page-header--tight">
            <p className="page-eyebrow">Member &amp; staff</p>
            <h1 className="page-title">Sign in</h1>
          </header>

          <form className="clutch-form clutch-form--tight" onSubmit={handleSubmit}>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label className="field field--full">
              <span className="field__label">Customer ID</span>
              <input
                className="field__input"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            {isAdminLogin && (
              <label className="field field--full">
                <span className="field__label">Admin password</span>
                <input
                  className="field__input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>
            )}
            <button type="submit" className="btn-primary btn-primary--wide" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="auth-links">
            <Link to="/register">New here? Register</Link>
            <span aria-hidden> · </span>
            <Link to="/">Home</Link>
          </p>
        </div>
      </div>
    </main>
  );
}

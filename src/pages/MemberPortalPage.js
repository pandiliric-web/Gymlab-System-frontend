import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listPayments } from '../services/payments';

function pickLatestMembership(payments) {
  if (!Array.isArray(payments) || !payments.length) return null;

  function toMillis(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts === 'number') return ts;
    if (ts instanceof Date) return ts.getTime();
    const ms = Date.parse(String(ts));
    return Number.isFinite(ms) ? ms : 0;
  }

  const paid = payments.filter((p) => p.status === 'paid');
  const source = paid.length ? paid : payments;

  source.sort((a, b) => {
    const am = toMillis(a.paidAt) || toMillis(a.updatedAt) || 0;
    const bm = toMillis(b.paidAt) || toMillis(b.updatedAt) || 0;
    return bm - am;
  });

  return source[0];
}

export default function MemberPortalPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [membership, setMembership] = useState(null);
  const [error, setError] = useState('');

  const uid = user?.uid;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!uid) {
        setMembership(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await listPayments({ userId: uid });
        if (cancelled) return;
        const all = res?.payments || [];
        setMembership(pickLatestMembership(all));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load membership.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const planName = useMemo(() => membership?.plan || '—', [membership?.plan]);
  const planType = useMemo(
    () => membership?.planType || membership?.plan || membership?.courseId || '—',
    [membership?.planType, membership?.plan, membership?.courseId]
  );
  const sessionsRemaining = useMemo(() => {
    const sr = Number(user?.sessionsRemaining);
    if (Number.isFinite(sr) && sr >= 0) return sr;
    const pkg = Number(membership?.sessions);
    if (Number.isFinite(pkg) && pkg >= 0) return pkg;
    return null;
  }, [user?.sessionsRemaining, membership?.sessions]);

  return (
    <main className="page-main">
      <div className="page-shell page-shell--narrow">
        <header className="page-header page-header--tight">
          <p className="page-eyebrow">Member Portal</p>
          <h1 className="page-title">{loading ? 'Loading your membership…' : 'Welcome back!'}</h1>
          <p className="page-subtitle">
            {loading
              ? 'Checking payment status...'
              : !uid
                ? 'Please sign in to view your membership.'
                : membership
                ? `Your selected plan is ${planName}.`
                : 'No membership record found yet.'}
          </p>
        </header>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {!loading && !uid && (
          <section className="reg-section" style={{ marginTop: '1rem' }}>
            <h2 className="reg-section__title" style={{ marginBottom: '0.6rem' }}>
              Sign in required
            </h2>
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              Please sign in using your Customer ID to see your membership details.
            </p>
            <div className="form-actions form-actions--tight" style={{ justifyContent: 'flex-start' }}>
              <Link className="btn-primary" to="/login">
                Go to login
              </Link>
              <Link className="btn-ghost" to="/register">
                Register
              </Link>
            </div>
          </section>
        )}

        {!loading && uid && membership && (
          <section className="reg-section" style={{ marginTop: '1rem' }}>
            <h2 className="reg-section__title" style={{ marginBottom: '0.6rem' }}>
              Membership details
            </h2>
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              Plan Type: <strong>{planType}</strong>
            </p>
            {typeof membership.sessions === 'number' && Number.isFinite(membership.sessions) ? (
              <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
                Sessions (package): <strong>{membership.sessions}</strong>
              </p>
            ) : null}
            {sessionsRemaining != null ? (
              <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
                Sessions left (after check-ins): <strong>{sessionsRemaining}</strong>
              </p>
            ) : null}
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              Amount: <strong>{membership.amount ? `PHP ${membership.amount}.00` : '—'}</strong>
            </p>
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              Payment Method: <strong>{membership.paymentMethod || '—'}</strong>
            </p>
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              Start Date: <strong>{membership.startDate || '—'}</strong>
            </p>
            <p className="page-subtitle" style={{ marginBottom: '0.35rem' }}>
              End Date: <strong>{membership.endDate || '—'}</strong>
            </p>
            <p className="page-subtitle">
              Status: <strong style={{ color: 'var(--accent)' }}>{membership.status || '—'}</strong>
            </p>
          </section>
        )}

        <div className="form-actions form-actions--tight" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
          <Link className="btn-ghost" to="/payment">
            Manage / renew
          </Link>
          <Link className="btn-ghost" to="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}


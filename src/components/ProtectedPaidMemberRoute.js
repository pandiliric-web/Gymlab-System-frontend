import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listPayments } from '../services/payments';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  const ms = Date.parse(String(ts));
  return Number.isFinite(ms) ? ms : 0;
}

function normalizePlanKey(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  if (v === 'base') return 'monthly';
  if (v === 'pro') return 'weekly';
  if (v === 'elite') return 'daily';
  if (v === 'walk-in') return 'walkin';
  if (v.includes('walk')) return 'walkin';
  if (v.includes('daily')) return 'daily';
  if (v.includes('weekly')) return 'weekly';
  if (v.includes('monthly') || v.includes('membership')) return 'monthly';
  return null;
}

function inferPlanKey(payment) {
  return (
    normalizePlanKey(payment?.courseId) ||
    normalizePlanKey(payment?.plan) ||
    normalizePlanKey(payment?.planType) ||
    null
  );
}

function resolveMembershipEndMs(payment) {
  const explicit = toMillis(payment?.endDate);
  if (explicit) return explicit;

  const planKey = inferPlanKey(payment);
  if (planKey !== 'monthly') return 0;

  const paidMs =
    toMillis(payment?.paidAt) ||
    toMillis(payment?.updatedAt) ||
    toMillis(payment?.createdAt) ||
    toMillis(payment?.submittedAt);
  if (!paidMs) return 0;

  return paidMs + 30 * 24 * 60 * 60 * 1000;
}

function isStillActive(payment) {
  const endMs = resolveMembershipEndMs(payment);
  if (!endMs) return true;
  return endMs >= Date.now();
}

function hasPaidMembership(payments) {
  const paid = payments.filter((p) => p.status === 'paid' && isStillActive(p));
  if (!paid.length) return null;

  paid.sort((a, b) => {
    const am = toMillis(a.paidAt) || toMillis(a.updatedAt);
    const bm = toMillis(b.paidAt) || toMillis(b.updatedAt);
    return bm - am;
  });

  return paid[0];
}

export default function ProtectedPaidMemberRoute({ children }) {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (authLoading) return;
      if (!user?.uid) {
        navigate('/login', { replace: true });
        return;
      }

      setChecking(true);
      try {
        const res = await listPayments({ userId: user.uid });
        if (cancelled) return;
        const all = res?.payments || [];
        const paid = hasPaidMembership(all);

        if (paid) setAllowed(true);
        else navigate('/payment/pending', { replace: true });
      } catch {
        if (!cancelled) navigate('/payment/pending', { replace: true });
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [authLoading, navigate, user?.uid]);

  if (authLoading || checking) return null;
  return allowed ? children : <Navigate to="/payment/pending" replace />;
}


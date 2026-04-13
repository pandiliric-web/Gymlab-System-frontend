import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPaymentById } from '../services/payments';

export default function PaymentPendingPage() {
  const location = useLocation();
  const { user } = useAuth();

  const refFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('ref') || params.get('pid');
  }, [location.search]);

  const referenceNumber = refFromQuery || sessionStorage.getItem('clutch_payment_ref');
  const formSnapshot = useMemo(() => {
    if (!referenceNumber) return null;
    try {
      const raw = sessionStorage.getItem(`clutch_payment_form_${referenceNumber}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, [referenceNumber]);

  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    async function load() {
      if (!referenceNumber) {
        if (!cancelled) {
          setLoading(false);
          setError('Missing payment reference.');
        }
        return;
      }

      try {
        const res = await getPaymentById(referenceNumber);
        if (cancelled) return;
        if (!res?.payment) {
          setPayment(null);
          setLoading(false);
          return;
        }
        const data = res.payment;
        setPayment(data);
        // In manual mode, admin may take longer to confirm. Stop polling once confirmed.
        if (data?.status === 'paid' && intervalId) {
          window.clearInterval(intervalId);
        }
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load payment status.');
          setLoading(false);
        }
      }
    }

    load();

    // Poll while pending.
    intervalId = window.setInterval(() => {
      if (cancelled) return;
      load();
    }, 4000);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [referenceNumber]);

  const isPaid = payment?.status === 'paid';
  const hasResultData = Boolean(payment || formSnapshot);
  const receiptData = {
    reference: referenceNumber || '—',
    status: payment?.status || 'submitted',
    customerId: formSnapshot?.customerId || payment?.customerId || '—',
    planType: formSnapshot?.planType || payment?.planType || payment?.courseId || '—',
    memberCategory: formSnapshot?.memberCategory || payment?.memberCategory || '—',
    paymentMethod: formSnapshot?.paymentMethod || payment?.paymentMethod || 'GCASH',
    amount: Number(formSnapshot?.amount || payment?.amount || 0),
    startDate: formSnapshot?.startDate || payment?.startDate || '—',
    endDate: formSnapshot?.endDate || payment?.endDate || '—',
    sessions:
      formSnapshot?.sessions ??
      (typeof payment?.sessions === 'number' && Number.isFinite(payment.sessions) ? payment.sessions : '—'),
    submittedAt: formSnapshot?.submittedAt ? new Date(formSnapshot.submittedAt) : null,
  };

  return (
    <main className="page-main">
      <div className="page-shell page-shell--narrow">
        <header className="page-header page-header--tight">
          <p className="page-eyebrow">Payment</p>
          <h1 className="page-title">{loading ? 'Pending payment…' : isPaid ? 'Payment successful' : 'Payment pending'}</h1>
          <p className="page-subtitle">
            {isPaid
              ? 'We confirmed your payment.'
              : 'Your payment is not confirmed yet. Please wait a moment and refresh automatically.'}
          </p>
        </header>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        {hasResultData && (
          <section className="receipt-card" style={{ marginTop: '1rem' }} aria-label="Payment receipt">
            <div className="receipt-head">
              <h2 className="receipt-title">Official Receipt</h2>
              <span className={`receipt-status ${isPaid ? 'receipt-status--paid' : 'receipt-status--pending'}`}>
                {receiptData.status}
              </span>
            </div>

            <p className="receipt-reference">Reference: {receiptData.reference}</p>

            <dl className="receipt-lines">
              <div className="receipt-line"><dt>Customer ID</dt><dd>{receiptData.customerId}</dd></div>
              <div className="receipt-line"><dt>Plan Type</dt><dd>{receiptData.planType}</dd></div>
              <div className="receipt-line"><dt>Member Category</dt><dd>{receiptData.memberCategory}</dd></div>
              <div className="receipt-line"><dt>Payment Method</dt><dd>{receiptData.paymentMethod}</dd></div>
              <div className="receipt-line"><dt>Start Date</dt><dd>{receiptData.startDate}</dd></div>
              <div className="receipt-line"><dt>End Date</dt><dd>{receiptData.endDate}</dd></div>
              <div className="receipt-line"><dt>Sessions with coach</dt><dd>{receiptData.sessions}</dd></div>
              <div className="receipt-line"><dt>Submitted</dt><dd>{receiptData.submittedAt ? receiptData.submittedAt.toLocaleString() : '—'}</dd></div>
            </dl>

            <div className="receipt-total">
              <span>Total Amount</span>
              <strong>{receiptData.amount > 0 ? `PHP ${receiptData.amount.toLocaleString()}.00` : '—'}</strong>
            </div>
          </section>
        )}

        <div className="form-actions form-actions--tight" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
          {isPaid ? (
            <Link className="btn-primary btn-primary--wide" to="/member">
              Go to member portal
            </Link>
          ) : (
            <Link className="btn-ghost" to="/payment">
              Try another plan
            </Link>
          )}
          {!user && (
            <Link className="btn-ghost" to="/login">
              Login
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}


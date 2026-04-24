import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { checkBalanceUseSession, createPaymentRequest, getMemberCategoryQuote, getPricingSettings, getWalkInQuote } from '../services/payments';

const PRICING_SYNC_CHANNEL = 'clutch-pricing-sync';

function normalizePortalCustomerId(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function coalesceSessionDefaultsClient(sd) {
  const fb = { member: { monthly: 10, daily: 1 }, nonMember: { monthly: 10, daily: 1 } };
  const flatM = Math.max(1, Math.floor(Number(sd?.monthly)) || fb.member.monthly);
  const flatD = Math.max(1, Math.floor(Number(sd?.daily)) || fb.member.daily);
  const mem = sd?.member || {};
  const non = sd?.nonMember || {};
  return {
    member: {
      monthly: Math.max(1, Math.floor(Number(mem.monthly)) || flatM),
      daily: Math.max(1, Math.floor(Number(mem.daily)) || flatD),
    },
    nonMember: {
      monthly: Math.max(1, Math.floor(Number(non.monthly)) || flatM),
      daily: Math.max(1, Math.floor(Number(non.daily)) || flatD),
    },
  };
}

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = String(user?.role || '').trim().toLowerCase() === 'admin';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [standardPrices, setStandardPrices] = useState({ base: 49, pro: 79, elite: 119 });
  const [tierPrices, setTierPrices] = useState({
    member: { monthly: 49, membership: 49, daily: 119 },
    nonMember: { monthly: 49, membership: 49, daily: 119 },
  });
  const [sessionDefaults, setSessionDefaults] = useState({
    member: { monthly: 10, daily: 1 },
    nonMember: { monthly: 10, daily: 1 },
  });
  const [walkInQuote, setWalkInQuote] = useState({
    amount: null,
    regularAmount: null,
    discountedAmount: null,
    eligibleForReturningDiscount: false,
    tierKey: null,
  });
  const [walkInQuoteLoading, setWalkInQuoteLoading] = useState(false);

  const formatDateInput = (d) => {
    if (!(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const initialStartDate = useMemo(() => {
    const now = new Date();
    return formatDateInput(now);
  }, []);

  const initialEndDate = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() + 30);
    return formatDateInput(now);
  }, []);

  const buildEndDateByPlan = useCallback((plan) => {
    const now = new Date();
    const normalized = String(plan || '').trim().toLowerCase();
    if (normalized === 'daily') {
      now.setDate(now.getDate() + 1);
      return formatDateInput(now);
    }
    now.setDate(now.getDate() + 30);
    return formatDateInput(now);
  }, []);

  // Payment form fields (UI-only for now; backend decides final pricing).
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState(800);
  const [paymentFlow, setPaymentFlow] = useState('Monthly Payment');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [memberCategory, setMemberCategory] = useState('Non-member');
  const [memberCategoryLocked, setMemberCategoryLocked] = useState(false);
  const [memberCategoryDetecting, setMemberCategoryDetecting] = useState(false);
  const [sessions, setSessions] = useState(10);

  const [portalCustomerId, setPortalCustomerId] = useState('');
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [balanceResult, setBalanceResult] = useState(null);

  const isWalkInSession = paymentFlow === 'Walk-in Session';
  const isMembershipPayment = paymentFlow === 'Membership Payment';
  const isMonthlyPayment = paymentFlow === 'Monthly Payment';
  const effectiveMemberCategory = isWalkInSession ? 'Walk-in Client' : memberCategory;

  // Pricing tier selection (planKey stored in payment.courseId)
  const computedPlanKey = useMemo(() => {
    if (isWalkInSession) return 'daily';
    if (isMembershipPayment) return 'membership';
    if (isMonthlyPayment) return 'monthly';
    return 'monthly';
  }, [isWalkInSession, isMembershipPayment, isMonthlyPayment]);

  const loadPricingSettings = useCallback(async () => {
    try {
      const res = await getPricingSettings();
      const data = res?.pricing || {};
      const standard = data?.standard || {};
      const tiers = data?.tiers || {};
      const memberTier = tiers?.member || {};
      const nonMemberTier = tiers?.nonMember || {};
      const sd = data?.sessionDefaults || {};
      setStandardPrices({
        base: Number.isFinite(Number(standard.base)) ? Number(standard.base) : 49,
        pro: Number.isFinite(Number(standard.pro)) ? Number(standard.pro) : 79,
        elite: Number.isFinite(Number(standard.elite)) ? Number(standard.elite) : 119,
      });
      setTierPrices({
        member: {
          monthly: Number.isFinite(Number(memberTier.monthly)) ? Number(memberTier.monthly) : Number(standard.base || 49),
          membership: Number.isFinite(Number(memberTier.membership))
            ? Number(memberTier.membership)
            : Number(memberTier.monthly || standard.base || 49),
          daily: Number.isFinite(Number(memberTier.daily)) ? Number(memberTier.daily) : Number(standard.elite || 119),
        },
        nonMember: {
          monthly: Number.isFinite(Number(nonMemberTier.monthly)) ? Number(nonMemberTier.monthly) : Number(standard.base || 49),
          membership: Number.isFinite(Number(nonMemberTier.membership))
            ? Number(nonMemberTier.membership)
            : Number(nonMemberTier.monthly || standard.base || 49),
          daily: Number.isFinite(Number(nonMemberTier.daily)) ? Number(nonMemberTier.daily) : Number(standard.elite || 119),
        },
      });
      setSessionDefaults(coalesceSessionDefaultsClient(sd));
    } catch {
      // non-blocking fallback keeps previous values.
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const safeLoad = async () => {
      if (!mounted) return;
      await loadPricingSettings();
    };

    safeLoad();
    // Keep Payment page synced when admin changes prices.
    const intervalId = window.setInterval(safeLoad, 10000);
    const onFocus = () => {
      safeLoad();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [loadPricingSettings]);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'clutch_pricing_updated_at') {
        loadPricingSettings();
      }
    };
    window.addEventListener('storage', onStorage);

    let channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(PRICING_SYNC_CHANNEL);
      channel.onmessage = (event) => {
        if (event?.data?.type === 'pricing-updated') {
          loadPricingSettings();
        }
      };
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) channel.close();
    };
  }, [loadPricingSettings]);

  const tierSessionDefaults = useMemo(() => {
    const t = String(effectiveMemberCategory || '').trim().toLowerCase() === 'non-member' ? 'nonMember' : 'member';
    return sessionDefaults[t] || sessionDefaults.member;
  }, [effectiveMemberCategory, sessionDefaults]);

  useEffect(() => {
    const next = isWalkInSession ? 1 : isMembershipPayment ? tierSessionDefaults.monthly : tierSessionDefaults.monthly;
    setSessions(next);
  }, [isWalkInSession, isMembershipPayment, tierSessionDefaults.monthly]);

  useEffect(() => {
    let cancelled = false;

    async function loadWalkInQuote() {
      if (!isWalkInSession || !user?.uid) {
        if (!cancelled) {
          setWalkInQuote({
            amount: null,
            regularAmount: null,
            discountedAmount: null,
            eligibleForReturningDiscount: false,
            tierKey: null,
          });
        }
        return;
      }

      setWalkInQuoteLoading(true);
      try {
        const quote = await getWalkInQuote({ customerId });
        if (cancelled) return;
        const amount = Number(quote?.amount);
        const regularAmount = Number(quote?.regularAmount);
        const discountedAmount = Number(quote?.discountedAmount);
        const normalized = {
          amount: Number.isFinite(amount) ? amount : null,
          regularAmount: Number.isFinite(regularAmount) ? regularAmount : null,
          discountedAmount: Number.isFinite(discountedAmount) ? discountedAmount : null,
          eligibleForReturningDiscount: Boolean(quote?.eligibleForReturningDiscount),
          tierKey: String(quote?.tierKey || '').trim() || null,
        };
        setWalkInQuote(normalized);
        if (Number.isFinite(normalized.amount) && normalized.amount > 0) {
          setAmount(normalized.amount);
        }
      } catch {
        if (!cancelled) {
          setWalkInQuote({
            amount: null,
            regularAmount: null,
            discountedAmount: null,
            eligibleForReturningDiscount: false,
            tierKey: null,
          });
        }
      } finally {
        if (!cancelled) setWalkInQuoteLoading(false);
      }
    }

    loadWalkInQuote();

    return () => {
      cancelled = true;
    };
  }, [isWalkInSession, user?.uid, customerId]);

  useEffect(() => {
    let cancelled = false;

    async function detectMemberCategory() {
      const shouldDetectLockedCategory = isMonthlyPayment || isMembershipPayment;
      if (!shouldDetectLockedCategory || !user?.uid) {
        setMemberCategoryLocked(false);
        return;
      }

      const typedCustomerId = String(customerId || '').trim();
      if (!typedCustomerId) {
        setMemberCategoryLocked(false);
        return;
      }

      setMemberCategoryDetecting(true);
      try {
        const quote = await getMemberCategoryQuote({ customerId: typedCustomerId });
        if (cancelled) return;
        const normalized = String(quote?.memberCategory || '').trim().toLowerCase();
        if (normalized === 'member' || normalized === 'non-member') {
          setMemberCategory(normalized === 'non-member' ? 'Non-member' : 'Member');
          setMemberCategoryLocked(true);
          return;
        }
        setMemberCategory('Non-member');
        setMemberCategoryLocked(true);
      } catch {
        if (!cancelled) {
          setMemberCategory('Non-member');
          setMemberCategoryLocked(true);
        }
      } finally {
        if (!cancelled) setMemberCategoryDetecting(false);
      }
    }

    detectMemberCategory();
    return () => {
      cancelled = true;
    };
  }, [isMonthlyPayment, isMembershipPayment, customerId, user?.uid]);

  // Keep amount in sync with admin pricing.
  useEffect(() => {
    if (!computedPlanKey) return;

    if (isWalkInSession) {
      const walkInAmount = Number(walkInQuote?.amount);
      if (Number.isFinite(walkInAmount) && walkInAmount > 0) {
        setAmount(walkInAmount);
        return;
      }
    }

    const tierKey =
      isWalkInSession || String(memberCategory || '').trim().toLowerCase() !== 'non-member'
        ? 'member'
        : 'nonMember';
    const price = Number(tierPrices?.[tierKey]?.[computedPlanKey]);
    if (Number.isFinite(price) && price > 0) {
      setAmount(price);
      return;
    }

    // Fallback to old settings shape.
    if (computedPlanKey === 'daily' && Number.isFinite(standardPrices?.elite) && standardPrices.elite > 0) setAmount(standardPrices.elite);
    if (computedPlanKey === 'monthly' && Number.isFinite(standardPrices?.base) && standardPrices.base > 0) setAmount(standardPrices.base);
  }, [computedPlanKey, memberCategory, tierPrices, standardPrices, isWalkInSession, isMembershipPayment, walkInQuote?.amount]);

  useEffect(() => {
    if (isMonthlyPayment) {
      setEndDate(buildEndDateByPlan('monthly'));
      return;
    }
    setEndDate('');
  }, [isMonthlyPayment, buildEndDateByPlan]);

  async function createPaymentAndNavigate(planKey) {
    setError('');
    setLoading(true);

    if (!user?.uid) {
      setLoading(false);
      navigate('/login', { state: { from: '/payment' } });
      return;
    }

    try {
      const res = await createPaymentRequest({
        courseId: planKey,
        formData: {
          // Stored on the payment request so admin can confirm it manually.
          customerId,
          amount,
          planType: paymentFlow,
          memberCategory: effectiveMemberCategory,
          paymentMethod,
          startDate: isMonthlyPayment ? startDate : null,
          endDate: isMonthlyPayment ? endDate : null,
          sessions: isWalkInSession ? 1 : isMembershipPayment ? tierSessionDefaults.monthly : sessions,
          userId: user.uid,
        },
      });

      const paymentId = res?.paymentId;
      const serverAmount = res?.amount;
      const walkInEligibleForReturningDiscount = Boolean(res?.walkInEligibleForReturningDiscount);
      const walkInRegularAmount = Number(res?.walkInRegularAmount);
      const walkInDiscountedAmount = Number(res?.walkInDiscountedAmount);
      if (!paymentId) {
        throw new Error('Payment request failed (missing payment reference).');
      }

      const finalAmount = Number.isFinite(serverAmount) ? serverAmount : Number(amount);

      sessionStorage.setItem('clutch_payment_ref', paymentId);
      sessionStorage.setItem(
        `clutch_payment_form_${paymentId}`,
        JSON.stringify({
          userId: user.uid,
          customerId,
          amount: finalAmount,
          planType: paymentFlow,
          memberCategory: effectiveMemberCategory,
          paymentMethod,
          startDate: isMonthlyPayment ? startDate : null,
          endDate: isMonthlyPayment ? endDate : null,
          sessions: isWalkInSession ? 1 : isMembershipPayment ? tierSessionDefaults.monthly : sessions,
          walkInEligibleForReturningDiscount,
          walkInRegularAmount: Number.isFinite(walkInRegularAmount) ? walkInRegularAmount : null,
          walkInDiscountedAmount: Number.isFinite(walkInDiscountedAmount) ? walkInDiscountedAmount : null,
          submittedAt: Date.now(),
        })
      );

      // Go to pending status page; admin will mark it paid manually.
      navigate(`/payment/pending?pid=${encodeURIComponent(paymentId)}`);
    } catch (err) {
      const msg =
        err?.message ||
        'Failed to create payment.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setShowReviewModal(true);
  };

  const handleConfirmSubmit = async () => {
    setShowReviewModal(false);
    await createPaymentAndNavigate(computedPlanKey);
  };

  async function handleCheckBalance() {
    const id = normalizePortalCustomerId(portalCustomerId);
    if (!id) {
      setBalanceError('Enter your Customer ID.');
      setBalanceResult(null);
      return;
    }
    setBalanceLoading(true);
    setBalanceError('');
    setBalanceResult(null);
    try {
      const data = await checkBalanceUseSession(id);
      setBalanceResult(data);
    } catch (e) {
      setBalanceError(e?.message || 'Could not check balance.');
    } finally {
      setBalanceLoading(false);
    }
  }

  const handleClear = () => {
    setError('');
    setCustomerId('');
    setAmount(800);
    setPaymentFlow('Monthly Payment');
    setPaymentMethod('Cash');
    setStartDate(initialStartDate);
    setEndDate(initialEndDate);
    setMemberCategory('Non-member');
    setMemberCategoryLocked(false);
    setMemberCategoryDetecting(false);
    setSessions(sessionDefaults.member.monthly);
    setWalkInQuote({
      amount: null,
      regularAmount: null,
      discountedAmount: null,
      eligibleForReturningDiscount: false,
      tierKey: null,
    });
  };

  return (
    <main className="page-main">
      <div className="page-shell">
        <header className="page-header page-header--tight">
          <p className="page-eyebrow">Clutch Lab System</p>
          <h1 className="page-title">Payment</h1>
        </header>
        {error && (
          <p className="form-error" role="alert" style={{ marginBottom: '1rem' }}>
            {error}
          </p>
        )}

        <div className="payment-landing">
          <section className="payment-card" aria-labelledby="payment-form-title">
            <h2 id="payment-form-title" className="payment-card__title">
              Payment Form
            </h2>

            <form className="payment-landing__form" onSubmit={handleSubmit}>
              <div className="payment-form-grid" aria-label="Payment details">
                <label className="field field--full">
                  <span className="field__label">Customer ID *</span>
                  <input className="field__input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required />
                </label>

                <label className="field field--full">
                  <span className="field__label">Payment Flow *</span>
                  <select className="field__input reg-select" value={paymentFlow} onChange={(e) => setPaymentFlow(e.target.value)}>
                    <option>Walk-in Session</option>
                    <option>Membership Payment</option>
                    <option>Monthly Payment</option>
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Amount (₱) *</span>
                  <input
                    className="field__input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    disabled={!isAdmin}
                    required
                  />
                  {/* Walk-in pricing is auto-detected; keep UI clean. */}
                </label>

                <label className="field">
                  <span className="field__label">Payment Method *</span>
                  <select className="field__input reg-select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                    <option>Cash</option>
                    <option>GCASH</option>
                  </select>
                </label>

                {!isWalkInSession && !isMembershipPayment ? (
                  <label className="field field--full">
                    <span className="field__label">Member Category *</span>
                    <select
                      className="field__input reg-select"
                      value={memberCategory}
                      onChange={(e) => setMemberCategory(e.target.value)}
                      disabled={memberCategoryLocked || memberCategoryDetecting}
                    >
                      <option>Member</option>
                      <option>Non-member</option>
                    </select>
                    {isMonthlyPayment ? (
                      <span className="payment-member-note" style={{ display: 'block', marginTop: '0.25rem' }}>
                        {memberCategoryDetecting
                          ? 'Detecting member category from Customer ID...'
                          : memberCategoryLocked
                          ? `Detected ${memberCategory} account from payment history. Category is locked.`
                          : 'Enter Customer ID to auto-detect and lock category.'}
                      </span>
                    ) : null}
                  </label>
                ) : null}

                {!isMonthlyPayment ? (
                  <label className="field field--full">
                    <span className="field__label">Sessions with coach</span>
                    <input className="field__input" type="number" value={isWalkInSession ? 1 : tierSessionDefaults.monthly} readOnly />
                    <span className="payment-member-note" style={{ display: 'block', marginTop: '0.25rem' }}>
                      {isWalkInSession
                        ? 'Walk-in Session uses 1 coach session.'
                        : `Membership Payment uses ${tierSessionDefaults.monthly} sessions by default.`}
                    </span>
                  </label>
                ) : null}

                {isMonthlyPayment ? (
                  <>
                    <label className="field">
                      <span className="field__label">Start Date *</span>
                      <input
                        className="field__input"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        disabled={!isAdmin}
                        required={isMonthlyPayment}
                      />
                    </label>

                    <label className="field">
                      <span className="field__label">End Date *</span>
                      <input
                        className="field__input"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        disabled={!isAdmin}
                        required={isMonthlyPayment}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              <div className="payment-form-actions">
                <button type="button" className="btn-ghost btn-ghost--small" onClick={handleClear} disabled={loading}>
                  Clear
                </button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>

            {showReviewModal && (
              <div className="review-modal-overlay" role="presentation" onClick={() => setShowReviewModal(false)}>
                <div
                  className="review-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="review-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 id="review-modal-title" className="review-modal__title">
                    Review Payment Details
                  </h3>

                  <dl className="summary-list">
                    <div className="summary-row">
                      <dt>Customer ID</dt>
                      <dd>{customerId}</dd>
                    </div>
                    <div className="summary-row">
                      <dt>Amount</dt>
                      <dd>₱{Number(amount || 0).toLocaleString()}</dd>
                    </div>
                    {isWalkInSession ? (
                      <div className="summary-row">
                        <dt>Walk-in member price</dt>
                        <dd>
                          {walkInQuote.eligibleForReturningDiscount
                            ? `Applied (member ₱${Number(walkInQuote.discountedAmount || amount || 0).toLocaleString()}, regular ₱${Number(walkInQuote.regularAmount || 0).toLocaleString()})`
                            : 'Regular rate applied'}
                        </dd>
                      </div>
                    ) : null}
                    <div className="summary-row">
                      <dt>Payment Flow</dt>
                      <dd>{paymentFlow}</dd>
                    </div>
                    {!isMonthlyPayment ? (
                      <div className="summary-row">
                        <dt>Sessions with coach</dt>
                        <dd>{isWalkInSession ? 1 : tierSessionDefaults.monthly}</dd>
                      </div>
                    ) : null}
                    {!isWalkInSession && !isMembershipPayment ? (
                      <div className="summary-row">
                        <dt>Member Category</dt>
                        <dd>{memberCategory}</dd>
                      </div>
                    ) : null}
                    <div className="summary-row">
                      <dt>Payment Method</dt>
                      <dd>{paymentMethod}</dd>
                    </div>
                    {isMonthlyPayment ? (
                      <>
                        <div className="summary-row">
                          <dt>Start Date</dt>
                          <dd>{startDate}</dd>
                        </div>
                        <div className="summary-row">
                          <dt>End Date</dt>
                          <dd>{endDate}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>

                  <div className="payment-form-actions">
                    <button type="button" className="btn-ghost btn-ghost--small" onClick={() => setShowReviewModal(false)}>
                      Close
                    </button>
                    <button type="button" className="btn-primary" onClick={handleConfirmSubmit} disabled={loading}>
                      {loading ? 'Submitting…' : 'Confirm & Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="payment-card payment-card--summary" aria-labelledby="gym-portal-title">
            <h2 id="gym-portal-title" className="payment-card__title">
              Gym portal
            </h2>
            <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1rem' }}>
              <strong>Member login</strong> — use your Customer ID below. Each check deducts <strong>one</strong> coach session from
              your balance (same as checking in at the gym).
            </p>

            <label className="field field--full">
              <span className="field__label">Customer ID</span>
              <input
                className="field__input"
                value={portalCustomerId}
                onChange={(e) => setPortalCustomerId(e.target.value)}
                autoComplete="username"
              />
            </label>

            {balanceError && (
              <p className="form-error" role="alert" style={{ marginTop: '0.75rem' }}>
                {balanceError}
              </p>
            )}

            <div className="payment-member-actions">
              <button type="button" className="btn-primary" onClick={() => navigate('/login')}>
                Log in
              </button>
              <button type="button" className="btn-ghost" onClick={handleCheckBalance} disabled={balanceLoading}>
                {balanceLoading ? 'Checking…' : 'Check balance'}
              </button>
            </div>

            {balanceResult && (
              <div className="payment-portal-stats" aria-live="polite">
                <div>
                  <span className="payment-portal-stat__label">PLAN</span>
                  <div className="payment-portal-stat__value">{balanceResult.plan || '—'}</div>
                </div>
                <div>
                  <span className="payment-portal-stat__label">SESSIONS LEFT</span>
                  <div className="payment-portal-stat__value">{Number(balanceResult.sessionsRemaining ?? 0)}</div>
                </div>
                <div>
                  <span className="payment-portal-stat__label">MONTHLY DAYS LEFT</span>
                  <div className="payment-portal-stat__value">{Number(balanceResult.monthlyDaysLeft ?? 0)}</div>
                </div>
                <div>
                  <span className="payment-portal-stat__label">TOTAL PAID</span>
                  <div className="payment-portal-stat__value">
                    ₱{Number(balanceResult.totalPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <span className="payment-portal-stat__label">MEMBER CATEGORY</span>
                  <div className="payment-portal-stat__value" style={{ fontSize: '1.05rem' }}>
                    {balanceResult.memberCategory || '—'}
                  </div>
                </div>
                {balanceResult.message ? (
                  <p className="payment-member-note" style={{ gridColumn: '1 / -1', marginTop: '0.25rem' }}>
                    {balanceResult.message}
                  </p>
                ) : null}
                {balanceResult.deducted ? (
                  <p className="payment-member-note" style={{ gridColumn: '1 / -1', color: 'var(--accent)' }}>
                    1 session deducted. Remaining: {balanceResult.sessionsRemaining}.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <p className="page-footnote">
          {isAdmin ? (
            <>
              <Link to="/register">Edit registration</Link>
              <span aria-hidden> · </span>
            </>
          ) : null}
          <Link to="/">Home</Link>
        </p>
      </div>
    </main>
  );
}

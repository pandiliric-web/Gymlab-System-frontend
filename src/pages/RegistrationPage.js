import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createCustomerIdFromProfile } from '../utils/phoneAuthEmail';

const DEFAULT_PLAN = 'pro';

const WAIVER_TEXT = `I voluntarily join this gym and understand that exercise and physical activity involve risk of injury. I confirm that I am physically fit to participate, including training with equipment, and that I have consulted a physician if needed. I release the gym, its owners, staff, and trainers from liability for injury or illness, loss, or damages that may arise during my participation, except in cases of gross negligence. I agree to follow all gym rules and safety instructions.`;

export default function RegistrationPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const formRef = useRef(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdCustomerId, setCreatedCustomerId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  const canSubmit = useMemo(() => waiverAccepted, [waiverAccepted]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreatedCustomerId('');
    setCopyStatus('');

    if (!waiverAccepted) {
      setError('You must agree to the gym waiver to continue.');
      return;
    }

    const form = new FormData(e.target);
    const fullName = form.get('fullName');
    const phone = form.get('phone');
    const gender = form.get('gender');
    const birthday = form.get('birthday');
    const plan = DEFAULT_PLAN;
    const customerId = createCustomerIdFromProfile(fullName, birthday);

    setIsSubmitting(true);
    const res = await signup(customerId, {
      fullName,
      phone,
      customerId,
      gender,
      birthday,
      waiverAccepted,
    });
    setIsSubmitting(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    const actualCustomerId = String(res?.customerId || customerId || '').trim();
    sessionStorage.setItem(
      'clutch_registration',
      JSON.stringify({
        fullName,
        phone,
        customerId: actualCustomerId,
        plan,
      })
    );

    setCreatedCustomerId(actualCustomerId);
    setSuccess('Registration successful. Please save your Customer ID / Passcode.');
  }

  async function handleCopyCustomerId() {
    const id = String(createdCustomerId || '').trim();
    if (!id) return;
    setCopyStatus('');
    try {
      await navigator.clipboard.writeText(id);
      setCopyStatus('Copied.');
      window.setTimeout(() => setCopyStatus(''), 1200);
    } catch {
      setCopyStatus('Copy failed. Please select and copy manually.');
    }
  }

  function handleClear() {
    setError('');
    setSuccess('');
    setCreatedCustomerId('');
    setWaiverAccepted(false);
    setIsSubmitting(false);
    setCopyStatus('');
    if (formRef.current) formRef.current.reset();
  }

  return (
    <main className="page-main">
      <div className="page-shell page-shell--narrow">
        <header className="page-header">
          <p className="page-eyebrow">Member Registration</p>
          <h1 className="page-title">User Info &amp; Waiver</h1>
          <p className="page-subtitle">
            Fill out your details and agree to the waiver. Your Customer ID will be auto-generated and used as your
            login passcode.
          </p>
        </header>

        <form ref={formRef} className="clutch-form" onSubmit={handleSubmit}>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="form-success" role="status" aria-live="polite">
              {success}
            </p>
          )}
          {createdCustomerId ? (
            <div
              role="region"
              aria-label="Your Customer ID"
              style={{
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                background: 'rgba(0,0,0,0.18)',
                marginTop: '0.8rem',
                marginBottom: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, letterSpacing: '0.02em' }}>Customer ID / Passcode</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Use this to log in and check your balance.
                  </div>
                </div>
                <button type="button" className="btn-ghost btn-ghost--small" onClick={handleCopyCustomerId}>
                  Copy
                </button>
              </div>
              <div
                style={{
                  marginTop: '0.65rem',
                  fontSize: '1.35rem',
                  fontWeight: 900,
                  letterSpacing: '0.06em',
                  wordBreak: 'break-all',
                }}
              >
                {createdCustomerId}
              </div>
              {copyStatus ? (
                <div style={{ marginTop: '0.35rem', color: 'var(--text-muted)' }}>{copyStatus}</div>
              ) : null}
              <div className="form-actions form-actions--tight" style={{ marginTop: '0.8rem' }}>
                <button type="button" className="btn-primary" onClick={() => navigate('/payment')}>
                  Continue to payment
                </button>
                <button type="button" className="btn-ghost" onClick={() => navigate('/login')}>
                  Go to login
                </button>
              </div>
            </div>
          ) : null}

          <section className="reg-section">
            <h2 className="reg-section__title">Member Details</h2>

            <div className="form-grid">
              <label className="field">
                <span className="field__label">Full name</span>
                <input className="field__input" name="fullName" type="text" required autoComplete="name" />
              </label>

              <label className="field">
                <span className="field__label">Gender</span>
                <select className="field__input reg-select" name="gender" defaultValue="prefer_not_say">
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="prefer_not_say">Prefer not to say</option>
                </select>
              </label>

              <label className="field">
                <span className="field__label">Birthday</span>
                <input className="field__input" name="birthday" type="date" required />
              </label>

              <label className="field field--full">
                <span className="field__label">Contact Number</span>
                <input className="field__input" name="phone" type="tel" autoComplete="tel" required />
              </label>
            </div>
          </section>

          <section className="reg-section">
            <h2 className="reg-section__title">Gym Waiver</h2>
            <div className="waiver-box" role="note" aria-label="Gym waiver text">
              <p className="waiver-text">{WAIVER_TEXT}</p>
            </div>

            <label className="waiver-check">
              <input
                type="checkbox"
                checked={waiverAccepted}
                onChange={(e) => setWaiverAccepted(e.target.checked)}
              />
              <span>I have read and agree to the gym waiver.</span>
            </label>
          </section>

          <div className="form-actions form-actions--tight">
            <button type="submit" className="btn-primary" disabled={isSubmitting || !canSubmit}>
              {isSubmitting ? 'Creating account…' : 'Register Member'}
            </button>
            <button type="button" className="btn-ghost" onClick={handleClear}>
              Clear
            </button>
            <Link className="btn-ghost" to="/">
              Back to home
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}

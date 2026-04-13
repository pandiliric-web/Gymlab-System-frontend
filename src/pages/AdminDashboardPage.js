import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  adminDeleteMember,
  createWalkInClient,
  getPricingSettings,
  listPayments,
  listUsers,
  markPaymentPaid,
  savePricingSettingsApi,
} from '../services/payments';

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts === 'number') return ts;
  if (ts instanceof Date) return ts.getTime();
  const ms = Date.parse(String(ts));
  return Number.isFinite(ms) ? ms : 0;
}

function startOfLocalDayMs(ms) {
  if (!ms) return 0;
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function formatDayLabel(ms) {
  if (!ms) return '—';
  try {
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
  } catch {
    return '—';
  }
}

function formatPhp(amount) {
  const n = Number(amount || 0);
  if (!Number.isFinite(n)) return 'PHP 0.00';
  return `PHP ${n.toFixed(2)}`;
}

function DailyRevenueChart({ series, maxTotal, days }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    // Re-play animation when data range changes.
    setAnimKey((k) => k + 1);
    setHoverIdx(null);
  }, [days, series]);

  const dims = useMemo(() => ({ w: 920, h: 260, pL: 56, pR: 20, pT: 22, pB: 42 }), []);

  const chart = useMemo(() => {
    const n = Array.isArray(series) ? series.length : 0;
    const w = dims.w;
    const h = dims.h;
    const innerW = w - dims.pL - dims.pR;
    const innerH = h - dims.pT - dims.pB;
    const max = maxTotal > 0 ? maxTotal : 1;
    const stepX = n > 1 ? innerW / (n - 1) : innerW;

    const pts = series.map((d, i) => {
      const x = dims.pL + i * stepX;
      const v = Number(d?.total || 0);
      const y = dims.pT + (1 - Math.min(1, Math.max(0, v / max))) * innerH;
      return { x, y, v, dayMs: d.dayMs, count: d.count };
    });

    const linePath =
      pts.length > 0
        ? `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} ` +
          pts
            .slice(1)
            .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
            .join(' ')
        : '';

    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(2)} ${(dims.pT + innerH).toFixed(2)} L ${pts[0].x.toFixed(2)} ${(dims.pT + innerH).toFixed(2)} Z`
        : '';

    const yTicks = 4;
    const grid = Array.from({ length: yTicks + 1 }).map((_, i) => {
      const t = i / yTicks;
      const y = dims.pT + t * innerH;
      const value = (1 - t) * max;
      return { y, value };
    });

    return { pts, linePath, areaPath, grid, innerW, innerH, max };
  }, [series, maxTotal, dims]);

  const active = hoverIdx != null ? chart.pts[hoverIdx] : null;

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const n = chart.pts.length;
    if (!n) return;
    const innerW = dims.w - dims.pL - dims.pR;
    const clamped = Math.max(dims.pL, Math.min(dims.pL + innerW, (x / rect.width) * dims.w));
    const stepX = n > 1 ? innerW / (n - 1) : innerW;
    const idx = stepX ? Math.round((clamped - dims.pL) / stepX) : 0;
    setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes clutchDrawLine {
          from { stroke-dashoffset: var(--dash, 1200); opacity: 0.35; }
          to { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes clutchFadeUp {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <svg
        key={animKey}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        width="100%"
        height="260"
        role="img"
        aria-label="Daily revenue area chart"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverIdx(null)}
        style={{ display: 'block' }}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="clutchAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(36, 255, 166, 0.40)" />
            <stop offset="60%" stopColor="rgba(10, 155, 255, 0.12)" />
            <stop offset="100%" stopColor="rgba(10, 155, 255, 0.02)" />
          </linearGradient>
          <linearGradient id="clutchLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(36, 255, 166, 0.95)" />
            <stop offset="100%" stopColor="rgba(10, 155, 255, 0.95)" />
          </linearGradient>
        </defs>

        {/* grid + y labels */}
        {chart.grid.map((g) => (
          <g key={g.y}>
            <line
              x1={dims.pL}
              x2={dims.w - dims.pR}
              y1={g.y}
              y2={g.y}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            <text
              x={dims.pL - 10}
              y={g.y + 4}
              textAnchor="end"
              fontSize="12"
              fill="rgba(255,255,255,0.55)"
            >
              {Math.round(g.value).toLocaleString()}
            </text>
          </g>
        ))}

        {/* x baseline */}
        <line
          x1={dims.pL}
          x2={dims.w - dims.pR}
          y1={dims.h - dims.pB}
          y2={dims.h - dims.pB}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />

        {/* area */}
        {chart.areaPath ? (
          <path
            d={chart.areaPath}
            fill="url(#clutchAreaFill)"
            style={{ animation: 'clutchFadeUp 520ms ease-out both' }}
          />
        ) : null}

        {/* line */}
        {chart.linePath ? (
          <path
            d={chart.linePath}
            fill="none"
            stroke="url(#clutchLine)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 1200,
              strokeDashoffset: 1200,
              animation: 'clutchDrawLine 760ms ease-out both',
              '--dash': 1200,
            }}
          />
        ) : null}

        {/* x tick labels (sparse) */}
        {chart.pts.map((p, i) => {
          if (!days || days > 30) {
            if (i % 7 !== 0 && i !== chart.pts.length - 1) return null;
          } else if (days > 14) {
            if (i % 4 !== 0 && i !== chart.pts.length - 1) return null;
          } else {
            if (i % 2 !== 0 && i !== chart.pts.length - 1) return null;
          }
          return (
            <text
              key={p.dayMs}
              x={p.x}
              y={dims.h - 16}
              textAnchor="middle"
              fontSize="12"
              fill="rgba(255,255,255,0.55)"
            >
              {formatDayLabel(p.dayMs)}
            </text>
          );
        })}

        {/* hover vertical + point */}
        {active ? (
          <g>
            <line
              x1={active.x}
              x2={active.x}
              y1={dims.pT}
              y2={dims.h - dims.pB}
              stroke="rgba(255,255,255,0.10)"
              strokeDasharray="4 6"
            />
            <circle cx={active.x} cy={active.y} r="6" fill="rgba(0,0,0,0.55)" stroke="rgba(255,255,255,0.65)" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="4" fill="rgba(36, 255, 166, 0.95)" />
          </g>
        ) : null}
      </svg>

      {active ? (
        <div
          style={{
            position: 'absolute',
            left: `${(active.x / dims.w) * 100}%`,
            top: `${Math.max(8, (active.y / dims.h) * 100 - 6)}%`,
            transform: 'translate(-50%, -110%)',
            pointerEvents: 'none',
            background: 'rgba(10, 14, 20, 0.92)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '12px',
            padding: '0.55rem 0.7rem',
            boxShadow: '0 16px 30px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
            minWidth: '180px',
            animation: 'clutchFadeUp 200ms ease-out both',
          }}
        >
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)' }}>{formatDayLabel(active.dayMs)}</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: '0.15rem' }}>{formatPhp(active.v)}</div>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.1rem' }}>
            {active.count} payment{active.count === 1 ? '' : 's'}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pickLatestPayment(payments) {
  if (!payments?.length) return null;
  const sorted = [...payments].sort((a, b) => {
    const am = toMillis(a.paidAt) || toMillis(a.updatedAt) || 0;
    const bm = toMillis(b.paidAt) || toMillis(b.updatedAt) || 0;
    return bm - am;
  });
  return sorted[0] || null;
}

function normalizePlanKeyFromPayment(payment) {
  if (!payment) return null;

  const planType = String(payment.planType || '')
    .trim()
    .toLowerCase();
  if (planType === 'walk-in' || planType === 'walkin') return 'walkin';
  if (planType === 'daily') return 'daily';
  if (planType === 'weekly') return 'weekly';
  if (planType === 'monthly') return 'monthly';

  const fromLegacyKey = (k) => {
    const v = String(k || '')
      .trim()
      .toLowerCase();
    if (v === 'base') return 'monthly';
    if (v === 'pro') return 'weekly';
    if (v === 'elite') return 'daily';
    if (v === 'walkin') return 'walkin';
    return null;
  };

  const fromPlan = String(payment.plan || '')
    .trim()
    .toLowerCase();
  if (fromPlan === 'daily' || fromPlan === 'weekly' || fromPlan === 'monthly' || fromPlan === 'walkin') return fromPlan;
  const legacyFromPlan = fromLegacyKey(fromPlan);
  if (legacyFromPlan) return legacyFromPlan;

  const fromCourse = String(payment.courseId || '')
    .trim()
    .toLowerCase();
  if (fromCourse === 'daily' || fromCourse === 'weekly' || fromCourse === 'monthly' || fromCourse === 'walkin') return fromCourse;
  const legacyFromCourse = fromLegacyKey(fromCourse);
  if (legacyFromCourse) return legacyFromCourse;

  const memberCategory = String(payment.memberCategory || '')
    .trim()
    .toLowerCase();
  if (
    memberCategory === 'member' ||
    memberCategory === 'student member' ||
    memberCategory === 'non-student member' ||
    memberCategory === 'regular member'
  ) {
    return 'monthly';
  }
  if (memberCategory === 'non-member' || memberCategory === 'non-regular member' || memberCategory === 'walk-in client') return 'walkin';

  return null;
}

function planLabel(planKey) {
  if (!planKey) return '—';
  if (planKey === 'daily') return 'Daily';
  if (planKey === 'weekly') return 'Weekly';
  if (planKey === 'monthly') return 'Monthly';
  if (planKey === 'walkin') return 'Walk-in';
  if (planKey === 'base') return 'Base';
  if (planKey === 'pro') return 'Pro';
  if (planKey === 'elite') return 'Elite';
  return `${planKey[0].toUpperCase()}${planKey.slice(1)}`;
}

function parseDateMs(dateValue) {
  if (!dateValue) return null;
  const ms = Date.parse(String(dateValue));
  return Number.isFinite(ms) ? ms : null;
}

/** Table placeholder when customerId is empty (—, -, en dash). */
function isPlaceholderCustomerId(value) {
  const t = String(value || '').trim();
  if (!t) return true;
  if (t === '—' || t === '-' || t === '–') return true;
  return false;
}

function formatCallableError(e) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '').trim();
  if (msg && !/^internal$/i.test(msg) && msg !== 'INTERNAL') {
    return msg;
  }
  if (/functions\/internal/i.test(code) || /^internal$/i.test(code)) {
    return 'Server error while deleting member. Please check backend logs and try again.';
  }
  return msg || code || 'Failed to complete request.';
}

const SESSION_DEFAULTS_FALLBACK = {
  member: { monthly: 10, daily: 1, walkin: 1 },
  nonMember: { monthly: 10, daily: 1, walkin: 1 },
};

function coalesceSessionDefaults(sd) {
  const flatM = Math.max(1, Math.floor(Number(sd?.monthly)) || SESSION_DEFAULTS_FALLBACK.member.monthly);
  const flatD = Math.max(1, Math.floor(Number(sd?.daily)) || SESSION_DEFAULTS_FALLBACK.member.daily);
  const flatW = Math.max(1, Math.floor(Number(sd?.walkin)) || SESSION_DEFAULTS_FALLBACK.member.walkin);
  const mem = sd?.member || {};
  const non = sd?.nonMember || {};
  return {
    member: {
      monthly: Math.max(1, Math.floor(Number(mem.monthly)) || flatM),
      daily: Math.max(1, Math.floor(Number(mem.daily)) || flatD),
      walkin: Math.max(1, Math.floor(Number(mem.walkin)) || flatW),
    },
    nonMember: {
      monthly: Math.max(1, Math.floor(Number(non.monthly)) || flatM),
      daily: Math.max(1, Math.floor(Number(non.daily)) || flatD),
      walkin: Math.max(1, Math.floor(Number(non.walkin)) || flatW),
    },
  };
}

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('members'); // members | billing | reports | customization
  const [memberSearch, setMemberSearch] = useState('');
  const [memberTypeFilter, setMemberTypeFilter] = useState('all'); // all | monthly | daily
  const [memberCategoryFilter, setMemberCategoryFilter] = useState('all'); // all | member | non-member
  const [reportDays, setReportDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiptUser, setReceiptUser] = useState(null); // { row, payments }
  const [markingPaymentId, setMarkingPaymentId] = useState(null);
  const [markingError, setMarkingError] = useState('');

  // Member management (create/delete) - admin-only.
  const [createMemberForm, setCreateMemberForm] = useState({
    customerId: '',
    fullName: '',
    phone: '',
    gender: 'prefer_not_say',
    birthday: '',
  });
  const [createMemberLoading, setCreateMemberLoading] = useState(false);
  const [createMemberError, setCreateMemberError] = useState('');
  const [createMemberSuccess, setCreateMemberSuccess] = useState('');

  const [deleteMemberCustomerId, setDeleteMemberCustomerId] = useState('');
  const [deleteMemberLoading, setDeleteMemberLoading] = useState(false);
  const [deleteMemberError, setDeleteMemberError] = useState('');
  const [deleteMemberSuccess, setDeleteMemberSuccess] = useState('');
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);

  const DEFAULT_STANDARD_PRICES = useMemo(() => ({ base: 49, pro: 79, elite: 119 }), []);
  const DEFAULT_TIER_PRICES = useMemo(
    () => ({
      member: { monthly: 49, daily: 119, walkin: 80 },
      nonMember: { monthly: 49, daily: 119, walkin: 80 },
    }),
    []
  );
  const DEFAULT_SESSION_DEFAULTS = useMemo(
    () => ({
      member: { ...SESSION_DEFAULTS_FALLBACK.member },
      nonMember: { ...SESSION_DEFAULTS_FALLBACK.nonMember },
    }),
    []
  );

  const DEFAULT_WALKIN = useMemo(
    () => ({ enabled: false, price: 80, startAtMs: null, endAtMs: null }),
    []
  );

  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingReloading, setPricingReloading] = useState(false);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState('');
  const [pricingSuccess, setPricingSuccess] = useState('');
  const [pricing, setPricing] = useState({
    standard: { base: DEFAULT_STANDARD_PRICES.base, pro: DEFAULT_STANDARD_PRICES.pro, elite: DEFAULT_STANDARD_PRICES.elite },
    tiers: {
      member: { ...DEFAULT_TIER_PRICES.member },
      nonMember: { ...DEFAULT_TIER_PRICES.nonMember },
    },
    sessionDefaults: {
      member: { ...DEFAULT_SESSION_DEFAULTS.member },
      nonMember: { ...DEFAULT_SESSION_DEFAULTS.nonMember },
    },
    walkIn: { ...DEFAULT_WALKIN },
  });

  function normalizeMs(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return value;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.seconds === 'number') return value.seconds * 1000;
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadPricing() {
      setPricingLoading(true);
      setPricingError('');
      setPricingSuccess('');
      try {
        const res = await getPricingSettings();
        const data = res?.pricing || {};
        const standard = data?.standard || {};
        const walkIn = data?.walkIn || {};
        const tiers = data?.tiers || {};
        const memberTier = tiers?.member || {};
        const nonMemberTier = tiers?.nonMember || {};
        const sd = coalesceSessionDefaults(data?.sessionDefaults);

        const next = {
          standard: {
            base: typeof standard.base === 'number' ? standard.base : DEFAULT_STANDARD_PRICES.base,
            pro: typeof standard.pro === 'number' ? standard.pro : DEFAULT_STANDARD_PRICES.pro,
            elite: typeof standard.elite === 'number' ? standard.elite : DEFAULT_STANDARD_PRICES.elite,
          },
          tiers: {
            member: {
              monthly: Number.isFinite(Number(memberTier.monthly)) ? Number(memberTier.monthly) : (typeof standard.base === 'number' ? standard.base : DEFAULT_TIER_PRICES.member.monthly),
              daily: Number.isFinite(Number(memberTier.daily)) ? Number(memberTier.daily) : (typeof standard.elite === 'number' ? standard.elite : DEFAULT_TIER_PRICES.member.daily),
              walkin: Number.isFinite(Number(memberTier.walkin)) ? Number(memberTier.walkin) : (typeof walkIn.price === 'number' ? walkIn.price : DEFAULT_TIER_PRICES.member.walkin),
            },
            nonMember: {
              monthly: Number.isFinite(Number(nonMemberTier.monthly)) ? Number(nonMemberTier.monthly) : (typeof standard.base === 'number' ? standard.base : DEFAULT_TIER_PRICES.nonMember.monthly),
              daily: Number.isFinite(Number(nonMemberTier.daily)) ? Number(nonMemberTier.daily) : (typeof standard.elite === 'number' ? standard.elite : DEFAULT_TIER_PRICES.nonMember.daily),
              walkin: Number.isFinite(Number(nonMemberTier.walkin)) ? Number(nonMemberTier.walkin) : (typeof walkIn.price === 'number' ? walkIn.price : DEFAULT_TIER_PRICES.nonMember.walkin),
            },
          },
          sessionDefaults: sd,
          walkIn: {
            enabled: Boolean(walkIn.enabled),
            price: typeof walkIn.price === 'number' ? walkIn.price : Number(walkIn.price || 0),
            startAtMs: normalizeMs(walkIn.startAtMs),
            endAtMs: normalizeMs(walkIn.endAtMs),
          },
        };

        if (!cancelled) setPricing(next);
      } catch (e) {
        if (!cancelled) setPricingError(e?.message || 'Failed to load pricing settings.');
      } finally {
        if (!cancelled) setPricingLoading(false);
      }
    }

    loadPricing();
    return () => {
      cancelled = true;
    };
  }, [DEFAULT_STANDARD_PRICES.elite, DEFAULT_STANDARD_PRICES.base, DEFAULT_STANDARD_PRICES.pro, DEFAULT_TIER_PRICES, DEFAULT_SESSION_DEFAULTS]);

  async function reloadPricingSettings() {
    setPricingReloading(true);
    setPricingError('');
    setPricingSuccess('');
    try {
      const res = await getPricingSettings();
      const data = res?.pricing || {};
      const standard = data?.standard || {};
      const walkIn = data?.walkIn || {};
      const tiers = data?.tiers || {};
      const memberTier = tiers?.member || {};
      const nonMemberTier = tiers?.nonMember || {};
      const sd = coalesceSessionDefaults(data?.sessionDefaults);

      setPricing({
        standard: {
          base: typeof standard.base === 'number' ? standard.base : DEFAULT_STANDARD_PRICES.base,
          pro: typeof standard.pro === 'number' ? standard.pro : DEFAULT_STANDARD_PRICES.pro,
          elite: typeof standard.elite === 'number' ? standard.elite : DEFAULT_STANDARD_PRICES.elite,
        },
        tiers: {
          member: {
            monthly: Number.isFinite(Number(memberTier.monthly)) ? Number(memberTier.monthly) : (typeof standard.base === 'number' ? standard.base : DEFAULT_TIER_PRICES.member.monthly),
            daily: Number.isFinite(Number(memberTier.daily)) ? Number(memberTier.daily) : (typeof standard.elite === 'number' ? standard.elite : DEFAULT_TIER_PRICES.member.daily),
            walkin: Number.isFinite(Number(memberTier.walkin)) ? Number(memberTier.walkin) : (typeof walkIn.price === 'number' ? walkIn.price : DEFAULT_TIER_PRICES.member.walkin),
          },
          nonMember: {
            monthly: Number.isFinite(Number(nonMemberTier.monthly)) ? Number(nonMemberTier.monthly) : (typeof standard.base === 'number' ? standard.base : DEFAULT_TIER_PRICES.nonMember.monthly),
            daily: Number.isFinite(Number(nonMemberTier.daily)) ? Number(nonMemberTier.daily) : (typeof standard.elite === 'number' ? standard.elite : DEFAULT_TIER_PRICES.nonMember.daily),
            walkin: Number.isFinite(Number(nonMemberTier.walkin)) ? Number(nonMemberTier.walkin) : (typeof walkIn.price === 'number' ? walkIn.price : DEFAULT_TIER_PRICES.nonMember.walkin),
          },
        },
        sessionDefaults: sd,
        walkIn: {
          enabled: Boolean(walkIn.enabled),
          price: typeof walkIn.price === 'number' ? walkIn.price : Number(walkIn.price || 0),
          startAtMs: normalizeMs(walkIn.startAtMs),
          endAtMs: normalizeMs(walkIn.endAtMs),
        },
      });
    } catch (e) {
      setPricingError(e?.message || 'Failed to reload pricing settings.');
    } finally {
      setPricingReloading(false);
    }
  }

  async function savePricingSettings(e) {
    if (e) e.preventDefault();
    setPricingSaving(true);
    setPricingError('');
    setPricingSuccess('');
    try {
      const memberMonthly = Number(pricing?.tiers?.member?.monthly);
      const memberDaily = Number(pricing?.tiers?.member?.daily);
      const nonMemberMonthly = Number(pricing?.tiers?.nonMember?.monthly);
      const nonMemberDaily = Number(pricing?.tiers?.nonMember?.daily);
      const sm = pricing?.sessionDefaults?.member || {};
      const sn = pricing?.sessionDefaults?.nonMember || {};
      const sessionPayload = {
        member: {
          monthly: Math.max(1, Math.floor(Number(sm.monthly)) || 10),
          daily: Math.max(1, Math.floor(Number(sm.daily)) || 1),
        },
        nonMember: {
          monthly: Math.max(1, Math.floor(Number(sn.monthly)) || 10),
          daily: Math.max(1, Math.floor(Number(sn.daily)) || 1),
        },
      };

      const allPrices = [memberMonthly, memberDaily, nonMemberMonthly, nonMemberDaily];
      if (allPrices.some((v) => !Number.isFinite(v) || v <= 0)) {
        throw new Error('All Member and Non-member prices must be valid numbers.');
      }

      const payload = {
        standard: {
          base: memberMonthly,
          pro: memberDaily,
          elite: memberDaily,
        },
        tiers: {
          member: {
            monthly: memberMonthly,
            daily: memberDaily,
          },
          nonMember: {
            monthly: nonMemberMonthly,
            daily: nonMemberDaily,
          },
        },
        sessionDefaults: sessionPayload,
      };

      await savePricingSettingsApi(payload);
      // Reload settings to reflect stored values.
      setPricingLoading(true);
      setPricingSaving(false);
      const res = await getPricingSettings();
      const data = res?.pricing || {};
      if (data) {
        const standard = data.standard || {};
        const walkIn = data.walkIn || {};
        const tiers = data.tiers || {};
        const memberTier = tiers.member || {};
        const nonMemberTier = tiers.nonMember || {};
        const savedSd = coalesceSessionDefaults(data.sessionDefaults);

        setPricing({
          standard: {
            base: typeof standard.base === 'number' ? standard.base : memberMonthly,
            pro: typeof standard.pro === 'number' ? standard.pro : memberDaily,
            elite: typeof standard.elite === 'number' ? standard.elite : memberDaily,
          },
          tiers: {
            member: {
              monthly: Number.isFinite(Number(memberTier.monthly)) ? Number(memberTier.monthly) : memberMonthly,
              daily: Number.isFinite(Number(memberTier.daily)) ? Number(memberTier.daily) : memberDaily,
            },
            nonMember: {
              monthly: Number.isFinite(Number(nonMemberTier.monthly)) ? Number(nonMemberTier.monthly) : nonMemberMonthly,
              daily: Number.isFinite(Number(nonMemberTier.daily)) ? Number(nonMemberTier.daily) : nonMemberDaily,
            },
          },
          sessionDefaults: savedSd,
          walkIn: {
            enabled: Boolean(walkIn.enabled),
            price: typeof walkIn.price === 'number' ? walkIn.price : 80,
            startAtMs: normalizeMs(walkIn.startAtMs),
            endAtMs: normalizeMs(walkIn.endAtMs),
          },
        });
      }
      setPricingSuccess('Saved successfully.');
    } catch (e) {
      setPricingError(e?.message || 'Failed to save pricing settings.');
    } finally {
      setPricingSaving(false);
      setPricingLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [usersRes, paymentsRes] = await Promise.all([listUsers(), listPayments()]);
      const fetchedUsers = usersRes?.users || [];
      const fetchedPayments = paymentsRes?.payments || [];

      setUsers(fetchedUsers);
      setPayments(fetchedPayments);
    } catch (e) {
      if (e?.code === 'permission-denied') {
        setError('Permission denied. Make sure your admin account is signed in.');
      } else {
        setError(e?.message || 'Failed to load admin data.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkPaymentPaid(paymentId) {
    setMarkingError('');
    setMarkingPaymentId(paymentId);
    try {
      await markPaymentPaid(paymentId);
      await loadData();
    } catch (e) {
      setMarkingError(e?.message || 'Failed to mark payment as paid.');
    } finally {
      setMarkingPaymentId(null);
    }
  }

  async function handleCreateMember() {
    setCreateMemberError('');
    setCreateMemberSuccess('');
    setCreateMemberLoading(true);
    try {
      const payload = {
        fullName: createMemberForm.fullName || null,
        phone: createMemberForm.phone || null,
        customerId: createMemberForm.customerId || null,
        amount: Number(pricing?.tiers?.member?.walkin || pricing.standard.elite || 80),
      };

      const res = await createWalkInClient(payload);
      setCreateMemberSuccess(`Created walk-in: ${res?.customerId || payload.customerId || '—'} (${res?.userId || '—'})`);
      setCreateMemberForm({
        customerId: '',
        fullName: '',
        phone: '',
        gender: 'prefer_not_say',
        birthday: '',
      });
      await loadData();
    } catch (e) {
      setCreateMemberError(e?.message || 'Failed to create member.');
    } finally {
      setCreateMemberLoading(false);
    }
  }

  async function handleDeleteMember() {
    setDeleteMemberError('');
    setDeleteMemberSuccess('');
    try {
      const customerId = String(deleteMemberCustomerId || '').trim();
      if (!customerId) throw new Error('Enter a Customer ID to delete.');

      const ok = window.confirm(`Delete member ${customerId}? This will remove their account and payments.`);
      if (!ok) return;

      setDeleteMemberLoading(true);
      await adminDeleteMember({ customerId });
      setDeleteMemberSuccess(`Deleted member: ${customerId}`);
      setDeleteMemberCustomerId('');
      await loadData();
    } catch (e) {
      setDeleteMemberError(formatCallableError(e));
    } finally {
      setDeleteMemberLoading(false);
    }
  }

  async function handleDeleteMemberFromRow(row) {
    setDeleteMemberError('');
    setDeleteMemberSuccess('');
    if (String(row?.role || '').trim().toLowerCase() === 'admin') {
      setDeleteMemberError('Admin accounts cannot be deleted.');
      return;
    }
    const customerId = String(row?.customerId || '').trim();
    const uid = String(row?.id || '').trim();
    const name = String(row?.name || '').trim() || customerId || 'this member';

    const normalizedCustomerId = !isPlaceholderCustomerId(customerId) ? customerId : null;
    if (!uid && !normalizedCustomerId) {
      setDeleteMemberError('Cannot delete: missing member identifier for this row.');
      return;
    }

    const displayId = normalizedCustomerId || uid;
    const ok = window.confirm(`Delete ${name} (${displayId})?\n\nThis will delete the account and all payment records.`);
    if (!ok) return;

    setDeleteMemberLoading(true);
    try {
      const payload = {};
      if (uid) payload.uid = uid;
      if (normalizedCustomerId) payload.customerId = normalizedCustomerId;
      await adminDeleteMember(payload);
      setDeleteMemberSuccess(`Deleted member: ${name} (${displayId})`);
      await loadData();
    } catch (e) {
      setDeleteMemberError(formatCallableError(e));
    } finally {
      setDeleteMemberLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initialLoad() {
      if (!mounted) return;
      await loadData();
    }

    initialLoad();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paymentsByUserId = useMemo(() => {
    const map = new Map();
    for (const p of payments) {
      if (!p?.userId) continue;
      const list = map.get(p.userId) || [];
      list.push(p);
      map.set(p.userId, list);
    }
    return map;
  }, [payments]);

  const usersById = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (!u?.id) continue;
      map.set(String(u.id), u);
    }
    return map;
  }, [users]);

  const rows = useMemo(() => {
    const now = Date.now();

    return users.map((u) => {
      const userPayments = paymentsByUserId.get(u.id) || [];
      const latest = pickLatestPayment(userPayments);

      const pendingSorted = [...userPayments].filter((p) => p?.status === 'pending').sort((a, b) => {
        const am = toMillis(a?.submittedAt) || toMillis(a?.createdAt) || toMillis(a?.updatedAt) || 0;
        const bm = toMillis(b?.submittedAt) || toMillis(b?.createdAt) || toMillis(b?.updatedAt) || 0;
        return bm - am;
      });
      const pendingPaymentId = pendingSorted[0]?.id || null;
      const pendingCount = pendingSorted.length;

      let status = 'Inactive';
      if (latest?.status === 'paid') {
        const endDateMs = parseDateMs(latest?.endDate);
        status = endDateMs && endDateMs < now ? 'Inactive' : 'Active';
      } else if (latest?.status === 'pending') {
        status = 'Pending';
      }

      const planKey = normalizePlanKeyFromPayment(latest);
      const plan = planLabel(planKey);
      const rawCategory = String(latest?.memberCategory || '').trim().toLowerCase();
      const memberType = rawCategory.includes('non-member') ? 'Non-member' : 'Member';
      const sessions =
        typeof latest?.sessions === 'number' && Number.isFinite(latest.sessions) ? latest.sessions : null;
      const sessionsRemaining =
        typeof u.sessionsRemaining === 'number' && Number.isFinite(u.sessionsRemaining) ? u.sessionsRemaining : null;

      return {
        id: u.id,
        customerId: u.customerId || u.memberId || '—',
        name: u.fullName || u.phone || u.id,
        role: u.role || null,
        planKey,
        plan,
        memberType,
        sessions,
        sessionsRemaining,
        status,
        pendingPaymentId,
        pendingCount,
        birthday: u.birthday || null,
        gender: u.gender || null,
        phone: u.phone || null,
      };
    });
  }, [users, paymentsByUserId]);

  function openReceipt(row) {
    const userPayments = paymentsByUserId.get(row.id) || [];
    const sorted = [...userPayments].sort((a, b) => {
      const am = toMillis(a?.submittedAt) || toMillis(a?.paidAt) || toMillis(a?.updatedAt) || 0;
      const bm = toMillis(b?.submittedAt) || toMillis(b?.paidAt) || toMillis(b?.updatedAt) || 0;
      return bm - am;
    });

    setReceiptUser({
      row,
      payments: sorted,
    });
  }

  const filteredRows = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();

    return rows.filter((r) => {
      const planKey = r?.planKey;
      const isMonthly = planKey === 'monthly' || planKey === 'base';
      const isDaily = planKey === 'daily' || planKey === 'elite';

      if (memberTypeFilter === 'monthly' && !isMonthly) return false;
      if (memberTypeFilter === 'daily' && !isDaily) return false;
      if (memberCategoryFilter === 'member' && r?.memberType !== 'Member') return false;
      if (memberCategoryFilter === 'non-member' && r?.memberType !== 'Non-member') return false;

      if (!q) return true;
      const haystack = [r?.customerId, r?.id, r?.name, r?.phone, r?.plan, r?.memberType]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [memberSearch, memberTypeFilter, memberCategoryFilter, rows]);

  const paidPayments = useMemo(() => payments.filter((p) => p?.status === 'paid'), [payments]);
  const pendingPayments = useMemo(
    () => payments.filter((p) => p?.status === 'pending'),
    [payments]
  );

  const dailyReport = useMemo(() => {
    const days = Math.max(7, Math.min(60, Math.floor(Number(reportDays)) || 14));
    const now = Date.now();
    const startMs = startOfLocalDayMs(now - (days - 1) * 24 * 60 * 60 * 1000);

    const buckets = new Map(); // dayStartMs -> { total, count, dailyTotal, monthlyTotal }
    for (let i = 0; i < days; i += 1) {
      const dayMs = startMs + i * 24 * 60 * 60 * 1000;
      buckets.set(dayMs, { dayMs, total: 0, count: 0, dailyTotal: 0, monthlyTotal: 0 });
    }

    for (const p of paidPayments) {
      const paidAtMs = toMillis(p?.paidAt) || toMillis(p?.updatedAt) || 0;
      if (!paidAtMs) continue;
      const dayMs = startOfLocalDayMs(paidAtMs);
      if (dayMs < startMs) continue;
      const b = buckets.get(dayMs);
      if (!b) continue;
      const amt = typeof p?.amount === 'number' && Number.isFinite(p.amount) ? p.amount : 0;
      b.total += amt;
      b.count += 1;
      const planKey = normalizePlanKeyFromPayment(p);
      if (planKey === 'daily' || planKey === 'elite') b.dailyTotal += amt;
      if (planKey === 'monthly' || planKey === 'base') b.monthlyTotal += amt;
    }

    const series = Array.from(buckets.values()).sort((a, b) => a.dayMs - b.dayMs);
    const maxTotal = series.reduce((m, v) => Math.max(m, v.total), 0);
    const sumTotal = series.reduce((acc, v) => acc + v.total, 0);
    const sumCount = series.reduce((acc, v) => acc + v.count, 0);
    const sumDaily = series.reduce((acc, v) => acc + v.dailyTotal, 0);
    const sumMonthly = series.reduce((acc, v) => acc + v.monthlyTotal, 0);

    return {
      days,
      series,
      maxTotal,
      sumTotal,
      sumCount,
      sumDaily,
      sumMonthly,
    };
  }, [paidPayments, reportDays]);

  const billing = useMemo(() => {
    const sum = (arr) =>
      arr.reduce((acc, p) => {
        const amt = typeof p?.amount === 'number' ? p.amount : 0;
        return acc + amt;
      }, 0);

    const monthlyPaid = paidPayments.filter((p) => {
      const planKey = normalizePlanKeyFromPayment(p);
      return planKey === 'monthly' || planKey === 'base';
    });

    const dailyPaid = paidPayments.filter((p) => {
      const planKey = normalizePlanKeyFromPayment(p);
      return planKey === 'daily' || planKey === 'elite';
    });

    const monthlyRevenue = sum(monthlyPaid);
    const dailyRevenue = sum(dailyPaid);
    const totalRevenue = monthlyRevenue + dailyRevenue;

    return {
      paidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
      paidTotal: sum(paidPayments),
      pendingTotal: sum(pendingPayments),
      monthlyRevenue,
      dailyRevenue,
      totalRevenue,
    };
  }, [paidPayments, pendingPayments]);

  const formatDate = (ts) => {
    const ms = toMillis(ts);
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const recentPayments = useMemo(() => {
    const sorted = [...payments].sort((a, b) => {
      const am = toMillis(a.paidAt) || toMillis(a.updatedAt) || 0;
      const bm = toMillis(b.paidAt) || toMillis(b.updatedAt) || 0;
      return bm - am;
    });
    return sorted.slice(0, 10);
  }, [payments]);

  const membersEmptyMessage = (() => {
    const q = memberSearch.trim();
    if (q) return `No members match "${q}".`;
    if (memberTypeFilter === 'monthly') return 'No monthly members found.';
    if (memberTypeFilter === 'daily') return 'No daily members found.';
    if (memberCategoryFilter === 'member') return 'No members found for Member category.';
    if (memberCategoryFilter === 'non-member') return 'No members found for Non-member category.';
    return 'No users found in database yet.';
  })();

  return (
    <>
      <main className="page-main admin-page-main">
      <div className="admin-dashboard">
        <aside className="admin-sidebar" aria-label="Admin navigation">
          <div className="admin-sidebar__brand">
            <span className="admin-sidebar__dot" aria-hidden />
            Admin
          </div>
          <nav className="admin-sidebar__nav">
            <button
              type="button"
              className={`admin-sidebar__link ${activeView === 'members' ? 'admin-sidebar__link--active' : 'admin-sidebar__link--muted'}`}
              onClick={() => setActiveView('members')}
              aria-current={activeView === 'members' ? 'page' : undefined}
            >
              Members
            </button>
            <button
              type="button"
              className={`admin-sidebar__link ${activeView === 'billing' ? 'admin-sidebar__link--active' : 'admin-sidebar__link--muted'}`}
              onClick={() => setActiveView('billing')}
              aria-current={activeView === 'billing' ? 'page' : undefined}
            >
              Billing
            </button>
            <button
              type="button"
              className={`admin-sidebar__link ${activeView === 'reports' ? 'admin-sidebar__link--active' : 'admin-sidebar__link--muted'}`}
              onClick={() => setActiveView('reports')}
              aria-current={activeView === 'reports' ? 'page' : undefined}
            >
              Reports
            </button>
            <button
              type="button"
              className={`admin-sidebar__link ${activeView === 'customization' ? 'admin-sidebar__link--active' : 'admin-sidebar__link--muted'}`}
              onClick={() => setActiveView('customization')}
              aria-current={activeView === 'customization' ? 'page' : undefined}
            >
              Customization
            </button>
          </nav>
          <p className="admin-sidebar__foot">Signed in as {user?.email}</p>
        </aside>

        <div className="admin-main">
          <header className="admin-topbar">
            <div>
              <h1 className="admin-title">Dashboard</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <Link className="btn-ghost btn-ghost--small" to="/">
                View site
              </Link>
              <button type="button" className="btn-ghost btn-ghost--small" onClick={logout}>
                Log out
              </button>
            </div>
          </header>

          {activeView === 'members' && (
            <section className="admin-panel admin-panel--flush" aria-labelledby="members-heading">
              <div className="admin-panel__head">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', minWidth: '18rem' }}>
                  <h2 id="members-heading" className="admin-panel__title">
                    Members
                  </h2>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="admin-search" style={{ width: 'min(22rem, 100%)' }}>
                      <span className="admin-search__icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M21 21l-4.35-4.35"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <input
                        className="field__input admin-search__input"
                        style={{ width: '100%', padding: '0.55rem 0.8rem', fontSize: '0.95rem' }}
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        aria-label="Search members"
                      />
                    </div>
                    <select
                      className="field__input"
                      style={{ width: '14rem', padding: '0.55rem 0.8rem', fontSize: '0.95rem' }}
                      value={memberTypeFilter}
                      onChange={(e) => setMemberTypeFilter(e.target.value)}
                      aria-label="Filter by plan type"
                    >
                      <option value="all">All</option>
                      <option value="monthly">Monthly</option>
                      <option value="daily">Daily</option>
                    </select>
                    <select
                      className="field__input"
                      style={{ width: '14rem', padding: '0.55rem 0.8rem', fontSize: '0.95rem' }}
                      value={memberCategoryFilter}
                      onChange={(e) => setMemberCategoryFilter(e.target.value)}
                      aria-label="Filter by member category"
                    >
                      <option value="all">All types</option>
                      <option value="member">Member</option>
                      <option value="non-member">Non-member</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn-primary" style={{ padding: '0.55rem 1rem', fontSize: '0.875rem' }} onClick={() => setAddUserModalOpen(true)}>
                    Add User
                  </button>
                  <button type="button" className="btn-ghost btn-ghost--small" onClick={loadData} disabled={loading}>
                    Refresh
                  </button>
                </div>
              </div>

              {deleteMemberError && (
                <p className="form-error" role="alert" style={{ margin: '0 1.25rem 0.75rem' }}>
                  {deleteMemberError}
                </p>
              )}
              {deleteMemberSuccess && (
                <p className="form-success" role="status" style={{ margin: '0 1.25rem 0.75rem' }}>
                  {deleteMemberSuccess}
                </p>
              )}

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Customer ID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Gender</th>
                      <th scope="col">Birthday</th>
                      <th scope="col">Contact</th>
                      <th scope="col">Member Type</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Sessions left</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {error ? (
                      <tr>
                        <td colSpan={10} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          {error}
                        </td>
                      </tr>
                    ) : loading ? (
                      <tr>
                        <td colSpan={10} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          Loading members...
                        </td>
                      </tr>
                    ) : filteredRows.length ? (
                      filteredRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.customerId}</td>
                          <td>
                            <button
                              type="button"
                              className="btn-ghost btn-ghost--small admin-member-name-link"
                              style={{ maxWidth: '16rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              onClick={() => openReceipt(row)}
                            >
                              {row.name}
                            </button>
                          </td>
                          <td>{row.gender || '—'}</td>
                          <td>{row.birthday || '—'}</td>
                          <td>{row.phone || '—'}</td>
                          <td>{row.memberType || 'Member'}</td>
                          <td>{row.plan}</td>
                          <td>{row.sessionsRemaining != null ? row.sessionsRemaining : '—'}</td>
                          <td>
                            <span
                              className={`pill pill--${row.status === 'Active' ? 'ok' : 'warn'}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {row.pendingPaymentId ? (
                                <button
                                  type="button"
                                  className="admin-action-icon-btn"
                                  onClick={() => handleMarkPaymentPaid(row.pendingPaymentId)}
                                  disabled={markingPaymentId === row.pendingPaymentId}
                                  aria-label={`Mark ${row.name} as paid`}
                                  title="Mark pending as paid"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M12 20h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    <path
                                      d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}

                              <button
                                type="button"
                                className="admin-action-icon-btn admin-action-icon-btn--danger"
                                onClick={() => handleDeleteMemberFromRow(row)}
                                disabled={deleteMemberLoading}
                                aria-label={`Delete ${row.name}`}
                                title="Delete member"
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                  <path
                                    d="M3 6h18"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                  <path
                                    d="M8 6V4h8v2"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M6 6l1 16h10l1-16"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinejoin="round"
                                  />
                                  <path d="M10 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <path d="M14 11v7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={10} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          {membersEmptyMessage}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'billing' && (
            <section className="admin-panel" aria-labelledby="billing-heading">
              <div className="admin-panel__head">
                <div>
                  <h2 id="billing-heading" className="admin-panel__title">
                    Billing
                  </h2>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-ghost--small"
                  onClick={loadData}
                  disabled={loading}
                >
                  Refresh
                </button>
              </div>

              <div className="billing-summary-wrap" aria-label="Revenue summary">
                <div className="billing-summary">
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Total revenue</p>
                    <p className="billing-summary__value">{loading ? '—' : `PHP ${Number(billing.totalRevenue || 0).toFixed(2)}`}</p>
                    <p className="billing-summary__meta">Daily + Monthly (paid)</p>
                  </article>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Monthly revenue</p>
                    <p className="billing-summary__value">{loading ? '—' : `PHP ${Number(billing.monthlyRevenue || 0).toFixed(2)}`}</p>
                    <p className="billing-summary__meta">Monthly plan only (paid)</p>
                  </article>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Daily revenue</p>
                    <p className="billing-summary__value">{loading ? '—' : `PHP ${Number(billing.dailyRevenue || 0).toFixed(2)}`}</p>
                    <p className="billing-summary__meta">Daily plan only (paid)</p>
                  </article>
                </div>
              </div>
              {markingError && (
                <p className="form-error" role="alert" style={{ margin: '0.95rem 1.25rem 0' }}>
                  {markingError}
                </p>
              )}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Customer ID</th>
                      <th scope="col">Name</th>
                      <th scope="col">Plan</th>
                      <th scope="col">Sessions</th>
                      <th scope="col">Amount</th>
                      <th scope="col">Status</th>
                      <th scope="col">Paid at</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {error ? (
                      <tr>
                        <td colSpan={8} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          {error}
                        </td>
                      </tr>
                    ) : loading ? (
                      <tr>
                        <td colSpan={8} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          Loading payments...
                        </td>
                      </tr>
                    ) : recentPayments.length ? (
                      recentPayments.map((p) => (
                        <tr key={p.id}>
                          {(() => {
                            const u = p?.userId ? usersById.get(String(p.userId)) : null;
                            const customerId = u?.customerId || u?.memberId || p?.customerId || '—';
                            const name = u?.fullName || u?.phone || p?.customerId || p?.userId || '—';
                            return (
                              <>
                                <td>{customerId}</td>
                                <td>{name}</td>
                              </>
                            );
                          })()}
                          <td>{planLabel(normalizePlanKeyFromPayment(p))}</td>
                          <td>{typeof p.sessions === 'number' && Number.isFinite(p.sessions) ? p.sessions : '—'}</td>
                          <td>{typeof p.amount === 'number' ? `PHP ${p.amount.toFixed(2)}` : '—'}</td>
                          <td>
                            <span className={`pill pill--${p.status === 'paid' ? 'ok' : 'warn'}`}>
                              {p.status === 'paid' ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td>{formatDate(p.paidAt) || '—'}</td>
                          <td>
                            {p.status === 'pending' ? (
                              <button
                                type="button"
                                className="btn-primary"
                                style={{ padding: '0.55rem 0.95rem', fontSize: '0.8125rem' }}
                                onClick={() => handleMarkPaymentPaid(p.id)}
                                disabled={markingPaymentId === p.id}
                              >
                                {markingPaymentId === p.id ? 'Marking…' : 'Mark paid'}
                              </button>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                          No payments found yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeView === 'reports' && (
            <section className="admin-panel" aria-labelledby="reports-heading">
              <div className="admin-panel__head">
                <div>
                  <h2 id="reports-heading" className="admin-panel__title">
                    Reports
                  </h2>
                  <p className="page-subtitle" style={{ margin: 0 }}>
                    Daily revenue graph (paid payments). Each bar is the total amount paid that day.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="field__input"
                    style={{ width: '12rem', padding: '0.55rem 0.8rem', fontSize: '0.95rem' }}
                    value={dailyReport.days}
                    onChange={(e) => setReportDays(Number(e.target.value))}
                    aria-label="Select report range"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                  </select>
                  <button
                    type="button"
                    className="btn-ghost btn-ghost--small"
                    onClick={loadData}
                    disabled={loading}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div style={{ padding: '1.1rem 1.25rem' }}>
                <div className="billing-summary" aria-label="Daily report summary" style={{ marginTop: 0, maxWidth: 'none' }}>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Total revenue</p>
                    <p className="billing-summary__value">
                      {loading ? '—' : `PHP ${Number(dailyReport.sumTotal || 0).toFixed(2)}`}
                    </p>
                    <p className="billing-summary__meta">{loading ? '—' : `${dailyReport.days} days (paid)`}</p>
                  </article>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Payments</p>
                    <p className="billing-summary__value">{loading ? '—' : dailyReport.sumCount}</p>
                    <p className="billing-summary__meta">Paid transactions</p>
                  </article>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Daily vs Monthly</p>
                    <p className="billing-summary__value">
                      {loading ? '—' : `PHP ${Number(dailyReport.sumDaily || 0).toFixed(2)} / PHP ${Number(dailyReport.sumMonthly || 0).toFixed(2)}`}
                    </p>
                    <p className="billing-summary__meta">Daily / Monthly revenue</p>
                  </article>
                </div>

                <div
                  style={{
                    marginTop: '1.1rem',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    padding: '1rem',
                    background: 'rgba(0,0,0,0.18)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <div>
                      <div style={{ fontWeight: 700, letterSpacing: '0.02em' }}>Daily revenue</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                        Trend line + area chart. Move your mouse over the chart to see the exact value for a day.
                      </div>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                      Peak day: {dailyReport.maxTotal ? formatPhp(dailyReport.maxTotal) : '—'}
                    </div>
                  </div>

                  <DailyRevenueChart series={dailyReport.series} maxTotal={dailyReport.maxTotal} days={dailyReport.days} />
                </div>
              </div>
            </section>
          )}

          {activeView === 'customization' && (
            <section className="admin-panel" aria-labelledby="customization-heading">
              <form className="clutch-form clutch-form--tight" onSubmit={savePricingSettings}>
                <div className="admin-panel__head">
                  <h2 id="customization-heading" className="admin-panel__title">
                    Customization
                  </h2>
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn-ghost btn-ghost--small"
                      onClick={reloadPricingSettings}
                      disabled={pricingLoading || pricingReloading || pricingSaving}
                      title="Reload pricing settings"
                    >
                      {pricingReloading ? 'Reloading…' : 'Reload'}
                    </button>
                    <button
                      type="submit"
                      className="btn-ghost btn-ghost--small"
                      disabled={pricingLoading || pricingSaving}
                    >
                      {pricingSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>

                {pricingError && (
                  <p className="form-error" role="alert" style={{ margin: '0 1.25rem 0' }}>
                    {pricingError}
                  </p>
                )}
                {pricingSuccess && (
                  <p className="form-success" role="status" style={{ margin: '0.45rem 1.25rem 0' }}>
                    {pricingSuccess}
                  </p>
                )}

                <div style={{ padding: '0 1.25rem 1.25rem' }}>
                  <h3 className="reg-section__title" style={{ margin: '1rem 0 0.75rem' }}>
                    Member — price &amp; coach sessions
                  </h3>
                  <p className="payment-hint" style={{ margin: '0 0 0.65rem' }}>
                    Prices and default session counts for clients who select <strong>Member</strong> on the payment form. Members cannot change amount or sessions; only admins can adjust them here.
                  </p>
                  <div className="form-grid form-grid--2">
                    <label className="field"><span className="field__label">Monthly price (PHP)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.tiers.member.monthly} onChange={(e) => setPricing((p) => ({ ...p, tiers: { ...p.tiers, member: { ...p.tiers.member, monthly: Number(e.target.value) } } }))} required /></label>
                    <label className="field"><span className="field__label">Monthly sessions (members)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.sessionDefaults.member.monthly} onChange={(e) => setPricing((p) => ({ ...p, sessionDefaults: { ...p.sessionDefaults, member: { ...p.sessionDefaults.member, monthly: Math.max(1, Math.floor(Number(e.target.value)) || 1) } } }))} required /></label>
                    <label className="field"><span className="field__label">Daily price (PHP)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.tiers.member.daily} onChange={(e) => setPricing((p) => ({ ...p, tiers: { ...p.tiers, member: { ...p.tiers.member, daily: Number(e.target.value) } } }))} required /></label>
                    <label className="field"><span className="field__label">Daily sessions (members)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.sessionDefaults.member.daily} onChange={(e) => setPricing((p) => ({ ...p, sessionDefaults: { ...p.sessionDefaults, member: { ...p.sessionDefaults.member, daily: Math.max(1, Math.floor(Number(e.target.value)) || 1) } } }))} required /></label>
                  </div>

                  <h3 className="reg-section__title" style={{ margin: '1.25rem 0 0.75rem' }}>
                    Non-member — price &amp; coach sessions
                  </h3>
                  <p className="payment-hint" style={{ margin: '0 0 0.65rem' }}>
                    Same plans for clients who select <strong>Non-member</strong>. You can set different daily/monthly prices and session counts than for members.
                  </p>
                  <div className="form-grid form-grid--2">
                    <label className="field"><span className="field__label">Monthly price (PHP)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.tiers.nonMember.monthly} onChange={(e) => setPricing((p) => ({ ...p, tiers: { ...p.tiers, nonMember: { ...p.tiers.nonMember, monthly: Number(e.target.value) } } }))} required /></label>
                    <label className="field"><span className="field__label">Monthly sessions (non-members)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.sessionDefaults.nonMember.monthly} onChange={(e) => setPricing((p) => ({ ...p, sessionDefaults: { ...p.sessionDefaults, nonMember: { ...p.sessionDefaults.nonMember, monthly: Math.max(1, Math.floor(Number(e.target.value)) || 1) } } }))} required /></label>
                    <label className="field"><span className="field__label">Daily price (PHP)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.tiers.nonMember.daily} onChange={(e) => setPricing((p) => ({ ...p, tiers: { ...p.tiers, nonMember: { ...p.tiers.nonMember, daily: Number(e.target.value) } } }))} required /></label>
                    <label className="field"><span className="field__label">Daily sessions (non-members)</span><input className="field__input" type="number" inputMode="numeric" min={1} value={pricing.sessionDefaults.nonMember.daily} onChange={(e) => setPricing((p) => ({ ...p, sessionDefaults: { ...p.sessionDefaults, nonMember: { ...p.sessionDefaults.nonMember, daily: Math.max(1, Math.floor(Number(e.target.value)) || 1) } } }))} required /></label>
                  </div>
                </div>
              </form>
            </section>
          )}
        </div>
      </div>
      </main>

      {addUserModalOpen && (
        <div className="review-modal-overlay" role="presentation" onClick={() => setAddUserModalOpen(false)}>
          <div
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '960px', width: 'calc(100% - 2rem)' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div>
                <h3 id="add-user-modal-title" className="review-modal__title">
                  Walk-in Clients
                </h3>
                <p className="page-subtitle" style={{ margin: '0.35rem 0 0' }}>
                  Create or delete walk-in clients. New accounts get a paid walk-in payment at your member walk-in price from Customization.
                </p>
              </div>
              <button type="button" className="btn-ghost btn-ghost--small" onClick={() => setAddUserModalOpen(false)}>
                Close
              </button>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              <div>
                <h4 className="reg-section__title" style={{ margin: '0 0 0.85rem' }}>
                  Create Walk-in Client
                </h4>

                {createMemberError && (
                  <p className="form-error" role="alert" style={{ margin: '0 0 0.85rem' }}>
                    {createMemberError}
                  </p>
                )}
                {createMemberSuccess && (
                  <p className="form-success" role="status" style={{ margin: '0 0 0.85rem' }}>
                    {createMemberSuccess}
                  </p>
                )}

                <div className="clutch-form clutch-form--tight" style={{ gap: '0.9rem' }}>
                  <label className="field">
                    <span className="field__label">Customer ID (optional)</span>
                    <input
                      className="field__input"
                      value={createMemberForm.customerId}
                      onChange={(e) => setCreateMemberForm((p) => ({ ...p, customerId: e.target.value }))}
                      placeholder="03102003ric (MMDDYYYY + first 3 letters)"
                      type="text"
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Full name (optional)</span>
                    <input
                      className="field__input"
                      value={createMemberForm.fullName}
                      onChange={(e) => setCreateMemberForm((p) => ({ ...p, fullName: e.target.value }))}
                      type="text"
                      placeholder="Jordan Lee"
                    />
                  </label>

                  <label className="field">
                    <span className="field__label">Phone (optional)</span>
                    <input
                      className="field__input"
                      value={createMemberForm.phone}
                      onChange={(e) => setCreateMemberForm((p) => ({ ...p, phone: e.target.value }))}
                      type="tel"
                      placeholder="09xxxxxxxxx"
                    />
                  </label>

                  <div className="form-grid form-grid--2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <label className="field">
                      <span className="field__label">Gender</span>
                      <select
                        className="field__input reg-select"
                        value={createMemberForm.gender}
                        onChange={(e) => setCreateMemberForm((p) => ({ ...p, gender: e.target.value }))}
                      >
                        <option value="prefer_not_say">Prefer not to say</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </label>

                    <label className="field">
                      <span className="field__label">Birthday</span>
                      <input
                        className="field__input"
                        value={createMemberForm.birthday}
                        onChange={(e) => setCreateMemberForm((p) => ({ ...p, birthday: e.target.value }))}
                        type="date"
                      />
                    </label>
                  </div>

                  <div className="form-actions" style={{ marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCreateMember}
                      disabled={createMemberLoading}
                    >
                      {createMemberLoading ? 'Creating…' : 'Create Member'}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="reg-section__title" style={{ margin: '0 0 0.85rem' }}>
                  Delete Walk-in Client
                </h4>

                {deleteMemberError && (
                  <p className="form-error" role="alert" style={{ margin: '0 0 0.85rem' }}>
                    {deleteMemberError}
                  </p>
                )}
                {deleteMemberSuccess && (
                  <p className="form-success" role="status" style={{ margin: '0 0 0.85rem' }}>
                    {deleteMemberSuccess}
                  </p>
                )}

                <div className="clutch-form clutch-form--tight" style={{ gap: '0.9rem' }}>
                  <label className="field">
                    <span className="field__label">Customer ID</span>
                    <input
                      className="field__input"
                      value={deleteMemberCustomerId}
                      onChange={(e) => setDeleteMemberCustomerId(e.target.value)}
                      placeholder="03102003ric (MMDDYYYY + first 3 letters)"
                      type="text"
                    />
                  </label>

                  <div className="form-actions" style={{ marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn-primary"
                      style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ff3b3b 42%, #c20000 100%)' }}
                      onClick={handleDeleteMember}
                      disabled={deleteMemberLoading}
                    >
                      {deleteMemberLoading ? 'Deleting…' : 'Delete Member'}
                    </button>
                  </div>
                  <p className="payment-hint" style={{ margin: '0.2rem 0 0' }}>
                    This deletes the member account and all their payment records.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiptUser && (
        <div className="review-modal-overlay" role="presentation" onClick={() => setReceiptUser(null)}>
          <div
            className="review-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '720px' }}
          >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
            <div>
              <h3 id="receipt-modal-title" className="review-modal__title">
                Payment Receipt: {receiptUser.row.name}
              </h3>
              <p className="page-subtitle" style={{ margin: 0, marginBottom: '0.9rem' }}>
                Customer ID: <strong>{receiptUser.row.customerId}</strong> · Status:{' '}
                <strong style={{ color: 'var(--accent)' }}>{receiptUser.row.status}</strong>
                {receiptUser.row.sessionsRemaining != null ? (
                  <>
                    {' '}
                    · Sessions left: <strong>{receiptUser.row.sessionsRemaining}</strong>
                  </>
                ) : null}
              </p>
            </div>
            <button type="button" className="btn-ghost btn-ghost--small" onClick={() => setReceiptUser(null)}>
              Close
            </button>
          </div>

          <div className="billing-summary" style={{ marginTop: '0.25rem', maxWidth: 'none' }}>
            {(() => {
              const total = receiptUser.payments.reduce(
                (acc, p) => acc + (typeof p?.amount === 'number' ? p.amount : 0),
                0
              );
              const paidCount = receiptUser.payments.filter((p) => p?.status === 'paid').length;
              return (
                <>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Total amount</p>
                    <p className="billing-summary__value">{total ? `PHP ${total.toFixed(2)}` : '—'}</p>
                    <p className="billing-summary__meta">All requests</p>
                  </article>
                  <article className="billing-summary__tile">
                    <p className="billing-summary__label">Paid requests</p>
                    <p className="billing-summary__value">{paidCount}</p>
                    <p className="billing-summary__meta">Confirmed by admin</p>
                  </article>
                </>
              );
            })()}
          </div>

          <div style={{ marginTop: '1.1rem' }}>
            <div className="table-wrap">
              <table className="data-table" aria-label="Payment history">
                <thead>
                  <tr>
                    <th scope="col">Ref</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Sessions</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Requested</th>
                    <th scope="col">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptUser.payments.length ? (
                    receiptUser.payments.map((p) => {
                      const planKey = normalizePlanKeyFromPayment(p);
                      const plan = planLabel(planKey);
                      return (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{plan}</td>
                          <td>{typeof p.sessions === 'number' && Number.isFinite(p.sessions) ? p.sessions : '—'}</td>
                          <td>{typeof p.amount === 'number' ? `PHP ${p.amount.toFixed(2)}` : '—'}</td>
                          <td>
                            <span className={`pill pill--${p.status === 'paid' ? 'ok' : 'warn'}`}>
                              {p.status === 'paid' ? 'Paid' : p.status === 'pending' ? 'Pending' : p.status}
                            </span>
                            {p.status === 'pending' && (
                              <button
                                type="button"
                                className="btn-primary"
                                style={{
                                  marginLeft: '0.75rem',
                                  padding: '0.45rem 0.8rem',
                                  fontSize: '0.8125rem',
                                  verticalAlign: 'middle',
                                }}
                                onClick={() => handleMarkPaymentPaid(p.id)}
                                disabled={markingPaymentId === p.id}
                              >
                                {markingPaymentId === p.id ? 'Marking…' : 'Mark paid'}
                              </button>
                            )}
                          </td>
                          <td>{formatDate(p.submittedAt || p.createdAt) || '—'}</td>
                          <td>{formatDate(p.paidAt) || '—'}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} style={{ color: 'var(--text-muted)', padding: '1.1rem' }}>
                        No payment records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      )}
    </>
  );
}

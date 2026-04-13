import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authEmailToCustomerId, normalizeLoginIdentifier as normalizeCustomerId } from '../utils/phoneAuthEmail';
import { apiRequest, getStoredToken, setStoredToken } from '../services/api';

const AuthContext = createContext(null);

function normalizeLoginIdentifier(identifier) {
  const raw = String(identifier || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('@')) return raw;
  return authEmailToCustomerId(raw) ? raw : raw.replace(/[^a-z0-9]/g, '');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  function normalizeBackendUser(u) {
    if (!u) return null;
    // Backend returns `{ id, role, email, customerId, ... }`
    // Frontend expects `{ uid, role, email, customerId, ... }` in many places.
    const uid = u.uid || u.id;
    return {
      ...u,
      uid,
    };
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const token = getStoredToken();
      if (!token) {
        if (!cancelled) setAuthLoading(false);
        return;
      }
      try {
        const res = await apiRequest('/api/auth/me');
        if (!cancelled) setUser(normalizeBackendUser(res?.user || null));
      } catch {
        setStoredToken('');
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    try {
      const input = normalizeLoginIdentifier(identifier);
      const isAdmin = input.includes('@');
      const payload = {
        identifier: isAdmin ? input : authEmailToCustomerId(input) || input,
        password: isAdmin ? String(password || '') : '',
      };
      const res = await apiRequest('/api/auth/login', { method: 'POST', body: payload });
      setStoredToken(res?.token || '');
      setUser(normalizeBackendUser(res?.user || null));
      return { ok: true, role: res?.user?.role || 'member' };
    } catch (e) {
      return { ok: false, error: e?.message || 'Authentication failed. Please try again.' };
    }
  }, []);

  const signup = useCallback(async (customerId, profile) => {
    try {
      const normalizedCustomerId = normalizeCustomerId(customerId).replace(/@member\.clutchlab\.local$/i, '');
      if (!normalizedCustomerId || normalizedCustomerId.includes('@')) return { ok: false, error: 'Invalid customer ID format.' };
      const res = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: {
          customerId: normalizedCustomerId,
          fullName: profile?.fullName || '',
          phone: profile?.phone || '',
          gender: profile?.gender || 'prefer_not_say',
          birthday: profile?.birthday || null,
          waiverAccepted: Boolean(profile?.waiverAccepted),
        },
      });
      setStoredToken(res?.token || '');
      const nextUser = normalizeBackendUser(res?.user || null);
      setUser(nextUser);
      return { ok: true, role: res?.user?.role || 'member', user: nextUser, customerId: nextUser?.customerId || null };
    } catch (e) {
      return { ok: false, error: e?.message || 'Registration failed.' };
    }
  }, []);

  const logout = useCallback(async () => {
    setStoredToken('');
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === 'admin',
      authLoading,
      login,
      signup,
      logout,
    }),
    [user, authLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}


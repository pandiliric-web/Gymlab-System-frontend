import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Home', to: '/' },
  { label: 'Registration', to: '/register' },
  { label: 'Payment', to: '/payment' },
  { label: 'Login', to: '/login' },
];

function navClass({ isActive }) {
  return ['nav-pill', isActive ? 'nav-pill--active' : ''].filter(Boolean).join(' ');
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Prevent stale drawer/overflow state when navigating repeatedly.
  useEffect(() => {
    setMenuOpen(false);
    document.body.style.overflow = '';
  }, [location.pathname]);

  const closeMenu = () => setMenuOpen(false);
  const visibleNavLinks = user
    ? NAV_LINKS.filter((item) => item.to !== '/register' && item.to !== '/login')
    : NAV_LINKS.filter((item) => item.to !== '/payment');

  return (
    <div className="landing" id="top">
      <div className={`ambient-glow ambient-glow--one ${scrolled ? 'ambient-glow--dim' : ''}`} aria-hidden />
      <div className={`ambient-glow ambient-glow--two ${scrolled ? 'ambient-glow--dim' : ''}`} aria-hidden />

      <header className={`site-header ${scrolled ? 'site-header--scrolled' : ''}`}>
        <div className="site-header__inner">
          <NavLink className="brand" to="/" onClick={closeMenu} end>
            <img className="brand__logo" src="/logo.png" alt="Clutch Lab Fitness logo" />
            <span className="brand__text">Clutch Lab Fitness Portal</span>
          </NavLink>

          <nav className="nav-desktop" aria-label="Primary">
            <ul className="nav-desktop__list">
              {visibleNavLinks.map((item) => (
                <li key={item.to}>
                  <NavLink className={navClass} to={item.to}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="site-header__actions">
            {user && (
              <button type="button" className="header-signout" onClick={logout}>
                Sign out
                <span className="visually-hidden">
                  {isAdmin ? ' (signed in as admin)' : ' (signed in as member)'}
                </span>
              </button>
            )}
            <button
              type="button"
              className={`menu-toggle ${menuOpen ? 'menu-toggle--open' : ''}`}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="menu-toggle__bar" />
              <span className="menu-toggle__bar" />
              <span className="menu-toggle__bar" />
              <span className="visually-hidden">{menuOpen ? 'Close menu' : 'Open menu'}</span>
            </button>
          </div>
        </div>

        <div
          id="mobile-nav"
          className={`mobile-drawer ${menuOpen ? 'mobile-drawer--open' : ''}`}
          aria-hidden={!menuOpen}
        >
          <div className="mobile-drawer__backdrop" onClick={closeMenu} />
          <nav className="mobile-drawer__panel" aria-label="Mobile primary">
            <ul className="mobile-drawer__list">
              {visibleNavLinks.map((item) => (
                <li key={item.to}>
                  <NavLink className="mobile-drawer__link" to={item.to} onClick={closeMenu}>
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            {user && (
              <button type="button" className="mobile-drawer__logout" onClick={() => { logout(); closeMenu(); }}>
                Sign out
              </button>
            )}
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

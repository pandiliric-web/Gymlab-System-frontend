import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../logo.svg';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=2000&q=80';

export default function HomePage() {
  const [parallaxY, setParallaxY] = useState(0);
  const heroRef = useRef(null);
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const updateScroll = useCallback(() => {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const heroProgress = Math.max(0, Math.min(1, -rect.top / rect.height));
    setParallaxY(heroProgress * 80);
  }, [reduceMotion]);

  useEffect(() => {
    updateScroll();
    window.addEventListener('scroll', updateScroll, { passive: true });
    window.addEventListener('resize', updateScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', updateScroll);
      window.removeEventListener('resize', updateScroll);
    };
  }, [updateScroll]);

  return (
    <main>
      <section className="hero" ref={heroRef}>
        <div
          className="hero__parallax"
          style={
            reduceMotion
              ? undefined
              : { transform: `translate3d(0, ${parallaxY}px, 0) scale(1.06)` }
          }
        >
          <div
            className="hero__bg-image"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            role="img"
            aria-label="Athlete training with barbell in a dim gym"
          />
        </div>

        <div className="hero__veil" aria-hidden />
        <div className="hero__light hero__light--left" aria-hidden />
        <div className="hero__light hero__light--right" aria-hidden />
        <div className="hero__vignette" aria-hidden />
        <div className="hero__grid" aria-hidden />
        <div className="hero__gradient-sweep" aria-hidden />

        <div className="hero__content">
          <p className="hero__eyebrow">
            <span>Clutch Lab Fitness Gym</span>
          </p>
          <div className="hero__logo-row">
            <img className="hero__logo" src={logo} alt="Clutch Lab logo" />
            <span className="hero__logo-glow" aria-hidden />
          </div>
          <h1 className="hero__title hero__title--animated">
            Train Hard.
            <br />
            <span className="hero__title-accent">Live Strong.</span>
          </h1>
          <p className="hero__lead">
            Premium fitness coaching, focused programs, and a high-energy community.
            <span className="hero__lead-accent"> Clutch your best self.</span>
          </p>
          <div className="hero__chips" aria-label="Highlights">
            <span className="hero__chip">Strength Classes</span>
            <span className="hero__chip">Personal Coaching</span>
            <span className="hero__chip">Nutrition Support</span>
          </div>
          <div className="hero__actions">
            <Link className="cta" to="/register">
              <span className="cta__shine" aria-hidden />
              <span className="cta__label">Start Registration</span>
            </Link>
            <a className="btn-ghost" href="#faq">
              Learn more
            </a>
          </div>
        </div>
      </section>

      <section className="home-section" id="highlights">
        <div className="page-shell">
          <header className="page-header page-header--center">
            <p className="page-eyebrow">Built for progress</p>
            <h2 className="page-title">Train with structure, coaching, and momentum</h2>
            <p className="page-subtitle">
              A more professional approach to fitness: clear programs, consistent coach feedback, and a supportive community that
              keeps you showing up.
            </p>
          </header>

          <div className="home-grid home-grid--3" aria-label="Highlights">
            <article className="home-card home-card--feature">
              <div className="home-card__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 10v4M7 9v6M17 9v6M20 10v4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M7 12h10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="home-card__title">Strength programs</h3>
              <p className="home-card__desc">Progressive training that’s planned, tracked, and coached—so results are earned.</p>
            </article>

            <article className="home-card home-card--feature">
              <div className="home-card__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M2.5 20c.6-3.2 3-5 5.5-5 1.1 0 2.1.3 3 .9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M21.5 20c-.6-3.2-3-5-5.5-5-1.1 0-2.1.3-3 .9"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="home-card__title">Personal coaching</h3>
              <p className="home-card__desc">Ongoing feedback on technique, effort, and progression—tailored to your pace.</p>
            </article>

            <article className="home-card home-card--feature">
              <div className="home-card__icon" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 4c-6 0-10 4-10 10 0 6 4 6 10 0 0-6-4-10-10-10Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 14 4 20"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <h3 className="home-card__title">Nutrition support</h3>
              <p className="home-card__desc">Simple, practical guidance that helps you stay consistent and recover better.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-section home-section--alt" id="how-it-works">
        <div className="page-shell">
          <header className="page-header page-header--center">
            <p className="page-eyebrow">Getting started</p>
            <h2 className="page-title">How it works</h2>
            <p className="page-subtitle">A straightforward flow from registration to access.</p>
          </header>

          <div className="home-grid home-grid--3 home-grid--steps" aria-label="How it works steps">
            <div className="home-step">
              <div className="home-step__num">1</div>
              <h3 className="home-step__title">Register</h3>
              <p className="home-step__desc">Complete your details and agree to the gym waiver.</p>
            </div>
            <div className="home-step">
              <div className="home-step__num">2</div>
              <h3 className="home-step__title">Pay</h3>
              <p className="home-step__desc">Submit payment and confirm your passcode/access.</p>
            </div>
            <div className="home-step">
              <div className="home-step__num">3</div>
              <h3 className="home-step__title">Train</h3>
              <p className="home-step__desc">Use your member portal and start following your plan.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="home-section" id="faq">
        <div className="page-shell">
          <header className="page-header page-header--center">
            <p className="page-eyebrow">FAQ</p>
            <h2 className="page-title">Questions, answered</h2>
            <p className="page-subtitle">Everything you need to feel confident before you register.</p>
          </header>

          <div className="home-faq" aria-label="Frequently asked questions">
            <details className="home-faq__item">
              <summary>How do I get started?</summary>
              <p>
                Click <strong>Start Registration</strong>, complete your details and waiver, then proceed to payment.
                After payment, you can access your member portal.
              </p>
            </details>

            <details className="home-faq__item">
              <summary>Do I need gym experience?</summary>
              <p>
                No. The focus is on technique, consistency, and progression. Coaches help you build confidence and move safely.
              </p>
            </details>

            <details className="home-faq__item">
              <summary>What kind of training do you offer?</summary>
              <p>
                Strength-focused coaching with structured programs, feedback, and practical nutrition support to help you stay on track.
              </p>
            </details>

            <details className="home-faq__item">
              <summary>Can I contact the gym before registering?</summary>
              <p>
                If you need help, you can start by registering and then use your member access flow to manage your account.
                (If you want a “contact us” page, tell me and I’ll add it.)
              </p>
            </details>
          </div>
        </div>
      </section>

      <section className="home-section home-section--cta" aria-label="Call to action">
        <div className="page-shell">
          <div className="home-cta">
            <div className="home-cta__copy">
              <p className="page-eyebrow">Clutch your best self</p>
              <h2 className="page-title">Ready to train with structure?</h2>
              <p className="page-subtitle">
                Start registration now and get set up for coaching, progress tracking, and a gym experience built to last.
              </p>
            </div>

            <div className="home-cta__actions">
              <Link className="btn-primary" to="/register">
                Start Registration
              </Link>
              <Link className="btn-ghost" to="/login">
                Member Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

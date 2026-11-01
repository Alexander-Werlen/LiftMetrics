import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
  useNavigate,
} from 'react-router';
import type { LinksFunction } from 'react-router';
import { AuthGate } from './auth/auth-gate';
import { authConfig } from './auth/config';
import { useAccountSession, type WeightUnit } from './auth/account-session';
import { errorMessage } from './api/api-client';
import stylesheet from './styles/app.css?url';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: stylesheet },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#151a1e" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const navigate = useNavigate();
  const onRedirectCallback = useCallback((appState?: { returnTo?: string }) => {
    const returnTo = appState?.returnTo;
    navigate(isSafeReturnPath(returnTo) ? returnTo : '/', { replace: true });
  }, [navigate]);

  if (!authConfig.isConfigured) {
    return (
      <main className="auth-page">
        <section className="auth-panel card" aria-labelledby="auth-config-title">
          <p className="section-kicker">LIFTMETRICS</p>
          <h1 id="auth-config-title">Sign-in isn’t set up yet.</h1>
          <p className="card-description">Sign-in is unavailable right now. Please try again later or contact support.</p>
        </section>
      </main>
    );
  }

  return (
    <Auth0Provider
      domain={authConfig.domain}
      clientId={authConfig.clientId}
      authorizationParams={{
        audience: authConfig.audience,
        redirect_uri: typeof window === 'undefined' ? undefined : window.location.origin,
        scope: 'openid',
      }}
      onRedirectCallback={onRedirectCallback}
    >
      <AuthGate>
        <AuthenticatedAppShell />
      </AuthGate>
    </Auth0Provider>
  );
}

function AuthenticatedAppShell() {
  const location = useLocation();
  useEffect(() => {
    document.getElementById('main-content')?.focus();
  }, [location.pathname]);

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <NavLink className="brand" to="/" aria-label="LiftMetrics home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LiftMetrics</span>
        </NavLink>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Today</NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>History</NavLink>
          <NavLink to="/plan" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Plan</NavLink>
        </nav>
        <AccountMenu />
      </header>
      <Outlet />
      <nav className="mobile-nav" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <span className="nav-symbol" aria-hidden="true">⌂</span><span>Today</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <span className="nav-symbol" aria-hidden="true">◷</span><span>History</span>
        </NavLink>
        <NavLink to="/plan" className={({ isActive }) => isActive ? 'mobile-nav-link active' : 'mobile-nav-link'}>
          <span className="nav-symbol" aria-hidden="true">▦</span><span>Plan</span>
        </NavLink>
      </nav>
    </div>
  );
}

function AccountMenu() {
  const { account, updatePreferredWeightUnit } = useAccountSession();
  const { logout } = useAuth0();
  const [unit, setUnit] = useState<WeightUnit>(account.preferredWeightUnit);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => setUnit(account.preferredWeightUnit), [account.preferredWeightUnit]);

  async function saveUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await updatePreferredWeightUnit(unit);
      setMessage('Preference saved.');
    } catch (cause) {
      setMessage(errorMessage(cause, 'Preference could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="account-menu">
      <summary className="account-menu-trigger">
        <span className="profile-dot" aria-hidden="true">◉</span>
        <span className="profile-label">Account</span>
      </summary>
      <section className="account-menu-panel" aria-label="Account preferences">
        <p className="section-kicker">ACCOUNT</p>
        <p className="account-time-zone">Time zone<br /><strong>{account.timeZone}</strong></p>
        <form className="account-preference-form" onSubmit={saveUnit}>
          <label className="form-field" htmlFor="preferred-weight-unit">
            <span>Preferred weight unit</span>
            <select id="preferred-weight-unit" value={unit} onChange={(event) => setUnit(event.currentTarget.value as WeightUnit)}>
              <option value="KG">Kilograms (kg)</option>
              <option value="LB">Pounds (lb)</option>
            </select>
          </label>
          <button className="secondary-button" type="submit" disabled={saving || unit === account.preferredWeightUnit}>
            {saving ? 'Saving…' : 'Save preference'}
          </button>
          {message && <p className="account-menu-message" role="status">{message}</p>}
        </form>
        <button className="sign-out-button" type="button" onClick={() => void logout({ logoutParams: { returnTo: window.location.origin } })}>
          Sign out
        </button>
      </section>
    </details>
  );
}

function isSafeReturnPath(path: string | undefined): path is string {
  return Boolean(path && path.startsWith('/') && !path.startsWith('//'));
}

export function HydrateFallback() {
  return <div className="initial-load" role="status">Loading LiftMetrics…</div>;
}

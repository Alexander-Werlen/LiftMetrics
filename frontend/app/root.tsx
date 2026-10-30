import type { ReactNode } from 'react';
import {
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from 'react-router';
import type { LinksFunction } from 'react-router';
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
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <NavLink className="brand" to="/" aria-label="LiftMetrics home">
          <span className="brand-mark" aria-hidden="true">L</span>
          <span>LiftMetrics</span>
        </NavLink>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Today
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            History
          </NavLink>
          <NavLink to="/plan" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Plan
          </NavLink>
        </nav>
        <div className="profile-placeholder" aria-label="Account">
          <span className="profile-dot" aria-hidden="true">◉</span>
          <span className="profile-label">Account</span>
        </div>
      </header>
      <main id="main-content" className="main-content">
        <Outlet />
      </main>
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

export function HydrateFallback() {
  return <div className="initial-load" role="status">Loading LiftMetrics…</div>;
}

import { Link } from 'react-router';
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [{ title: 'Page not found · LiftMetrics' }];

export default function NotFoundRoute() {
  return (
    <main id="main-content" tabIndex={-1} className="page-shell not-found-page">
      <div className="page-heading">
        <div className="eyebrow">404</div>
        <h1>Page not found</h1>
        <p className="page-intro">That page isn’t part of LiftMetrics.</p>
      </div>
      <Link className="primary-button link-button" to="/">Return to Today</Link>
    </main>
  );
}

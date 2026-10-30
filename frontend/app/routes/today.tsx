import { Link } from 'react-router';
import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'Today · LiftMetrics' },
  { name: 'description', content: 'Your daily weight and workout check-in.' },
];

export default function TodayRoute() {
  return (
    <div className="page-shell today-page">
      <div className="page-heading">
        <div className="eyebrow"><span className="status-dot" /> DAILY CHECK-IN</div>
        <h1>Today</h1>
      </div>
      <section className="card weight-card" aria-labelledby="weight-heading">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">BODY WEIGHT</p>
            <h2 id="weight-heading">Keep your progress in view.</h2>
          </div>
          <span className="card-icon" aria-hidden="true">↗</span>
        </div>
        <p className="card-description">Your daily weight check-in will be available here.</p>
        <div className="placeholder-value" aria-hidden="true">—</div>
        <button className="primary-button" type="button" disabled aria-disabled="true">
          Record today’s weight
        </button>
      </section>

      <section className="card workout-card" aria-labelledby="workout-heading">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">TODAY’S WORKOUT</p>
            <h2 id="workout-heading">Your training plan</h2>
          </div>
          <span className="card-icon workout-icon" aria-hidden="true">✳</span>
        </div>
        <p className="card-description">Your scheduled or in-progress workout will appear here.</p>
        <div className="empty-workout">
          <span className="empty-workout-mark" aria-hidden="true">◌</span>
          <span>Workout details will be ready here.</span>
        </div>
        <Link className="text-link" to="/plan">View weekly plan <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  );
}

import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'History · LiftMetrics' },
  { name: 'description', content: 'Review weight entries and completed workouts.' },
];

export default function HistoryRoute() {
  return (
    <div className="page-shell secondary-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR PROGRESS</div>
        <h1>History</h1>
        <p className="page-intro">Weight entries and completed workouts will live here.</p>
      </div>
      <section className="card secondary-card" aria-labelledby="weight-history-heading">
        <p className="section-kicker">BODY WEIGHT</p>
        <h2 id="weight-history-heading">Weight trend and entries</h2>
        <p className="card-description">Review your measurements over time and correct an earlier day.</p>
        <div className="history-placeholder">Your weight trend will appear here once your entries are connected.</div>
      </section>
      <section className="card secondary-card" aria-labelledby="workout-history-heading">
        <p className="section-kicker">TRAINING LOG</p>
        <h2 id="workout-history-heading">All workouts</h2>
        <p className="card-description">Completed sessions and their recorded sets will be available here.</p>
      </section>
    </div>
  );
}

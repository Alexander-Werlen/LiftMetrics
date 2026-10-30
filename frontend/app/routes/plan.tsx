import type { MetaFunction } from 'react-router';

export const meta: MetaFunction = () => [
  { title: 'Plan · LiftMetrics' },
  { name: 'description', content: 'Manage weekly training plans and saved workouts.' },
];

export default function PlanRoute() {
  return (
    <div className="page-shell secondary-page">
      <div className="page-heading">
        <div className="eyebrow">YOUR ROUTINE</div>
        <h1>Plan</h1>
        <p className="page-intro">Set up the sessions you want to follow through the week.</p>
      </div>
      <section className="card secondary-card" aria-labelledby="weekly-plan-heading">
        <p className="section-kicker">WEEKLY SCHEDULE</p>
        <h2 id="weekly-plan-heading">Your active week</h2>
        <p className="card-description">Choose a plan, then assign saved workouts to the days that work for you.</p>
        <div className="week-placeholder" aria-hidden="true">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}
        </div>
      </section>
      <section className="card secondary-card" aria-labelledby="saved-workouts-heading">
        <p className="section-kicker">WORKOUT LIBRARY</p>
        <h2 id="saved-workouts-heading">Saved workouts</h2>
        <p className="card-description">Reusable workout recipes will be managed here.</p>
      </section>
    </div>
  );
}

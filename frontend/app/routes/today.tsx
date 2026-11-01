import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { MetaFunction } from 'react-router';
import { ApiError, errorMessage } from '../api/api-client';
import { useAccountSession, type WeightUnit } from '../auth/account-session';
import { useApiClient } from '../auth/use-api';

export const meta: MetaFunction = () => [
  { title: 'Today · LiftMetrics' },
  { name: 'description', content: 'Your daily weight and workout check-in.' },
];

interface WeightEntry { id: string; entryDate: string; weight: string; unit: WeightUnit }
interface BlueprintExercise {
  id: string;
  plannedSetCount: number;
  targetRepMin: number | null;
  targetRepMax: number | null;
  exercise: { id: string; name: string; measurementType: 'REPS_AND_WEIGHT' | 'TIME' };
}
interface RecommendationSession {
  id: string;
  position: number;
  blueprint: { id: string; name: string; exercises: BlueprintExercise[] };
}
interface Recommendation { date: string; weeklyPlan: { id: string; name: string } | null; sessions: RecommendationSession[] }
interface Workout {
  id: string;
  workoutDate: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  sourceNameSnapshot: string | null;
  exercises: Array<{
    id: string;
    exerciseNameSnapshot: string;
    measurementTypeSnapshot: 'REPS_AND_WEIGHT' | 'TIME';
    plannedSetCountSnapshot: number | null;
    targetRepMinSnapshot: number | null;
    targetRepMaxSnapshot: number | null;
  }>;
}

export default function TodayRoute() {
  const api = useApiClient();
  const navigate = useNavigate();
  const { account } = useAccountSession();
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [date, setDate] = useState(() => localDateInTimeZone(account.timeZone));
  const [weight, setWeight] = useState<WeightEntry | null>(null);
  const [weightValue, setWeightValue] = useState('');
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightMessage, setWeightMessage] = useState('');
  const [weightError, setWeightError] = useState('');
  const [dayError, setDayError] = useState('');
  const [dayLoading, setDayLoading] = useState(true);
  const [startingId, setStartingId] = useState('');
  const [workoutError, setWorkoutError] = useState('');
  const [workoutMessage, setWorkoutMessage] = useState('');
  const unit = account.preferredWeightUnit;

  const loadWorkoutState = useCallback(async () => {
    setDayLoading(true);
    const [dayResult, activeResult] = await Promise.allSettled([
      api<Recommendation>('/api/weekly-plans/recommendation/today'),
      api<Workout | null>(`/api/workout-sessions/in-progress?unit=${unit}`),
    ]);
    if (dayResult.status === 'fulfilled') {
      setRecommendation(dayResult.value);
      setDate(dayResult.value.date);
      setDayError('');
    } else {
      setDayError(errorMessage(dayResult.reason, 'Today’s workout could not be loaded.'));
    }
    if (activeResult.status === 'fulfilled') {
      setWorkout(activeResult.value);
      setWorkoutError('');
    } else {
      setWorkoutError(errorMessage(activeResult.reason, 'Your in-progress workout could not be loaded.'));
    }
    setDayLoading(false);
    return dayResult.status === 'fulfilled' ? dayResult.value.date : null;
  }, [api, unit]);

  const loadWeight = useCallback(async (entryDate: string) => {
    setWeightLoading(true);
    setWeightError('');
    try {
      const entry = await api<WeightEntry>(`/api/weight-entries/${entryDate}?unit=${unit}`);
      setWeight(entry);
      setWeightValue(entry.weight);
    } catch (cause) {
      setWeight(null);
      setWeightValue('');
      if (cause instanceof ApiError && cause.statusCode === 404) return;
      setWeightError(errorMessage(cause, 'Today’s weight could not be loaded.'));
    } finally {
      setWeightLoading(false);
    }
  }, [api, unit]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const currentDate = await loadWorkoutState();
      if (active) await loadWeight(currentDate ?? localDateInTimeZone(account.timeZone));
    })();
    return () => { active = false; };
  }, [account.timeZone, loadWeight, loadWorkoutState]);

  async function saveWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWeightSaving(true);
    setWeightMessage('');
    setWeightError('');
    try {
      const saved = await api<WeightEntry>(`/api/weight-entries/${date}`, {
        method: 'PUT', body: { weight: weightValue.trim(), unit },
      });
      setWeight(saved);
      setWeightValue(saved.weight);
      setWeightMessage('Weight saved for today.');
    } catch (cause) {
      setWeightError(errorMessage(cause, 'Your weight could not be saved. Please try again.'));
    } finally {
      setWeightSaving(false);
    }
  }

  async function startWorkout(session: RecommendationSession) {
    setStartingId(session.id);
    setWorkoutError('');
    setWorkoutMessage('');
    try {
      const started = await api<Workout>(`/api/workout-sessions/from-recommendation/${session.id}`, { method: 'POST' });
      navigate(`/workout/${started.id}`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 409) {
        try {
          const current = await api<Workout | null>(`/api/workout-sessions/in-progress?unit=${unit}`);
          if (current) navigate(`/workout/${current.id}`);
          else setWorkoutError('An in-progress workout was detected but could not be reopened. Refresh Today and try again.');
        } catch (refreshError) {
          setWorkoutError(errorMessage(refreshError, 'An in-progress workout could not be reloaded. Please retry.'));
        }
      } else {
        setWorkoutError(errorMessage(cause, 'This workout could not be started. Refresh today’s recommendations and try again.'));
      }
    } finally {
      setStartingId('');
    }
  }

  return (
    <div className="page-shell today-page">
      <div className="page-heading">
        <div className="eyebrow"><span className="status-dot" /> DAILY CHECK-IN</div>
        <h1>Today</h1>
        <p className="today-date">{formatLocalDate(date, account.timeZone)}</p>
      </div>

      <section className="card weight-card" aria-labelledby="weight-heading">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">BODY WEIGHT</p>
            <h2 id="weight-heading">{weight ? 'Today’s check-in' : 'Record today’s weight'}</h2>
          </div>
          <span className="card-icon" aria-hidden="true">↗</span>
        </div>
        <form className="today-weight-form" onSubmit={saveWeight}>
          <label className="weight-input-field" htmlFor="today-weight">
            <span className="visually-hidden">Body weight in {unit === 'KG' ? 'kilograms' : 'pounds'}</span>
            <input
              id="today-weight" name="weight" type="number" inputMode="decimal" min="0" max="999999.999999"
              step="any" required value={weightValue} disabled={weightLoading}
              onChange={(event) => { setWeightValue(event.currentTarget.value); setWeightMessage(''); }}
              aria-describedby={weightError ? 'today-weight-error' : undefined}
              aria-invalid={Boolean(weightError)} placeholder="e.g. 75.0"
            />
            <span>{unit === 'KG' ? 'kg' : 'lb'}</span>
          </label>
          <button className="primary-button" type="submit" disabled={weightLoading || weightSaving || !weightValue.trim()}>
            {weightSaving ? 'Saving…' : weight ? 'Update weight' : 'Save weight'}
          </button>
        </form>
        {weightLoading && <p className="inline-status" role="status">Loading today’s entry…</p>}
        {weightError && <p className="form-error" id="today-weight-error" role="alert">{weightError}</p>}
        {weightMessage && <p className="inline-success" role="status">{weightMessage}</p>}
      </section>

      <section className="card workout-card" aria-labelledby="workout-heading">
        <div className="card-heading-row">
          <div>
            <p className="section-kicker">TODAY’S WORKOUT</p>
            <h2 id="workout-heading">{workout ? (workout.sourceNameSnapshot ?? 'Workout in progress') : 'Your training plan'}</h2>
          </div>
          <span className="card-icon workout-icon" aria-hidden="true">✳</span>
        </div>

        {dayError ? <p className="form-error" role="alert">{dayError}</p> : workoutError ? <p className="form-error" role="alert">{workoutError}</p> : null}
        {workoutMessage && <p className="inline-success" role="status">{workoutMessage}</p>}
        {workout ? (
          <>
            <p className="card-description">In progress · started from {workout.sourceNameSnapshot ?? 'a workout'}.</p>
            <ExerciseList exercises={workout.exercises.map((exercise) => ({
              name: exercise.exerciseNameSnapshot,
              count: exercise.plannedSetCountSnapshot,
              targetMin: exercise.targetRepMinSnapshot,
              targetMax: exercise.targetRepMaxSnapshot,
              measurementType: exercise.measurementTypeSnapshot,
            }))} />
            <Link className="primary-button workout-start" to={`/workout/${workout.id}`}>Resume workout</Link>
          </>
        ) : dayLoading ? (
          <p className="inline-status" role="status">Loading today’s workout…</p>
        ) : !dayError && recommendation && recommendation.sessions.length > 0 ? (
          <>
            <p className="card-description">{recommendation.sessions.length > 1 ? 'Choose a session to start. Your plan is a recommendation and can be adjusted during training.' : 'A starting point for today. You can adjust it during training.'}</p>
            {recommendation.sessions.map((session) => (
              <div className="recommended-session" key={session.id}>
                {recommendation.sessions.length > 1 && <h3>{session.blueprint.name}</h3>}
                <ExerciseList exercises={session.blueprint.exercises.map((item) => ({
                  name: item.exercise.name,
                  count: item.plannedSetCount,
                  targetMin: item.targetRepMin,
                  targetMax: item.targetRepMax,
                  measurementType: item.exercise.measurementType,
                }))} />
                <button className="primary-button workout-start" type="button" disabled={Boolean(startingId)} onClick={() => void startWorkout(session)}>
                  {startingId === session.id ? 'Starting…' : 'Start workout'}
                </button>
              </div>
            ))}
          </>
        ) : !dayError && recommendation ? (
          <>
            <div className="empty-workout"><span className="empty-workout-mark" aria-hidden="true">◌</span><span>No workout scheduled for today.</span></div>
            <Link className="text-link" to="/plan">View weekly plan <span aria-hidden="true">→</span></Link>
          </>
        ) : null}
      </section>
    </div>
  );
}

function ExerciseList({ exercises }: { exercises: Array<{ name: string; count: number | null; targetMin: number | null; targetMax: number | null; measurementType: string }> }) {
  if (!exercises.length) return <div className="empty-workout"><span>No exercises in this workout.</span></div>;
  return (
    <ol className="today-exercise-list">
      {exercises.map((exercise, index) => (
        <li key={`${exercise.name}-${index}`}>
          <span className="exercise-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="exercise-name">{exercise.name}</span>
          <span className="exercise-prescription">
            {exercise.count ? `${exercise.count} sets` : 'Sets'}
            {exercise.measurementType === 'TIME' ? ' · time' : exercise.targetMin && exercise.targetMax ? ` · ${exercise.targetMin}–${exercise.targetMax} reps` : ''}
          </span>
        </li>
      ))}
    </ol>
  );
}

function localDateInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function formatLocalDate(date: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const formatted = new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  return `${formatted} · ${timeZone}`;
}

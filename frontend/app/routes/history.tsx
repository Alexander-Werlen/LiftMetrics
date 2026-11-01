import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { MetaFunction } from 'react-router';
import { errorMessage } from '../api/api-client';
import { useApiClient } from '../auth/use-api';
import { useAccountSession, type WeightUnit } from '../auth/account-session';

export const meta: MetaFunction = () => [
  { title: 'History · LiftMetrics' },
  { name: 'description', content: 'Review weight entries and completed workouts.' },
];

interface WeightEntry { id: string; entryDate: string; weight: string; unit: WeightUnit }
interface WeightPage { items: WeightEntry[]; nextCursor: string | null }
interface WorkoutSet { id: string; position: number; repetitions: number | null; weight: string | null; unit: WeightUnit | null; durationSeconds: number | null }
interface WorkoutExercise {
  id: string;
  position: number;
  exerciseNameSnapshot: string;
  measurementTypeSnapshot: 'REPS_AND_WEIGHT' | 'TIME';
  sets: WorkoutSet[];
}
interface Workout {
  id: string;
  workoutDate: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  startedAt: string;
  completedAt: string | null;
  sourceNameSnapshot: string | null;
  exercises: WorkoutExercise[];
}
interface WorkoutPage { items: Workout[]; nextCursor: string | null }

const PAGE_SIZE = 5;
const WEIGHT_PATTERN = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/;
const WEIGHT_RANGES = [
  { days: 30, label: '30 days', shortLabel: '30D' },
  { days: 90, label: '90 days', shortLabel: '90D' },
  { days: 180, label: '6 months', shortLabel: '6M' },
  { days: 365, label: '1 year', shortLabel: '1Y' },
] as const;

function accountDate(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateDaysBefore(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }): string {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
}

export default function HistoryRoute() {
  const { id: workoutId } = useParams();
  return workoutId ? <WorkoutDetail workoutId={workoutId} /> : <HistoryOverview />;
}

function HistoryOverview() {
  const api = useApiClient();
  const { account } = useAccountSession();
  const unit = account.preferredWeightUnit;
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [trendWeights, setTrendWeights] = useState<WeightEntry[]>([]);
  const [weightCursor, setWeightCursor] = useState<string | null>(null);
  const [weightPage, setWeightPage] = useState(0);
  const [weightLoading, setWeightLoading] = useState(true);
  const [weightMoreLoading, setWeightMoreLoading] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState('');
  const [rangeDays, setRangeDays] = useState<number>(90);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState<WeightUnit>(unit);
  const [editError, setEditError] = useState('');
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutCursor, setWorkoutCursor] = useState<string | null>(null);
  const [workoutPage, setWorkoutPage] = useState(0);
  const [workoutsLoading, setWorkoutsLoading] = useState(true);
  const [workoutMoreLoading, setWorkoutMoreLoading] = useState(false);
  const [workoutError, setWorkoutError] = useState('');

  const today = useMemo(() => accountDate(account.timeZone), [account.timeZone]);
  const from = useMemo(() => dateDaysBefore(today, rangeDays - 1), [today, rangeDays]);
  const visibleWeightEntries = weights.slice(weightPage * PAGE_SIZE, (weightPage + 1) * PAGE_SIZE);
  const weightCanGoNext = weights.length > (weightPage + 1) * PAGE_SIZE || Boolean(weightCursor);
  const visibleWorkouts = workouts.slice(workoutPage * PAGE_SIZE, (workoutPage + 1) * PAGE_SIZE);
  const workoutCanGoNext = workouts.length > (workoutPage + 1) * PAGE_SIZE || Boolean(workoutCursor);

  const loadWeightHistory = useCallback(async (cursor?: string | null, append = false): Promise<boolean> => {
    if (append) setWeightMoreLoading(true);
    else { setWeightLoading(true); setWeightError(''); }
    try {
      const params = new URLSearchParams({ unit, limit: String(PAGE_SIZE) });
      if (cursor) params.set('before', cursor);
      const page = await api<WeightPage>(`/api/weight-entries?${params}`);
      setWeights((current) => append ? [...current, ...page.items] : page.items);
      if (!append) setWeightPage(0);
      setWeightCursor(page.nextCursor);
      return true;
    } catch (error) {
      setWeightError(errorMessage(error, 'Could not load weight history. Check your connection and try again.'));
      return false;
    } finally {
      setWeightLoading(false);
      setWeightMoreLoading(false);
    }
  }, [api, unit]);

  const loadWeightTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError('');
    try {
      const entries: WeightEntry[] = [];
      let cursor: string | null = null;
      do {
        const params = new URLSearchParams({ from, to: today, unit, limit: '100' });
        if (cursor) params.set('before', cursor);
        const page = await api<WeightPage>(`/api/weight-entries?${params}`);
        entries.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor);
      setTrendWeights(entries);
    } catch (error) {
      setTrendError(errorMessage(error, 'Could not load the weight trend. Check your connection and try again.'));
    } finally {
      setTrendLoading(false);
    }
  }, [api, from, today, unit]);

  const loadWorkouts = useCallback(async (cursor?: string | null, append = false): Promise<boolean> => {
    if (append) setWorkoutMoreLoading(true);
    else { setWorkoutsLoading(true); setWorkoutError(''); }
    try {
      const params = new URLSearchParams({ status: 'COMPLETED', unit, limit: String(PAGE_SIZE) });
      if (cursor) params.set('cursor', cursor);
      const page = await api<WorkoutPage>(`/api/workout-sessions?${params}`);
      setWorkouts((current) => append ? [...current, ...page.items] : page.items);
      if (!append) setWorkoutPage(0);
      setWorkoutCursor(page.nextCursor);
      return true;
    } catch (error) {
      setWorkoutError(errorMessage(error, 'Could not load workout history. Check your connection and try again.'));
      return false;
    } finally {
      setWorkoutsLoading(false);
      setWorkoutMoreLoading(false);
    }
  }, [api, unit]);

  useEffect(() => { void loadWeightHistory(); }, [loadWeightHistory]);
  useEffect(() => { void loadWeightTrend(); }, [loadWeightTrend]);
  useEffect(() => { void loadWorkouts(); }, [loadWorkouts]);

  async function goToNewerWeightPage() {
    setWeightPage((page) => Math.max(0, page - 1));
  }

  async function goToOlderWeightPage() {
    if ((weightPage + 1) * PAGE_SIZE < weights.length) {
      setWeightPage((page) => page + 1);
      return;
    }
    if (!weightCursor || weightMoreLoading) return;
    const loaded = await loadWeightHistory(weightCursor, true);
    if (loaded) setWeightPage((page) => page + 1);
  }

  function goToNewerWorkoutPage() {
    setWorkoutPage((page) => Math.max(0, page - 1));
  }

  async function goToOlderWorkoutPage() {
    if ((workoutPage + 1) * PAGE_SIZE < workouts.length) {
      setWorkoutPage((page) => page + 1);
      return;
    }
    if (!workoutCursor || workoutMoreLoading) return;
    const loaded = await loadWorkouts(workoutCursor, true);
    if (loaded) setWorkoutPage((page) => page + 1);
  }

  function startEdit(entry: WeightEntry) {
    setEditingDate(entry.entryDate);
    setEditValue(entry.weight);
    setEditUnit(entry.unit);
    setEditError('');
    setSavedMessage('');
  }

  async function saveEdit(entryDate: string) {
    if (!WEIGHT_PATTERN.test(editValue)) {
      setEditError('Enter a non-negative weight with up to six decimal places.');
      return;
    }
    setSavingDate(entryDate);
    setEditError('');
    setSavedMessage('');
    try {
      await api<WeightEntry>(`/api/weight-entries/${entryDate}`, {
        method: 'PUT',
        body: { weight: editValue, unit: editUnit },
      });
      setEditingDate(null);
      setSavedMessage(`Entry for ${formatDate(entryDate)} updated.`);
      await Promise.all([loadWeightHistory(), loadWeightTrend()]);
    } catch (error) {
      setEditError(errorMessage(error, 'Could not save this entry. Check the value and try again.'));
    } finally {
      setSavingDate(null);
    }
  }

  return (
    <div className="page-shell secondary-page history-page">
      <div className="page-heading">
        <h1>History</h1>
      </div>

      <section className="card secondary-card" aria-labelledby="weight-history-heading">
        <div className="card-heading-row">
          <div><h2 id="weight-history-heading">Weight trend</h2></div>
          <div className="history-range-controls" role="group" aria-label="Weight trend date range">
            {WEIGHT_RANGES.map((range) => <button key={range.days} type="button" className={rangeDays === range.days ? 'range-button active' : 'range-button'} aria-label={`Last ${range.label}`} aria-pressed={rangeDays === range.days} onClick={() => setRangeDays(range.days)}>{range.shortLabel}</button>)}
          </div>
        </div>
        {trendLoading ? <p className="history-state" role="status">Loading weight trend…</p> : trendError ? (
          <div className="form-error history-error" role="alert"><span>{trendError}</span><button type="button" className="text-button" onClick={() => void loadWeightTrend()}>Try again</button></div>
        ) : trendWeights.length ? <WeightTrend entries={trendWeights} from={from} to={today} unit={unit} /> : (
          <div className="history-empty">No weight entries in the last {WEIGHT_RANGES.find((range) => range.days === rangeDays)?.label ?? 'selected range'}. Your measurements will appear here after you record them on Today.</div>
        )}
      </section>

      <section className="card secondary-card" aria-labelledby="weight-entries-heading">
        <div className="card-heading-row history-list-heading">
          <div><h2 id="weight-entries-heading">Weight entries</h2></div>
        </div>
        {savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}
        {weightLoading ? <p className="history-state" role="status">Loading entries…</p> : weightError ? (
          <div className="form-error history-error" role="alert"><span>{weightError}</span><button type="button" className="text-button" onClick={() => void loadWeightHistory()}>Try again</button></div>
        ) : weights.length ? <>
          <div className="weight-entry-list">
            {visibleWeightEntries.map((entry) => <article className="weight-entry" key={entry.id}>
              {editingDate === entry.entryDate ? (
                <form className="weight-edit-form" onSubmit={(event) => { event.preventDefault(); void saveEdit(entry.entryDate); }}>
                  <div className="weight-entry-date"><strong>{formatDate(entry.entryDate)}</strong></div>
                  <div className="weight-edit-controls">
                    <label className="visually-hidden" htmlFor={`weight-${entry.id}`}>Weight for {formatDate(entry.entryDate)}</label>
                    <input id={`weight-${entry.id}`} inputMode="decimal" autoComplete="off" value={editValue} onChange={(event) => setEditValue(event.target.value)} aria-invalid={Boolean(editError)} aria-describedby={editError ? `weight-error-${entry.id}` : undefined} />
                    <label className="visually-hidden" htmlFor={`unit-${entry.id}`}>Weight unit</label>
                    <select id={`unit-${entry.id}`} value={editUnit} onChange={(event) => setEditUnit(event.target.value as WeightUnit)}><option value="KG">kg</option><option value="LB">lb</option></select>
                    <button className="primary-button compact-button" type="submit" disabled={savingDate === entry.entryDate}>{savingDate === entry.entryDate ? 'Saving…' : 'Save'}</button>
                    <button className="secondary-button compact-button" type="button" onClick={() => { setEditingDate(null); setEditError(''); }}>Cancel</button>
                  </div>
                  {editError && <p className="form-error weight-edit-error" id={`weight-error-${entry.id}`} role="alert">{editError}</p>}
                </form>
              ) : <>
                <div className="weight-entry-date"><strong>{formatDate(entry.entryDate)}</strong></div>
                <div className="weight-entry-reading"><strong>{entry.weight}</strong><span>{entry.unit.toLowerCase()}</span></div>
                <button className="secondary-button edit-weight-button" type="button" onClick={() => startEdit(entry)} aria-label={`Correct weight entry for ${formatDate(entry.entryDate)}`}>Edit</button>
              </>}
            </article>)}
          </div>
          <div className="history-pagination" aria-label="Weight entry pages">
            <button className="secondary-button" type="button" onClick={() => void goToNewerWeightPage()} disabled={weightPage === 0}>Newer</button>
            <span>Page {weightPage + 1}</span>
            <button className="secondary-button" type="button" onClick={() => void goToOlderWeightPage()} disabled={!weightCanGoNext || weightMoreLoading}>{weightMoreLoading ? 'Loading…' : 'Older'}</button>
          </div>
          {!weightCursor && weightPage * PAGE_SIZE + visibleWeightEntries.length >= weights.length && <p className="history-end">End of weight history.</p>}
        </> : <div className="history-empty compact-empty">No dated entries yet.</div>}
      </section>

      <section className="card secondary-card workout-history-card" aria-labelledby="workout-history-heading">
        <h2 id="workout-history-heading">All workouts</h2>
        {workoutsLoading ? <p className="history-state" role="status">Loading workouts…</p> : workoutError ? (
          <div className="form-error history-error" role="alert"><span>{workoutError}</span><button type="button" className="text-button" onClick={() => void loadWorkouts()}>Try again</button></div>
        ) : workouts.length ? <>
          <ul className="workout-history-list">
            {visibleWorkouts.map((workout) => <li key={workout.id}>
              <Link className="workout-history-link" to={`/history/workouts/${workout.id}`}>
                <span className="workout-history-copy"><strong>{workout.sourceNameSnapshot || 'Workout'}</strong><small>{formatDate(workout.workoutDate)} · {workout.exercises.length} {workout.exercises.length === 1 ? 'exercise' : 'exercises'}</small></span>
                <span className="workout-complete-label">Completed</span><span className="history-arrow" aria-hidden="true">›</span>
              </Link>
            </li>)}
          </ul>
          <div className="history-pagination" aria-label="Workout pages">
            <button className="secondary-button" type="button" onClick={goToNewerWorkoutPage} disabled={workoutPage === 0}>Newer</button>
            <span>Page {workoutPage + 1}</span>
            <button className="secondary-button" type="button" onClick={() => void goToOlderWorkoutPage()} disabled={!workoutCanGoNext || workoutMoreLoading}>{workoutMoreLoading ? 'Loading…' : 'Older'}</button>
          </div>
          {!workoutCursor && workoutPage * PAGE_SIZE + visibleWorkouts.length >= workouts.length && <p className="history-end">End of workout history.</p>}
        </> : <div className="history-empty compact-empty">No completed workouts yet. Completed sessions will appear here.</div>}
      </section>
    </div>
  );
}

function WeightTrend({ entries, from, to, unit }: { entries: WeightEntry[]; from: string; to: string; unit: WeightUnit }) {
  const sorted = [...entries].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const values = sorted.map((entry) => Number(entry.weight)).filter(Number.isFinite);
  if (!sorted.length || !values.length) return <div className="history-empty">No chart data is available for this range.</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.12, unit === 'KG' ? 0.25 : 0.5);
  const axisMin = min - padding;
  const axisMax = max + padding;
  const axisRange = axisMax - axisMin || 1;
  const firstDate = sorted[0].entryDate;
  const lastDate = sorted.at(-1)!.entryDate;
  const domainFrom = sorted.length > 1 ? firstDate : from;
  const domainTo = sorted.length > 1 ? lastDate : to;
  const plot = { left: 50, right: 638, top: 26, bottom: 246 };
  const fromNumber = Date.parse(`${domainFrom}T00:00:00Z`);
  const toNumber = Date.parse(`${domainTo}T00:00:00Z`);
  const dateRange = Math.max(1, toNumber - fromNumber);
  const dateSpanDays = Math.max(1, rangeDaysFromDates(domainFrom, domainTo) - 1);
  const dateTickCount = Math.min(8, Math.max(2, Math.ceil(dateSpanDays / 5) + 1));
  const points = sorted.map((entry) => {
    const datePosition = (Date.parse(`${entry.entryDate}T00:00:00Z`) - fromNumber) / dateRange;
    const x = plot.left + datePosition * (plot.right - plot.left);
    const y = plot.bottom - ((Number(entry.weight) - axisMin) / axisRange) * (plot.bottom - plot.top);
    return { x, y, entry };
  });
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${points.at(-1)?.x ?? plot.right} ${plot.bottom} L ${points[0]?.x ?? plot.left} ${plot.bottom} Z`;
  const yTicks = Array.from({ length: 5 }, (_, index) => axisMax - (axisRange * index / 4));
  return <div className="weight-trend" role="img" aria-label={`Weight trend for ${sorted.length} dated ${sorted.length === 1 ? 'entry' : 'entries'} from ${formatDate(sorted[0].entryDate)} to ${formatDate(sorted.at(-1)!.entryDate)}. ${sorted[0].weight} ${sorted[0].unit.toLowerCase()} to ${sorted.at(-1)!.weight} ${sorted.at(-1)!.unit.toLowerCase()}.`}>
    <svg className="trend-chart" viewBox="0 0 640 300" aria-hidden="true">
      {yTicks.map((tick, index) => {
        const y = plot.top + (index / 4) * (plot.bottom - plot.top);
        return <g key={tick}><line x1={plot.left} y1={y} x2={plot.right} y2={y} className="trend-grid" /><text x={plot.left - 9} y={y} className="trend-axis-label" textAnchor="end" dominantBaseline="middle">{formatAxisWeight(tick)}</text></g>;
      })}
      {Array.from({ length: dateTickCount }, (_, index) => index / (dateTickCount - 1)).map((fraction) => {
        const x = plot.left + fraction * (plot.right - plot.left);
        const daysBefore = Math.round((1 - fraction) * dateSpanDays);
        const date = dateDaysBefore(domainTo, daysBefore);
        return <g key={fraction}><line x1={x} y1={plot.top} x2={x} y2={plot.bottom} className="trend-grid vertical" /><text x={x} y="286" className="trend-axis-date" textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{formatAxisDate(date)}</text></g>;
      })}
      {sorted.length > 1 && <path d={area} className="trend-area" />}
      {sorted.length > 1 && <path d={line} className="trend-line" />}
      {points.map(({ x, y, entry }) => <circle key={entry.id} cx={x} cy={y} r={sorted.length === 1 ? 5 : 3.5} className="trend-point"><title>{`${formatDate(entry.entryDate)}: ${entry.weight} ${entry.unit.toLowerCase()}`}</title></circle>)}
    </svg>
  </div>;
}

function formatAxisWeight(value: number): string {
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
}

function formatAxisDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

function rangeDaysFromDates(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function WorkoutDetail({ workoutId }: { workoutId: string }) {
  const api = useApiClient();
  const { account } = useAccountSession();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setWorkout(await api<Workout>(`/api/workout-sessions/${encodeURIComponent(workoutId)}?unit=${account.preferredWeightUnit}`));
    } catch (issue) {
      setError(errorMessage(issue, 'Could not load this workout. Check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  }, [account.preferredWeightUnit, api, workoutId]);
  useEffect(() => { void load(); }, [load]);

  return <div className="page-shell secondary-page workout-detail-page">
    <Link className="back-history-link" to="/history/workouts">‹ <span>All workouts</span></Link>
    {loading ? <section className="card secondary-card"><p className="history-state" role="status">Loading workout…</p></section> : error ? (
      <section className="card secondary-card"><div className="form-error history-error" role="alert">{error}</div><button className="secondary-button" type="button" onClick={() => void load()}>Try again</button></section>
    ) : workout ? <>
      <div className="page-heading workout-detail-heading">
        <div className="eyebrow">WORKOUT DETAIL</div>
        <h1>{workout.sourceNameSnapshot || 'Workout'}</h1>
        <p className="page-intro">{formatDate(workout.workoutDate)}</p>
      </div>
      <section className="card secondary-card" aria-labelledby="workout-detail-title">
        <div className="workout-detail-summary"><span className="workout-detail-status">{workout.status === 'COMPLETED' ? 'Completed' : 'In progress'}</span><span>{workout.exercises.length} {workout.exercises.length === 1 ? 'exercise' : 'exercises'}</span></div>
        <h2 id="workout-detail-title" className="visually-hidden">Recorded exercises</h2>
        {workout.exercises.length ? <ol className="workout-detail-list">
          {[...workout.exercises].sort((a, b) => a.position - b.position).map((exercise, index) => <li className="workout-detail-exercise" key={exercise.id}>
            <div className="workout-detail-exercise-heading"><span className="workout-detail-index">{index + 1}</span><div><h3>{exercise.exerciseNameSnapshot}</h3><span className="measurement-type">{exercise.measurementTypeSnapshot === 'REPS_AND_WEIGHT' ? 'Repetitions + weight' : 'Time'}</span></div></div>
            {exercise.sets.length ? <ol className="recorded-set-list">
              {[...exercise.sets].sort((a, b) => a.position - b.position).map((set, setIndex) => <li key={set.id}>
                <span className="recorded-set-number">Set {setIndex + 1}</span>
                <strong>{exercise.measurementTypeSnapshot === 'REPS_AND_WEIGHT' ? `${set.repetitions ?? '—'} reps · ${set.weight ?? '—'} ${(set.unit ?? account.preferredWeightUnit).toLowerCase()}` : set.durationSeconds == null ? '—' : `${set.durationSeconds} sec`}</strong>
              </li>)}
            </ol> : <p className="no-recorded-sets">No recorded sets.</p>}
          </li>)}
        </ol> : <div className="history-empty">No exercises were recorded for this session.</div>}
      </section>
    </> : null}
  </div>;
}

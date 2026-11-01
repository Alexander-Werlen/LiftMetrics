import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { MetaFunction } from 'react-router';
import { errorMessage } from '../api/api-client';
import { useAccountSession, type WeightUnit } from '../auth/account-session';
import { useApiClient } from '../auth/use-api';

export const meta: MetaFunction = () => [
  { title: 'Workout · LiftMetrics' },
  { name: 'description', content: 'Record and adjust your workout.' },
];

type MeasurementType = 'REPS_AND_WEIGHT' | 'TIME';
interface ExerciseCatalogItem { id: string; name: string; measurementType: MeasurementType; archivedAt: string | null }
interface ApiSet { id: string; position: number; repetitions: number | null; weight: string | null; unit: WeightUnit | null; durationSeconds: number | null }
interface ApiWorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  measurementTypeSnapshot: MeasurementType;
  position: number;
  plannedSetCountSnapshot: number | null;
  targetRepMinSnapshot: number | null;
  targetRepMaxSnapshot: number | null;
  sets: ApiSet[];
}
interface Workout {
  id: string;
  workoutDate: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  sourceNameSnapshot: string | null;
  startedAt: string;
  completedAt: string | null;
  exercises: ApiWorkoutExercise[];
}
interface SetDraft {
  key: string;
  repetitions: string;
  weight: string;
  unit: WeightUnit;
  durationSeconds: string;
}
interface ExerciseDraft {
  exerciseId: string;
  name: string;
  measurementType: MeasurementType;
  plannedSetCount: number | null;
  targetRepMin: number | null;
  targetRepMax: number | null;
  sets: SetDraft[];
}
interface SetPayload { repetitions?: number; weight?: string; unit?: WeightUnit; durationSeconds?: number }

export default function WorkoutRoute() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const api = useApiClient();
  const { account } = useAccountSession();
  const unit = account.preferredWeightUnit;
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [openExercises, setOpenExercises] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [replacingExerciseId, setReplacingExerciseId] = useState('');
  const [openExerciseActions, setOpenExerciseActions] = useState('');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [exerciseResults, setExerciseResults] = useState<ExerciseCatalogItem[]>([]);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [exerciseError, setExerciseError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api<Workout>(`/api/workout-sessions/${id}?unit=${unit}`)
      .then((loaded) => {
        if (!active) return;
        setWorkout(loaded);
        setExercises(loaded.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          name: exercise.exerciseNameSnapshot,
          measurementType: exercise.measurementTypeSnapshot,
          plannedSetCount: exercise.plannedSetCountSnapshot,
          targetRepMin: exercise.targetRepMinSnapshot,
          targetRepMax: exercise.targetRepMaxSnapshot,
          sets: restoreSetDrafts(exercise.sets.map((set) => ({
            key: set.id,
            repetitions: set.repetitions == null ? '' : String(set.repetitions),
            weight: set.weight ?? '',
            unit: set.unit ?? unit,
            durationSeconds: set.durationSeconds == null ? '' : String(set.durationSeconds),
          })), loaded.status === 'IN_PROGRESS' ? exercise.plannedSetCountSnapshot : null, unit),
        })));
        setOpenExercises(new Set());
      })
      .catch((cause: unknown) => { if (active) setError(errorMessage(cause, 'This workout could not be loaded.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, id, unit]);

  useEffect(() => {
    if (!pickerOpen) return;
    let active = true;
    setExerciseLoading(true);
    setExerciseError('');
    const timer = window.setTimeout(() => {
      void api<ExerciseCatalogItem[]>(`/api/exercises?q=${encodeURIComponent(exerciseQuery.trim())}`)
        .then((items) => { if (active) setExerciseResults(items); })
        .catch((cause: unknown) => { if (active) setExerciseError(errorMessage(cause, 'Exercise choices could not be loaded.')); })
        .finally(() => { if (active) setExerciseLoading(false); });
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [api, exerciseQuery, pickerOpen]);

  const recordedSetCount = useMemo(() => exercises.reduce((count, exercise) => count + exercise.sets.filter((set) => isSetValid(exercise.measurementType, set)).length, 0), [exercises]);
  const totalSetCount = useMemo(() => exercises.reduce((count, exercise) => count + exercise.sets.length, 0), [exercises]);

  function changeSet(exerciseId: string, setKey: string, field: keyof Omit<SetDraft, 'key'>, value: string) {
    setExercises((current) => current.map((exercise) => exercise.exerciseId === exerciseId ? {
      ...exercise,
      sets: exercise.sets.map((set) => set.key === setKey ? { ...set, [field]: value } : set),
    } : exercise));
    setSetErrors((current) => { const next = { ...current }; delete next[setKey]; return next; });
    setSaveMessage('');
  }

  function addSet(exerciseId: string) {
    setExercises((current) => current.map((exercise) => exercise.exerciseId === exerciseId ? { ...exercise, sets: [...exercise.sets, blankSet(unit)] } : exercise));
    setOpenExercises((current) => new Set(current).add(exerciseId));
    setSaveMessage('');
  }

  function removeSet(exerciseId: string, setKey: string) {
    setExercises((current) => current.map((exercise) => exercise.exerciseId === exerciseId ? { ...exercise, sets: exercise.sets.filter((set) => set.key !== setKey) } : exercise));
    setSetErrors((current) => { const next = { ...current }; delete next[setKey]; return next; });
    setSaveMessage('');
  }

  function removeExercise(exerciseId: string) {
    setExercises((current) => current.filter((exercise) => exercise.exerciseId !== exerciseId));
    setOpenExercises((current) => { const next = new Set(current); next.delete(exerciseId); return next; });
    setSaveMessage('');
  }

  function moveExercise(exerciseIndex: number, direction: -1 | 1) {
    setExercises((current) => {
      const next = [...current];
      const targetIndex = exerciseIndex + direction;
      if (targetIndex < 0 || targetIndex >= next.length) return current;
      [next[exerciseIndex], next[targetIndex]] = [next[targetIndex], next[exerciseIndex]];
      return next;
    });
    setSaveMessage('');
  }

  function addExercise(item: ExerciseCatalogItem) {
    const replacedExercise = exercises.find((exercise) => exercise.exerciseId === replacingExerciseId);
    if (exercises.some((exercise) => exercise.exerciseId === item.id && exercise.exerciseId !== replacingExerciseId)) {
      setExerciseError('This exercise is already in the workout.');
      return;
    }
    if (replacedExercise && replacedExercise.measurementType !== item.measurementType && replacedExercise.sets.some(hasAnyValue)) {
      setExerciseError('Save or remove the entered values before replacing this exercise with a different measurement type.');
      return;
    }
    if (replacedExercise) {
      setExercises((current) => current.map((exercise) => exercise.exerciseId === replacingExerciseId ? {
        ...exercise,
        exerciseId: item.id,
        name: item.name,
        measurementType: item.measurementType,
        targetRepMin: null,
        targetRepMax: null,
        sets: exercise.measurementType === item.measurementType ? exercise.sets : exercise.sets.map(() => blankSet(unit)),
      } : exercise));
      setOpenExercises((current) => { const next = new Set(current); next.delete(replacingExerciseId); next.add(item.id); return next; });
      setReplacingExerciseId('');
      setPickerOpen(false);
      setExerciseQuery('');
      setExerciseError('');
      setSetErrors({});
      setSaveMessage('');
      return;
    }
    setExercises((current) => [...current, {
      exerciseId: item.id,
      name: item.name,
      measurementType: item.measurementType,
      plannedSetCount: null,
      targetRepMin: null,
      targetRepMax: null,
      sets: [],
    }]);
    setOpenExercises((current) => new Set(current).add(item.id));
    setPickerOpen(false);
    setExerciseQuery('');
    setExerciseError('');
    setSetErrors({});
    setSaveMessage('');
  }

  function openExercisePicker(replaceId = '') {
    setReplacingExerciseId(replaceId);
    setExerciseError('');
    setExerciseQuery('');
    setPickerOpen(true);
    setOpenExerciseActions('');
  }

  async function persistWorkout(): Promise<Workout | null> {
    const validation: Record<string, string> = {};
    const payloadExercises: Array<{ exerciseId: string; sets: SetPayload[] }> = [];
    for (const exercise of exercises) {
      const sets: SetPayload[] = [];
      for (const set of exercise.sets) {
        if (!hasAnyValue(set)) continue;
        const message = validateSet(exercise.measurementType, set);
        if (message) {
          validation[set.key] = message;
          continue;
        }
        sets.push(exercise.measurementType === 'TIME'
          ? { durationSeconds: Number(set.durationSeconds) }
          : { repetitions: Number(set.repetitions), weight: set.weight.trim(), unit: set.unit });
      }
      payloadExercises.push({ exerciseId: exercise.exerciseId, sets });
    }
    setSetErrors(validation);
    if (Object.keys(validation).length) {
      setError('Finish or remove the highlighted set before saving. Empty set rows are left out until you enter a value.');
      return null;
    }

    setSaving(true);
    setError('');
    setSaveMessage('');
    try {
      const updated = await api<Workout>(`/api/workout-sessions/${id}`, {
        method: 'PUT', body: { workoutDate: workout?.workoutDate, exercises: payloadExercises },
      });
      setWorkout(updated);
      const updatedDrafts = updated.exercises.map((exercise) => {
        const currentDraft = exercises.find((draft) => draft.exerciseId === exercise.exerciseId);
        const savedSets = exercise.sets.map((set) => ({ key: set.id, repetitions: set.repetitions == null ? '' : String(set.repetitions), weight: set.weight ?? '', unit: set.unit ?? unit, durationSeconds: set.durationSeconds == null ? '' : String(set.durationSeconds) }));
        let savedIndex = 0;
        const sets = currentDraft
          ? currentDraft.sets.map((draft) => hasAnyValue(draft) ? (savedSets[savedIndex++] ?? draft) : draft)
          : [...savedSets];
        sets.push(...savedSets.slice(savedIndex));
        const plannedSetCount = exercise.plannedSetCountSnapshot ?? currentDraft?.plannedSetCount ?? null;
        return {
          exerciseId: exercise.exerciseId,
          name: exercise.exerciseNameSnapshot,
          measurementType: exercise.measurementTypeSnapshot,
          plannedSetCount,
          targetRepMin: exercise.targetRepMinSnapshot ?? currentDraft?.targetRepMin ?? null,
          targetRepMax: exercise.targetRepMaxSnapshot ?? currentDraft?.targetRepMax ?? null,
          sets: restoreSetDrafts(sets, plannedSetCount, unit),
        };
      });
      setExercises(updatedDrafts);
      setSetErrors({});
      setSaveMessage('Workout saved.');
      return updated;
    } catch (cause) {
      setError(errorMessage(cause, 'The workout could not be saved. Your edits are still on this screen.'));
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveAndLeave() {
    const updated = await persistWorkout();
    if (updated) navigate('/');
  }

  async function completeWorkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCompleting(true);
    const updated = await persistWorkout();
    if (!updated) { setCompleting(false); return; }
    setError('');
    try {
      await api<Workout>(`/api/workout-sessions/${id}/complete`, { method: 'POST' });
      navigate('/', { replace: true, state: { workoutCompleted: true } });
    } catch (cause) {
      setError(errorMessage(cause, 'Your workout was saved but could not be completed. Try again.'));
      setCompleting(false);
    }
  }

  if (loading) return <main id="main-content" tabIndex={-1} className="workout-route"><div className="workout-sheet"><p className="inline-status" role="status">Loading your workout…</p></div></main>;
  if (error && !workout) return (
    <main id="main-content" tabIndex={-1} className="workout-route">
      <section className="workout-sheet workout-error-panel"><p className="section-kicker">WORKOUT</p><h1>Workout unavailable</h1><p className="form-error" role="alert">{error}</p><Link className="secondary-button" to="/">Return to Today</Link></section>
    </main>
  );
  if (!workout) return null;
  const readOnly = workout.status === 'COMPLETED';

  return (
    <main id="main-content" tabIndex={-1} className="workout-route">
      <section className="workout-sheet" aria-label={`${workout.sourceNameSnapshot ?? 'Workout'} session`}>
        <header className="workout-session-header">
          {readOnly ? <Link className="workout-close-button" to="/" aria-label="Return to Today">‹</Link> : <button className="workout-close-button" type="button" aria-label="Save and return to Today" disabled={saving || completing} onClick={() => void saveAndLeave()}>‹</button>}
          <div className="workout-session-heading"><small>{readOnly ? 'Workout completed' : 'Workout in progress'}</small><strong>{workout.sourceNameSnapshot ?? 'Workout'}</strong></div>
          <span className={readOnly ? 'workout-status complete' : 'workout-status'}>{readOnly ? 'DONE' : 'ACTIVE'}</span>
        </header>

        <div className="workout-session-scroll">
          <div className="workout-session-meta"><span>{formatWorkoutDate(workout.workoutDate, account.timeZone)}</span><span>{recordedSetCount} / {totalSetCount} sets recorded</span></div>
          <div className="workout-progress-track" role="progressbar" aria-label="Workout sets recorded" aria-valuemin={0} aria-valuemax={totalSetCount} aria-valuenow={recordedSetCount}><span style={{ width: `${totalSetCount ? recordedSetCount / totalSetCount * 100 : 0}%` }} /></div>

          <div className="workout-editor-heading">
            <div><p className="section-kicker">WORKOUT OVERVIEW</p><h1 id="exercise-overview-heading">All exercises</h1></div>
            {!readOnly && <button className="workout-add-exercise" type="button" onClick={() => { if (pickerOpen) { setPickerOpen(false); setReplacingExerciseId(''); setExerciseError(''); } else openExercisePicker(); }}>{pickerOpen ? 'Close' : '+ Add exercise'}</button>}
          </div>
          {!readOnly && <p className="workout-editor-note">Choose an exercise to edit its sets. This workout can change as you go.</p>}

        {pickerOpen && !readOnly && (
          <div className="exercise-picker" role="dialog" aria-label="Choose an exercise">
            <p className="picker-title">{replacingExerciseId ? `Replace ${exercises.find((exercise) => exercise.exerciseId === replacingExerciseId)?.name ?? 'exercise'}` : 'Choose an exercise'}</p>
            <label className="form-field" htmlFor="exercise-search"><span>Search exercises</span><input id="exercise-search" type="search" value={exerciseQuery} onChange={(event) => setExerciseQuery(event.currentTarget.value)} placeholder="Type an exercise name" autoFocus /></label>
            {exerciseLoading && <p className="inline-status" role="status">Loading exercises…</p>}
            {exerciseError && <p className="form-error" role="alert">{exerciseError}</p>}
            {!exerciseLoading && !exerciseError && <ul className="exercise-search-results">
              {exerciseResults.filter((item) => !exercises.some((exercise) => exercise.exerciseId === item.id && exercise.exerciseId !== replacingExerciseId)).slice(0, 10).map((item) => (
                <li key={item.id}><span><strong>{item.name}</strong><small>{measurementLabel(item.measurementType)}</small></span><button className="secondary-button" type="button" onClick={() => addExercise(item)}>{replacingExerciseId ? 'Replace' : 'Add'}</button></li>
              ))}
              {exerciseResults.length === 0 && <li className="search-empty">No matching exercises.</li>}
            </ul>}
            <button className="picker-cancel" type="button" onClick={() => { setPickerOpen(false); setReplacingExerciseId(''); setExerciseError(''); }}>Cancel</button>
          </div>
        )}

        {exercises.length === 0 ? <div className="empty-workout"><span>No exercises in this workout yet.</span></div> : (
          <ol className="workout-exercise-list">
            {exercises.map((exercise, index) => {
              const isOpen = openExercises.has(exercise.exerciseId);
              const recordedSets = exercise.sets.filter((set) => isSetValid(exercise.measurementType, set)).length;
              return (
                <li className="workout-exercise" key={exercise.exerciseId}>
                  <div className="workout-exercise-summary">
                    <button className="exercise-expand" type="button" aria-expanded={isOpen} aria-controls={`exercise-panel-${exercise.exerciseId}`} onClick={() => setOpenExercises((current) => { const next = new Set(current); if (next.has(exercise.exerciseId)) next.delete(exercise.exerciseId); else next.add(exercise.exerciseId); return next; })}>
                      <span className="exercise-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="exercise-summary-copy"><strong>{exercise.name}</strong></span>
                      <span className="exercise-set-count" aria-label={`${recordedSets} of ${exercise.sets.length} sets recorded`}>{recordedSets}/{exercise.sets.length} <small>sets</small></span>
                      <span className={`exercise-chevron${isOpen ? ' expanded' : ''}`} aria-hidden="true"><svg viewBox="0 0 16 16" focusable="false"><path d="m4.5 6 3.5 3.5L11.5 6" /></svg></span>
                    </button>
                    {!readOnly && <div className="exercise-actions-wrap">
                      <button className="exercise-actions-trigger" type="button" aria-label={`Actions for ${exercise.name}`} aria-expanded={openExerciseActions === exercise.exerciseId} onClick={() => setOpenExerciseActions((current) => current === exercise.exerciseId ? '' : exercise.exerciseId)}>···</button>
                      {openExerciseActions === exercise.exerciseId && <div className="exercise-actions-menu" role="group" aria-label={`Actions for ${exercise.name}`}>
                        <button type="button" onClick={() => openExercisePicker(exercise.exerciseId)}>Replace</button>
                        <button type="button" disabled={index === 0} onClick={() => { moveExercise(index, -1); setOpenExerciseActions(''); }}>Move up</button>
                        <button type="button" disabled={index === exercises.length - 1} onClick={() => { moveExercise(index, 1); setOpenExerciseActions(''); }}>Move down</button>
                        <button className="danger-action" type="button" onClick={() => { removeExercise(exercise.exerciseId); setOpenExerciseActions(''); }}>Remove</button>
                      </div>}
                    </div>}
                  </div>

                  {isOpen && <div className="exercise-editor-panel" id={`exercise-panel-${exercise.exerciseId}`}>
                    {exercise.targetRepMin && exercise.targetRepMax && <p className="target-hint">Target: {exercise.targetRepMin}–{exercise.targetRepMax} reps per set</p>}
                    {!exercise.sets.length && <p className="empty-sets">No sets recorded yet{exercise.plannedSetCount ? ` · ${exercise.plannedSetCount} planned` : ''}.</p>}
                    {exercise.sets.length > 0 && <div className={`set-editor-labels${exercise.measurementType === 'TIME' ? ' timed' : ''}`} aria-hidden="true"><span>Set</span>{exercise.measurementType === 'TIME' ? <span>Duration · sec</span> : <><span>Reps</span><span>Load · unit</span></>}</div>}
                    {exercise.sets.map((set, setIndex) => (
                      <div className="set-editor" key={set.key}>
                        <div className="set-editor-top"><strong>{setIndex + 1}</strong>{!readOnly && <button className="remove-set-button" type="button" aria-label={`Remove set ${setIndex + 1}`} onClick={() => removeSet(exercise.exerciseId, set.key)}>×</button>}</div>
                        {exercise.measurementType === 'TIME' ? (
                          <label className="form-field set-field" htmlFor={`duration-${set.key}`}><span className="visually-hidden">Duration in seconds</span><div className="input-with-unit"><input id={`duration-${set.key}`} type="number" inputMode="numeric" min="1" step="1" value={set.durationSeconds} disabled={readOnly} onChange={(event) => changeSet(exercise.exerciseId, set.key, 'durationSeconds', event.currentTarget.value)} placeholder="sec" /><span>sec</span></div></label>
                        ) : (
                          <div className="set-measurement-fields">
                            <label className="form-field set-field" htmlFor={`reps-${set.key}`}><span className="visually-hidden">Repetitions</span><input id={`reps-${set.key}`} type="number" inputMode="numeric" min="1" step="1" value={set.repetitions} disabled={readOnly} onChange={(event) => changeSet(exercise.exerciseId, set.key, 'repetitions', event.currentTarget.value)} placeholder="reps" /></label>
                            <label className="form-field set-field" htmlFor={`weight-${set.key}`}><span className="visually-hidden">Weight</span><div className="input-with-unit"><input id={`weight-${set.key}`} type="number" inputMode="decimal" min="0" step="any" value={set.weight} disabled={readOnly} onChange={(event) => changeSet(exercise.exerciseId, set.key, 'weight', event.currentTarget.value)} placeholder="load" /><select aria-label={`Weight unit for set ${setIndex + 1}`} value={set.unit} disabled={readOnly} onChange={(event) => changeSet(exercise.exerciseId, set.key, 'unit', event.currentTarget.value)}><option value="KG">kg</option><option value="LB">lb</option></select></div></label>
                          </div>
                        )}
                        {setErrors[set.key] && <p className="set-error" role="alert">{setErrors[set.key]}</p>}
                      </div>
                    ))}
                    {!readOnly && <button className="add-set-button" type="button" onClick={() => addSet(exercise.exerciseId)}>+ Add set</button>}
                  </div>}
                </li>
              );
            })}
          </ol>
        )}
        </div>
        {error && <p className="form-error workout-global-error" role="alert">{error}</p>}
        {saveMessage && <p className="inline-success workout-save-message" role="status">{saveMessage}</p>}
        <footer className="workout-session-footer">
          {readOnly ? <Link className="primary-button" to="/">Return to Today</Link> : <form className="workout-footer-actions" onSubmit={(event) => void completeWorkout(event)}>
            <button className="secondary-button" type="button" disabled={saving || completing} onClick={() => void persistWorkout()}>{saving ? 'Saving…' : 'Save changes'}</button>
            <button className="primary-button" type="submit" disabled={saving || completing}>{completing ? 'Completing…' : 'Complete workout'}</button>
          </form>}
          {!readOnly && <p className="workout-recording-note">{recordedSetCount} of {totalSetCount} {totalSetCount === 1 ? 'set' : 'sets'} recorded</p>}
        </footer>
      </section>
    </main>
  );
}

function blankSet(unit: WeightUnit): SetDraft {
  return { key: `draft-${crypto.randomUUID()}`, repetitions: '', weight: '', unit, durationSeconds: '' };
}

function restoreSetDrafts(savedSets: SetDraft[], plannedSetCount: number | null, unit: WeightUnit): SetDraft[] {
  const missingPlannedSets = Math.max(0, (plannedSetCount ?? 0) - savedSets.length);
  return [...savedSets, ...Array.from({ length: missingPlannedSets }, () => blankSet(unit))];
}

function hasAnyValue(set: SetDraft): boolean {
  return Boolean(set.repetitions.trim() || set.weight.trim() || set.durationSeconds.trim());
}

function isSetValid(type: MeasurementType, set: SetDraft): boolean {
  return validateSet(type, set) === '';
}

function validateSet(type: MeasurementType, set: SetDraft): string {
  if (type === 'TIME') {
    if (!/^\d+$/.test(set.durationSeconds) || Number(set.durationSeconds) < 1) return 'Enter a duration of at least 1 second.';
    if (set.repetitions.trim() || set.weight.trim()) return 'Time sets use duration only.';
    return '';
  }
  if (!/^\d+$/.test(set.repetitions) || Number(set.repetitions) < 1) return 'Enter at least 1 repetition.';
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(set.weight.trim())) return 'Enter a nonnegative weight (zero is valid).';
  if (set.durationSeconds.trim()) return 'Repetition-and-weight sets do not use duration.';
  return '';
}

function measurementLabel(type: MeasurementType): string {
  return type === 'TIME' ? 'Time' : 'Reps + weight';
}

function formatWorkoutDate(date: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { timeZone, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import type { MetaFunction } from 'react-router';
import { errorMessage } from '../api/api-client';
import { useApiClient } from '../auth/use-api';

export const meta: MetaFunction = () => [{ title: 'Plan · LiftMetrics' }];

type MeasurementType = 'REPS_AND_WEIGHT' | 'TIME';
interface Exercise { id: string; name: string; measurementType: MeasurementType; archivedAt: string | null }
interface BlueprintExercise { id: string; exerciseId: string; position: number; plannedSetCount: number; targetRepMin: number | null; targetRepMax: number | null; exercise: Exercise }
interface Blueprint { id: string; name: string; notes: string | null; archivedAt: string | null; exercises: BlueprintExercise[] }
interface Assignment { id: string; blueprintId: string; weekday: number; position: number; blueprint: Blueprint }
interface WeeklyPlan { id: string; name: string; isActive: boolean; assignments: Assignment[] }
interface ExerciseDraft { key: string; exerciseId: string; name: string; measurementType: MeasurementType; sets: string; min: string; max: string; showTarget: boolean }
interface DayDraft { choice: 'unset' | 'rest' | 'workout'; name: string; exercises: ExerciseDraft[]; blueprintId?: string }
interface Wizard { mode: 'create' | 'edit'; planId?: string }

const days = [
  { iso: 1, name: 'Monday' }, { iso: 2, name: 'Tuesday' }, { iso: 3, name: 'Wednesday' },
  { iso: 4, name: 'Thursday' }, { iso: 5, name: 'Friday' }, { iso: 6, name: 'Saturday' }, { iso: 7, name: 'Sunday' },
];
const emptyDays = (): DayDraft[] => days.map(() => ({ choice: 'unset', name: '', exercises: [] }));

export default function PlanRoute() {
  const api = useApiClient();
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [wizard, setWizard] = useState<Wizard | null>(null);
  const [step, setStep] = useState(0);
  const [showDayChoices, setShowDayChoices] = useState(true);
  const [planName, setPlanName] = useState('');
  const [draftDays, setDraftDays] = useState<DayDraft[]>(emptyDays);
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [newPlanId, setNewPlanId] = useState('');
  const wizardFormRef = useRef<HTMLFormElement>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [planResult, exerciseResult] = await Promise.allSettled([
      api<WeeklyPlan[]>('/api/weekly-plans'),
      api<Exercise[]>('/api/exercises'),
    ]);
    const errors: string[] = [];
    if (planResult.status === 'fulfilled') {
      setPlans(planResult.value);
      setSelectedPlanId((current) => planResult.value.some((plan) => plan.id === current)
        ? current : (planResult.value.find((plan) => plan.isActive) ?? planResult.value[0])?.id ?? '');
    } else errors.push(errorMessage(planResult.reason, 'Your plans could not be loaded.'));
    if (exerciseResult.status === 'fulfilled') setExercises(exerciseResult.value.filter((item) => !item.archivedAt));
    else errors.push(errorMessage(exerciseResult.reason, 'The exercise list could not be loaded.'));
    setLoadError(errors.join(' '));
    setLoading(false);
  }, [api]);

  useEffect(() => { void refresh(); }, [refresh]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? null;

  function startCreate() {
    setWizard({ mode: 'create' }); setStep(0); setPlanName(''); setDraftDays(emptyDays());
    setMessage(''); setError(''); setNewPlanId(''); setShowDayChoices(false);
  }

  function startEdit(plan: WeeklyPlan) {
    const next = emptyDays();
    for (const assignment of plan.assignments) {
      if (next[assignment.weekday - 1].choice !== 'unset') continue;
      const blueprint = assignment.blueprint;
      next[assignment.weekday - 1] = {
        choice: 'workout', name: blueprint.name, blueprintId: blueprint.id,
        exercises: [...blueprint.exercises].sort((a, b) => a.position - b.position).map((item) => ({
          key: item.id, exerciseId: item.exerciseId, name: item.exercise.name,
          measurementType: item.exercise.measurementType, sets: String(item.plannedSetCount),
          min: item.targetRepMin == null ? '' : String(item.targetRepMin),
          max: item.targetRepMax == null ? '' : String(item.targetRepMax),
          showTarget: item.targetRepMin != null || item.targetRepMax != null,
        })),
      };
    }
    setWizard({ mode: 'edit', planId: plan.id }); setStep(0); setPlanName(plan.name); setDraftDays(next);
    setMessage(''); setError(''); setNewPlanId(''); setShowDayChoices(false);
  }

  function updateDay(index: number, change: Partial<DayDraft>) {
    setDraftDays((current) => current.map((day, i) => i === index ? { ...day, ...change } : day));
    setError('');
  }

  function addExercise(index: number, exercise: Exercise) {
    if (!exercise || draftDays[index].exercises.some((item) => item.exerciseId === exercise.id)) return;
    const next = [...draftDays];
    next[index] = { ...next[index], exercises: [...next[index].exercises, {
      key: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name,
      measurementType: exercise.measurementType, sets: '3', min: '', max: '', showTarget: false,
    }] };
    setDraftDays(next); setExerciseQuery(''); setActiveExerciseIndex(-1); setError('');
  }

  function updateExercise(dayIndex: number, key: string, change: Partial<ExerciseDraft>) {
    setDraftDays((current) => current.map((day, i) => i !== dayIndex ? day : {
      ...day, exercises: day.exercises.map((exercise) => exercise.key === key ? { ...exercise, ...change } : exercise),
    }));
    setError('');
  }

  function moveExercise(dayIndex: number, index: number, direction: -1 | 1) {
    setDraftDays((current) => current.map((day, i) => {
      if (i !== dayIndex) return day;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= day.exercises.length) return day;
      const next = [...day.exercises]; [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return { ...day, exercises: next };
    }));
  }

  function validateDay(index: number) {
    const day = draftDays[index];
    if (day.choice === 'unset') return `Choose a workout or rest day for ${days[index].name}.`;
    if (day.choice === 'workout') {
      if (!day.name.trim()) return `Add a name for ${days[index].name}’s workout.`;
      if (!day.exercises.length) return `Add at least one exercise to ${days[index].name}’s workout.`;
      for (const item of day.exercises) {
        const sets = Number(item.sets); const min = item.min === '' ? null : Number(item.min); const max = item.max === '' ? null : Number(item.max);
        if (!Number.isInteger(sets) || sets < 1) return `Enter a valid set count for ${item.name}.`;
        const hasTarget = min !== null || max !== null;
        if (item.measurementType === 'REPS_AND_WEIGHT' && hasTarget
          && (min === null || max === null || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min)) {
          return `Check the optional repetition range for ${item.name}. Enter both bounds and make the maximum at least the minimum.`;
        }
      }
    }
    return '';
  }

  function continueDay() {
    const validationError = validateDay(step);
    if (validationError) { setError(validationError); return; }
    setError(''); setExerciseQuery(''); setActiveExerciseIndex(-1); setShowDayChoices(false); setStep((current) => current + 1);
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!wizard) return;
    if (!planName.trim()) { setError('Give this weekly plan a name.'); setStep(7); return; }
    for (let index = 0; index < 7; index += 1) {
      const validationError = validateDay(index);
      if (validationError) { setError(validationError); setStep(index); return; }
    }
    setBusy(true); setError(''); setMessage('');
    try {
      if (newPlanId) {
        const active = await api<WeeklyPlan>(`/api/weekly-plans/${newPlanId}/activate`, { method: 'POST' });
        setPlans((current) => current.map((plan) => ({ ...plan, isActive: plan.id === active.id })));
        setSelectedPlanId(active.id); setWizard(null); setNewPlanId('');
        setMessage('Plan created and activated. Today will follow this week’s schedule.');
        return;
      }

      const startingPlan = wizard.mode === 'edit' ? plans.find((plan) => plan.id === wizard.planId) : null;
      const assignments: Array<{ blueprintId: string; weekday: number }> = [];
      const updatedDays = [...draftDays];
      for (let index = 0; index < updatedDays.length; index += 1) {
        const day = updatedDays[index];
        if (day.choice !== 'workout') continue;
        const body = {
          name: day.name.trim(), notes: null,
          exercises: day.exercises.map((item) => ({
            exerciseId: item.exerciseId, plannedSetCount: Number(item.sets),
            ...(item.measurementType === 'REPS_AND_WEIGHT' && item.min !== '' && item.max !== ''
              ? { targetRepMin: Number(item.min), targetRepMax: Number(item.max) } : {}),
          })),
        };
        let blueprintId = day.blueprintId;
        let isShared = false;
        if (blueprintId && startingPlan) {
          isShared = plans.some((plan) => plan.id !== startingPlan.id
            && plan.assignments.some((assignment) => assignment.blueprintId === blueprintId));
        }
        const saved = blueprintId && !isShared
          ? await api<Blueprint>(`/api/session-blueprints/${blueprintId}`, { method: 'PUT', body })
          : await api<Blueprint>('/api/session-blueprints', { method: 'POST', body });
        blueprintId = saved.id;
        updatedDays[index] = { ...day, blueprintId };
        assignments.push({ blueprintId, weekday: index + 1 });
        setDraftDays([...updatedDays]);
      }

      if (wizard.mode === 'edit' && wizard.planId) {
        const updated = await api<WeeklyPlan>(`/api/weekly-plans/${wizard.planId}`, {
          method: 'PUT', body: { name: planName.trim(), assignments },
        });
        setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
        setSelectedPlanId(updated.id); setWizard(null);
        const retainedIds = new Set(assignments.map((assignment) => assignment.blueprintId));
        const noLongerUsed = [...new Set((startingPlan?.assignments ?? []).map((assignment) => assignment.blueprintId))]
          .filter((id) => !retainedIds.has(id) && !plans.some((plan) => plan.id !== updated.id
            && plan.assignments.some((assignment) => assignment.blueprintId === id)));
        const archiveResults = await Promise.allSettled(noLongerUsed.map((id) =>
          api<Blueprint>(`/api/session-blueprints/${id}/archive`, { method: 'POST' })));
        const archiveFailed = archiveResults.some((result) => result.status === 'rejected');
        setMessage(archiveFailed
          ? 'Your weekly plan was saved, but an unused old workout could not be archived. It will not appear in this plan.'
          : 'Your weekly plan was saved. Started workouts keep the prescription they began with.');
      } else {
        const created = await api<WeeklyPlan>('/api/weekly-plans', {
          method: 'POST', body: { name: planName.trim(), assignments },
        });
        setPlans((current) => [created, ...current.filter((plan) => plan.id !== created.id)]);
        setNewPlanId(created.id);
        const active = await api<WeeklyPlan>(`/api/weekly-plans/${created.id}/activate`, { method: 'POST' });
        setPlans((current) => current.map((plan) => plan.id === active.id ? active : { ...plan, isActive: false }));
        setSelectedPlanId(active.id); setWizard(null); setNewPlanId('');
        setMessage('Plan created and activated. Today will follow this week’s schedule.');
      }
    } catch (cause) {
      setError(errorMessage(cause, 'The plan could not be saved. Your progress is still here; try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function activate(plan: WeeklyPlan) {
    setBusy(true); setError(''); setMessage('');
    try {
      const active = await api<WeeklyPlan>(`/api/weekly-plans/${plan.id}/activate`, { method: 'POST' });
      setPlans((current) => current.map((item) => item.id === active.id ? active : { ...item, isActive: false }));
      setMessage('Plan activated. Today will use this schedule.');
    } catch (cause) { setError(errorMessage(cause, 'This plan could not be activated. Please try again.')); }
    finally { setBusy(false); }
  }

  async function deactivate(plan: WeeklyPlan) {
    setBusy(true); setError(''); setMessage('');
    try {
      const inactive = await api<WeeklyPlan>(`/api/weekly-plans/${plan.id}/deactivate`, { method: 'POST' });
      setPlans((current) => current.map((item) => item.id === inactive.id ? inactive : item));
      setMessage('Plan deactivated. Today will have no scheduled workout until a plan is activated.');
    } catch (cause) { setError(errorMessage(cause, 'This plan could not be deactivated. Please try again.')); }
    finally { setBusy(false); }
  }

  const exerciseSuggestions = exerciseQuery.trim()
    ? exercises.filter((item) => item.name.toLocaleLowerCase().includes(exerciseQuery.trim().toLocaleLowerCase())
      && !draftDays[step]?.exercises.some((current) => current.exerciseId === item.id)).slice(0, 7)
    : [];
  const currentDay = days[step];

  function handleDayChoiceKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const nextChoice = event.key === 'Home' ? 0
      : event.key === 'End' ? 1
        : event.currentTarget.dataset.choice === 'workout' ? 1 : 0;
    const choice = nextChoice === 0 ? 'workout' : 'rest';
    setShowDayChoices(true);
    updateDay(step, choice === 'workout' ? { choice } : { choice, blueprintId: undefined });
    const group = event.currentTarget.parentElement;
    const nextButton = group?.querySelector<HTMLButtonElement>(`[data-choice="${choice}"]`);
    nextButton?.focus();
  }

  return <main id="main-content" tabIndex={-1} className="page-shell secondary-page plan-page">
    {!wizard && <div className="page-heading"><div className="eyebrow">TRAINING</div><h1>Plan</h1></div>}
    {loadError && <div className="plan-load-error form-error" role="alert"><span>{loadError}</span><button className="text-button" type="button" onClick={() => void refresh()}>Retry</button></div>}
    {message && <p className="plan-notice" role="status">{message}</p>}
    {error && !wizard && <p className="form-error" role="alert">{error}</p>}
    {loading && !plans.length ? <p className="history-state" role="status">Loading plans…</p> : wizard ? (
      <form ref={wizardFormRef} className="card plan-wizard" onSubmit={(event) => void savePlan(event)}>
        <div className="wizard-topline"><span>{step < 7 ? `DAY ${step + 1} OF 7` : 'WEEKLY REVIEW'}</span></div>
        {step < 7 ? <section className="wizard-day" aria-labelledby="wizard-day-title">
          <div className="wizard-day-heading"><h2 id="wizard-day-title">{currentDay.name}</h2>
          {draftDays[step].choice !== 'unset' && !showDayChoices && <div className="day-choice-summary"><strong>{draftDays[step].choice === 'workout' ? 'Workout' : 'Rest day'}</strong><button className="text-button" type="button" onClick={() => setShowDayChoices(true)}>Change</button></div>}</div>
          {(draftDays[step].choice === 'unset' || showDayChoices) && <div className="day-choice-list" role="radiogroup" aria-label={`Schedule for ${currentDay.name}`}>
            <button type="button" role="radio" data-choice="workout" aria-checked={draftDays[step].choice === 'workout'} tabIndex={draftDays[step].choice === 'rest' ? -1 : 0} className={`day-choice${draftDays[step].choice === 'workout' ? ' selected' : ''}`} onKeyDown={handleDayChoiceKeyDown} onClick={() => { updateDay(step, { choice: 'workout' }); setShowDayChoices(false); }}><span className="choice-dot" /><strong>Workout</strong></button>
            <button type="button" role="radio" data-choice="rest" aria-checked={draftDays[step].choice === 'rest'} tabIndex={draftDays[step].choice === 'rest' ? 0 : -1} className={`day-choice${draftDays[step].choice === 'rest' ? ' selected' : ''}`} onKeyDown={handleDayChoiceKeyDown} onClick={() => { updateDay(step, { choice: 'rest', blueprintId: undefined }); setShowDayChoices(false); }}><span className="choice-dot" /><strong>Rest day</strong></button>
          </div>}
          {draftDays[step].choice === 'workout' && <div className="day-workout-editor">
            <label className="form-field" htmlFor="day-workout-name"><span>Workout name</span><input id="day-workout-name" value={draftDays[step].name} onChange={(event) => updateDay(step, { name: event.currentTarget.value })} maxLength={120} required placeholder="e.g. Upper body" /></label>
            {draftDays[step].exercises.length > 0 && <ol className="wizard-exercise-list">{draftDays[step].exercises.map((item, index) => <li key={item.key}>
              <header className="wizard-exercise-card-heading"><div><strong>{item.name}</strong><small>{item.measurementType === 'TIME' ? 'Timed exercise' : 'Repetitions + weight'}</small></div><div className="routine-row-actions"><button className="icon-button" type="button" aria-label={`Move ${item.name} earlier`} onClick={() => moveExercise(step, index, -1)} disabled={index === 0}>↑</button><button className="icon-button" type="button" aria-label={`Move ${item.name} later`} onClick={() => moveExercise(step, index, 1)} disabled={index === draftDays[step].exercises.length - 1}>↓</button><button className="icon-button remove" type="button" aria-label={`Remove ${item.name}`} onClick={() => updateDay(step, { exercises: draftDays[step].exercises.filter((exercise) => exercise.key !== item.key) })}>×</button></div></header>
              <div className="wizard-exercise-settings"><label className="wizard-sets-field"><span>Sets</span><input aria-label={`${item.name} sets`} type="number" min="1" step="1" inputMode="numeric" value={item.sets} onChange={(event) => updateExercise(step, item.key, { sets: event.currentTarget.value })} /></label>
                {item.measurementType === 'REPS_AND_WEIGHT' && (item.showTarget
                  ? <fieldset className="wizard-target"><legend>Rep range</legend><div><input aria-label={`${item.name} minimum reps`} placeholder="Min" type="number" min="1" step="1" inputMode="numeric" value={item.min} onChange={(event) => updateExercise(step, item.key, { min: event.currentTarget.value })} /><span aria-hidden="true">–</span><input aria-label={`${item.name} maximum reps`} placeholder="Max" type="number" min="1" step="1" inputMode="numeric" value={item.max} onChange={(event) => updateExercise(step, item.key, { max: event.currentTarget.value })} /><button className="target-remove" type="button" aria-label={`Remove rep range for ${item.name}`} onClick={() => updateExercise(step, item.key, { min: '', max: '', showTarget: false })}>×</button></div></fieldset>
                  : <button className="target-add" type="button" onClick={() => updateExercise(step, item.key, { showTarget: true })}>＋ Add rep range</button>)}
              </div>
            </li>)}</ol>}
            <div className="wizard-add-section"><strong>Add an exercise</strong><div className="wizard-add-exercise"><label className="visually-hidden" htmlFor="exercise-search">Search exercises</label><input id="exercise-search" type="search" role="combobox" aria-haspopup="listbox" aria-autocomplete="list" aria-expanded={exerciseSuggestions.length > 0} aria-controls={exerciseSuggestions.length > 0 ? 'exercise-suggestions' : undefined} aria-activedescendant={exerciseSuggestions[activeExerciseIndex] ? `exercise-suggestion-${activeExerciseIndex}` : undefined} placeholder="Search exercises by name" value={exerciseQuery} onChange={(event) => { setExerciseQuery(event.currentTarget.value); setActiveExerciseIndex(-1); }} onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && exerciseSuggestions.length) { event.preventDefault(); setActiveExerciseIndex((current) => current < 0 ? 0 : Math.min(current + 1, exerciseSuggestions.length - 1)); }
              if (event.key === 'ArrowUp' && exerciseSuggestions.length) { event.preventDefault(); setActiveExerciseIndex((current) => Math.max(current - 1, 0)); }
              if (event.key === 'Enter' && exerciseSuggestions[Math.max(activeExerciseIndex, 0)]) { event.preventDefault(); addExercise(step, exerciseSuggestions[Math.max(activeExerciseIndex, 0)]); }
              if (event.key === 'Escape') { setExerciseQuery(''); setActiveExerciseIndex(-1); }
            }} />{exerciseSuggestions.length > 0 && <div className="exercise-suggestions" id="exercise-suggestions" role="listbox" aria-label="Exercise results">{exerciseSuggestions.map((item, index) => <div className={`exercise-suggestion${index === activeExerciseIndex ? ' active' : ''}`} id={`exercise-suggestion-${index}`} key={item.id} role="option" aria-selected={index === activeExerciseIndex} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActiveExerciseIndex(index)} onClick={() => addExercise(step, item)}><span><strong>{item.name}</strong><small>{item.measurementType === 'TIME' ? 'Time' : 'Repetitions + weight'}</small></span><span className="exercise-suggestion-add" aria-hidden="true">＋</span></div>)}</div>}{exerciseQuery.trim() && exerciseSuggestions.length === 0 && <p className="exercise-no-results" role="status">No matching exercises. Try another name.</p>}</div></div>
          </div>}
        </section> : <section className="wizard-review" aria-labelledby="wizard-review-title"><p className="section-kicker">CHECK YOUR WEEK</p><h2 id="wizard-review-title">Review your week</h2><label className="form-field wizard-plan-name" htmlFor="wizard-plan-name"><span>Plan name</span><input id="wizard-plan-name" value={planName} onChange={(event) => setPlanName(event.currentTarget.value)} maxLength={120} required placeholder="e.g. Strength and conditioning" /></label><ol>{draftDays.map((day, index) => <li key={index}><div><strong>{days[index].name}</strong><span>{day.choice === 'workout' ? day.name : 'Rest day'}</span></div>{day.choice === 'workout' && <small>{day.exercises.length} {day.exercises.length === 1 ? 'exercise' : 'exercises'}</small>}<button className="text-button" type="button" onClick={() => { setStep(index); setError(''); }}>Edit</button></li>)}</ol><p className="plan-snapshot-note">Each workout is saved with this plan. Changes apply to future recommendations; a workout already started keeps its original exercises and targets.</p></section>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="wizard-actions"><button className="text-button wizard-discard" type="button" onClick={() => { setWizard(null); setError(''); setNewPlanId(''); }}>{wizard.mode === 'create' ? 'Discard plan' : 'Discard changes'}</button>{step > 0 && <button className="secondary-button" type="button" onClick={() => { setStep((current) => current - 1); setError(''); }}>Previous</button>}<button className="primary-button" type="button" disabled={busy || (step === 7 && !planName.trim())} onClick={() => { if (step < 7) continueDay(); else wizardFormRef.current?.requestSubmit(); }}>{step < 7 ? <>Continue <span aria-hidden="true">→</span></> : busy ? 'Saving plan…' : wizard.mode === 'create' ? (newPlanId ? 'Activate plan' : 'Create plan') : 'Save changes'}</button></div>
      </form>
    ) : plans.length === 0 ? <section className="card plan-empty-state"><div><p className="section-kicker">YOUR WEEKLY PLAN</p><h2>No plan yet</h2><p>Create one by choosing what you’ll do each day. Each workout belongs to its day in this plan.</p><button className="primary-button" type="button" onClick={startCreate}>＋ Create new plan</button></div></section> : <>
      <section className="card plan-overview">
        <div className="plan-overview-top"><div className="plan-overview-label"><label htmlFor="weekly-plan-select">Weekly plan</label><span className={selectedPlan?.isActive ? 'plan-status active' : 'plan-status'}>{selectedPlan?.isActive ? 'Active' : 'Inactive'}</span></div><select id="weekly-plan-select" value={selectedPlanId} onChange={(event) => { setSelectedPlanId(event.currentTarget.value); setError(''); setMessage(''); }}>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.isActive ? ' · Active' : ''}</option>)}</select></div>
        {selectedPlan && <><div className="week-overview">{days.map((day) => {
          const assignment = selectedPlan.assignments.find((item) => item.weekday === day.iso);
          return <article className="week-overview-day" key={day.iso}><strong>{day.name}</strong><div className="week-overview-details"><span>{assignment ? assignment.blueprint.archivedAt ? 'Workout needs updating' : assignment.blueprint.name : 'Rest day'}</span>{assignment && !assignment.blueprint.archivedAt && <small>{assignment.blueprint.exercises.length} {assignment.blueprint.exercises.length === 1 ? 'exercise' : 'exercises'}</small>}</div></article>;
        })}</div><div className="plan-overview-actions"><button className="primary-button" type="button" onClick={() => startEdit(selectedPlan)}>Edit this plan</button>{selectedPlan.isActive ? <button className="secondary-button" type="button" onClick={() => void deactivate(selectedPlan)} disabled={busy}>Deactivate</button> : <button className="secondary-button" type="button" onClick={() => void activate(selectedPlan)} disabled={busy}>Use this plan</button>}<button className="secondary-button" type="button" onClick={startCreate}>Create new plan</button></div></>}
      </section><p className="plan-today-link">Today’s recommendation is based on your active plan. <Link to="/">View Today →</Link></p>
    </>}
  </main>;
}

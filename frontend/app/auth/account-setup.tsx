import { useEffect, useState, type FormEvent } from 'react';
import type { Account, WeightUnit } from './account-session';
import { errorMessage } from '../api/api-client';
import { useApiClient } from './use-api';

export function AccountSetup({ onComplete }: { onComplete: (account: Account) => void }) {
  const api = useApiClient();
  const [timeZone, setTimeZone] = useState('');
  const [unit, setUnit] = useState<WeightUnit>('KG');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const account = await api<Account>('/api/account', {
        method: 'POST',
        body: { timeZone: timeZone.trim(), preferredWeightUnit: unit },
      });
      onComplete(account);
    } catch (cause) {
      setError(errorMessage(cause, 'Your account could not be set up. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel card" aria-labelledby="account-setup-title">
        <p className="section-kicker">FIRST TIME HERE?</p>
        <h1 id="account-setup-title">Set up your account.</h1>
        <p className="card-description">Choose the time zone used for your training days and the weight unit you prefer.</p>
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field" htmlFor="account-time-zone">
            <span>Time zone</span>
            <input
              id="account-time-zone"
              name="timeZone"
              autoComplete="off"
              maxLength={64}
              required
              value={timeZone}
              onChange={(event) => setTimeZone(event.currentTarget.value)}
              placeholder="America/Argentina/Buenos_Aires"
            />
            <small>This is detected from your device and can’t be changed later.</small>
          </label>
          <label className="form-field" htmlFor="account-weight-unit">
            <span>Preferred weight unit</span>
            <select
              id="account-weight-unit"
              value={unit}
              onChange={(event) => setUnit(event.currentTarget.value as WeightUnit)}
            >
              <option value="KG">Kilograms (kg)</option>
              <option value="LB">Pounds (lb)</option>
            </select>
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={saving || !timeZone.trim()}>
            {saving ? 'Setting up…' : 'Continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

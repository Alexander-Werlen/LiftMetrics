import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { ApiError, errorMessage } from '../api/api-client';
import { AccountSessionContext, type Account, type WeightUnit } from './account-session';
import { AccountSetup } from './account-setup';
import { useApiClient } from './use-api';

type AccountStatus = 'idle' | 'checking' | 'setup' | 'ready' | 'error';

export function AuthGate({ children }: { children: ReactNode }) {
  const { error, isAuthenticated, isLoading, loginWithRedirect, logout } = useAuth0();
  const api = useApiClient();
  const [status, setStatus] = useState<AccountStatus>('idle');
  const [account, setAccount] = useState<Account | null>(null);
  const [accountError, setAccountError] = useState('');

  const loadAccount = useCallback(async () => {
    setStatus('checking');
    setAccountError('');
    try {
      const existing = await api<Account>('/api/account');
      setAccount(existing);
      setStatus('ready');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 404) {
        setAccount(null);
        setStatus('setup');
        return;
      }
      setAccountError(errorMessage(cause, 'Your account could not be loaded. Try again.'));
      setStatus('error');
    }
  }, [api]);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccount(null);
      setStatus('idle');
      setAccountError('');
      return;
    }
    void loadAccount();
  }, [isAuthenticated, loadAccount]);

  const updatePreferredWeightUnit = useCallback(async (unit: WeightUnit) => {
    const updated = await api<Account>('/api/account', {
      method: 'PATCH',
      body: { preferredWeightUnit: unit },
    });
    setAccount(updated);
  }, [api]);

  if (isLoading) return <AuthStatusScreen message="Checking your sign-in…" />;

  if (error && !isAuthenticated) {
    return (
      <AuthMessageScreen
        title="Sign-in couldn’t finish."
        message="Please try again. If the problem continues, check your connection and try once more."
        action="Try again"
        onAction={() => void loginWithRedirect({ appState: { returnTo: currentReturnTo() } })}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-panel card" aria-labelledby="sign-in-title">
          <div className="brand-mark auth-brand-mark" aria-hidden="true">L</div>
          <p className="section-kicker">LIFTMETRICS</p>
          <h1 id="sign-in-title">A clearer view of your progress.</h1>
          <p className="card-description">Sign in to record your weight, follow your training plan, and review your history.</p>
          <button
            className="primary-button auth-submit"
            type="button"
            onClick={() => void loginWithRedirect({ appState: { returnTo: currentReturnTo() } })}
          >
            Sign in
          </button>
        </section>
      </main>
    );
  }

  if (status === 'checking' || status === 'idle') {
    return <AuthStatusScreen message="Loading your account…" />;
  }

  if (status === 'setup') {
    return <AccountSetup onComplete={(created) => { setAccount(created); setStatus('ready'); }} />;
  }

  if (status === 'error') {
    return (
      <AuthMessageScreen
        title="Your account couldn’t be loaded."
        message={accountError}
        action="Try again"
        onAction={() => void loadAccount()}
        secondaryAction="Sign out"
        onSecondaryAction={() => void logout({ logoutParams: { returnTo: window.location.origin } })}
      />
    );
  }

  if (!account) return <AuthStatusScreen message="Loading your account…" />;

  return (
    <AccountSessionContext.Provider value={{ account, updatePreferredWeightUnit }}>
      {children}
    </AccountSessionContext.Provider>
  );
}

export function AuthStatusScreen({ message }: { message: string }) {
  return <main className="auth-page"><p className="auth-status" role="status">{message}</p></main>;
}

export function AuthMessageScreen({
  title,
  message,
  action,
  onAction,
  secondaryAction,
  onSecondaryAction,
}: {
  title: string;
  message: string;
  action: string;
  onAction: () => void;
  secondaryAction?: string;
  onSecondaryAction?: () => void;
}) {
  return (
    <main className="auth-page">
      <section className="auth-panel card">
        <p className="section-kicker">LIFTMETRICS</p>
        <h1>{title}</h1>
        <p className="card-description">{message}</p>
        <div className="auth-actions">
          <button className="primary-button" type="button" onClick={onAction}>{action}</button>
          {secondaryAction && onSecondaryAction && (
            <button className="secondary-button" type="button" onClick={onSecondaryAction}>{secondaryAction}</button>
          )}
        </div>
      </section>
    </main>
  );
}

function currentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

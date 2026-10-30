import { useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { apiRequest, type ApiRequestOptions } from '../api/api-client';

export function useApiClient() {
  const { getAccessTokenSilently } = useAuth0();

  return useCallback(async <T,>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
    const accessToken = await getAccessTokenSilently();
    if (!accessToken) throw new Error('Sign in again to continue.');
    return apiRequest<T>(path, accessToken, options);
  }, [getAccessTokenSilently]);
}

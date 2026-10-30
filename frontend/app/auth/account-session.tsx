import { createContext, useContext } from 'react';

export type WeightUnit = 'KG' | 'LB';

export interface Account {
  id: string;
  timeZone: string;
  preferredWeightUnit: WeightUnit;
}

export interface AccountSessionValue {
  account: Account;
  updatePreferredWeightUnit: (unit: WeightUnit) => Promise<void>;
}

export const AccountSessionContext = createContext<AccountSessionValue | null>(null);

export function useAccountSession(): AccountSessionValue {
  const value = useContext(AccountSessionContext);
  if (!value) throw new Error('Account session is available only inside the authenticated application.');
  return value;
}

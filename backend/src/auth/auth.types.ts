import { Request } from 'express';
import { WeightUnit } from '@prisma/client';

export interface AuthenticatedIdentity {
  issuer: string;
  subject: string;
  clientId: string;
}

export interface AccountContext {
  id: string;
  timeZone: string;
  preferredWeightUnit: WeightUnit;
}

export interface AuthenticatedRequest extends Request {
  authIdentity?: AuthenticatedIdentity;
  account?: AccountContext;
}

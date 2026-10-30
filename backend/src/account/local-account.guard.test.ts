import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { AccountService } from './account.service';
import { LocalAccountGuard } from './local-account.guard';

const localAccount = {
  id: '00000000-0000-4000-8000-000000000001',
  timeZone: 'America/Argentina/Buenos_Aires',
  preferredWeightUnit: 'KG' as const,
};
const identity = { issuer: 'https://liftmetrics.example.auth0.com/', subject: 'auth0|user-123', clientId: 'web-client' };

function context(request: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as never;
}

test('resolves verified issuer and subject to the local account context', async () => {
  let lookup: unknown;
  const service = {
    findByIdentity: async (issuer: string, subject: string) => { lookup = { issuer, subject }; return localAccount; },
  } as unknown as AccountService;
  const guard = new LocalAccountGuard(service);
  const request: Record<string, unknown> = { authIdentity: identity };

  assert.equal(await guard.canActivate(context(request)), true);
  assert.deepEqual(lookup, { issuer: identity.issuer, subject: identity.subject });
  assert.deepEqual(request.account, localAccount);
});

test('does not resolve an Auth0 identity without a local account', async () => {
  const service = { findByIdentity: async () => null } as unknown as AccountService;
  const guard = new LocalAccountGuard(service);
  const request: Record<string, unknown> = { authIdentity: identity };

  await assert.rejects(() => guard.canActivate(context(request)), /Account not found/);
  assert.equal(request.account, undefined);
});

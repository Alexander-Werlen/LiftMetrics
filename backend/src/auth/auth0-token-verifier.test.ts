import * as assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, JWK, SignJWT } from 'jose';
import { verifyAuth0AccessToken } from './auth0-token-verifier';

const issuer = 'https://liftmetrics.example.auth0.com/';
const audience = 'https://api.liftmetrics.example';
let privateKey: CryptoKey;
let keySet: ReturnType<typeof createLocalJWKSet>;

before(async () => {
  const pair = await generateKeyPair('RS256');
  privateKey = pair.privateKey;
  const publicJwk = await exportJWK(pair.publicKey);
  keySet = createLocalJWKSet({ keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' } as JWK] });
});

async function token(options: { iss?: string; aud?: string; exp?: number; client?: string } = {}): Promise<string> {
  return new SignJWT({ azp: options.client ?? 'web-client' })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(options.iss ?? issuer)
    .setAudience(options.aud ?? audience)
    .setSubject('auth0|user-123')
    .setIssuedAt()
    .setExpirationTime(options.exp ?? Math.floor(Date.now() / 1000) + 120)
    .sign(privateKey);
}

test('validates signature, issuer, audience, expiry, subject, and authorized client', async () => {
  const verified = await verifyAuth0AccessToken(await token(), keySet, issuer, audience, ['web-client']);
  assert.deepEqual(verified, { issuer, subject: 'auth0|user-123', clientId: 'web-client' });
});

test('rejects invalid signatures and malformed bearer token contents', async () => {
  await assert.rejects(() => verifyAuth0AccessToken('not-a-jwt', keySet, issuer, audience, ['web-client']));
  const otherPair = await generateKeyPair('RS256');
  const forged = await new SignJWT({ azp: 'web-client' }).setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer).setAudience(audience).setSubject('attacker').setExpirationTime('2m').sign(otherPair.privateKey);
  await assert.rejects(() => verifyAuth0AccessToken(forged, keySet, issuer, audience, ['web-client']));
});

test('rejects expired, wrong-issuer, wrong-audience, and unauthorized-client tokens', async () => {
  await assert.rejects(() => token({ exp: Math.floor(Date.now() / 1000) - 10 }).then((jwt) =>
    verifyAuth0AccessToken(jwt, keySet, issuer, audience, ['web-client'])));
  await assert.rejects(() => token({ iss: 'https://another-tenant.example/' }).then((jwt) =>
    verifyAuth0AccessToken(jwt, keySet, issuer, audience, ['web-client'])));
  await assert.rejects(() => token({ aud: 'https://another-api.example' }).then((jwt) =>
    verifyAuth0AccessToken(jwt, keySet, issuer, audience, ['web-client'])));
  await assert.rejects(() => token({ client: 'unapproved-client' }).then((jwt) =>
    verifyAuth0AccessToken(jwt, keySet, issuer, audience, ['web-client'])));
});

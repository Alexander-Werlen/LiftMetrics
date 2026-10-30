import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, JWTVerifyGetKey, jwtVerify } from 'jose';
import { AuthenticatedIdentity } from './auth.types';

@Injectable()
export class Auth0TokenVerifier {
  private keySet?: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: ConfigService) {}

  async verify(token: string): Promise<AuthenticatedIdentity> {
    const issuer = this.config.get<string>('AUTH0_ISSUER');
    const audience = this.config.get<string>('AUTH0_API_AUDIENCE');
    const clientIds = this.config.get<string>('AUTH0_CLIENT_IDS')
      ?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    if (!issuer || !audience || clientIds.length === 0) {
      throw new ServiceUnavailableException('Authentication is not configured for this environment');
    }

    const normalizedIssuer = issuer.endsWith('/') ? issuer : `${issuer}/`;
    this.keySet ??= createRemoteJWKSet(new URL(`${normalizedIssuer}.well-known/jwks.json`));
    try {
      return await verifyAuth0AccessToken(token, this.keySet, normalizedIssuer, audience, clientIds);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = this.errorCode(error);
      if (!code) {
        throw new ServiceUnavailableException('The identity provider signing keys are unavailable');
      }
      const isCredentialFailure = code.startsWith('ERR_JWT_') || code.startsWith('ERR_JWS_')
        || code === 'ERR_JOSE_ALG_NOT_ALLOWED' || code === 'ERR_JWKS_NO_MATCHING_KEY';
      if (!isCredentialFailure) {
        throw new ServiceUnavailableException('The identity provider signing keys are unavailable');
      }
      throw error;
    }
  }

  private errorCode(error: unknown): string {
    return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  }
}

export async function verifyAuth0AccessToken(
  token: string,
  keySet: JWTVerifyGetKey,
  issuer: string,
  audience: string,
  allowedClientIds: string[],
): Promise<AuthenticatedIdentity> {
  const { payload } = await jwtVerify(token, keySet, {
    issuer,
    audience,
    algorithms: ['RS256'],
    clockTolerance: 5,
    requiredClaims: ['iss', 'sub', 'aud', 'exp'],
  });
  const subject = payload.sub;
  const clientId = typeof payload.azp === 'string'
    ? payload.azp
    : (typeof payload.client_id === 'string' ? payload.client_id : undefined);
  if (!subject || !clientId || !allowedClientIds.includes(clientId)) {
    const error = new Error('Token is missing a valid subject or authorized client') as Error & { code: string };
    error.code = 'ERR_JWT_INVALID';
    throw error;
  }
  return { issuer, subject, clientId };
}

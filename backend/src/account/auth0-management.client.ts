import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export class Auth0ManagementError extends Error {
  constructor(readonly code: string) { super(code); }
}

@Injectable()
export class Auth0ManagementClient {
  private cachedToken?: string;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get('AUTH0_ISSUER') && this.config.get('AUTH0_MGMT_CLIENT_ID')
      && this.config.get('AUTH0_MGMT_CLIENT_SECRET') && this.config.get('AUTH0_MGMT_AUDIENCE'));
  }

  async deleteUser(subject: string): Promise<void> {
    const token = await this.getManagementToken();
    const issuer = this.required('AUTH0_ISSUER').replace(/\/$/, '');
    let response: Response;
    try {
      response = await fetch(`${issuer}/api/v2/users/${encodeURIComponent(subject)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Auth0ManagementError('management_delete_network_error');
    }
    if (response.status === 204 || response.status === 404) return;
    throw new Auth0ManagementError(`management_delete_http_${response.status}`);
  }

  private async getManagementToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) return this.cachedToken;
    const issuer = this.required('AUTH0_ISSUER').replace(/\/$/, '');
    let response: Response;
    try {
      response = await fetch(`${issuer}/oauth/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'client_credentials',
          client_id: this.required('AUTH0_MGMT_CLIENT_ID'),
          client_secret: this.required('AUTH0_MGMT_CLIENT_SECRET'),
          audience: this.required('AUTH0_MGMT_AUDIENCE'),
          scope: 'delete:users',
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Auth0ManagementError('management_token_network_error');
    }
    if (!response.ok) throw new Auth0ManagementError(`management_token_http_${response.status}`);
    const result = await response.json() as { access_token?: unknown; expires_in?: unknown };
    if (typeof result.access_token !== 'string' || typeof result.expires_in !== 'number') {
      throw new Auth0ManagementError('management_token_invalid_response');
    }
    this.cachedToken = result.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, result.expires_in - 60) * 1000;
    return this.cachedToken;
  }

  private required(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) throw new Auth0ManagementError('management_configuration_missing');
    return value;
  }
}

import { CanActivate, ExecutionContext, HttpException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Auth0TokenVerifier } from './auth0-token-verifier';
import { AuthenticatedRequest } from './auth.types';

@Injectable()
export class Auth0AccessTokenGuard implements CanActivate {
  constructor(private readonly verifier: Auth0TokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) throw new UnauthorizedException('A valid bearer access token is required');
    try {
      request.authIdentity = await this.verifier.verify(match[1]);
      return true;
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() >= 500) throw error;
      throw new UnauthorizedException('The access token is invalid or expired');
    }
  }
}

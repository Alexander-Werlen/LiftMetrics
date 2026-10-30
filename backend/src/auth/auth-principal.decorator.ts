import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedIdentity, AuthenticatedRequest } from './auth.types';

export const AuthPrincipal = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const principal = context.switchToHttp().getRequest<AuthenticatedRequest>().authIdentity;
    if (!principal) throw new Error('AuthPrincipal requires Auth0AccessTokenGuard');
    return principal;
  },
);

export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const account = context.switchToHttp().getRequest<AuthenticatedRequest>().account;
    if (!account) throw new Error('CurrentAccount requires LocalAccountGuard');
    return account;
  },
);

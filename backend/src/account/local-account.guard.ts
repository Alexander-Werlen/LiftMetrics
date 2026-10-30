import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { AccountService } from './account.service';
import { AuthenticatedRequest } from '../auth/auth.types';

@Injectable()
export class LocalAccountGuard implements CanActivate {
  constructor(private readonly accounts: AccountService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const identity = request.authIdentity;
    if (!identity) throw new NotFoundException('Account not found');
    const account = await this.accounts.findByIdentity(identity.issuer, identity.subject);
    if (!account) throw new NotFoundException('Account not found');
    request.account = { id: account.id, timeZone: account.timeZone, preferredWeightUnit: account.preferredWeightUnit };
    return true;
  }
}

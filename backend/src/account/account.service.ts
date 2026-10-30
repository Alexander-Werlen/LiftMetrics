import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, WeightUnit } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedIdentity, AccountContext } from '../auth/auth.types';
import { Auth0ManagementClient } from './auth0-management.client';
import { ProvisionAccountDto, UpdateAccountDto } from './account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService, private readonly management: Auth0ManagementClient) {}

  async provision(identity: AuthenticatedIdentity, input: ProvisionAccountDto): Promise<{ account: AccountContext; created: boolean }> {
    const existing = await this.findByIdentity(identity.issuer, identity.subject);
    if (existing) return { account: this.toContext(existing), created: false };

    try {
      const user = await this.prisma.user.create({
        data: {
          timeZone: input.timeZone,
          preferredWeightUnit: input.preferredWeightUnit,
          authIdentity: { create: { issuer: identity.issuer, subject: identity.subject } },
        },
      });
      return { account: this.toContext(user), created: true };
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const racedAccount = await this.findByIdentity(identity.issuer, identity.subject);
      if (!racedAccount) throw error;
      return { account: this.toContext(racedAccount), created: false };
    }
  }

  findByIdentity(issuer: string, subject: string) {
    return this.prisma.user.findFirst({
      where: { authIdentity: { is: { issuer, subject } } },
      select: { id: true, timeZone: true, preferredWeightUnit: true },
    });
  }

  async update(account: AccountContext, input: UpdateAccountDto): Promise<AccountContext> {
    if (input.timeZone !== undefined && input.timeZone !== account.timeZone) {
      throw new BadRequestException('The account time zone cannot be changed after provisioning');
    }
    if (input.preferredWeightUnit === undefined) return account;
    const updated = await this.prisma.user.update({
      where: { id: account.id },
      data: { preferredWeightUnit: input.preferredWeightUnit },
      select: { id: true, timeZone: true, preferredWeightUnit: true },
    });
    return this.toContext(updated);
  }

  async scheduleDeletion(accountId: string): Promise<void> {
    if (!this.management.isConfigured()) {
      throw new ServiceUnavailableException('Account deletion is not configured for this environment');
    }
    await this.prisma.$transaction(async (transaction) => {
      const identity = await transaction.authIdentity.findUnique({ where: { userId: accountId }, select: { subject: true } });
      if (!identity) throw new NotFoundException('Account not found');
      await transaction.accountDeletionTask.create({ data: { subject: identity.subject } });
      // Clear references that deliberately RESTRICT deletion during normal use.
      // Account deletion is the explicit operation that removes the full history.
      await transaction.weeklyPlanAssignment.deleteMany({ where: { userId: accountId } });
      await transaction.workoutSession.deleteMany({ where: { userId: accountId } });
      await transaction.blueprintExercise.deleteMany({ where: { userId: accountId } });
      await transaction.sessionBlueprint.deleteMany({ where: { userId: accountId } });
      await transaction.user.delete({ where: { id: accountId } });
    });
  }

  private toContext(user: { id: string; timeZone: string; preferredWeightUnit: WeightUnit }): AccountContext {
    return { id: user.id, timeZone: user.timeZone, preferredWeightUnit: user.preferredWeightUnit };
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { Auth0ManagementClient, Auth0ManagementError } from './auth0-management.client';

interface DeletionTaskClaim { id: string; subject: string; attempts: number }

@Injectable()
export class AccountDeletionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AccountDeletionWorker.name);
  private timer?: NodeJS.Timeout;
  private working = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly management: Auth0ManagementClient,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.management.isConfigured()) return;
    const intervalMs = this.config.get<number>('ACCOUNT_DELETION_POLL_MS', 5000);
    this.timer = setInterval(() => { void this.processOne(); }, intervalMs);
    this.timer.unref();
    void this.processOne();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async processOne(): Promise<void> {
    if (this.working || !this.management.isConfigured()) return;
    this.working = true;
    try {
      const [task] = await this.prisma.$queryRaw<DeletionTaskClaim[]>`
        UPDATE "AccountDeletionTask"
        SET "lockedUntil" = NOW() + INTERVAL '1 minute'
        WHERE "id" = (
          SELECT "id" FROM "AccountDeletionTask"
          WHERE "nextAttemptAt" <= NOW()
            AND ("lockedUntil" IS NULL OR "lockedUntil" < NOW())
          ORDER BY "createdAt"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING "id", "subject", "attempts"
      `;
      if (!task) return;
      try {
        await this.management.deleteUser(task.subject);
        await this.prisma.accountDeletionTask.deleteMany({ where: { id: task.id } });
        this.logger.log(JSON.stringify({ event: 'account_identity_deleted', taskId: task.id }));
      } catch (error) {
        const errorCode = error instanceof Auth0ManagementError ? error.code : 'management_request_failed';
        const attempts = task.attempts + 1;
        const delayMs = Math.min(30_000 * (2 ** Math.min(attempts - 1, 10)), 86_400_000);
        await this.prisma.accountDeletionTask.updateMany({
          where: { id: task.id },
          data: {
            attempts,
            lastErrorCode: errorCode,
            nextAttemptAt: new Date(Date.now() + delayMs),
            lockedUntil: null,
          },
        });
        this.logger.warn(JSON.stringify({ event: 'account_identity_delete_retry', taskId: task.id,
          attempt: attempts, errorCode, retryAfterMs: delayMs }));
      }
    } catch {
      this.logger.warn(JSON.stringify({ event: 'account_deletion_queue_unavailable' }));
    } finally {
      this.working = false;
    }
  }
}

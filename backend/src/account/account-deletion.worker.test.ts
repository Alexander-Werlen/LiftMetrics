import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaService } from '../prisma/prisma.service';
import { AccountDeletionWorker } from './account-deletion.worker';
import { Auth0ManagementClient, Auth0ManagementError } from './auth0-management.client';

test('records failed remote deletion and schedules a retry without retaining user data', async () => {
  const now = Date.now();
  let updateData: Record<string, unknown> | undefined;
  const prisma = {
    $queryRaw: async () => [{ id: 'task-1', subject: 'auth0|user-123', attempts: 0 }],
    accountDeletionTask: { updateMany: async ({ data }: { data: Record<string, unknown> }) => { updateData = data; } },
  } as unknown as PrismaService;
  const management = {
    isConfigured: () => true,
    deleteUser: async () => { throw new Auth0ManagementError('management_delete_http_429'); },
  } as unknown as Auth0ManagementClient;
  const worker = new AccountDeletionWorker(prisma, management, { get: () => 5000 } as never);

  await worker.processOne();

  assert.equal(updateData?.attempts, 1);
  assert.equal(updateData?.lastErrorCode, 'management_delete_http_429');
  assert.equal(updateData?.lockedUntil, null);
  assert.ok((updateData?.nextAttemptAt as Date).getTime() >= now + 29_000);
  assert.ok((updateData?.nextAttemptAt as Date).getTime() <= now + 31_000);
  assert.deepEqual(Object.keys(updateData ?? {}).sort(), ['attempts', 'lastErrorCode', 'lockedUntil', 'nextAttemptAt'].sort());
});

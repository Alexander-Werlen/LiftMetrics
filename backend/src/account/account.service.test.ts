import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, WeightUnit } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AccountService } from './account.service';
import { Auth0ManagementClient } from './auth0-management.client';

const identity = { issuer: 'https://liftmetrics.example.auth0.com/', subject: 'auth0|user-123', clientId: 'web-client' };
const account: AccountContext = { id: '00000000-0000-4000-8000-000000000001', timeZone: 'America/Argentina/Buenos_Aires', preferredWeightUnit: WeightUnit.KG };

test('provisions account and external identity in one nested Prisma write', async () => {
  let createInput: unknown;
  const prisma = {
    user: {
      findFirst: async () => null,
      create: async (input: unknown) => { createInput = input; return account; },
    },
  } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => true } as Auth0ManagementClient);

  const result = await service.provision(identity, { timeZone: account.timeZone, preferredWeightUnit: WeightUnit.KG });

  assert.equal(result.created, true);
  assert.deepEqual((createInput as { data: unknown }).data, {
    timeZone: account.timeZone,
    preferredWeightUnit: WeightUnit.KG,
    authIdentity: { create: { issuer: identity.issuer, subject: identity.subject } },
  });
});

test('a repeated provision request returns the existing local account', async () => {
  let createCalled = false;
  const prisma = { user: { findFirst: async () => account, create: async () => { createCalled = true; return account; } } } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => true } as Auth0ManagementClient);

  const result = await service.provision(identity, { timeZone: 'Pacific/Auckland', preferredWeightUnit: WeightUnit.LB });

  assert.equal(result.created, false);
  assert.deepEqual(result.account, account);
  assert.equal(createCalled, false);
});

test('a concurrent duplicate identity conflict resolves to the winning account', async () => {
  const conflict = new Prisma.PrismaClientKnownRequestError('unique conflict', { code: 'P2002', clientVersion: 'test' });
  let lookupCount = 0;
  const prisma = {
    user: {
      findFirst: async () => ++lookupCount === 1 ? null : account,
      create: async () => { throw conflict; },
    },
  } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => true } as Auth0ManagementClient);

  const result = await service.provision(identity, { timeZone: account.timeZone, preferredWeightUnit: WeightUnit.KG });

  assert.equal(result.created, false);
  assert.deepEqual(result.account, account);
});

test('rejects a changed account time zone and permits an unchanged one', async () => {
  let updateCalled = false;
  const prisma = { user: { update: async () => { updateCalled = true; return account; } } } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => true } as Auth0ManagementClient);

  await assert.rejects(() => service.update(account, { timeZone: 'Europe/Paris' }), /cannot be changed/);
  await service.update(account, { timeZone: account.timeZone });
  assert.equal(updateCalled, false);
});

test('account deletion writes a minimal Auth0 outbox task and removes local user in one transaction', async () => {
  const calls: string[] = [];
  let taskData: unknown;
  const transaction = {
    authIdentity: { findUnique: async () => { calls.push('find-identity'); return { subject: identity.subject }; } },
    accountDeletionTask: { create: async ({ data }: { data: unknown }) => { calls.push('create-task'); taskData = data; } },
    weeklyPlanAssignment: { deleteMany: async () => { calls.push('delete-assignments'); } },
    workoutSession: { deleteMany: async () => { calls.push('delete-workouts'); } },
    blueprintExercise: { deleteMany: async () => { calls.push('delete-blueprint-exercises'); } },
    sessionBlueprint: { deleteMany: async () => { calls.push('delete-blueprints'); } },
    user: { delete: async () => { calls.push('delete-user'); } },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<void>) => operation(transaction) } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => true } as Auth0ManagementClient);

  await service.scheduleDeletion(account.id);

  assert.deepEqual(calls, ['find-identity', 'create-task', 'delete-assignments', 'delete-workouts', 'delete-blueprint-exercises', 'delete-blueprints', 'delete-user']);
  assert.deepEqual(taskData, { subject: identity.subject });
});

test('does not delete local account data when Auth0 Management API configuration is absent', async () => {
  let transactionCalled = false;
  const prisma = { $transaction: async () => { transactionCalled = true; } } as unknown as PrismaService;
  const service = new AccountService(prisma, { isConfigured: () => false } as Auth0ManagementClient);

  await assert.rejects(() => service.scheduleDeletion(account.id), /not configured/);
  assert.equal(transactionCalled, false);
});

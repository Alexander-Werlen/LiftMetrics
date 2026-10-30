import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { WeightUnit } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWeeklyPlanDto } from './weekly-plan.dto';
import { resolveLocalScheduleDay, WeeklyPlanService } from './weekly-plan.service';

const account: AccountContext = {
  id: '00000000-0000-4000-8000-000000000001',
  timeZone: 'UTC',
  preferredWeightUnit: WeightUnit.KG,
};
const planId = '30000000-0000-4000-8000-000000000003';
const blueprintA = '40000000-0000-4000-8000-000000000004';
const blueprintB = '50000000-0000-4000-8000-000000000005';
const assignments: CreateWeeklyPlanDto['assignments'] = [
  { weekday: 1, blueprintId: blueprintA },
  { weekday: 3, blueprintId: blueprintA },
  { weekday: 1, blueprintId: blueprintB },
];

test('creates an owner-scoped plan and assigns contiguous order per ISO weekday', async () => {
  const calls: Array<{ method: string; input?: any }> = [];
  const result = { id: planId, userId: account.id, name: 'Week A', assignments: [] };
  const transaction = {
    sessionBlueprint: { findMany: async (input: unknown) => { calls.push({ method: 'blueprints', input }); return [{ id: blueprintA }, { id: blueprintB }]; } },
    weeklyPlan: {
      create: async (input: unknown) => { calls.push({ method: 'create', input }); return { id: planId }; },
      findFirst: async (input: unknown) => { calls.push({ method: 'read', input }); return result; },
    },
    weeklyPlanAssignment: { createMany: async (input: unknown) => { calls.push({ method: 'assignments', input }); return { count: 3 }; } },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new WeeklyPlanService(prisma);

  assert.equal(await service.create(account, { name: ' Week A ', assignments }), result);
  assert.deepEqual(calls.map(({ method }) => method), ['blueprints', 'create', 'assignments', 'read']);
  assert.deepEqual(calls[1].input, { data: { userId: account.id, name: 'Week A' }, select: { id: true } });
  assert.deepEqual((calls[2].input as { data: unknown[] }).data, [
    { userId: account.id, weeklyPlanId: planId, blueprintId: blueprintA, weekday: 1, position: 0 },
    { userId: account.id, weeklyPlanId: planId, blueprintId: blueprintA, weekday: 3, position: 0 },
    { userId: account.id, weeklyPlanId: planId, blueprintId: blueprintB, weekday: 1, position: 1 },
  ]);
});

test('rejects invalid weekdays and foreign or archived blueprints', async () => {
  let catalogRows = [{ id: blueprintA }];
  const transaction = {
    sessionBlueprint: { findMany: async (args: { where: { id: { in: string[] } } }) => catalogRows.filter(({ id }) => args.where.id.in.includes(id)) },
    weeklyPlan: { create: async () => ({ id: planId }), findFirst: async () => null },
    weeklyPlanAssignment: { createMany: async () => ({ count: 0 }) },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new WeeklyPlanService(prisma);

  await assert.rejects(() => service.create(account, { name: 'Week', assignments: [{ weekday: 0, blueprintId: blueprintA }] }), /ISO numbering/);
  catalogRows = [];
  await assert.rejects(() => service.create(account, { name: 'Week', assignments: [{ weekday: 1, blueprintId: blueprintB }] }), /belong to this user/);
});

test('foreign plan IDs are not disclosed and do not cause updates', async () => {
  let updateCalled = false;
  const transaction = {
    weeklyPlan: {
      findFirst: async (input: unknown) => { assert.deepEqual(input, { where: { id: planId, userId: account.id }, select: { id: true } }); return null; },
      update: async () => { updateCalled = true; },
    },
    sessionBlueprint: { findMany: async () => [] },
    weeklyPlanAssignment: { deleteMany: async () => undefined, createMany: async () => undefined },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new WeeklyPlanService(prisma);

  await assert.rejects(() => service.update(account, planId, { name: 'Changed', assignments: [] }), /not found/);
  assert.equal(updateCalled, false);
});

test('activation deactivates the user’s current plan before activating the selected plan', async () => {
  const calls: Array<{ method: string; input?: any }> = [];
  const result = { id: planId, isActive: true, assignments: [] };
  const transaction = {
    weeklyPlan: {
      findFirst: async (input: unknown) => { calls.push({ method: 'read', input }); return calls.length === 1 ? { id: planId } : result; },
      updateMany: async (input: unknown) => { calls.push({ method: 'deactivate-current', input }); return { count: 1 }; },
      update: async (input: unknown) => { calls.push({ method: 'activate-selected', input }); return { id: planId }; },
    },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new WeeklyPlanService(prisma);

  assert.equal(await service.activate(account, planId), result);
  assert.deepEqual(calls.map(({ method }) => method), ['read', 'deactivate-current', 'activate-selected', 'read']);
  assert.deepEqual(calls[1].input, { where: { userId: account.id, isActive: true }, data: { isActive: false } });
  assert.deepEqual(calls[2].input, { where: { userId_id: { userId: account.id, id: planId } }, data: { isActive: true }, select: { id: true } });
});

test('maps UTC instants to the user’s local date and ISO weekday across timezone boundaries', () => {
  assert.deepEqual(resolveLocalScheduleDay(new Date('2026-10-30T01:00:00.000Z'), 'America/Los_Angeles'), { date: '2026-10-29', weekday: 4 });
  assert.deepEqual(resolveLocalScheduleDay(new Date('2026-11-02T01:00:00.000Z'), 'America/Los_Angeles'), { date: '2026-11-01', weekday: 7 });
});

test('returns no invented session when there is no active plan or no assignment today', async () => {
  const queries: unknown[] = [];
  let call = 0;
  const prisma = {
    weeklyPlan: { findFirst: async (input: unknown) => {
      queries.push(input);
      call += 1;
      return call === 1 ? null : { id: planId, name: 'Active plan', isActive: true, assignments: [] };
    } },
  } as unknown as PrismaService;
  const service = new WeeklyPlanService(prisma);

  const recommendation = await service.recommendation(account, new Date('2026-10-30T12:00:00.000Z'));

  assert.deepEqual(recommendation, { date: '2026-10-30', weeklyPlan: null, sessions: [] });
  assert.deepEqual(await service.recommendation(account, new Date('2026-10-30T12:00:00.000Z')), {
    date: '2026-10-30', weeklyPlan: { id: planId, name: 'Active plan', isActive: true }, sessions: [],
  });
  const query = queries[0] as { where: { userId: string; isActive: boolean }; include: { assignments: { where: { weekday: number }; orderBy: { position: string } } } };
  assert.deepEqual(query.where, { userId: account.id, isActive: true });
  assert.equal(query.include.assignments.where.weekday, 5);
  assert.deepEqual(query.include.assignments.orderBy, { position: 'asc' });
});

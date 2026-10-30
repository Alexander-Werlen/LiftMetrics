import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExerciseMeasurementType, WeightUnit } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlueprintDto, UpdateBlueprintDto } from './blueprint.dto';
import { BlueprintService } from './blueprint.service';

const account: AccountContext = {
  id: '00000000-0000-4000-8000-000000000001',
  timeZone: 'UTC',
  preferredWeightUnit: WeightUnit.KG,
};
const squatId = '10000000-0000-4000-8000-000000000001';
const plankId = '20000000-0000-4000-8000-000000000002';
const blueprintId = '30000000-0000-4000-8000-000000000003';
const catalog = [
  { id: squatId, measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
  { id: plankId, measurementType: ExerciseMeasurementType.TIME },
];
const prescriptions: CreateBlueprintDto['exercises'] = [
  { exerciseId: squatId, plannedSetCount: 3, targetRepMin: 8, targetRepMax: 12 },
  { exerciseId: plankId, plannedSetCount: 2 },
];

test('lists only the authenticated owner’s active blueprints by default and can include archived ones', async () => {
  const calls: unknown[] = [];
  const prisma = {
    sessionBlueprint: { findMany: async (args: unknown) => { calls.push(args); return []; } },
  } as unknown as PrismaService;
  const service = new BlueprintService(prisma);

  await service.list(account);
  await service.list(account, true);

  assert.deepEqual(calls, [
    { where: { userId: account.id, archivedAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } } } } },
    { where: { userId: account.id }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } } } } },
  ]);
});

test('creates the blueprint and its ordered exercise rows in one transaction', async () => {
  const calls: Array<{ method: string; input?: any }> = [];
  const result = { id: blueprintId, userId: account.id, name: 'Strength A', notes: null, exercises: [] };
  const transaction = {
    exercise: { findMany: async (input: unknown) => { calls.push({ method: 'catalog', input }); return catalog; } },
    sessionBlueprint: {
      create: async (input: unknown) => { calls.push({ method: 'blueprint-create', input }); return { id: blueprintId }; },
      findFirst: async (input: unknown) => { calls.push({ method: 'blueprint-read', input }); return result; },
    },
    blueprintExercise: { createMany: async (input: unknown) => { calls.push({ method: 'children-create', input }); return { count: 2 }; } },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new BlueprintService(prisma);

  assert.equal(await service.create(account, { name: ' Strength A ', exercises: prescriptions }), result);
  assert.deepEqual(calls.map((call) => call.method), ['catalog', 'blueprint-create', 'children-create', 'blueprint-read']);
  assert.deepEqual(calls[2].input, { data: [
    { userId: account.id, blueprintId, exerciseId: squatId, position: 0, plannedSetCount: 3, targetRepMin: 8, targetRepMax: 12 },
    { userId: account.id, blueprintId, exerciseId: plankId, position: 1, plannedSetCount: 2, targetRepMin: null, targetRepMax: null },
  ] });
});

test('rejects duplicate exercises, invalid prescriptions, archived selections, and timed rep targets', async () => {
  let catalogCalls = 0;
  let catalogRows = catalog;
  const transaction = {
    exercise: { findMany: async (args: { where: { id: { in: string[] } } }) => { catalogCalls += 1; return catalogRows.filter((row) => args.where.id.in.includes(row.id)); } },
    sessionBlueprint: { create: async () => ({ id: blueprintId }), findFirst: async () => null },
    blueprintExercise: { createMany: async () => ({ count: 0 }) },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new BlueprintService(prisma);

  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [prescriptions[0], prescriptions[0]] }), /only once/);
  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [{ exerciseId: squatId, plannedSetCount: 0 }] }), /positive integer/);
  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [{ exerciseId: squatId, plannedSetCount: 3, targetRepMin: 10 }] }), /Both repetition-range bounds/);
  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [{ exerciseId: squatId, plannedSetCount: 3, targetRepMin: 12, targetRepMax: 8 }] }), /at least the minimum/);
  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [{ exerciseId: plankId, plannedSetCount: 2, targetRepMin: 10, targetRepMax: 12 }] }), /only for repetitions-and-weight/);
  catalogRows = [];
  await assert.rejects(() => service.create(account, { name: 'Routine', exercises: [prescriptions[0]] }), /exist and be active/);
  assert.equal(catalogCalls, 2);
});

test('foreign blueprint IDs are returned as not found and are not updated', async () => {
  let updateCalled = false;
  const transaction = {
    sessionBlueprint: {
      findFirst: async (args: unknown) => { assert.deepEqual(args, { where: { id: blueprintId, userId: account.id, archivedAt: null }, select: { id: true } }); return null; },
      update: async () => { updateCalled = true; },
    },
    exercise: { findMany: async () => catalog },
    blueprintExercise: { deleteMany: async () => undefined, createMany: async () => undefined },
  };
  const prisma = { $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction) } as unknown as PrismaService;
  const service = new BlueprintService(prisma);

  await assert.rejects(() => service.update(account, blueprintId, { name: 'Changed', exercises: [] } as UpdateBlueprintDto), /not found/);
  assert.equal(updateCalled, false);
});

test('replaces exercise order atomically and scopes each update to the owner', async () => {
  const calls: Array<{ method: string; input?: any }> = [];
  const result = { id: blueprintId, userId: account.id, name: 'Reordered', exercises: [] };
  const transaction = {
    sessionBlueprint: {
      findFirst: async (input: unknown) => { calls.push({ method: 'read-existing', input }); return { id: blueprintId }; },
      update: async (input: unknown) => { calls.push({ method: 'update-blueprint', input }); return { id: blueprintId }; },
    },
    exercise: { findMany: async () => catalog },
    blueprintExercise: {
      deleteMany: async (input: unknown) => { calls.push({ method: 'delete-old', input }); return { count: 2 }; },
      createMany: async (input: unknown) => { calls.push({ method: 'create-new', input }); return { count: 2 }; },
    },
  };
  const prisma = {
    $transaction: async (operation: (tx: typeof transaction) => Promise<unknown>) => operation(transaction),
  } as unknown as PrismaService;
  (transaction.sessionBlueprint as unknown as { findFirst: (input: unknown) => Promise<unknown> }).findFirst = async (input: unknown) => {
    calls.push({ method: calls.length === 0 ? 'read-existing' : 'read-updated', input });
    return calls.length === 1 ? { id: blueprintId } : result;
  };
  const service = new BlueprintService(prisma);

  assert.equal(await service.update(account, blueprintId, { name: 'Reordered', exercises: [...prescriptions].reverse() }), result);
  assert.deepEqual(calls.map((call) => call.method), ['read-existing', 'update-blueprint', 'delete-old', 'create-new', 'read-updated']);
  assert.deepEqual(calls[1].input, { where: { userId_id: { userId: account.id, id: blueprintId } }, data: { name: 'Reordered', notes: null }, select: { id: true } });
  assert.deepEqual(calls[2].input, { where: { userId: account.id, blueprintId } });
  assert.deepEqual((calls[3].input as { data: Array<{ exerciseId: string; position: number }> }).data.map(({ exerciseId, position }) => [exerciseId, position]), [
    [plankId, 0], [squatId, 1],
  ]);
});

test('archives blueprints idempotently and continues to return their exercise history', async () => {
  const archivedAt = new Date('2026-10-30T12:00:00.000Z');
  const calls: unknown[] = [];
  const prisma = {
    sessionBlueprint: {
      findFirst: async (args: unknown) => {
        calls.push(args);
        return calls.length === 1
          ? { id: blueprintId, archivedAt: null }
          : { id: blueprintId, userId: account.id, archivedAt, exercises: [{ exerciseId: squatId }] };
      },
      updateMany: async (args: unknown) => { calls.push(args); return { count: 1 }; },
    },
  } as unknown as PrismaService;
  const service = new BlueprintService(prisma);

  const result = await service.archive(account, blueprintId);

  assert.equal(result.archivedAt, archivedAt);
  const archiveCall = calls[1] as { where: unknown; data: { archivedAt: Date } };
  assert.deepEqual(archiveCall.where, { id: blueprintId, userId: account.id, archivedAt: null });
  assert.ok(archiveCall.data.archivedAt instanceof Date);
  assert.deepEqual(calls[2], { where: { id: blueprintId, userId: account.id }, include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } } } } });
});

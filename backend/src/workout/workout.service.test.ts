import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExerciseMeasurementType, Prisma, WeightUnit, WorkoutStatus } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StartAdHocWorkoutDto, UpdateWorkoutDto } from './workout.dto';
import { WorkoutService } from './workout.service';
import { resolveLocalScheduleDay } from '../common/local-calendar';

const account: AccountContext = {
  id: '00000000-0000-4000-8000-000000000001',
  timeZone: 'UTC',
  preferredWeightUnit: WeightUnit.LB,
};
const workoutId = '30000000-0000-4000-8000-000000000003';
const blueprintId = '40000000-0000-4000-8000-000000000004';
const assignmentId = '50000000-0000-4000-8000-000000000005';
const repsExerciseId = '60000000-0000-4000-8000-000000000006';
const timeExerciseId = '70000000-0000-4000-8000-000000000007';

function workoutRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: workoutId,
    userId: account.id,
    sourceBlueprintId: null,
    sourceNameSnapshot: null,
    workoutDate: new Date('2026-10-30T00:00:00.000Z'),
    status: WorkoutStatus.IN_PROGRESS,
    startedAt: new Date('2026-10-30T10:00:00.000Z'),
    completedAt: null,
    createdAt: new Date('2026-10-30T10:00:00.000Z'),
    updatedAt: new Date('2026-10-30T10:00:00.000Z'),
    exercises: [],
    ...overrides,
  };
}

test('starts an ad hoc workout without a blueprint using the owner and local date', async () => {
  let args: unknown;
  const prisma = {
    workoutSession: { create: async (input: unknown) => {
      args = input;
      return workoutRecord({ workoutDate: (input as { data: { workoutDate: Date } }).data.workoutDate });
    } },
  } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  const response = await service.startAdHoc(account, { name: '  Quick session  ', workoutDate: '2026-10-29' });

  assert.deepEqual(args, {
    data: { userId: account.id, sourceBlueprintId: null, sourceNameSnapshot: 'Quick session', workoutDate: new Date('2026-10-29T00:00:00.000Z') },
    include: { exercises: { orderBy: { position: 'asc' }, include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } }, sets: { orderBy: { position: 'asc' } } } } },
  });
  assert.equal(response.sourceBlueprintId, null);
  assert.equal(response.workoutDate, '2026-10-29');
});

test('starts today’s active recommendation with blueprint name, exercise order, measurement and prescription snapshots', async () => {
  let createInput: any;
  const today = resolveLocalScheduleDay(new Date(), account.timeZone);
  const blueprint = {
    id: blueprintId,
    name: 'Strength A',
    exercises: [{
      exerciseId: repsExerciseId,
      plannedSetCount: 3,
      targetRepMin: 8,
      targetRepMax: 12,
      exercise: { id: repsExerciseId, name: 'Squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
    }],
  };
  const transaction = {
    weeklyPlanAssignment: { findFirst: async (input: unknown) => {
      assert.deepEqual((input as { where: unknown }).where, {
        id: assignmentId,
        userId: account.id,
        weekday: today.weekday,
        weeklyPlan: { is: { userId: account.id, isActive: true } },
      });
      return { blueprint };
    } },
    workoutSession: { create: async (input: unknown) => { createInput = input; return workoutRecord({ sourceBlueprintId: blueprintId, sourceNameSnapshot: 'Strength A' }); } },
  };
  const prisma = { $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  const response = await service.startRecommendation(account, assignmentId);

  const create = createInput as { data: { sourceBlueprintId: string; sourceNameSnapshot: string; exercises: { create: Array<Record<string, unknown>> } } };
  assert.equal(create.data.sourceBlueprintId, blueprintId);
  assert.equal(create.data.sourceNameSnapshot, 'Strength A');
  assert.deepEqual(create.data.exercises.create, [{
    exerciseId: repsExerciseId,
    exerciseNameSnapshot: 'Squat',
    measurementTypeSnapshot: ExerciseMeasurementType.REPS_AND_WEIGHT,
    position: 0,
    plannedSetCountSnapshot: 3,
    targetRepMinSnapshot: 8,
    targetRepMaxSnapshot: 12,
  }]);
  assert.equal(response.sourceBlueprintId, blueprintId);
});

test('replaces exercises and sets atomically in submitted order; accepts zero load and time sets', async () => {
  const calls: Array<{ method: string; input?: any }> = [];
  const result = workoutRecord({ workoutDate: new Date('2026-10-29T00:00:00.000Z'), exercises: [
    { id: 'ex-row-1', exerciseId: repsExerciseId, exerciseNameSnapshot: 'Squat', measurementTypeSnapshot: ExerciseMeasurementType.REPS_AND_WEIGHT, position: 0, plannedSetCountSnapshot: null, targetRepMinSnapshot: null, targetRepMaxSnapshot: null, exercise: { id: repsExerciseId, name: 'Squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT, archivedAt: null }, sets: [{ id: 'set-1', position: 0, repetitions: 2, weightKg: new Prisma.Decimal('0.000'), durationSeconds: null }] },
    { id: 'ex-row-2', exerciseId: timeExerciseId, exerciseNameSnapshot: 'Plank', measurementTypeSnapshot: ExerciseMeasurementType.TIME, position: 1, plannedSetCountSnapshot: null, targetRepMinSnapshot: null, targetRepMaxSnapshot: null, exercise: { id: timeExerciseId, name: 'Plank', measurementType: ExerciseMeasurementType.TIME, archivedAt: null }, sets: [{ id: 'set-2', position: 0, repetitions: null, weightKg: null, durationSeconds: 30 }] },
  ] });
  let readCount = 0;
  const transaction = {
    workoutSession: {
      findFirst: async () => { readCount += 1; return readCount === 1 ? { id: workoutId, exercises: [] } : result; },
      update: async (input: unknown) => { calls.push({ method: 'touch-parent', input }); },
    },
    exercise: { findMany: async () => [
      { id: repsExerciseId, name: 'Squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT, archivedAt: null },
      { id: timeExerciseId, name: 'Plank', measurementType: ExerciseMeasurementType.TIME, archivedAt: null },
    ] },
    workoutExercise: {
      deleteMany: async (input: unknown) => { calls.push({ method: 'delete-exercises', input }); },
      createMany: async (input: unknown) => { calls.push({ method: 'create-exercises', input }); },
      findMany: async () => [{ id: 'ex-row-1', exerciseId: repsExerciseId, measurementTypeSnapshot: ExerciseMeasurementType.REPS_AND_WEIGHT }, { id: 'ex-row-2', exerciseId: timeExerciseId, measurementTypeSnapshot: ExerciseMeasurementType.TIME }],
    },
    workoutSet: { createMany: async (input: unknown) => { calls.push({ method: 'create-sets', input }); } },
  };
  const prisma = { $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaService;
  const service = new WorkoutService(prisma);
  const input: UpdateWorkoutDto = { workoutDate: '2026-10-29', exercises: [
    { exerciseId: repsExerciseId, sets: [{ repetitions: 2, weight: '0', unit: WeightUnit.KG }] },
    { exerciseId: timeExerciseId, sets: [{ durationSeconds: 30 }] },
  ] };

  const response = await service.update(account, workoutId, input);

  assert.deepEqual(calls.map(({ method }) => method), ['touch-parent', 'delete-exercises', 'create-exercises', 'create-sets', 'create-sets']);
  assert.deepEqual((calls[2].input as { data: Array<Record<string, unknown>> }).data.map(({ position, exerciseId }) => [position, exerciseId]), [[0, repsExerciseId], [1, timeExerciseId]]);
  const createdSets = calls.slice(3).map((call) => (call.input as { data: Array<{ position: number; repetitions: number | null; weightKg: Prisma.Decimal | null; durationSeconds: number | null }> }).data[0]);
  assert.equal(createdSets[0].weightKg?.toFixed(3), '0.000');
  assert.equal(createdSets[1].durationSeconds, 30);
  assert.equal(response.exercises[0].sets[0].weight, '0.000');
  assert.equal(response.exercises[0].sets[0].unit, WeightUnit.KG);
  assert.equal(response.workoutDate, '2026-10-29');
});

test('rejects duplicate exercises and set values that do not match the fixed measurement type', async () => {
  const transaction = {
    workoutSession: { findFirst: async () => ({ id: workoutId, exercises: [] }), update: async () => undefined },
    exercise: { findMany: async (input: { where: { id: { in: string[] } } }) => [
      { id: repsExerciseId, measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT, archivedAt: null },
      { id: timeExerciseId, measurementType: ExerciseMeasurementType.TIME, archivedAt: null },
    ].filter(({ id }) => input.where.id.in.includes(id)) },
    workoutExercise: { deleteMany: async () => { throw new Error('Must not mutate invalid request'); }, createMany: async () => undefined },
  };
  const prisma = { $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction) } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  await assert.rejects(() => service.update(account, workoutId, { exercises: [
    { exerciseId: repsExerciseId, sets: [] }, { exerciseId: repsExerciseId, sets: [] },
  ] }), /only once/);
  await assert.rejects(() => service.update(account, workoutId, { exercises: [
    { exerciseId: repsExerciseId, sets: [{ durationSeconds: 30 }] },
  ] }), /Repetitions-and-weight sets require/);
  await assert.rejects(() => service.update(account, workoutId, { exercises: [
    { exerciseId: timeExerciseId, sets: [{ repetitions: 5, weight: '10', unit: WeightUnit.KG }] },
  ] }), /Time sets require/);
});

test('maps a uniqueness conflict at start to the one-in-progress-workout response', async () => {
  const prisma = {
    workoutSession: { create: async () => { throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }); } },
  } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  await assert.rejects(() => service.startAdHoc(account, {} as StartAdHocWorkoutDto), (error: unknown) => error instanceof ConflictException);
});

test('completes only this user’s workout and leaves repeated completion safe', async () => {
  const calls: unknown[] = [];
  const prisma = {
    workoutSession: {
      updateMany: async (input: unknown) => { calls.push(input); return { count: 1 }; },
      findFirst: async () => workoutRecord({ status: WorkoutStatus.COMPLETED, completedAt: new Date('2026-10-30T11:00:00.000Z') }),
    },
  } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  const response = await service.complete(account, workoutId);

  const completionCall = calls[0] as { where: unknown; data: { status: WorkoutStatus; completedAt: Date } };
  assert.deepEqual(completionCall.where, { id: workoutId, userId: account.id, status: WorkoutStatus.IN_PROGRESS });
  assert.equal(completionCall.data.status, WorkoutStatus.COMPLETED);
  assert.ok(completionCall.data.completedAt instanceof Date);
  assert.equal(response.status, WorkoutStatus.COMPLETED);
});

test('returns not found for another user’s workout before update or deletion', async () => {
  const transaction = { workoutSession: { findFirst: async () => null, delete: async () => { throw new Error('Must not delete foreign workout'); } } };
  const prisma = {
    $transaction: async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction),
    workoutSession: { findFirst: async () => null, updateMany: async () => ({ count: 0 }) },
  } as unknown as PrismaService;
  const service = new WorkoutService(prisma);

  await assert.rejects(() => service.get(account, workoutId), /not found/);
  await assert.rejects(() => service.delete(account, workoutId), /not found/);
  await assert.rejects(() => service.complete(account, workoutId), /not found/);
});

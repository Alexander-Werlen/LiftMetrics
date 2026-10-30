import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { ExerciseMeasurementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExerciseService } from './exercise.service';
import { ExerciseSeedEntry, seedExercises } from './seed-exercises';

const active = { id: '00000000-0000-4000-8000-000000000001', name: 'Back squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT, archivedAt: null };
const archived = { id: '00000000-0000-4000-8000-000000000002', name: 'Old plank', measurementType: ExerciseMeasurementType.TIME, archivedAt: new Date('2026-01-01T00:00:00.000Z') };

test('catalog browse returns active exercises and detail keeps archived exercises readable', async () => {
  let listArgs: unknown;
  let detailArgs: unknown;
  const prisma = {
    exercise: {
      findMany: async (args: unknown) => { listArgs = args; return [active]; },
      findUnique: async (args: unknown) => { detailArgs = args; return archived; },
    },
  } as unknown as PrismaService;
  const service = new ExerciseService(prisma);

  assert.deepEqual(await service.list('  SQUAT '), [active]);
  assert.deepEqual(listArgs, {
    where: { archivedAt: null, name: { contains: 'SQUAT', mode: 'insensitive' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, measurementType: true, archivedAt: true },
  });
  assert.deepEqual(await service.getById(archived.id), archived);
  assert.deepEqual(detailArgs, { where: { id: archived.id }, select: { id: true, name: true, measurementType: true, archivedAt: true } });
});

test('catalog detail returns a non-disclosing not-found response for an unknown ID', async () => {
  const prisma = { exercise: { findUnique: async () => null } } as unknown as PrismaService;
  const service = new ExerciseService(prisma);
  await assert.rejects(() => service.getById('00000000-0000-4000-8000-000000000099'), /Exercise not found/);
});

test('the committed seed matches the approved 99-exercise catalog baseline', () => {
  const entries = JSON.parse(readFileSync(join(process.cwd(), 'prisma', 'exercises.json'), 'utf8')) as ExerciseSeedEntry[];
  assert.equal(entries.length, 99);
  assert.equal(entries.filter((entry) => entry.measurementType === ExerciseMeasurementType.TIME).length, 9);
  assert.equal(new Set(entries.map((entry) => entry.name.trim().replace(/\s+/g, ' ').toLowerCase())).size, 99);
});

test('catalog seeding is repeatable and matches names after case and whitespace normalization', async () => {
  const records = new Map<string, ExerciseSeedEntry & { id: string; archivedAt: Date | null }>();
  let nextId = 1;
  const transaction = {
    $queryRaw: async (_strings: TemplateStringsArray, normalizedName: string) => {
      const found = records.get(normalizedName);
      return found ? [{ id: found.id, measurementType: found.measurementType }] : [];
    },
    exercise: {
      create: async ({ data }: { data: ExerciseSeedEntry }) => {
        const id = `id-${nextId++}`;
        records.set(data.name.trim().replace(/\s+/g, ' ').toLowerCase(), { ...data, id, archivedAt: null });
        return { id };
      },
    },
  };
  const client = { $transaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction) };
  const entries: ExerciseSeedEntry[] = [
    { name: 'Back squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
    { name: 'Timed plank', measurementType: ExerciseMeasurementType.TIME },
  ];

  assert.deepEqual(await seedExercises(client, entries), { created: 2, existing: 0 });
  assert.deepEqual(await seedExercises(client, [
    { name: '  BACK   SQUAT ', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
    entries[1],
  ]), { created: 0, existing: 2 });
  assert.equal(records.size, 2);
});

test('seeding rejects duplicate normalized names and measurement-type changes', async () => {
  const records = new Map([['back squat', { id: 'existing', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT }]]);
  const transaction = {
    $queryRaw: async (_strings: TemplateStringsArray, normalizedName: string) => {
      const found = records.get(normalizedName);
      return found ? [found] : [];
    },
    exercise: { create: async () => { throw new Error('unexpected create'); } },
  };
  const client = { $transaction: async <T>(operation: (tx: typeof transaction) => Promise<T>) => operation(transaction) };

  await assert.rejects(() => seedExercises(client, [
    { name: 'Back squat', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
    { name: ' back   SQUAT ', measurementType: ExerciseMeasurementType.REPS_AND_WEIGHT },
  ]), /Duplicate normalized exercise name/);
  await assert.rejects(() => seedExercises(client, [
    { name: 'Back squat', measurementType: ExerciseMeasurementType.TIME },
  ]), /measurement type is immutable/);
});

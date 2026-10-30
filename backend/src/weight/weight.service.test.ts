import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma, WeightUnit } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { WeightService } from './weight.service';
import { formatWeightRead, parseCalendarDate, toStoredLoadMilliKilograms, toStoredMilliKilograms } from './weight-units';

const account: AccountContext = {
  id: '00000000-0000-4000-8000-000000000001',
  timeZone: 'America/Argentina/Buenos_Aires',
  preferredWeightUnit: WeightUnit.LB,
};

test('weight conversion uses exact decimal arithmetic and half-up gram rounding', () => {
  assert.equal(toStoredMilliKilograms('1.0004', WeightUnit.KG), 1_000n);
  assert.equal(toStoredMilliKilograms('1.0005', WeightUnit.KG), 1_001n);
  assert.equal(toStoredMilliKilograms('1', WeightUnit.LB), 454n);
  assert.equal(toStoredMilliKilograms('0.002', WeightUnit.LB), 1n);
  assert.equal(formatWeightRead('1.000', WeightUnit.LB), '2.205');
  assert.equal(formatWeightRead('1.000', WeightUnit.KG), '1.000');
});

test('rejects non-positive weights, values rounded to zero, and values outside database precision', () => {
  assert.throws(() => toStoredMilliKilograms('0', WeightUnit.KG), /greater than zero/);
  assert.throws(() => toStoredMilliKilograms('0.001', WeightUnit.LB), /greater than zero/);
  assert.throws(() => toStoredMilliKilograms('10000', WeightUnit.KG), /supported maximum/);
  assert.throws(() => toStoredMilliKilograms('-1', WeightUnit.KG), /positive decimal/);
  assert.throws(() => toStoredMilliKilograms('1.0000001', WeightUnit.KG), /positive decimal/);
});

test('load conversion accepts zero and uses the same exact kilogram rounding', () => {
  assert.equal(toStoredLoadMilliKilograms('0', WeightUnit.KG), 0n);
  assert.equal(toStoredLoadMilliKilograms('1', WeightUnit.LB), 454n);
  assert.throws(() => toStoredLoadMilliKilograms('-1', WeightUnit.KG), /positive decimal/);
});

test('accepts only real YYYY-MM-DD calendar dates', () => {
  assert.equal(parseCalendarDate('2024-02-29').toISOString(), '2024-02-29T00:00:00.000Z');
  assert.throws(() => parseCalendarDate('2026-02-29'), /valid calendar date/);
  assert.throws(() => parseCalendarDate('2026-10-30T00:00:00Z'), /YYYY-MM-DD/);
});

test('save upserts by authenticated owner and local calendar date, and echoes submitted unit', async () => {
  let upsertArgs: unknown;
  const savedAt = new Date('2026-10-30T12:00:00.000Z');
  const prisma = {
    weightEntry: {
      upsert: async (args: unknown) => {
        upsertArgs = args;
        return { id: 'entry-id', entryDate: new Date('2026-10-30T00:00:00.000Z'), createdAt: savedAt, updatedAt: savedAt };
      },
    },
  } as unknown as PrismaService;
  const service = new WeightService(prisma);

  const result = await service.save(account, '2026-10-30', { weight: '180.25', unit: WeightUnit.LB });

  assert.deepEqual(upsertArgs, {
    where: { userId_entryDate: { userId: account.id, entryDate: new Date('2026-10-30T00:00:00.000Z') } },
    create: { userId: account.id, entryDate: new Date('2026-10-30T00:00:00.000Z'), weightKg: new Prisma.Decimal('81.760') },
    update: { weightKg: new Prisma.Decimal('81.760') },
    select: { id: true, entryDate: true, createdAt: true, updatedAt: true },
  });
  assert.deepEqual(result, {
    id: 'entry-id', entryDate: '2026-10-30', weight: '180.25', unit: WeightUnit.LB,
    createdAt: savedAt, updatedAt: savedAt,
  });
});

test('saving the same date again reuses the owner/date key to correct the existing entry', async () => {
  const calls: unknown[] = [];
  const prisma = {
    weightEntry: {
      upsert: async (args: unknown) => {
        calls.push(args);
        return { id: 'same-entry-id', entryDate: new Date('2026-10-29T00:00:00.000Z'), createdAt: new Date(), updatedAt: new Date() };
      },
    },
  } as unknown as PrismaService;
  const service = new WeightService(prisma);

  await service.save(account, '2026-10-29', { weight: '80', unit: WeightUnit.KG });
  await service.save(account, '2026-10-29', { weight: '176.4', unit: WeightUnit.LB });

  assert.equal(calls.length, 2);
  assert.deepEqual((calls[0] as { where: unknown }).where, (calls[1] as { where: unknown }).where);
  assert.equal((calls[0] as { create: { weightKg: Prisma.Decimal } }).create.weightKg.toFixed(3), '80.000');
  assert.equal((calls[1] as { update: { weightKg: Prisma.Decimal } }).update.weightKg.toFixed(3), '80.014');
});

test('reads only the current user and defaults to the preferred weight unit', async () => {
  let findArgs: unknown;
  const prisma = {
    weightEntry: {
      findFirst: async (args: unknown) => {
        findArgs = args;
        return { id: 'entry-id', entryDate: new Date('2026-10-30T00:00:00.000Z'), weightKg: new Prisma.Decimal('81.760'), createdAt: new Date(), updatedAt: new Date() };
      },
    },
  } as unknown as PrismaService;
  const service = new WeightService(prisma);

  const result = await service.get(account, '2026-10-30');

  assert.deepEqual(findArgs, {
    where: { userId: account.id, entryDate: new Date('2026-10-30T00:00:00.000Z') },
    select: { id: true, entryDate: true, weightKg: true, createdAt: true, updatedAt: true },
  });
  assert.equal(result.weight, '180.250');
  assert.equal(result.unit, WeightUnit.LB);
});

test('history is owner-scoped, date-filterable, and returned newest date first in the requested unit', async () => {
  let findArgs: unknown;
  const prisma = {
    weightEntry: {
      findMany: async (args: unknown) => {
        findArgs = args;
        return [
          { id: 'new', entryDate: new Date('2026-10-02T00:00:00.000Z'), weightKg: new Prisma.Decimal('80.000'), createdAt: new Date(), updatedAt: new Date() },
          { id: 'old', entryDate: new Date('2026-10-01T00:00:00.000Z'), weightKg: new Prisma.Decimal('79.000'), createdAt: new Date(), updatedAt: new Date() },
        ];
      },
    },
  } as unknown as PrismaService;
  const service = new WeightService(prisma);

  const result = await service.history(account, { from: '2026-10-01', to: '2026-10-02', unit: WeightUnit.KG, limit: 1 });

  assert.deepEqual(findArgs, {
    where: { userId: account.id, entryDate: { gte: new Date('2026-10-01T00:00:00.000Z'), lte: new Date('2026-10-02T00:00:00.000Z') } },
    orderBy: { entryDate: 'desc' },
    take: 2,
    select: { id: true, entryDate: true, weightKg: true, createdAt: true, updatedAt: true },
  });
  assert.deepEqual(result.items.map((entry) => [entry.id, entry.entryDate, entry.weight, entry.unit]), [
    ['new', '2026-10-02', '80.000', WeightUnit.KG],
  ]);
  assert.equal(result.nextCursor, '2026-10-02');
});

test('rejects inverted history ranges and returns not found for missing owner dates', async () => {
  let findCalled = false;
  const prisma = { weightEntry: { findMany: async () => { findCalled = true; return []; }, findFirst: async () => null } } as unknown as PrismaService;
  const service = new WeightService(prisma);

  await assert.rejects(() => service.history(account, { from: '2026-10-02', to: '2026-10-01' }), /on or before/);
  assert.equal(findCalled, false);
  await assert.rejects(() => service.get(account, '2026-10-30'), /Weight entry not found/);
});

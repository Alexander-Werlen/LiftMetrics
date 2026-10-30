import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, WeightUnit } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { SaveWeightEntryDto, WeightHistoryQuery } from './weight.dto';
import { formatWeightRead, parseCalendarDate, toStoredMilliKilograms } from './weight-units';

@Injectable()
export class WeightService {
  constructor(private readonly prisma: PrismaService) {}

  async save(account: AccountContext, entryDate: string, input: SaveWeightEntryDto) {
    const date = parseCalendarDate(entryDate);
    const weightMilliKg = toStoredMilliKilograms(input.weight, input.unit);
    const weightKg = new Prisma.Decimal(weightMilliKg.toString()).div(1_000);
    const entry = await this.prisma.weightEntry.upsert({
      where: { userId_entryDate: { userId: account.id, entryDate: date } },
      create: { userId: account.id, entryDate: date, weightKg },
      update: { weightKg },
      select: { id: true, entryDate: true, createdAt: true, updatedAt: true },
    });
    return { ...entry, entryDate, weight: input.weight, unit: input.unit };
  }

  async get(account: AccountContext, entryDate: string, unit?: WeightUnit) {
    const date = parseCalendarDate(entryDate);
    const entry = await this.prisma.weightEntry.findFirst({
      where: { userId: account.id, entryDate: date },
      select: { id: true, entryDate: true, weightKg: true, createdAt: true, updatedAt: true },
    });
    if (!entry) throw new NotFoundException('Weight entry not found');
    const responseUnit = unit ?? account.preferredWeightUnit;
    return this.toResponse(entry, responseUnit);
  }

  async history(account: AccountContext, query: WeightHistoryQuery) {
    const from = query.from ? parseCalendarDate(query.from) : undefined;
    const to = query.to ? parseCalendarDate(query.to) : undefined;
    const before = query.before ? parseCalendarDate(query.before) : undefined;
    if (from && to && from > to) throw new BadRequestException('The from date must be on or before the to date');
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('The history limit must be between 1 and 100');

    const entries = await this.prisma.weightEntry.findMany({
      where: {
        userId: account.id,
        ...(from || to || before ? { entryDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}), ...(before ? { lt: before } : {}) } } : {}),
      },
      orderBy: { entryDate: 'desc' },
      take: limit + 1,
      select: { id: true, entryDate: true, weightKg: true, createdAt: true, updatedAt: true },
    });
    const responseUnit = query.unit ?? account.preferredWeightUnit;
    const page = entries.slice(0, limit);
    return {
      items: page.map((entry) => this.toResponse(entry, responseUnit)),
      nextCursor: entries.length > limit ? page[page.length - 1].entryDate.toISOString().slice(0, 10) : null,
    };
  }

  private toResponse(entry: { id: string; entryDate: Date; weightKg: Prisma.Decimal; createdAt: Date; updatedAt: Date }, unit: WeightUnit) {
    return {
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      weight: formatWeightRead(entry.weightKg.toFixed(3), unit),
      unit,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

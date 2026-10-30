import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { resolveLocalScheduleDay } from '../common/local-calendar';
import { CreateWeeklyPlanDto, UpdateWeeklyPlanDto, WeeklyPlanAssignmentInput } from './weekly-plan.dto';

const includeAssignments = {
  assignments: {
    orderBy: [{ weekday: 'asc' as const }, { position: 'asc' as const }],
    include: {
      blueprint: {
        include: {
          exercises: {
            orderBy: { position: 'asc' as const },
            include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } },
          },
        },
      },
    },
  },
};

@Injectable()
export class WeeklyPlanService {
  constructor(private readonly prisma: PrismaService) {}

  list(account: AccountContext) {
    return this.prisma.weeklyPlan.findMany({
      where: { userId: account.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      include: includeAssignments,
    });
  }

  async get(account: AccountContext, id: string) {
    const plan = await this.prisma.weeklyPlan.findFirst({ where: { id, userId: account.id }, include: includeAssignments });
    if (!plan) throw new NotFoundException('Weekly plan not found');
    return plan;
  }

  async create(account: AccountContext, input: CreateWeeklyPlanDto) {
    this.validateName(input.name);
    return this.prisma.$transaction(async (transaction) => {
      await this.validateAssignments(transaction, account.id, input.assignments);
      const plan = await transaction.weeklyPlan.create({
        data: { userId: account.id, name: input.name.trim() },
        select: { id: true },
      });
      await this.replaceAssignments(transaction, account.id, plan.id, input.assignments);
      return transaction.weeklyPlan.findFirst({ where: { id: plan.id, userId: account.id }, include: includeAssignments });
    });
  }

  async update(account: AccountContext, id: string, input: UpdateWeeklyPlanDto) {
    this.validateName(input.name);
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.weeklyPlan.findFirst({ where: { id, userId: account.id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Weekly plan not found');
      await this.validateAssignments(transaction, account.id, input.assignments);
      await transaction.weeklyPlan.update({
        where: { userId_id: { userId: account.id, id } },
        data: { name: input.name.trim() },
        select: { id: true },
      });
      await transaction.weeklyPlanAssignment.deleteMany({ where: { userId: account.id, weeklyPlanId: id } });
      await this.replaceAssignments(transaction, account.id, id, input.assignments);
      return transaction.weeklyPlan.findFirst({ where: { id, userId: account.id }, include: includeAssignments });
    });
  }

  async activate(account: AccountContext, id: string) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const plan = await transaction.weeklyPlan.findFirst({ where: { id, userId: account.id }, select: { id: true } });
        if (!plan) throw new NotFoundException('Weekly plan not found');
        await transaction.weeklyPlan.updateMany({ where: { userId: account.id, isActive: true }, data: { isActive: false } });
        await transaction.weeklyPlan.update({ where: { userId_id: { userId: account.id, id } }, data: { isActive: true }, select: { id: true } });
        return transaction.weeklyPlan.findFirst({ where: { id, userId: account.id }, include: includeAssignments });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Another weekly plan was activated concurrently; retry the request');
      }
      throw error;
    }
  }

  async deactivate(account: AccountContext, id: string) {
    const result = await this.prisma.weeklyPlan.updateMany({ where: { id, userId: account.id, isActive: true }, data: { isActive: false } });
    if (result.count === 0) {
      const exists = await this.prisma.weeklyPlan.findFirst({ where: { id, userId: account.id }, select: { id: true } });
      if (!exists) throw new NotFoundException('Weekly plan not found');
    }
    return this.get(account, id);
  }

  async recommendation(account: AccountContext, now = new Date()) {
    const localDay = resolveLocalScheduleDay(now, account.timeZone);
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: { userId: account.id, isActive: true },
      include: {
        assignments: {
          where: { weekday: localDay.weekday },
          orderBy: { position: 'asc' },
          include: {
            blueprint: {
              include: {
                exercises: {
                  orderBy: { position: 'asc' },
                  include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } },
                },
              },
            },
          },
        },
      },
    });
    return {
      date: localDay.date,
      weeklyPlan: plan ? { id: plan.id, name: plan.name, isActive: plan.isActive } : null,
      sessions: plan?.assignments.map((assignment) => ({
        id: assignment.id,
        weekday: assignment.weekday,
        position: assignment.position,
        blueprint: assignment.blueprint,
      })) ?? [],
    };
  }

  private async validateAssignments(transaction: Prisma.TransactionClient, userId: string, assignments: WeeklyPlanAssignmentInput[]) {
    if (!Array.isArray(assignments)) throw new BadRequestException('Assignments must be an array');
    for (const assignment of assignments) {
      if (!Number.isInteger(assignment.weekday) || assignment.weekday < 1 || assignment.weekday > 7) {
        throw new BadRequestException('Weekday must use ISO numbering from 1 (Monday) to 7 (Sunday)');
      }
    }
    const blueprintIds = [...new Set(assignments.map(({ blueprintId }) => blueprintId))];
    if (blueprintIds.length === 0) return;
    const found = await transaction.sessionBlueprint.findMany({
      where: { id: { in: blueprintIds }, userId, archivedAt: null },
      select: { id: true },
    });
    if (found.length !== blueprintIds.length) throw new BadRequestException('Every assigned blueprint must exist, belong to this user, and be active');
  }

  private async replaceAssignments(transaction: Prisma.TransactionClient, userId: string, weeklyPlanId: string, assignments: WeeklyPlanAssignmentInput[]) {
    if (assignments.length === 0) return;
    const nextPosition = new Map<number, number>();
    await transaction.weeklyPlanAssignment.createMany({
      data: assignments.map(({ weekday, blueprintId }) => {
        const position = nextPosition.get(weekday) ?? 0;
        nextPosition.set(weekday, position + 1);
        return { userId, weeklyPlanId, blueprintId, weekday, position };
      }),
    });
  }

  private validateName(name: string) {
    if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 120) {
      throw new BadRequestException('Weekly plan name must contain between 1 and 120 characters');
    }
  }
}

export { resolveLocalScheduleDay } from '../common/local-calendar';

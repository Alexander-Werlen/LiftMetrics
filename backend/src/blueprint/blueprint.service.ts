import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExerciseMeasurementType, Prisma } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { BlueprintExerciseInput, CreateBlueprintDto, UpdateBlueprintDto } from './blueprint.dto';

const includeExercises = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: { exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } } },
  },
};

@Injectable()
export class BlueprintService {
  constructor(private readonly prisma: PrismaService) {}

  list(account: AccountContext, includeArchived = false) {
    return this.prisma.sessionBlueprint.findMany({
      where: { userId: account.id, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      include: includeExercises,
    });
  }

  async get(account: AccountContext, id: string) {
    const blueprint = await this.prisma.sessionBlueprint.findFirst({ where: { id, userId: account.id }, include: includeExercises });
    if (!blueprint) throw new NotFoundException('Session blueprint not found');
    return blueprint;
  }

  create(account: AccountContext, input: CreateBlueprintDto) {
    return this.prisma.$transaction(async (transaction) => {
      this.validateName(input.name);
      await this.validateExercises(transaction, input.exercises);
      const blueprint = await transaction.sessionBlueprint.create({
        data: { userId: account.id, name: input.name.trim(), notes: input.notes ?? null },
        select: { id: true },
      });
      if (input.exercises.length > 0) {
        await transaction.blueprintExercise.createMany({
          data: input.exercises.map((exercise, position) => ({
            userId: account.id,
            blueprintId: blueprint.id,
            exerciseId: exercise.exerciseId,
            position,
            plannedSetCount: exercise.plannedSetCount,
            targetRepMin: exercise.targetRepMin ?? null,
            targetRepMax: exercise.targetRepMax ?? null,
          })),
        });
      }
      return transaction.sessionBlueprint.findFirst({ where: { id: blueprint.id, userId: account.id }, include: includeExercises });
    });
  }

  async update(account: AccountContext, id: string, input: UpdateBlueprintDto) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.sessionBlueprint.findFirst({
        where: { id, userId: account.id, archivedAt: null },
        select: { id: true },
      });
      if (!existing) throw new NotFoundException('Session blueprint not found');

      this.validateName(input.name);
      await this.validateExercises(transaction, input.exercises);
      await transaction.sessionBlueprint.update({
        where: { userId_id: { userId: account.id, id } },
        data: { name: input.name.trim(), notes: input.notes ?? null },
        select: { id: true },
      });
      await transaction.blueprintExercise.deleteMany({ where: { userId: account.id, blueprintId: id } });
      if (input.exercises.length > 0) {
        await transaction.blueprintExercise.createMany({
          data: input.exercises.map((exercise, position) => ({
            userId: account.id,
            blueprintId: id,
            exerciseId: exercise.exerciseId,
            position,
            plannedSetCount: exercise.plannedSetCount,
            targetRepMin: exercise.targetRepMin ?? null,
            targetRepMax: exercise.targetRepMax ?? null,
          })),
        });
      }
      return transaction.sessionBlueprint.findFirst({ where: { id, userId: account.id }, include: includeExercises });
    });
  }

  async archive(account: AccountContext, id: string) {
    const existing = await this.prisma.sessionBlueprint.findFirst({ where: { id, userId: account.id }, select: { id: true, archivedAt: true } });
    if (!existing) throw new NotFoundException('Session blueprint not found');
    if (!existing.archivedAt) {
      await this.prisma.sessionBlueprint.updateMany({
        where: { id, userId: account.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
    }
    return this.get(account, id);
  }

  private async validateExercises(transaction: Prisma.TransactionClient, exercises: BlueprintExerciseInput[]): Promise<void> {
    if (!Array.isArray(exercises)) throw new BadRequestException('Exercises must be an array');
    const exerciseIds = exercises.map((exercise) => exercise.exerciseId);
    if (new Set(exerciseIds).size !== exerciseIds.length) {
      throw new BadRequestException('An exercise can appear only once in a session blueprint');
    }
    for (const exercise of exercises) {
      if (!Number.isInteger(exercise.plannedSetCount) || exercise.plannedSetCount < 1) {
        throw new BadRequestException('Planned set count must be a positive integer');
      }
      if ((exercise.targetRepMin == null) !== (exercise.targetRepMax == null)) {
        throw new BadRequestException('Both repetition-range bounds must be provided together');
      }
      if (exercise.targetRepMin != null
        && (!Number.isInteger(exercise.targetRepMin) || !Number.isInteger(exercise.targetRepMax) || exercise.targetRepMin < 1 || exercise.targetRepMax! < 1)) {
        throw new BadRequestException('Repetition targets must be positive integers');
      }
      if (exercise.targetRepMin != null && exercise.targetRepMax! < exercise.targetRepMin) {
        throw new BadRequestException('The maximum target repetitions must be at least the minimum');
      }
    }

    const catalog = await transaction.exercise.findMany({
      where: { id: { in: exerciseIds }, archivedAt: null },
      select: { id: true, measurementType: true },
    });
    if (catalog.length !== exerciseIds.length) {
      throw new BadRequestException('Every selected exercise must exist and be active');
    }
    const typeById = new Map(catalog.map((exercise: { id: string; measurementType: ExerciseMeasurementType }) => [exercise.id, exercise.measurementType]));
    for (const exercise of exercises) {
      if (exercise.targetRepMin != null && typeById.get(exercise.exerciseId) !== ExerciseMeasurementType.REPS_AND_WEIGHT) {
        throw new BadRequestException('Repetition targets are available only for repetitions-and-weight exercises');
      }
    }
  }

  private validateName(name: string): void {
    if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
      throw new BadRequestException('Blueprint name must contain between 1 and 120 characters');
    }
  }
}

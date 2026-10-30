import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ExerciseMeasurementType, Prisma, WeightUnit, WorkoutStatus } from '@prisma/client';
import { AccountContext } from '../auth/auth.types';
import { resolveLocalScheduleDay } from '../common/local-calendar';
import { parseCalendarDate, formatWeightRead, toStoredLoadMilliKilograms, formatMilliUnits } from '../weight/weight-units';
import { PrismaService } from '../prisma/prisma.service';
import { StartAdHocWorkoutDto, UpdateWorkoutDto, WorkoutExerciseInput, WorkoutHistoryQuery, WorkoutSetInput } from './workout.dto';

const includeWorkout = {
  exercises: {
    orderBy: { position: 'asc' as const },
    include: {
      exercise: { select: { id: true, name: true, measurementType: true, archivedAt: true } },
      sets: { orderBy: { position: 'asc' as const } },
    },
  },
};
type WorkoutRecord = Prisma.WorkoutSessionGetPayload<{ include: typeof includeWorkout }>;

@Injectable()
export class WorkoutService {
  constructor(private readonly prisma: PrismaService) {}

  async startAdHoc(account: AccountContext, input: StartAdHocWorkoutDto) {
    const today = resolveLocalScheduleDay(new Date(), account.timeZone).date;
    const workoutDate = parseCalendarDate(input.workoutDate ?? today);
    const name = this.optionalName(input.name);
    try {
      const workout = await this.prisma.workoutSession.create({
        data: {
          userId: account.id,
          sourceBlueprintId: null,
          sourceNameSnapshot: name,
          workoutDate,
        },
        include: includeWorkout,
      });
      return this.toResponse(workout, account.preferredWeightUnit);
    } catch (error) {
      this.throwIfInProgressConflict(error);
      throw error;
    }
  }

  async startRecommendation(account: AccountContext, assignmentId: string) {
    const today = resolveLocalScheduleDay(new Date(), account.timeZone);
    try {
      const workout = await this.prisma.$transaction(async (transaction) => {
        const assignment = await transaction.weeklyPlanAssignment.findFirst({
          where: {
            id: assignmentId,
            userId: account.id,
            weekday: today.weekday,
            weeklyPlan: { is: { userId: account.id, isActive: true } },
          },
          include: {
            blueprint: {
              include: {
                exercises: {
                  orderBy: { position: 'asc' },
                  include: { exercise: { select: { id: true, name: true, measurementType: true } } },
                },
              },
            },
          },
        });
        if (!assignment) throw new NotFoundException('Today’s active recommendation was not found');
        const created = await transaction.workoutSession.create({
          data: {
            userId: account.id,
            sourceBlueprintId: assignment.blueprint.id,
            sourceNameSnapshot: assignment.blueprint.name,
            workoutDate: parseCalendarDate(today.date),
            exercises: {
              create: assignment.blueprint.exercises.map((entry, position) => ({
                exerciseId: entry.exerciseId,
                exerciseNameSnapshot: entry.exercise.name,
                measurementTypeSnapshot: entry.exercise.measurementType,
                position,
                plannedSetCountSnapshot: entry.plannedSetCount,
                targetRepMinSnapshot: entry.targetRepMin,
                targetRepMaxSnapshot: entry.targetRepMax,
              })),
            },
          },
          include: includeWorkout,
        });
        return created;
      });
      return this.toResponse(workout, account.preferredWeightUnit);
    } catch (error) {
      this.throwIfInProgressConflict(error);
      throw error;
    }
  }

  async inProgress(account: AccountContext, unit?: WeightUnit) {
    const workout = await this.prisma.workoutSession.findFirst({
      where: { userId: account.id, status: WorkoutStatus.IN_PROGRESS },
      orderBy: [{ startedAt: 'desc' }, { id: 'asc' }],
      include: includeWorkout,
    });
    return workout ? this.toResponse(workout, unit ?? account.preferredWeightUnit) : null;
  }

  async list(account: AccountContext, query: WorkoutHistoryQuery) {
    const from = query.from ? parseCalendarDate(query.from) : undefined;
    const to = query.to ? parseCalendarDate(query.to) : undefined;
    if (from && to && from > to) throw new BadRequestException('The from date must be on or before the to date');
    const limit = query.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('The history limit must be between 1 and 100');
    const baseWhere: Prisma.WorkoutSessionWhereInput = {
      userId: account.id,
      ...(query.status ? { status: query.status } : {}),
      ...(from || to ? { workoutDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };
    let where: Prisma.WorkoutSessionWhereInput = baseWhere;
    if (query.cursor) {
      const cursor = await this.prisma.workoutSession.findFirst({
        where: { id: query.cursor, userId: account.id },
        select: { id: true, workoutDate: true, startedAt: true },
      });
      if (!cursor) throw new BadRequestException('The history cursor is invalid for this account');
      where = {
        AND: [baseWhere, { OR: [
          { workoutDate: { lt: cursor.workoutDate } },
          { workoutDate: cursor.workoutDate, startedAt: { lt: cursor.startedAt } },
          { workoutDate: cursor.workoutDate, startedAt: cursor.startedAt, id: { gt: cursor.id } },
        ] }],
      };
    }
    const workouts = await this.prisma.workoutSession.findMany({
      where,
      orderBy: [{ workoutDate: 'desc' }, { startedAt: 'desc' }, { id: 'asc' }],
      take: limit + 1,
      include: includeWorkout,
    });
    const responseUnit = query.unit ?? account.preferredWeightUnit;
    const page = workouts.slice(0, limit);
    return {
      items: page.map((workout) => this.toResponse(workout, responseUnit)),
      nextCursor: workouts.length > limit ? page[page.length - 1].id : null,
    };
  }

  async get(account: AccountContext, id: string, unit?: WeightUnit) {
    const workout = await this.prisma.workoutSession.findFirst({ where: { id, userId: account.id }, include: includeWorkout });
    if (!workout) throw new NotFoundException('Workout not found');
    return this.toResponse(workout, unit ?? account.preferredWeightUnit);
  }

  async update(account: AccountContext, id: string, input: UpdateWorkoutDto) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.workoutSession.findFirst({
        where: { id, userId: account.id },
        include: { exercises: { select: { exerciseId: true, exerciseNameSnapshot: true, measurementTypeSnapshot: true, plannedSetCountSnapshot: true, targetRepMinSnapshot: true, targetRepMaxSnapshot: true } } },
      });
      if (!existing) throw new NotFoundException('Workout not found');
      await this.validateExercises(transaction, account.id, existing.exercises, input.exercises);
      await transaction.workoutSession.update({
        where: { userId_id: { userId: account.id, id } },
        data: { updatedAt: new Date(), ...(input.workoutDate ? { workoutDate: parseCalendarDate(input.workoutDate) } : {}) },
      });
      await transaction.workoutExercise.deleteMany({ where: { userId: account.id, workoutSessionId: id } });
      if (input.exercises.length > 0) {
        const catalog = await transaction.exercise.findMany({
          where: { id: { in: input.exercises.map(({ exerciseId }) => exerciseId) } },
          select: { id: true, name: true, measurementType: true, archivedAt: true },
        });
        const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
        const priorById = new Map(existing.exercises.map((exercise) => [exercise.exerciseId, exercise]));
        await transaction.workoutExercise.createMany({
          data: input.exercises.map((entry, position) => {
            const exercise = catalogById.get(entry.exerciseId)!;
            const prior = priorById.get(entry.exerciseId);
            const measurementType = prior?.measurementTypeSnapshot ?? exercise.measurementType;
            return {
              userId: account.id,
              workoutSessionId: id,
              exerciseId: exercise.id,
              exerciseNameSnapshot: prior?.exerciseNameSnapshot ?? exercise.name,
              measurementTypeSnapshot: measurementType,
              position,
              plannedSetCountSnapshot: prior?.plannedSetCountSnapshot ?? null,
              targetRepMinSnapshot: prior?.targetRepMinSnapshot ?? null,
              targetRepMaxSnapshot: prior?.targetRepMaxSnapshot ?? null,
            };
          }),
        });
        const createdExercises = await transaction.workoutExercise.findMany({
          where: { userId: account.id, workoutSessionId: id },
          select: { id: true, exerciseId: true, measurementTypeSnapshot: true },
        });
        const childByExercise = new Map(createdExercises.map((exercise) => [exercise.exerciseId, exercise]));
        for (let exerciseIndex = 0; exerciseIndex < input.exercises.length; exerciseIndex += 1) {
          const entry = input.exercises[exerciseIndex];
          const child = childByExercise.get(entry.exerciseId)!;
          const rows = entry.sets.map((set, position) => this.toSetCreate(account.id, child.id, position, child.measurementTypeSnapshot, set));
          if (rows.length > 0) await transaction.workoutSet.createMany({ data: rows });
        }
      }
      const updated = await transaction.workoutSession.findFirst({ where: { id, userId: account.id }, include: includeWorkout });
      return this.toResponse(updated!, account.preferredWeightUnit, input.exercises);
    });
  }

  async complete(account: AccountContext, id: string) {
    const changed = await this.prisma.workoutSession.updateMany({
      where: { id, userId: account.id, status: WorkoutStatus.IN_PROGRESS },
      data: { status: WorkoutStatus.COMPLETED, completedAt: new Date() },
    });
    if (changed.count === 0) {
      const existing = await this.prisma.workoutSession.findFirst({ where: { id, userId: account.id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Workout not found');
    }
    return this.get(account, id);
  }

  async delete(account: AccountContext, id: string) {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.workoutSession.findFirst({ where: { id, userId: account.id }, select: { id: true } });
      if (!existing) throw new NotFoundException('Workout not found');
      await transaction.workoutSession.delete({ where: { userId_id: { userId: account.id, id } } });
      return { id, deleted: true };
    });
  }

  private async validateExercises(
    transaction: Prisma.TransactionClient,
    userId: string,
    existing: Array<{ exerciseId: string; measurementTypeSnapshot: ExerciseMeasurementType }>,
    exercises: WorkoutExerciseInput[],
  ) {
    if (!Array.isArray(exercises)) throw new BadRequestException('Exercises must be an array');
    const ids = exercises.map(({ exerciseId }) => exerciseId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('An exercise can appear only once in a workout');
    const existingIds = new Set(existing.map(({ exerciseId }) => exerciseId));
    const catalog = await transaction.exercise.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, measurementType: true, archivedAt: true },
    });
    const catalogById = new Map(catalog.map((exercise) => [exercise.id, exercise]));
    if (catalog.length !== new Set(ids).size) throw new BadRequestException('Every workout exercise must exist in the catalog');
    const previousType = new Map(existing.map(({ exerciseId, measurementTypeSnapshot }) => [exerciseId, measurementTypeSnapshot]));
    for (const entry of exercises) {
      const catalogExercise = catalogById.get(entry.exerciseId)!;
      if (catalogExercise.archivedAt && !existingIds.has(entry.exerciseId)) {
        throw new BadRequestException('Archived exercises cannot be newly selected for a workout');
      }
      const measurementType = previousType.get(entry.exerciseId) ?? catalogExercise.measurementType;
      if (!Array.isArray(entry.sets)) throw new BadRequestException('Sets must be an array');
      for (const set of entry.sets) this.validateSet(measurementType, set);
    }
  }

  private validateSet(measurementType: ExerciseMeasurementType, set: WorkoutSetInput) {
    if (measurementType === ExerciseMeasurementType.REPS_AND_WEIGHT) {
      if (!Number.isInteger(set.repetitions) || (set.repetitions ?? 0) <= 0 || set.weight == null || set.unit == null || set.durationSeconds != null) {
        throw new BadRequestException('Repetitions-and-weight sets require positive repetitions, a nonnegative weight and unit, and no duration');
      }
      toStoredLoadMilliKilograms(set.weight, set.unit);
      return;
    }
    if (!Number.isInteger(set.durationSeconds) || (set.durationSeconds ?? 0) <= 0 || set.repetitions != null || set.weight != null || set.unit != null) {
      throw new BadRequestException('Time sets require a positive duration and cannot include repetitions or weight');
    }
  }

  private toSetCreate(userId: string, workoutExerciseId: string, position: number, measurementType: ExerciseMeasurementType, set: WorkoutSetInput) {
    if (measurementType === ExerciseMeasurementType.TIME) {
      return { userId, workoutExerciseId, position, repetitions: null, weightKg: null, durationSeconds: set.durationSeconds! };
    }
    const milliKg = toStoredLoadMilliKilograms(set.weight!, set.unit!);
    return {
      userId,
      workoutExerciseId,
      position,
      repetitions: set.repetitions!,
      weightKg: new Prisma.Decimal(formatMilliUnits(milliKg)),
      durationSeconds: null,
    };
  }

  private toResponse(workout: WorkoutRecord, defaultUnit: WeightUnit, inputExercises?: WorkoutExerciseInput[]) {
    return {
      ...workout,
      workoutDate: workout.workoutDate.toISOString().slice(0, 10),
      exercises: workout.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        exercise: { ...exercise.exercise, name: exercise.exerciseNameSnapshot, measurementType: exercise.measurementTypeSnapshot },
        sets: exercise.sets.map((set, setIndex) => {
          const { weightKg, ...setResponse } = set;
          if (weightKg == null) return { ...setResponse, weight: null, unit: null };
          const echoedUnit = inputExercises?.[exerciseIndex]?.sets[setIndex]?.unit;
          const unit = echoedUnit ?? defaultUnit;
          return { ...setResponse, weight: formatWeightRead(weightKg.toFixed(3), unit), unit };
        }),
      })),
    };
  }

  private optionalName(value: string | null | undefined): string | null {
    if (value == null) return null;
    const name = value.trim();
    if (!name || name.length > 120) throw new BadRequestException('Workout name must contain between 1 and 120 characters when provided');
    return name;
  }

  private throwIfInProgressConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('The user already has an in-progress workout');
    }
  }
}


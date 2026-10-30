import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExerciseService {
  constructor(private readonly prisma: PrismaService) {}

  list(search?: string) {
    const query = search?.trim();
    return this.prisma.exercise.findMany({
      where: {
        archivedAt: null,
        ...(query ? { name: { contains: query, mode: Prisma.QueryMode.insensitive } } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, measurementType: true, archivedAt: true },
    });
  }

  async getById(id: string) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      select: { id: true, name: true, measurementType: true, archivedAt: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }
}

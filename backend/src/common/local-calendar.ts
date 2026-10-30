import { BadRequestException } from '@nestjs/common';

export function resolveLocalScheduleDay(now: Date, timeZone: string): { date: string; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekdayByName: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const weekday = weekdayByName[values.weekday];
  if (!weekday || !values.year || !values.month || !values.day) throw new BadRequestException('Could not resolve the local schedule date');
  return { date: `${values.year}-${values.month}-${values.day}`, weekday };
}

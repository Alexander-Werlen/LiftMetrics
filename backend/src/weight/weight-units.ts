import { BadRequestException } from '@nestjs/common';
import { WeightUnit } from '@prisma/client';

const MAX_STORED_MILLIKILOGRAMS = 9_999_999n;
const LB_TO_KG_NUMERATOR = 45_359_237n;
const LB_TO_KG_DENOMINATOR = 100_000_000n;

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function parseMicroUnits(value: string): bigint {
  if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,6})?$/.test(value)) {
    throw new BadRequestException('Weight must be a positive decimal string with at most six fractional digits');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
}

export function toStoredMilliKilograms(value: string, unit: WeightUnit): bigint {
  const microUnits = parseMicroUnits(value);
  const milliKilograms = convertToMilliKilograms(microUnits, unit);

  if (milliKilograms <= 0n) throw new BadRequestException('Weight must be greater than zero after conversion');
  if (milliKilograms > MAX_STORED_MILLIKILOGRAMS) {
    throw new BadRequestException('Weight exceeds the supported maximum');
  }
  return milliKilograms;
}

export function toStoredLoadMilliKilograms(value: string, unit: WeightUnit): bigint {
  const milliKilograms = convertToMilliKilograms(parseMicroUnits(value), unit);
  if (milliKilograms < 0n) throw new BadRequestException('Load cannot be negative');
  if (milliKilograms > MAX_STORED_MILLIKILOGRAMS) throw new BadRequestException('Load exceeds the supported maximum');
  return milliKilograms;
}

function convertToMilliKilograms(microUnits: bigint, unit: WeightUnit): bigint {
  return unit === WeightUnit.KG
    ? roundHalfUp(microUnits, 1_000n)
    : roundHalfUp(microUnits * LB_TO_KG_NUMERATOR, 100_000_000_000n);
}

export function formatMilliUnits(value: bigint): string {
  return `${value / 1_000n}.${(value % 1_000n).toString().padStart(3, '0')}`;
}

export function formatWeightRead(weightKg: string, unit: WeightUnit): string {
  const [whole, fraction = ''] = weightKg.split('.');
  const milliKilograms = BigInt(whole) * 1_000n + BigInt(fraction.padEnd(3, '0').slice(0, 3));
  if (unit === WeightUnit.KG) return formatMilliUnits(milliKilograms);

  const milliPounds = roundHalfUp(milliKilograms * 100_000_000n, LB_TO_KG_NUMERATOR);
  return formatMilliUnits(milliPounds);
}

export function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException('Date must use the YYYY-MM-DD calendar-date format');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('Date is not a valid calendar date');
  }
  return parsed;
}

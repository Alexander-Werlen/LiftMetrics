import { registerDecorator, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ name: 'isIanaTimeZone', async: false })
export class IanaTimeZoneConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || value.length === 0) return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
      return true;
    } catch {
      return false;
    }
  }
  defaultMessage(): string { return 'timeZone must be a supported IANA time-zone identifier'; }
}

export function IsIanaTimeZone(options?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => registerDecorator({
    target: target.constructor,
    propertyName: propertyName.toString(),
    options,
    validator: IanaTimeZoneConstraint,
  });
}

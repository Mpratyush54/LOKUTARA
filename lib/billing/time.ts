/** Asia/Kolkata is UTC+5:30 with no DST. */
export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export type IstParts = { year: number; month: number; day: number };

export function toIstParts(date: Date): IstParts {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth(),
    day: ist.getUTCDate(),
  };
}

export function istYmd(date: Date): string {
  const { year, month, day } = toIstParts(date);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function startOfIstDay(date: Date): Date {
  const { year, month, day } = toIstParts(date);
  return new Date(Date.UTC(year, month, day) - IST_OFFSET_MS);
}

export function startOfIstMonth(date: Date): Date {
  const { year, month } = toIstParts(date);
  return new Date(Date.UTC(year, month, 1) - IST_OFFSET_MS);
}

export function startOfNextIstMonth(date: Date): Date {
  const { year, month } = toIstParts(date);
  return new Date(Date.UTC(year, month + 1, 1) - IST_OFFSET_MS);
}

export function startOfPreviousIstMonth(date: Date): Date {
  const { year, month } = toIstParts(date);
  return new Date(Date.UTC(year, month - 1, 1) - IST_OFFSET_MS);
}

export function inRange(at: Date, start: Date, end: Date): boolean {
  return at.getTime() >= start.getTime() && at.getTime() < end.getTime();
}

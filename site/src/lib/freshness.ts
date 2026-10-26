export const MAX_AGE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function ageInDays(verified: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - verified.getTime()) / DAY_MS);
}

export function isStale(verified: Date, now: Date = new Date()): boolean {
  return ageInDays(verified, now) > MAX_AGE_DAYS;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

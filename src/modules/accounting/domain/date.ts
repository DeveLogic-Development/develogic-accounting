export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIsoDate(startIsoDate: string, days: number): string {
  const date = new Date(startIsoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

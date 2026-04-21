export function matchesSearchText(search: string, fields: Array<string | number | undefined>): boolean {
  const normalized = search.trim().toLowerCase();
  if (!normalized) return true;

  return fields.some((field) => String(field ?? '').toLowerCase().includes(normalized));
}

export function matchesDateRange(dateIso: string | null | undefined, from?: string, to?: string): boolean {
  if (!dateIso) return !from && !to;
  const date = dateIso.slice(0, 10);
  if (!date) return !from && !to;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function sortByDateDesc<T>(rows: T[], selector: (row: T) => string): T[] {
  return rows.slice().sort((a, b) => selector(b).localeCompare(selector(a)));
}

export function sortByNumberDesc<T>(rows: T[], selector: (row: T) => number): T[] {
  return rows.slice().sort((a, b) => selector(b) - selector(a));
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function interpolateTemplate(template: string, values: Record<string, string | undefined>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_, key: string) => values[key] ?? '');
}

export function createBodySnippet(body: string, maxLength = 120): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

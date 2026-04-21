import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function stripOptionalQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseViteDefaultsFromEnvExample(): Record<string, string> {
  const filePath = resolve(process.cwd(), '.env.example');
  if (!existsSync(filePath)) return {};

  const raw = readFileSync(filePath, 'utf8');
  const entries: Record<string, string> = {};

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key.startsWith('VITE_')) return;

    const value = stripOptionalQuotes(trimmed.slice(separatorIndex + 1));
    entries[key] = value;
  });

  return entries;
}

const viteEnvDefaults = parseViteDefaultsFromEnvExample();

export default defineConfig({
  plugins: [react()],
  define: {
    __ENV_EXAMPLE__: JSON.stringify(viteEnvDefaults),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});

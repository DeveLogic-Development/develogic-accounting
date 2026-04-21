export interface BusinessSettings {
  businessName: string;
  registrationNumber: string;
  vatNumber: string;
  email: string;
  phone: string;
  website: string;
  currency: string;
  timezone: string;
  address: string;
  fontFamily: string;
  brandColor: string;
  logoDataUrl?: string;
  logoFileName?: string;
  logoAssetId?: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  signatureName: string;
}

export const BUSINESS_SETTINGS_STORAGE_KEY = 'develogic_business_settings_v1';
export const BUSINESS_SETTINGS_UPDATED_EVENT = 'develogic:business-settings-updated';

export const defaultBusinessSettings: BusinessSettings = {
  businessName: 'DeveLogic Digital',
  registrationNumber: '2020/123456/07',
  vatNumber: '4123456789',
  email: 'finance@develogic.digital',
  phone: '+27 11 555 0100',
  website: 'https://develogic.digital',
  currency: 'ZAR',
  timezone: 'Africa/Johannesburg',
  address: '145 Rivonia Road, Sandton, Johannesburg',
  fontFamily: 'manrope',
  brandColor: '#174B7A',
  senderName: 'DeveLogic Finance',
  senderEmail: 'billing@develogic.digital',
  replyTo: 'accounts@develogic.digital',
  signatureName: 'Finance Team',
};

export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(withHash);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  if (/^#([0-9a-fA-F]{6})$/.test(withHash)) {
    return withHash.toUpperCase();
  }
  return null;
}

export function hexToRgbString(hex: string): string {
  const normalized = normalizeHexColor(hex) ?? defaultBusinessSettings.brandColor;
  const value = normalized.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

export function rgbStringToHex(value: string): string | null {
  const cleaned = value.trim().replace(/^rgb\(/i, '').replace(/\)$/, '');
  const parts = cleaned.split(',').map((segment) => Number(segment.trim()));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return null;
  }

  const hex = parts
    .map((part) => Math.round(part).toString(16).padStart(2, '0'))
    .join('');
  return `#${hex}`.toUpperCase();
}

function mixHexColors(a: string, b: string, weight: number): string {
  const start = normalizeHexColor(a) ?? '#174B7A';
  const end = normalizeHexColor(b) ?? '#FFFFFF';
  const clamped = Math.max(0, Math.min(1, weight));

  const channels = [0, 2, 4].map((offset) => {
    const from = Number.parseInt(start.slice(offset + 1, offset + 3), 16);
    const to = Number.parseInt(end.slice(offset + 1, offset + 3), 16);
    return Math.round(from + (to - from) * clamped);
  });

  return `#${channels.map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function loadBusinessSettings(): BusinessSettings {
  if (typeof window === 'undefined') return defaultBusinessSettings;

  const raw = window.localStorage.getItem(BUSINESS_SETTINGS_STORAGE_KEY);
  if (!raw) return defaultBusinessSettings;

  try {
    const parsed = JSON.parse(raw) as Partial<BusinessSettings>;
    const normalizedBrand = normalizeHexColor(parsed.brandColor ?? '') ?? defaultBusinessSettings.brandColor;

    return {
      ...defaultBusinessSettings,
      ...parsed,
      brandColor: normalizedBrand,
    };
  } catch {
    return defaultBusinessSettings;
  }
}

export function saveBusinessSettings(settings: BusinessSettings): void {
  if (typeof window === 'undefined') return;
  const normalized = {
    ...settings,
    brandColor: normalizeHexColor(settings.brandColor) ?? defaultBusinessSettings.brandColor,
  };
  window.localStorage.setItem(BUSINESS_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(BUSINESS_SETTINGS_UPDATED_EVENT, { detail: normalized }));
}

export function applyBusinessBrandTheme(settings: Pick<BusinessSettings, 'brandColor'>): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const brand = normalizeHexColor(settings.brandColor) ?? defaultBusinessSettings.brandColor;

  root.style.setProperty('--color-brand-700', brand);
  root.style.setProperty('--color-brand-900', mixHexColors(brand, '#000000', 0.42));
  root.style.setProperty('--color-brand-500', mixHexColors(brand, '#FFFFFF', 0.16));
  root.style.setProperty('--color-brand-100', mixHexColors(brand, '#FFFFFF', 0.88));
}

export function initializeBusinessBrandTheme(): void {
  const settings = loadBusinessSettings();
  applyBusinessBrandTheme(settings);
}

export function subscribeBusinessSettings(onChange: (settings: BusinessSettings) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<BusinessSettings>).detail;
    onChange(detail ?? loadBusinessSettings());
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== BUSINESS_SETTINGS_STORAGE_KEY) return;
    onChange(loadBusinessSettings());
  };

  window.addEventListener(BUSINESS_SETTINGS_UPDATED_EVENT, handleCustomEvent as EventListener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(BUSINESS_SETTINGS_UPDATED_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function splitAddressLines(address: string): string[] {
  return address
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

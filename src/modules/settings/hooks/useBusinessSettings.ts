import { useEffect, useState } from 'react';
import { BusinessSettings, loadBusinessSettings, subscribeBusinessSettings } from '../domain/business-settings';

export function useBusinessSettings(): BusinessSettings {
  const [settings, setSettings] = useState<BusinessSettings>(loadBusinessSettings);

  useEffect(() => subscribeBusinessSettings(setSettings), []);

  return settings;
}

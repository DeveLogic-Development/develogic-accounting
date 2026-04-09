import { describe, expect, it } from 'vitest';
import { TEMPLATE_PRESETS, createPresetTemplateState, createTemplateFromPreset } from '../defaults';

describe('template presets', () => {
  it('provides a curated starter preset set', () => {
    expect(TEMPLATE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('builds seed state with templates, versions, and logos', () => {
    const state = createPresetTemplateState('2026-04-09T00:00:00.000Z');
    expect(state.templates.length).toBe(TEMPLATE_PRESETS.length);
    expect(state.versions.length).toBe(TEMPLATE_PRESETS.length);
    expect(state.logoAssets.length).toBeGreaterThan(0);
  });

  it('creates a preset payload for template creation', () => {
    const preset = createTemplateFromPreset('preset_modern_minimal');
    expect(preset).not.toBeNull();
    expect(preset?.name).toBe('Modern Minimal');
    expect(preset?.config.sections.lineItems.enabled).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { createDefaultTemplateConfigForType } from '../defaults';
import { validateTemplateConfig, validateTemplateName, validateTemplatePublishState } from '../validation';

describe('template validation', () => {
  it('rejects invalid branding colors and missing legal text', () => {
    const config = createDefaultTemplateConfigForType('quote');
    config.branding.primaryColor = 'blue';
    config.footer.legalText = '';

    const result = validateTemplateConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('validates publish state with metadata and config checks', () => {
    const config = createDefaultTemplateConfigForType('invoice');
    const validResult = validateTemplatePublishState({
      name: 'Invoice Template',
      type: 'invoice',
      config,
    });
    expect(validResult.isValid).toBe(true);

    const invalidResult = validateTemplatePublishState({
      name: '',
      type: 'quote',
      config: { ...config, footer: { ...config.footer, legalText: '' } },
    });
    expect(invalidResult.isValid).toBe(false);
  });

  it('requires a non-empty template name', () => {
    expect(validateTemplateName('').isValid).toBe(false);
    expect(validateTemplateName('Valid Name').isValid).toBe(true);
  });
});

import { DocumentTemplateType, TemplateConfig, TemplateValidationIssue, TemplateValidationResult } from './types';

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6})$/;

function makeResult(issues: TemplateValidationIssue[]): TemplateValidationResult {
  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function validateTemplateName(name: string): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (name.trim().length === 0) {
    issues.push({ field: 'name', message: 'Template name is required.' });
  }

  if (name.trim().length > 90) {
    issues.push({ field: 'name', message: 'Template name must be shorter than 90 characters.' });
  }

  return makeResult(issues);
}

export function validateTemplateType(type: DocumentTemplateType): TemplateValidationResult {
  const allowed: DocumentTemplateType[] = ['quote', 'invoice', 'universal'];
  if (allowed.includes(type)) return makeResult([]);
  return makeResult([{ field: 'type', message: 'Template type is invalid.' }]);
}

export function validateTemplateConfig(config: TemplateConfig): TemplateValidationResult {
  const issues: TemplateValidationIssue[] = [];

  if (!HEX_COLOR_PATTERN.test(config.branding.primaryColor)) {
    issues.push({ field: 'branding.primaryColor', message: 'Primary color must be a valid hex color.' });
  }
  if (!HEX_COLOR_PATTERN.test(config.branding.accentColor)) {
    issues.push({ field: 'branding.accentColor', message: 'Accent color must be a valid hex color.' });
  }

  if (config.layout.sectionSpacing < 4 || config.layout.sectionSpacing > 40) {
    issues.push({
      field: 'layout.sectionSpacing',
      message: 'Section spacing must be between 4 and 40.',
    });
  }

  const enabledSections = Object.values(config.sections).filter((section) => section.enabled).length;
  if (enabledSections < 4) {
    issues.push({
      field: 'sections',
      message: 'At least four sections must remain enabled for readable documents.',
    });
  }

  if (!config.sections.lineItems.enabled) {
    issues.push({
      field: 'sections.lineItems',
      message: 'Line items section cannot be disabled.',
    });
  }

  if (!config.table.columns.showLineTotal) {
    issues.push({
      field: 'table.columns.showLineTotal',
      message: 'Line total column must remain enabled.',
    });
  }

  if (!config.summary.labels.total.trim()) {
    issues.push({
      field: 'summary.labels.total',
      message: 'Total label is required.',
    });
  }

  if (config.footer.showPaymentInstructions && config.footer.paymentInstructionsText.trim().length === 0) {
    issues.push({
      field: 'footer.paymentInstructionsText',
      message: 'Payment instruction text is required when payment instructions are enabled.',
    });
  }

  if (!config.footer.legalText.trim()) {
    issues.push({
      field: 'footer.legalText',
      message: 'Legal footer text is required.',
    });
  }

  return makeResult(issues);
}

export function validateTemplatePublishState(input: {
  name: string;
  type: DocumentTemplateType;
  config: TemplateConfig;
}): TemplateValidationResult {
  const allIssues: TemplateValidationIssue[] = [];
  allIssues.push(...validateTemplateName(input.name).issues);
  allIssues.push(...validateTemplateType(input.type).issues);
  allIssues.push(...validateTemplateConfig(input.config).issues);

  return makeResult(allIssues);
}

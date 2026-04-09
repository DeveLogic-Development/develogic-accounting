import { describe, expect, it } from 'vitest';
import { createPresetTemplateState } from '../defaults';
import { findDefaultAssignmentForDocumentType, getPublishedTemplateAssignments, isTemplateApplicableToDocumentType } from '../rules';

describe('template applicability rules', () => {
  it('supports universal templates for both document types', () => {
    expect(isTemplateApplicableToDocumentType('universal', 'quote')).toBe(true);
    expect(isTemplateApplicableToDocumentType('universal', 'invoice')).toBe(true);
    expect(isTemplateApplicableToDocumentType('quote', 'invoice')).toBe(false);
  });

  it('returns published assignments for document forms', () => {
    const state = createPresetTemplateState('2026-04-09T00:00:00.000Z');
    const quoteAssignments = getPublishedTemplateAssignments(state.templates, state.versions, 'quote');
    const invoiceAssignments = getPublishedTemplateAssignments(state.templates, state.versions, 'invoice');

    expect(quoteAssignments.length).toBeGreaterThan(0);
    expect(invoiceAssignments.length).toBeGreaterThan(0);
  });

  it('finds defaults for quote and invoice', () => {
    const state = createPresetTemplateState('2026-04-09T00:00:00.000Z');
    expect(findDefaultAssignmentForDocumentType(state.templates, state.versions, 'quote')).toBeDefined();
    expect(findDefaultAssignmentForDocumentType(state.templates, state.versions, 'invoice')).toBeDefined();
  });
});

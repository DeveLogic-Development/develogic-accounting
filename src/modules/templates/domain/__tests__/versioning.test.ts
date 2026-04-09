import { describe, expect, it } from 'vitest';
import { createDefaultTemplateConfigForType } from '../defaults';
import { createDraftVersion, publishTemplateVersion } from '../versioning';
import { DocumentTemplate } from '../types';

describe('template versioning', () => {
  const baseTemplate: DocumentTemplate = {
    id: 'tpl_001',
    name: 'Sample Template',
    description: '',
    type: 'quote',
    status: 'published',
    currentPublishedVersionId: 'tplver_1',
    currentDraftVersionId: undefined,
    latestVersionNumber: 1,
    isDefaultForQuote: false,
    isDefaultForInvoice: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  };

  it('creates next draft version incrementally', () => {
    const mutation = createDraftVersion({
      template: baseTemplate,
      baseConfig: createDefaultTemplateConfigForType('quote'),
      nowIso: '2026-04-02T00:00:00.000Z',
      changeNote: 'Adjust spacing',
    });

    expect(mutation.newVersion.versionNumber).toBe(2);
    expect(mutation.template.currentDraftVersionId).toBe(mutation.newVersion.id);
    expect(mutation.template.latestVersionNumber).toBe(2);
  });

  it('publishes draft version and sets active pointer', () => {
    const draft = createDraftVersion({
      template: baseTemplate,
      baseConfig: createDefaultTemplateConfigForType('quote'),
      nowIso: '2026-04-02T00:00:00.000Z',
    });

    const published = publishTemplateVersion({
      template: draft.template,
      version: draft.newVersion,
      nowIso: '2026-04-03T00:00:00.000Z',
      changeNote: 'Publish v2',
    });

    expect(published.template.currentDraftVersionId).toBeUndefined();
    expect(published.template.currentPublishedVersionId).toBe(draft.newVersion.id);
    expect(published.version.status).toBe('published');
  });
});

import { createId } from '@/modules/accounting/domain/id';
import {
  DocumentTemplate,
  DocumentTemplateVersion,
  TemplateConfig,
  TemplateVersionStatus,
} from './types';

export interface VersionMutationResult {
  template: DocumentTemplate;
  newVersion: DocumentTemplateVersion;
  previousDraftVersionId?: string;
}

export function createDraftVersion(input: {
  template: DocumentTemplate;
  baseConfig: TemplateConfig;
  nowIso: string;
  changeNote?: string;
}): VersionMutationResult {
  const { template, baseConfig, nowIso, changeNote } = input;

  const newVersionNumber = template.latestVersionNumber + 1;
  const draftVersionId = createId('tplver');

  const newVersion: DocumentTemplateVersion = {
    id: draftVersionId,
    templateId: template.id,
    versionNumber: newVersionNumber,
    status: 'draft',
    config: baseConfig,
    changeNote,
    createdAt: nowIso,
  };

  return {
    template: {
      ...template,
      currentDraftVersionId: draftVersionId,
      latestVersionNumber: newVersionNumber,
      status: template.currentPublishedVersionId ? template.status : 'draft',
      updatedAt: nowIso,
    },
    newVersion,
    previousDraftVersionId: template.currentDraftVersionId,
  };
}

export function publishTemplateVersion(input: {
  template: DocumentTemplate;
  version: DocumentTemplateVersion;
  nowIso: string;
  changeNote?: string;
}): { template: DocumentTemplate; version: DocumentTemplateVersion } {
  const { template, version, nowIso, changeNote } = input;

  const publishedStatus: TemplateVersionStatus = 'published';
  return {
    template: {
      ...template,
      status: 'published',
      currentPublishedVersionId: version.id,
      currentDraftVersionId: undefined,
      updatedAt: nowIso,
    },
    version: {
      ...version,
      status: publishedStatus,
      publishedAt: nowIso,
      changeNote: changeNote ?? version.changeNote,
    },
  };
}

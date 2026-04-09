import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { createId } from '@/modules/accounting/domain/id';
import { createTemplatesSeedState } from '../data/seed';
import { LocalStorageTemplatesRepository } from '../data/localStorageRepository';
import { createDefaultTemplateConfigForType } from '../domain/defaults';
import { getPublishedTemplateAssignments, findDefaultAssignmentForDocumentType, getTemplateVersionById, isTemplateApplicableToDocumentType, toTemplateListRow } from '../domain/rules';
import { createDraftVersion, publishTemplateVersion } from '../domain/versioning';
import { validateTemplateConfig, validateTemplateName, validateTemplatePublishState, validateTemplateType } from '../domain/validation';
import {
  DocumentTemplate,
  DocumentTemplateType,
  DocumentTemplateVersion,
  LogoAsset,
  TemplateAssignmentReference,
  TemplateConfig,
  TemplateCreatePayload,
  TemplateListRow,
  TemplateUpdateDraftPayload,
  TemplatesState,
  TemplateValidationIssue,
} from '../domain/types';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

interface TemplateSnapshot {
  template: DocumentTemplate;
  draftVersion?: DocumentTemplateVersion;
  publishedVersion?: DocumentTemplateVersion;
  editableVersion?: DocumentTemplateVersion;
}

interface TemplatesContextValue {
  state: TemplatesState;
  templateRows: TemplateListRow[];
  getTemplateById: (templateId: string) => DocumentTemplate | undefined;
  getTemplateVersionById: (versionId?: string) => DocumentTemplateVersion | undefined;
  getTemplateSnapshot: (templateId: string) => TemplateSnapshot | undefined;
  getTemplateAssignmentsForDocument: (documentType: 'quote' | 'invoice') => TemplateAssignmentReference[];
  getDefaultTemplateAssignmentForDocument: (
    documentType: 'quote' | 'invoice',
  ) => TemplateAssignmentReference | undefined;
  createTemplate: (payload: TemplateCreatePayload) => ActionResult<DocumentTemplate>;
  updateTemplateDraft: (payload: TemplateUpdateDraftPayload) => ActionResult<DocumentTemplateVersion>;
  publishTemplate: (templateId: string, changeNote?: string) => ActionResult<DocumentTemplateVersion>;
  duplicateTemplate: (templateId: string) => ActionResult<DocumentTemplate>;
  archiveTemplate: (templateId: string) => ActionResult<DocumentTemplate>;
  setDefaultTemplate: (
    templateId: string,
    documentType: 'quote' | 'invoice',
  ) => ActionResult<DocumentTemplate>;
  saveLogoAsset: (input: { name: string; url: string; kind?: LogoAsset['kind'] }) => ActionResult<LogoAsset>;
}

const repository = new LocalStorageTemplatesRepository();
const TemplatesContext = createContext<TemplatesContextValue | undefined>(undefined);

function isTemplatesState(value: unknown): value is TemplatesState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<TemplatesState>;
  return (
    Array.isArray(candidate.templates) &&
    Array.isArray(candidate.versions) &&
    Array.isArray(candidate.logoAssets)
  );
}

function createInitialState(): TemplatesState {
  const loaded = repository.load();
  return isTemplatesState(loaded) ? loaded : createTemplatesSeedState();
}

function summarizeValidationIssues(issues: TemplateValidationIssue[]): string {
  return issues.map((issue) => issue.message).join(' ');
}

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TemplatesState>(createInitialState);

  const commit = (updater: (previous: TemplatesState) => TemplatesState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const templateRows = useMemo(
    () => state.templates.map((template) => toTemplateListRow(template, state.versions)),
    [state.templates, state.versions],
  );

  const contextValue: TemplatesContextValue = {
    state,
    templateRows,
    getTemplateById: (templateId) => state.templates.find((template) => template.id === templateId),
    getTemplateVersionById: (versionId) => getTemplateVersionById(state.versions, versionId),
    getTemplateSnapshot: (templateId) => {
      const template = state.templates.find((entry) => entry.id === templateId);
      if (!template) return undefined;

      const draftVersion = getTemplateVersionById(state.versions, template.currentDraftVersionId);
      const publishedVersion = getTemplateVersionById(state.versions, template.currentPublishedVersionId);

      return {
        template,
        draftVersion,
        publishedVersion,
        editableVersion: draftVersion ?? publishedVersion,
      };
    },
    getTemplateAssignmentsForDocument: (documentType) =>
      getPublishedTemplateAssignments(state.templates, state.versions, documentType),
    getDefaultTemplateAssignmentForDocument: (documentType) =>
      findDefaultAssignmentForDocumentType(state.templates, state.versions, documentType),
    createTemplate: (payload) => {
      const nameValidation = validateTemplateName(payload.name);
      const typeValidation = validateTemplateType(payload.type);
      const configValidation = validateTemplateConfig(payload.config);
      const issues = [...nameValidation.issues, ...typeValidation.issues, ...configValidation.issues];
      if (issues.length > 0) {
        return { ok: false, error: summarizeValidationIssues(issues) };
      }

      const nowIso = new Date().toISOString();
      const templateId = createId('template');
      const versionId = createId('tplver');

      const template: DocumentTemplate = {
        id: templateId,
        name: payload.name.trim(),
        description: payload.description?.trim() ?? '',
        type: payload.type,
        status: 'draft',
        currentDraftVersionId: versionId,
        currentPublishedVersionId: undefined,
        latestVersionNumber: 1,
        isDefaultForQuote: false,
        isDefaultForInvoice: false,
        preset: payload.preset,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const version: DocumentTemplateVersion = {
        id: versionId,
        templateId,
        versionNumber: 1,
        status: 'draft',
        config: payload.config,
        changeNote: 'Initial draft version',
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        templates: [template, ...previous.templates],
        versions: [version, ...previous.versions],
      }));

      return { ok: true, data: template };
    },
    updateTemplateDraft: (payload) => {
      const template = state.templates.find((entry) => entry.id === payload.templateId);
      if (!template) return { ok: false, error: 'Template not found.' };
      if (template.status === 'archived') return { ok: false, error: 'Archived templates cannot be edited.' };

      const configValidation = validateTemplateConfig(payload.config);
      if (!configValidation.isValid) {
        return { ok: false, error: summarizeValidationIssues(configValidation.issues) };
      }

      const nowIso = new Date().toISOString();
      const name = payload.name?.trim() ?? template.name;
      const description = payload.description?.trim() ?? template.description;
      const existingDraft = getTemplateVersionById(state.versions, template.currentDraftVersionId);

      if (existingDraft) {
        const nextDraft: DocumentTemplateVersion = {
          ...existingDraft,
          config: payload.config,
          changeNote: payload.changeNote ?? existingDraft.changeNote,
        };

        const nextTemplate: DocumentTemplate = {
          ...template,
          name,
          description,
          updatedAt: nowIso,
          status: template.currentPublishedVersionId ? template.status : 'draft',
        };

        commit((previous) => ({
          ...previous,
          templates: previous.templates.map((entry) => (entry.id === template.id ? nextTemplate : entry)),
          versions: previous.versions.map((entry) => (entry.id === nextDraft.id ? nextDraft : entry)),
        }));

        return { ok: true, data: nextDraft };
      }

      const published = getTemplateVersionById(state.versions, template.currentPublishedVersionId);
      const baseConfig = published?.config ?? createDefaultTemplateConfigForType(template.type);
      const mutation = createDraftVersion({
        template: {
          ...template,
          name,
          description,
        },
        baseConfig: payload.config ?? baseConfig,
        nowIso,
        changeNote: payload.changeNote,
      });

      commit((previous) => ({
        ...previous,
        templates: previous.templates.map((entry) =>
          entry.id === template.id ? mutation.template : entry,
        ),
        versions: [mutation.newVersion, ...previous.versions],
      }));

      return { ok: true, data: mutation.newVersion };
    },
    publishTemplate: (templateId, changeNote) => {
      const template = state.templates.find((entry) => entry.id === templateId);
      if (!template) return { ok: false, error: 'Template not found.' };
      if (template.status === 'archived') return { ok: false, error: 'Archived templates cannot be published.' };

      const draftVersion = getTemplateVersionById(state.versions, template.currentDraftVersionId);
      if (!draftVersion) return { ok: false, error: 'No draft version available to publish.' };

      const publishValidation = validateTemplatePublishState({
        name: template.name,
        type: template.type,
        config: draftVersion.config,
      });
      if (!publishValidation.isValid) {
        return { ok: false, error: summarizeValidationIssues(publishValidation.issues) };
      }

      const nowIso = new Date().toISOString();
      const published = publishTemplateVersion({
        template,
        version: draftVersion,
        nowIso,
        changeNote,
      });

      commit((previous) => ({
        ...previous,
        templates: previous.templates.map((entry) =>
          entry.id === template.id ? published.template : entry,
        ),
        versions: previous.versions.map((entry) =>
          entry.id === draftVersion.id ? published.version : entry,
        ),
      }));

      return { ok: true, data: published.version };
    },
    duplicateTemplate: (templateId) => {
      const sourceTemplate = state.templates.find((entry) => entry.id === templateId);
      if (!sourceTemplate) return { ok: false, error: 'Template not found.' };

      const sourceSnapshot =
        getTemplateVersionById(state.versions, sourceTemplate.currentDraftVersionId) ??
        getTemplateVersionById(state.versions, sourceTemplate.currentPublishedVersionId);
      if (!sourceSnapshot) return { ok: false, error: 'Template has no version to duplicate.' };

      const nowIso = new Date().toISOString();
      const templateCopyId = createId('template');
      const draftVersionId = createId('tplver');

      const duplicatedTemplate: DocumentTemplate = {
        ...sourceTemplate,
        id: templateCopyId,
        name: `${sourceTemplate.name} Copy`,
        status: 'draft',
        currentPublishedVersionId: undefined,
        currentDraftVersionId: draftVersionId,
        latestVersionNumber: 1,
        isDefaultForInvoice: false,
        isDefaultForQuote: false,
        archivedAt: undefined,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const duplicatedVersion: DocumentTemplateVersion = {
        ...sourceSnapshot,
        id: draftVersionId,
        templateId: templateCopyId,
        versionNumber: 1,
        status: 'draft',
        publishedAt: undefined,
        changeNote: `Duplicated from ${sourceTemplate.name}`,
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        templates: [duplicatedTemplate, ...previous.templates],
        versions: [duplicatedVersion, ...previous.versions],
      }));

      return { ok: true, data: duplicatedTemplate };
    },
    archiveTemplate: (templateId) => {
      const template = state.templates.find((entry) => entry.id === templateId);
      if (!template) return { ok: false, error: 'Template not found.' };
      if (template.status === 'archived') return { ok: true, data: template };

      const nowIso = new Date().toISOString();
      const archivedTemplate: DocumentTemplate = {
        ...template,
        status: 'archived',
        archivedAt: nowIso,
        isDefaultForInvoice: false,
        isDefaultForQuote: false,
        updatedAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        templates: previous.templates.map((entry) =>
          entry.id === template.id ? archivedTemplate : entry,
        ),
      }));

      return { ok: true, data: archivedTemplate };
    },
    setDefaultTemplate: (templateId, documentType) => {
      const template = state.templates.find((entry) => entry.id === templateId);
      if (!template) return { ok: false, error: 'Template not found.' };
      if (template.status === 'archived') return { ok: false, error: 'Archived templates cannot be default.' };
      if (!template.currentPublishedVersionId) {
        return { ok: false, error: 'Only published templates can be set as default.' };
      }
      if (!isTemplateApplicableToDocumentType(template.type, documentType)) {
        return { ok: false, error: 'Template type is not applicable to this document type.' };
      }

      commit((previous) => ({
        ...previous,
        templates: previous.templates.map((entry) => ({
          ...entry,
          isDefaultForQuote:
            documentType === 'quote' ? entry.id === templateId : entry.isDefaultForQuote,
          isDefaultForInvoice:
            documentType === 'invoice' ? entry.id === templateId : entry.isDefaultForInvoice,
        })),
      }));

      const nextTemplate = state.templates.find((entry) => entry.id === templateId) ?? template;
      return { ok: true, data: nextTemplate };
    },
    saveLogoAsset: (input) => {
      const name = input.name.trim();
      const url = input.url.trim();
      if (name.length === 0) return { ok: false, error: 'Logo name is required.' };
      if (url.length === 0) return { ok: false, error: 'Logo URL is required.' };

      const nowIso = new Date().toISOString();
      const logoAsset: LogoAsset = {
        id: createId('logo'),
        name,
        url,
        kind: input.kind ?? 'uploaded',
        createdAt: nowIso,
      };

      commit((previous) => ({
        ...previous,
        logoAssets: [logoAsset, ...previous.logoAssets],
      }));

      return { ok: true, data: logoAsset };
    },
  };

  return <TemplatesContext.Provider value={contextValue}>{children}</TemplatesContext.Provider>;
}

export function useTemplatesContext(): TemplatesContextValue {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error('useTemplatesContext must be used within TemplatesProvider');
  }
  return context;
}

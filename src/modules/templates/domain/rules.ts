import {
  DocumentTemplate,
  DocumentTemplateType,
  DocumentTemplateVersion,
  TemplateAssignmentReference,
  TemplateListRow,
} from './types';

export function isTemplateApplicableToDocumentType(
  templateType: DocumentTemplateType,
  documentType: 'quote' | 'invoice',
): boolean {
  if (templateType === 'universal') return true;
  return templateType === documentType;
}

export function canArchiveTemplate(template: DocumentTemplate): boolean {
  return template.status !== 'archived';
}

export function canPublishTemplate(template: DocumentTemplate): boolean {
  return template.status !== 'archived';
}

export function toTemplateListRow(
  template: DocumentTemplate,
  versions: DocumentTemplateVersion[],
): TemplateListRow {
  const publishedVersion = template.currentPublishedVersionId
    ? versions.find((version) => version.id === template.currentPublishedVersionId)
    : undefined;
  const draftVersion = template.currentDraftVersionId
    ? versions.find((version) => version.id === template.currentDraftVersionId)
    : undefined;

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    type: template.type,
    status: template.status,
    publishedVersionNumber: publishedVersion?.versionNumber,
    draftVersionNumber: draftVersion?.versionNumber,
    updatedAt: template.updatedAt,
    isDefaultForQuote: template.isDefaultForQuote,
    isDefaultForInvoice: template.isDefaultForInvoice,
  };
}

export function getTemplateVersionById(
  versions: DocumentTemplateVersion[],
  versionId?: string,
): DocumentTemplateVersion | undefined {
  if (!versionId) return undefined;
  return versions.find((version) => version.id === versionId);
}

export function getPublishedTemplateAssignments(
  templates: DocumentTemplate[],
  versions: DocumentTemplateVersion[],
  documentType: 'quote' | 'invoice',
): TemplateAssignmentReference[] {
  return templates
    .filter(
      (template) =>
        template.currentPublishedVersionId &&
        template.status !== 'archived' &&
        isTemplateApplicableToDocumentType(template.type, documentType),
    )
    .map((template) => {
      const version = getTemplateVersionById(versions, template.currentPublishedVersionId);
      if (!version) return null;

      return {
        templateId: template.id,
        templateVersionId: version.id,
        templateName: template.name,
        templateVersionNumber: version.versionNumber,
      } satisfies TemplateAssignmentReference;
    })
    .filter((entry): entry is TemplateAssignmentReference => Boolean(entry))
    .sort((a, b) => a.templateName.localeCompare(b.templateName));
}

export function findDefaultAssignmentForDocumentType(
  templates: DocumentTemplate[],
  versions: DocumentTemplateVersion[],
  documentType: 'quote' | 'invoice',
): TemplateAssignmentReference | undefined {
  const defaultTemplate = templates.find((template) =>
    documentType === 'quote' ? template.isDefaultForQuote : template.isDefaultForInvoice,
  );

  if (!defaultTemplate || !defaultTemplate.currentPublishedVersionId) return undefined;

  const version = getTemplateVersionById(versions, defaultTemplate.currentPublishedVersionId);
  if (!version) return undefined;

  return {
    templateId: defaultTemplate.id,
    templateVersionId: version.id,
    templateName: defaultTemplate.name,
    templateVersionNumber: version.versionNumber,
  };
}

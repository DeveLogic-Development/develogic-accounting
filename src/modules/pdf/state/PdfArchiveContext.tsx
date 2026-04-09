import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { clients } from '@/mocks/data';
import { createId } from '@/modules/accounting/domain/id';
import { useAccountingContext } from '@/modules/accounting/state/AccountingContext';
import { useTemplatesContext } from '@/modules/templates/state/TemplatesContext';
import { createPdfArchiveSeedState } from '../data/seed';
import { LocalStoragePdfArchiveRepository } from '../data/localStorageRepository';
import { blobToDataUrl, buildPdfFileMetadata, computeBlobChecksum } from '../domain/file';
import { mapInvoiceToRenderSnapshot, mapQuoteToRenderSnapshot, mapTemplateContextForArchive } from '../domain/mappers';
import { canRegenerateWithoutOverwrite, evaluatePdfGenerationPolicy, getNextPdfRevision, selectLatestPdfRecord } from '../domain/rules';
import {
  PdfArchiveListRow,
  PdfArchiveRecord,
  PdfArchiveState,
  PdfGenerationMode,
  PdfGenerationResult,
  PdfSourceReference,
} from '../domain/types';
import { generatePdfBlob } from '../services/generator';

interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

interface PdfArchiveContextValue {
  state: PdfArchiveState;
  rows: PdfArchiveListRow[];
  getRecordById: (recordId: string) => PdfArchiveRecord | undefined;
  getPdfRecordsForDocument: (input: { documentType: 'quote' | 'invoice'; documentId: string }) => PdfArchiveRecord[];
  getLatestPdfForDocument: (
    input: { documentType: 'quote' | 'invoice'; documentId: string; immutableOnly?: boolean },
  ) => PdfArchiveRecord | undefined;
  generateQuotePdf: (
    quoteId: string,
    input?: { generationMode?: PdfGenerationMode; source?: PdfSourceReference['source'] },
  ) => Promise<PdfGenerationResult>;
  generateInvoicePdf: (
    invoiceId: string,
    input?: { generationMode?: PdfGenerationMode; source?: PdfSourceReference['source'] },
  ) => Promise<PdfGenerationResult>;
  downloadPdfRecord: (recordId: string) => ActionResult;
  openPdfRecord: (recordId: string) => ActionResult;
}

const repository = new LocalStoragePdfArchiveRepository();
const PdfArchiveContext = createContext<PdfArchiveContextValue | undefined>(undefined);

function isPdfArchiveState(value: unknown): value is PdfArchiveState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PdfArchiveState>;
  return Array.isArray(candidate.records);
}

function createInitialState(): PdfArchiveState {
  const loaded = repository.load();
  return isPdfArchiveState(loaded) ? loaded : createPdfArchiveSeedState();
}

function resolveClient(clientId: string): {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
} {
  const client = clients.find((entry) => entry.id === clientId);
  if (!client) {
    return { name: clientId };
  }

  return {
    name: client.name,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
  };
}

export function PdfArchiveProvider({ children }: { children: ReactNode }) {
  const accounting = useAccountingContext();
  const templates = useTemplatesContext();
  const [state, setState] = useState<PdfArchiveState>(createInitialState);

  const commit = (updater: (previous: PdfArchiveState) => PdfArchiveState) => {
    setState((previous) => {
      const next = updater(previous);
      repository.save(next);
      return next;
    });
  };

  const rows = useMemo<PdfArchiveListRow[]>(
    () =>
      state.records
        .map((record) => ({
          id: record.id,
          documentType: record.documentReference.documentType,
          documentId: record.documentReference.documentId,
          documentNumber: record.documentReference.documentNumber,
          documentStatus: record.documentReference.documentStatus,
          clientName: record.snapshot.previewPayload.client.name,
          revision: record.revision,
          generationMode: record.generationMode,
          immutable: record.immutable,
          templateName: record.versionContext.templateName,
          templateVersionNumber: record.versionContext.templateVersionNumber,
          generatedAt: record.generatedAt,
          fileName: record.file.fileName,
          sizeBytes: record.file.sizeBytes,
          checksum: record.file.checksum,
        }))
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt)),
    [state.records],
  );

  const contextValue: PdfArchiveContextValue = {
    state,
    rows,
    getRecordById: (recordId) => state.records.find((record) => record.id === recordId),
    getPdfRecordsForDocument: ({ documentType, documentId }) =>
      state.records
        .filter(
          (record) =>
            record.documentReference.documentType === documentType &&
            record.documentReference.documentId === documentId,
        )
        .sort((a, b) => b.revision - a.revision),
    getLatestPdfForDocument: ({ documentType, documentId, immutableOnly }) =>
      selectLatestPdfRecord(state.records, { documentType, documentId, immutableOnly }),
    generateQuotePdf: async (quoteId, input) => {
      const quote = accounting.getQuoteById(quoteId);
      if (!quote) return { ok: false, error: 'Quote not found.' };
      if (!quote.templateId || !quote.templateVersionId) {
        return { ok: false, error: 'Quote has no template assignment.' };
      }

      const template = templates.getTemplateById(quote.templateId);
      const templateVersion = templates.getTemplateVersionById(quote.templateVersionId);
      if (!template || !templateVersion) {
        return { ok: false, error: 'Quote template version reference is invalid.' };
      }

      const mode = input?.generationMode ?? 'draft_preview';
      const statusPolicy = evaluatePdfGenerationPolicy({
        generationMode: mode,
        documentStatus: quote.status,
      });
      if (!statusPolicy.allowed) return { ok: false, error: statusPolicy.reason };

      const replacePolicy = canRegenerateWithoutOverwrite(state.records, {
        documentType: 'quote',
        documentId: quote.id,
        generationMode: mode,
        source: { source: input?.source ?? 'quote_detail' },
      });
      if (!replacePolicy.allowed) return { ok: false, error: replacePolicy.reason };

      const nowIso = new Date().toISOString();
      const snapshot = mapQuoteToRenderSnapshot({
        quote,
        template,
        templateVersion,
        capturedAt: nowIso,
        client: resolveClient(quote.clientId),
      });

      try {
        const pdfBlob = await generatePdfBlob(snapshot);
        const dataUrl = await blobToDataUrl(pdfBlob);
        const checksum = await computeBlobChecksum(pdfBlob);

        let createdRecord: PdfArchiveRecord | undefined;
        commit((previous) => {
          const revision = getNextPdfRevision(previous.records, {
            documentType: 'quote',
            documentId: quote.id,
          });

          createdRecord = {
            id: createId('pdfrec'),
            revision,
            status: 'generated',
            generationMode: mode,
            immutable: statusPolicy.immutable,
            generatedAt: nowIso,
            source: {
              source: input?.source ?? 'quote_detail',
            },
            documentReference: snapshot.documentReference,
            versionContext: mapTemplateContextForArchive({
              template,
              templateVersion,
            }),
            snapshot,
            file: buildPdfFileMetadata({
              documentType: 'quote',
              documentId: quote.id,
              documentNumber: quote.quoteNumber,
              revision,
              sizeBytes: pdfBlob.size,
              checksum,
              dataUrl,
            }),
          };

          return {
            ...previous,
            records: [createdRecord, ...previous.records],
          };
        });

        if (!createdRecord) {
          return { ok: false, error: 'PDF archive record creation failed.' };
        }

        return { ok: true, data: createdRecord };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Quote PDF generation failed.',
        };
      }
    },
    generateInvoicePdf: async (invoiceId, input) => {
      const invoice = accounting.getInvoiceById(invoiceId);
      if (!invoice) return { ok: false, error: 'Invoice not found.' };
      if (!invoice.templateId || !invoice.templateVersionId) {
        return { ok: false, error: 'Invoice has no template assignment.' };
      }

      const template = templates.getTemplateById(invoice.templateId);
      const templateVersion = templates.getTemplateVersionById(invoice.templateVersionId);
      if (!template || !templateVersion) {
        return { ok: false, error: 'Invoice template version reference is invalid.' };
      }

      const mode = input?.generationMode ?? 'draft_preview';
      const statusPolicy = evaluatePdfGenerationPolicy({
        generationMode: mode,
        documentStatus: invoice.status,
      });
      if (!statusPolicy.allowed) return { ok: false, error: statusPolicy.reason };

      const replacePolicy = canRegenerateWithoutOverwrite(state.records, {
        documentType: 'invoice',
        documentId: invoice.id,
        generationMode: mode,
        source: { source: input?.source ?? 'invoice_detail' },
      });
      if (!replacePolicy.allowed) return { ok: false, error: replacePolicy.reason };

      const nowIso = new Date().toISOString();
      const snapshot = mapInvoiceToRenderSnapshot({
        invoice,
        template,
        templateVersion,
        capturedAt: nowIso,
        payments: accounting.state.payments,
        client: resolveClient(invoice.clientId),
      });

      try {
        const pdfBlob = await generatePdfBlob(snapshot);
        const dataUrl = await blobToDataUrl(pdfBlob);
        const checksum = await computeBlobChecksum(pdfBlob);

        let createdRecord: PdfArchiveRecord | undefined;
        commit((previous) => {
          const revision = getNextPdfRevision(previous.records, {
            documentType: 'invoice',
            documentId: invoice.id,
          });

          createdRecord = {
            id: createId('pdfrec'),
            revision,
            status: 'generated',
            generationMode: mode,
            immutable: statusPolicy.immutable,
            generatedAt: nowIso,
            source: {
              source: input?.source ?? 'invoice_detail',
            },
            documentReference: snapshot.documentReference,
            versionContext: mapTemplateContextForArchive({
              template,
              templateVersion,
            }),
            snapshot,
            file: buildPdfFileMetadata({
              documentType: 'invoice',
              documentId: invoice.id,
              documentNumber: invoice.invoiceNumber,
              revision,
              sizeBytes: pdfBlob.size,
              checksum,
              dataUrl,
            }),
          };

          return {
            ...previous,
            records: [createdRecord, ...previous.records],
          };
        });

        if (!createdRecord) {
          return { ok: false, error: 'PDF archive record creation failed.' };
        }

        return { ok: true, data: createdRecord };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Invoice PDF generation failed.',
        };
      }
    },
    downloadPdfRecord: (recordId) => {
      const record = state.records.find((entry) => entry.id === recordId);
      if (!record) return { ok: false, error: 'PDF record not found.' };
      if (typeof document === 'undefined') return { ok: false, error: 'Download is unavailable in this environment.' };

      const anchor = document.createElement('a');
      anchor.href = record.file.dataUrl;
      anchor.download = record.file.fileName;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      return { ok: true };
    },
    openPdfRecord: (recordId) => {
      const record = state.records.find((entry) => entry.id === recordId);
      if (!record) return { ok: false, error: 'PDF record not found.' };
      if (typeof window === 'undefined') return { ok: false, error: 'Open is unavailable in this environment.' };

      window.open(record.file.dataUrl, '_blank', 'noopener,noreferrer');
      return { ok: true };
    },
  };

  return <PdfArchiveContext.Provider value={contextValue}>{children}</PdfArchiveContext.Provider>;
}

export function usePdfArchiveContext(): PdfArchiveContextValue {
  const context = useContext(PdfArchiveContext);
  if (!context) {
    throw new Error('usePdfArchiveContext must be used within PdfArchiveProvider');
  }
  return context;
}

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { createId } from '@/modules/accounting/domain/id';
import { useAccountingContext } from '@/modules/accounting/state/AccountingContext';
import { useTemplatesContext } from '@/modules/templates/state/TemplatesContext';
import { useNotificationsContext } from '@/modules/notifications/state/NotificationsContext';
import { useBusinessSettings } from '@/modules/settings/hooks/useBusinessSettings';
import { canUseSupabaseRuntimeState, loadRuntimeState, saveRuntimeState } from '@/lib/supabase/runtime-state';
import { useMasterDataContext } from '@/modules/master-data/state/MasterDataContext';
import { createPdfArchiveSeedState } from '../data/seed';
import { LocalStoragePdfArchiveRepository } from '../data/localStorageRepository';
import { blobToDataUrl, buildPdfFileMetadata, computeBlobChecksum, dataUrlToBlob } from '../domain/file';
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
const REMOTE_STATE_KEY = 'pdf_archive';

function isPdfArchiveState(value: unknown): value is PdfArchiveState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PdfArchiveState>;
  return Array.isArray(candidate.records);
}

function createInitialState(): PdfArchiveState {
  const loaded = repository.load();
  return isPdfArchiveState(loaded) ? loaded : createPdfArchiveSeedState();
}

export function PdfArchiveProvider({ children }: { children: ReactNode }) {
  const accounting = useAccountingContext();
  const templates = useTemplatesContext();
  const notifications = useNotificationsContext();
  const businessSettings = useBusinessSettings();
  const masterData = useMasterDataContext();
  const [state, setState] = useState<PdfArchiveState>(createInitialState);
  const [remoteHydrationComplete, setRemoteHydrationComplete] = useState(!canUseSupabaseRuntimeState());

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

  useEffect(() => {
    if (!canUseSupabaseRuntimeState()) return;

    let active = true;
    loadRuntimeState<PdfArchiveState>(REMOTE_STATE_KEY).then((result) => {
      if (!active) return;
      if (result.ok && result.data && isPdfArchiveState(result.data)) {
        setState(result.data);
      }
      setRemoteHydrationComplete(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!remoteHydrationComplete || !canUseSupabaseRuntimeState()) return;
    void saveRuntimeState(REMOTE_STATE_KEY, state);
  }, [remoteHydrationComplete, state]);

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
        businessSettings,
        client: (() => {
          const client = masterData.getClientById(quote.clientId);
          if (!client) return { name: quote.clientId };
          return {
            name: client.name,
            contactName: client.contactName,
            email: client.email,
            phone: client.phone,
          };
        })(),
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

        notifications.notify({
          level: 'success',
          source: 'pdf',
          title: statusPolicy.immutable ? 'Archived PDF Created' : 'Draft PDF Generated',
          message: `${createdRecord.file.fileName} is ready.`,
          persistent: statusPolicy.immutable,
          toast: true,
          route: '/pdf-archive',
          relatedEntityType: 'pdf_archive',
          relatedEntityId: createdRecord.id,
          dedupeKey: `pdf:${createdRecord.documentReference.documentType}:${createdRecord.documentReference.documentId}:v${createdRecord.revision}`,
        });

        return { ok: true, data: createdRecord };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Quote PDF generation failed.';
        notifications.notify({
          level: 'error',
          source: 'pdf',
          title: 'Quote PDF Generation Failed',
          message: errorMessage,
          persistent: true,
          toast: true,
          route: `/quotes/${quote.id}`,
          relatedEntityType: 'quote',
          relatedEntityId: quote.id,
          dedupeKey: `pdf-error:quote:${quote.id}`,
        });

        return {
          ok: false,
          error: errorMessage,
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
        businessSettings,
        payments: accounting.state.payments,
        client: (() => {
          const client = masterData.getClientById(invoice.clientId);
          if (!client) return { name: invoice.clientId };
          return {
            name: client.name,
            contactName: client.contactName,
            email: client.email,
            phone: client.phone,
          };
        })(),
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

        notifications.notify({
          level: 'success',
          source: 'pdf',
          title: statusPolicy.immutable ? 'Archived PDF Created' : 'Draft PDF Generated',
          message: `${createdRecord.file.fileName} is ready.`,
          persistent: statusPolicy.immutable,
          toast: true,
          route: '/pdf-archive',
          relatedEntityType: 'pdf_archive',
          relatedEntityId: createdRecord.id,
          dedupeKey: `pdf:${createdRecord.documentReference.documentType}:${createdRecord.documentReference.documentId}:v${createdRecord.revision}`,
        });

        return { ok: true, data: createdRecord };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invoice PDF generation failed.';
        notifications.notify({
          level: 'error',
          source: 'pdf',
          title: 'Invoice PDF Generation Failed',
          message: errorMessage,
          persistent: true,
          toast: true,
          route: `/invoices/${invoice.id}`,
          relatedEntityType: 'invoice',
          relatedEntityId: invoice.id,
          dedupeKey: `pdf-error:invoice:${invoice.id}`,
        });

        return {
          ok: false,
          error: errorMessage,
        };
      }
    },
    downloadPdfRecord: (recordId) => {
      const record = state.records.find((entry) => entry.id === recordId);
      if (!record) return { ok: false, error: 'PDF record not found.' };
      if (typeof document === 'undefined') return { ok: false, error: 'Download is unavailable in this environment.' };
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return { ok: false, error: 'Download is unavailable on this device.' };
      }

      try {
        const blob = dataUrlToBlob(record.file.dataUrl);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = record.file.fileName;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Failed to prepare PDF download.' };
      }
    },
    openPdfRecord: (recordId) => {
      const record = state.records.find((entry) => entry.id === recordId);
      if (!record) return { ok: false, error: 'PDF record not found.' };
      if (typeof window === 'undefined') return { ok: false, error: 'Open is unavailable in this environment.' };
      if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        return { ok: false, error: 'Open is unavailable on this device.' };
      }

      try {
        const blob = dataUrlToBlob(record.file.dataUrl);
        const objectUrl = URL.createObjectURL(blob);
        const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (!opened) {
          URL.revokeObjectURL(objectUrl);
          return { ok: false, error: 'Popup blocked. Allow popups to open the PDF.' };
        }

        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
        return { ok: true };
      } catch {
        return { ok: false, error: 'Failed to open PDF.' };
      }
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

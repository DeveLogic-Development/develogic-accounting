import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Tabs } from '@/design-system/primitives/Tabs';
import { IconButton } from '@/design-system/primitives/IconButton';
import { StickyActionBar } from '@/design-system/patterns/StickyActionBar';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { mapInvoiceToFormValues } from '@/modules/accounting/domain/mappers';
import { createDefaultInvoiceFormValues, createEmptyLineItem } from '@/modules/accounting/domain/form-defaults';
import { canEditInvoice, deriveDueDateForTerms, getInvoiceTermsLabel, InvoiceTermsCode } from '@/modules/accounting/domain/invoice-rules';
import { validateInvoiceForm } from '@/modules/accounting/domain/validation';
import { InvoiceAddressSnapshot, InvoiceFormValues, InvoiceItemFormValues, ValidationIssue } from '@/modules/accounting/domain/types';
import { FormValidationSummary } from '@/modules/accounting/components/FormValidationSummary';
import { LineItemsEditor } from '@/modules/accounting/components/LineItemsEditor';
import { DocumentTotalsPanel } from '@/modules/accounting/components/DocumentTotalsPanel';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { createId } from '@/modules/accounting/domain/id';
import { formatDate, formatMinorCurrency } from '@/utils/format';

type InvoiceFormTab = 'details' | 'items' | 'notes' | 'attachments';

const FORM_TABS: Array<{ key: InvoiceFormTab; label: string }> = [
  { key: 'details', label: 'Invoice Details' },
  { key: 'items', label: 'Item Table' },
  { key: 'notes', label: 'Notes & Terms' },
  { key: 'attachments', label: 'Attachments' },
];

const AR_ACCOUNT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Accounts Receivable', value: 'accounts_receivable' },
  { label: 'Trade Receivables', value: 'trade_receivables' },
  { label: 'Other Debtors', value: 'other_debtors' },
];

const INVOICE_TERMS_OPTIONS: Array<{ label: string; value: InvoiceTermsCode }> = [
  { label: 'Due on Receipt', value: 'due_on_receipt' },
  { label: 'Net 7', value: 'net_7' },
  { label: 'Net 14', value: 'net_14' },
  { label: 'Net 30', value: 'net_30' },
  { label: 'Net 45', value: 'net_45' },
  { label: 'Net 60', value: 'net_60' },
  { label: 'Custom', value: 'custom' },
];

function getIssueForField(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

function mapClientAddressToSnapshot(
  address:
    | {
      attention?: string;
      line1?: string;
      line2?: string;
      city?: string;
      stateRegion?: string;
      postalCode?: string;
      countryRegion?: string;
    }
    | undefined,
): InvoiceAddressSnapshot | undefined {
  if (!address) return undefined;
  return {
    attention: address.attention,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    stateRegion: address.stateRegion,
    postalCode: address.postalCode,
    countryRegion: address.countryRegion,
  };
}

function formatAddress(snapshot?: InvoiceAddressSnapshot): string {
  if (!snapshot) return 'No address captured yet.';
  const parts = [
    snapshot.attention,
    snapshot.line1,
    snapshot.line2,
    snapshot.city,
    snapshot.stateRegion,
    snapshot.postalCode,
    snapshot.countryRegion,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'No address captured yet.';
}

function parseRecipientInput(value: string): string[] {
  const unique = new Set<string>();
  value
    .split(/[\n,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .forEach((entry) => unique.add(entry));
  return Array.from(unique);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error(`Unable to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function normalizeTermsCode(value?: string): InvoiceTermsCode {
  if (!value) return 'due_on_receipt';
  const allowed = new Set<InvoiceTermsCode>([
    'due_on_receipt',
    'net_7',
    'net_14',
    'net_30',
    'net_45',
    'net_60',
    'custom',
  ]);
  return allowed.has(value as InvoiceTermsCode) ? (value as InvoiceTermsCode) : 'custom';
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(invoiceId);

  const {
    invoiceSummaries,
    getInvoiceById,
    createInvoice,
    updateInvoice,
    duplicateInvoice,
    transitionInvoice,
  } = useAccounting();
  const { clients, getClientById, productsServices } = useMasterData();
  const { getTemplateAssignmentsForDocument, getDefaultTemplateAssignmentForDocument } = useTemplates();
  const { generateInvoicePdf, openPdfRecord } = usePdfArchive();

  const existingInvoice = invoiceId ? getInvoiceById(invoiceId) : undefined;
  const [activeTab, setActiveTab] = useState<InvoiceFormTab>('details');
  const [values, setValues] = useState<InvoiceFormValues>(() =>
    existingInvoice ? mapInvoiceToFormValues(existingInvoice) : createDefaultInvoiceFormValues(),
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [catalogSelectionId, setCatalogSelectionId] = useState('');
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [saveMenuStyle, setSaveMenuStyle] = useState<CSSProperties | null>(null);

  const hydratedVersionRef = useRef<string | null>(null);
  const saveMenuRootRef = useRef<HTMLDivElement | null>(null);
  const saveMenuPopoverRef = useRef<HTMLDivElement | null>(null);

  const templateAssignments = useMemo(
    () => getTemplateAssignmentsForDocument('invoice'),
    [getTemplateAssignmentsForDocument],
  );
  const defaultAssignment = useMemo(
    () => getDefaultTemplateAssignmentForDocument('invoice'),
    [getDefaultTemplateAssignmentForDocument],
  );
  const activeCatalogItems = useMemo(
    () =>
      productsServices
        .filter((item) => item.status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [productsServices],
  );

  useEffect(() => {
    if (!existingInvoice) return;
    const hydrateVersion = `${existingInvoice.id}:${existingInvoice.updatedAt}`;
    if (hydratedVersionRef.current === hydrateVersion) return;
    hydratedVersionRef.current = hydrateVersion;
    setValues(mapInvoiceToFormValues(existingInvoice));
  }, [existingInvoice?.id, existingInvoice?.updatedAt]);

  useEffect(() => {
    if (existingInvoice) return;
    if (values.templateVersionId) return;
    if (!defaultAssignment) return;
    setValues((previous) => ({
      ...previous,
      templateId: defaultAssignment.templateId,
      templateVersionId: defaultAssignment.templateVersionId,
      templateName: defaultAssignment.templateName,
    }));
  }, [defaultAssignment, existingInvoice, values.templateVersionId]);

  useEffect(() => {
    if (existingInvoice) return;
    const clientId = searchParams.get('clientId');
    if (!clientId) return;
    if (!clients.some((client) => client.id === clientId)) return;
    const nextClient = getClientById(clientId);
    setValues((previous) => ({
      ...previous,
      clientId,
      recipientEmails:
        previous.recipientEmails && previous.recipientEmails.length > 0
          ? previous.recipientEmails
          : nextClient?.email
            ? [nextClient.email]
            : [],
      billingAddressSnapshot: previous.billingAddressSnapshot ?? mapClientAddressToSnapshot(nextClient?.billingAddress),
      shippingAddressSnapshot: previous.shippingAddressSnapshot ?? mapClientAddressToSnapshot(nextClient?.shippingAddress),
      paymentTerms: previous.paymentTerms || nextClient?.paymentTerms || previous.paymentTerms,
    }));
  }, [clients, existingInvoice, getClientById, searchParams]);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const updatePopoverPosition = () => {
      if (!saveMenuRootRef.current) return;
      const triggerRect = saveMenuRootRef.current.getBoundingClientRect();
      const menuWidth = 220;
      const estimatedMenuHeight = 170;
      const viewportPadding = 8;
      const top = Math.min(window.innerHeight - estimatedMenuHeight - viewportPadding, triggerRect.bottom + 6);
      const left = Math.max(
        viewportPadding,
        Math.min(window.innerWidth - menuWidth - viewportPadding, triggerRect.right - menuWidth),
      );
      setSaveMenuStyle({
        position: 'fixed',
        top,
        left,
        width: menuWidth,
        zIndex: 140,
      });
    };

    updatePopoverPosition();
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (saveMenuRootRef.current?.contains(target) || saveMenuPopoverRef.current?.contains(target)) return;
      setSaveMenuOpen(false);
    };
    const handleViewportChange = () => updatePopoverPosition();
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [saveMenuOpen]);

  if (isEdit && !existingInvoice) {
    return (
      <EmptyState
        title="Invoice not found"
        description="The invoice may have been deleted or is unavailable."
        action={
          <Link to="/invoices">
            <Button variant="primary">Back to Invoices</Button>
          </Link>
        }
      />
    );
  }

  const editable = !existingInvoice || canEditInvoice(existingInvoice.status).allowed;
  const selectedClient = getClientById(values.clientId);
  const termsCode = normalizeTermsCode(values.terms);

  const title = isEdit ? `Edit ${existingInvoice?.invoiceNumber ?? 'Invoice'}` : 'New Invoice';
  const subtitle = selectedClient
    ? `${selectedClient.displayName} · Invoice Date ${formatDate(values.issueDate)}`
    : 'Create and configure a customer invoice.';

  const templateOptions = useMemo(() => {
    const options = templateAssignments.map((assignment) => ({
      label: `${assignment.templateName} v${assignment.templateVersionNumber}`,
      value: assignment.templateVersionId,
    }));

    if (
      values.templateVersionId &&
      !templateAssignments.some((assignment) => assignment.templateVersionId === values.templateVersionId)
    ) {
      options.unshift({
        label: `Current: ${values.templateName ?? 'Historical Template'}`,
        value: values.templateVersionId,
      });
    }

    return [{ label: 'Select template', value: '' }, ...options];
  }, [templateAssignments, values.templateName, values.templateVersionId]);

  const clientOptions = useMemo(() => {
    const options = clients.map((client) => ({ label: client.displayName, value: client.id }));
    const currentClient = getClientById(values.clientId);
    if (values.clientId && !clients.some((client) => client.id === values.clientId)) {
      options.unshift({
        label: `Current: ${currentClient?.displayName ?? values.clientId}`,
        value: values.clientId,
      });
    }
    return [{ label: 'Select or add a customer', value: '' }, ...options];
  }, [clients, getClientById, values.clientId]);

  const catalogOptions = useMemo(
    () => [
      { label: 'Select an item', value: '' },
      ...activeCatalogItems.map((item) => ({
        label: `${item.name} · ${item.salesRate.toFixed(2)}`,
        value: item.id,
      })),
    ],
    [activeCatalogItems],
  );

  const selectedClientOutstandingMinor = useMemo(
    () =>
      invoiceSummaries
        .filter((summary) => summary.clientId === values.clientId && summary.status !== 'void')
        .reduce((sum, summary) => sum + summary.outstandingMinor, 0),
    [invoiceSummaries, values.clientId],
  );

  const selectedClientInvoicesCount = useMemo(
    () => invoiceSummaries.filter((summary) => summary.clientId === values.clientId).length,
    [invoiceSummaries, values.clientId],
  );

  const getFieldError = (field: string) => getIssueForField(issues, field);

  const applyValues = <K extends keyof InvoiceFormValues>(field: K, nextValue: InvoiceFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const updateClientSelection = (nextClientId: string) => {
    const client = getClientById(nextClientId);
    setValues((previous) => ({
      ...previous,
      clientId: nextClientId,
      recipientEmails:
        previous.recipientEmails && previous.recipientEmails.length > 0
          ? previous.recipientEmails
          : client?.email
            ? [client.email]
            : [],
      billingAddressSnapshot: mapClientAddressToSnapshot(client?.billingAddress),
      shippingAddressSnapshot: mapClientAddressToSnapshot(client?.shippingAddress),
      paymentTerms: previous.paymentTerms || client?.paymentTerms || previous.paymentTerms,
    }));
  };

  const handleIssueDateChange = (nextIssueDate: string) => {
    setValues((previous) => {
      const nextTermsCode = normalizeTermsCode(previous.terms);
      return {
        ...previous,
        issueDate: nextIssueDate,
        dueDate: deriveDueDateForTerms(nextIssueDate, nextTermsCode, previous.dueDate),
      };
    });
  };

  const handleTermsChange = (nextTermsCode: InvoiceTermsCode) => {
    setValues((previous) => ({
      ...previous,
      terms: nextTermsCode,
      dueDate: deriveDueDateForTerms(previous.issueDate, nextTermsCode, previous.dueDate),
      paymentTerms: nextTermsCode === 'custom' ? previous.paymentTerms : getInvoiceTermsLabel(nextTermsCode),
    }));
  };

  const addCatalogItem = (itemId: string) => {
    const selected = activeCatalogItems.find((item) => item.id === itemId);
    if (!selected) {
      setNotice({ tone: 'warning', text: 'Select an item from the catalog first.' });
      return;
    }

    const nextItem: InvoiceItemFormValues = {
      ...(createEmptyLineItem(values.items.length + 1) as InvoiceItemFormValues),
      productServiceId: selected.id,
      itemName: selected.name,
      description: selected.salesDescription || selected.description || '',
      unitPrice: selected.salesRate,
    };

    applyValues('items', [...values.items, nextItem]);
    setCatalogSelectionId('');
    setActiveTab('items');
  };

  const addAllCatalogItemsInBulk = () => {
    if (activeCatalogItems.length === 0) {
      setNotice({ tone: 'warning', text: 'No active items are available to add in bulk.' });
      return;
    }

    const appended = activeCatalogItems.map((item, index) => ({
      ...(createEmptyLineItem(values.items.length + index + 1) as InvoiceItemFormValues),
      productServiceId: item.id,
      itemName: item.name,
      description: item.salesDescription || item.description || '',
      unitPrice: item.salesRate,
    }));
    applyValues('items', [...values.items, ...appended]);
    setActiveTab('items');
    setNotice({ tone: 'success', text: `Added ${appended.length} item rows from catalog.` });
  };

  const validateValues = (): boolean => {
    const result = validateInvoiceForm(values);
    setIssues(result.issues);
    if (!result.isValid) {
      setNotice({ tone: 'error', text: 'Please resolve validation errors before continuing.' });
    }
    return result.isValid;
  };

  const persistInvoiceDraft = () => {
    if (!validateValues()) return null;

    if (isEdit && existingInvoice) {
      const result = updateInvoice(existingInvoice.id, values);
      if (result.ok && result.data) {
        setNotice({ tone: 'success', text: 'Invoice draft saved.' });
        return result.data;
      }
      setNotice({ tone: 'error', text: result.error ?? 'Unable to save invoice.' });
      return null;
    }

    const result = createInvoice(values);
    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: 'Invoice draft created.' });
      return result.data;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to create invoice.' });
    return null;
  };

  const handleSaveDraft = () => {
    const invoice = persistInvoiceDraft();
    if (invoice) navigate(`/invoices/${invoice.id}`);
  };

  const markInvoiceSent = (invoiceIdentifier: string) => {
    const sendResult = transitionInvoice(invoiceIdentifier, 'sent', 'Marked sent from invoice form.');
    if (!sendResult.ok) {
      setNotice({ tone: 'error', text: sendResult.error ?? 'Unable to mark invoice as sent.' });
      return false;
    }
    return true;
  };

  const handleSaveAndSend = () => {
    const invoice = persistInvoiceDraft();
    if (!invoice) return;
    if (!markInvoiceSent(invoice.id)) return;
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSaveAndPrint = async () => {
    const invoice = persistInvoiceDraft();
    if (!invoice) return;
    setIsGeneratingPdf(true);
    const result = await generateInvoicePdf(invoice.id, {
      generationMode: 'draft_preview',
      source: 'invoice_form',
    });
    setIsGeneratingPdf(false);
    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to generate invoice PDF.' });
      return;
    }
    openPdfRecord(result.data.id);
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSaveAndShare = () => {
    const invoice = persistInvoiceDraft();
    if (!invoice) return;
    if (!markInvoiceSent(invoice.id)) return;
    setNotice({ tone: 'success', text: 'Invoice saved and prepared for sharing from invoice detail.' });
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSaveAndSendLater = () => {
    const invoice = persistInvoiceDraft();
    if (!invoice) return;
    setNotice({ tone: 'info', text: 'Invoice saved. You can send it later from the detail screen.' });
    navigate(`/invoices/${invoice.id}`);
  };

  const handleDuplicate = () => {
    if (!existingInvoice) return;
    const result = duplicateInvoice(existingInvoice.id);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}/edit`);
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate invoice.' });
  };

  const handleGenerateDraftPdf = async () => {
    if (!existingInvoice) {
      setNotice({ tone: 'warning', text: 'Save this invoice first, then generate a draft PDF from edit mode.' });
      return;
    }
    setIsGeneratingPdf(true);
    const result = await generateInvoicePdf(existingInvoice.id, {
      generationMode: 'draft_preview',
      source: 'invoice_form',
    });
    setIsGeneratingPdf(false);
    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: `Draft PDF generated: ${result.data.file.fileName}` });
      return;
    }
    setNotice({ tone: 'error', text: result.error ?? 'Unable to generate invoice PDF.' });
  };

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;
    setIsUploadingAttachments(true);
    try {
      const mappedAttachments = await Promise.all(
        files.map(async (file) => ({
          id: createId('iatt'),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl: await readFileAsDataUrl(file),
          createdAt: new Date().toISOString(),
        })),
      );
      applyValues('attachments', [...(values.attachments ?? []), ...mappedAttachments]);
      setNotice({ tone: 'success', text: `${mappedAttachments.length} attachment(s) added to this invoice draft.` });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Unable to upload attachment.',
      });
    } finally {
      setIsUploadingAttachments(false);
      event.target.value = '';
    }
  };

  const removeAttachment = (attachmentId: string) => {
    applyValues(
      'attachments',
      (values.attachments ?? []).filter((attachment) => attachment.id !== attachmentId),
    );
  };

  const recipientInputValue = (values.recipientEmails ?? []).join(', ');

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          editable ? (
            <>
              {isEdit ? (
                <Button variant="secondary" onClick={handleDuplicate}>
                  Duplicate
                </Button>
              ) : null}
              {isEdit ? (
                <Button variant="secondary" onClick={handleGenerateDraftPdf} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? 'Generating PDF...' : 'Generate Draft PDF'}
                </Button>
              ) : null}
              <Button variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
              <div className="dl-row-action-menu" ref={saveMenuRootRef}>
                <Button variant="primary" onClick={handleSaveAndSend}>
                  Save and Send
                </Button>
                <IconButton
                  icon="▾"
                  label="More save actions"
                  className="dl-row-action-trigger"
                  onClick={() => setSaveMenuOpen((previous) => !previous)}
                />
                {saveMenuOpen && saveMenuStyle
                  ? createPortal(
                      <div
                        ref={saveMenuPopoverRef}
                        className="dl-row-action-popover"
                        role="menu"
                        aria-label="Invoice save actions"
                        style={saveMenuStyle}
                      >
                        <button type="button" className="dl-row-action-item" onClick={handleSaveAndPrint}>
                          Save and Print
                        </button>
                        <button type="button" className="dl-row-action-item" onClick={handleSaveAndShare}>
                          Save and Share
                        </button>
                        <button type="button" className="dl-row-action-item" onClick={handleSaveAndSendLater}>
                          Save and Send Later
                        </button>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            </>
          ) : (
            <Button disabled>Only draft invoices can be edited</Button>
          )
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {termsCode !== 'custom' ? (
        <InlineNotice tone="info">
          Due date is calculated from invoice terms. Switch terms to <strong>Custom</strong> to set due date manually.
        </InlineNotice>
      ) : null}
      <FormValidationSummary issues={issues} />

      <div style={{ marginBottom: 12 }}>
        <Tabs tabs={FORM_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as InvoiceFormTab)} />
      </div>

      <div className="dl-split-layout">
        <div style={{ display: 'grid', gap: 16 }}>
          {(activeTab === 'details' || activeTab === 'items') ? (
            <Card title="Invoice Header" subtitle="Customer, numbering, dates, terms, and receivables context">
              <div className="dl-form-grid">
                <Select
                  label="Customer Name"
                  value={values.clientId}
                  onChange={(event) => updateClientSelection(event.target.value)}
                  options={clientOptions}
                  disabled={!editable}
                  helperText={getFieldError('clientId')}
                />
                <Input
                  label="Invoice Number"
                  value={values.invoiceNumber ?? ''}
                  onChange={(event) => applyValues('invoiceNumber', event.target.value)}
                  disabled={!editable}
                  helperText={getFieldError('invoiceNumber')}
                  placeholder="Auto-generated if blank"
                />
                <Input
                  label="Order Number"
                  value={values.orderNumber ?? ''}
                  onChange={(event) => applyValues('orderNumber', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Invoice Date"
                  type="date"
                  value={values.issueDate}
                  onChange={(event) => handleIssueDateChange(event.target.value)}
                  disabled={!editable}
                  helperText={getFieldError('issueDate')}
                />
                <Select
                  label="Terms"
                  value={termsCode}
                  onChange={(event) => handleTermsChange(event.target.value as InvoiceTermsCode)}
                  options={INVOICE_TERMS_OPTIONS.map((option) => ({ label: option.label, value: option.value }))}
                  disabled={!editable}
                  helperText={getFieldError('terms')}
                />
                <Input
                  label="Due Date"
                  type="date"
                  value={values.dueDate}
                  onChange={(event) => applyValues('dueDate', event.target.value)}
                  disabled={!editable || termsCode !== 'custom'}
                  helperText={getFieldError('dueDate')}
                />
                <Select
                  label="Accounts Receivable"
                  value={values.accountsReceivableAccountId ?? ''}
                  onChange={(event) => applyValues('accountsReceivableAccountId', event.target.value)}
                  options={[{ label: 'Select AR account', value: '' }, ...AR_ACCOUNT_OPTIONS]}
                  disabled={!editable}
                  helperText={getFieldError('accountsReceivableAccountId')}
                />
                <Input
                  label="Salesperson"
                  value={values.salesperson ?? ''}
                  onChange={(event) => applyValues('salesperson', event.target.value)}
                  disabled={!editable}
                  placeholder="Select or add salesperson"
                />
                <Input
                  label="Subject"
                  value={values.subject ?? ''}
                  onChange={(event) => applyValues('subject', event.target.value)}
                  disabled={!editable}
                  placeholder="Let your customer know what this invoice is for"
                />
                <Select
                  label="Template"
                  value={values.templateVersionId ?? ''}
                  onChange={(event) => {
                    const selectedVersionId = event.target.value;
                    const selected = templateAssignments.find(
                      (assignment) => assignment.templateVersionId === selectedVersionId,
                    );
                    if (!selected) {
                      applyValues('templateId', undefined);
                      applyValues('templateVersionId', undefined);
                      applyValues('templateName', undefined);
                      return;
                    }
                    applyValues('templateId', selected.templateId);
                    applyValues('templateVersionId', selected.templateVersionId);
                    applyValues('templateName', selected.templateName);
                  }}
                  options={templateOptions}
                  disabled={!editable}
                  helperText={getFieldError('templateVersionId')}
                />
                <Input
                  label="Recipient Emails"
                  value={recipientInputValue}
                  onChange={(event) => applyValues('recipientEmails', parseRecipientInput(event.target.value))}
                  disabled={!editable}
                  placeholder="name@company.com, ap@company.com"
                  helperText={getFieldError('recipientEmails')}
                />
              </div>

              <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
                <div className="dl-card" style={{ padding: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Billing Address Snapshot</strong>
                  <p className="dl-muted" style={{ margin: 0, fontSize: 13 }}>{formatAddress(values.billingAddressSnapshot)}</p>
                </div>
                <div className="dl-card" style={{ padding: 12 }}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>Shipping Address Snapshot</strong>
                  <p className="dl-muted" style={{ margin: 0, fontSize: 13 }}>{formatAddress(values.shippingAddressSnapshot)}</p>
                </div>
              </div>
            </Card>
          ) : null}

          {activeTab === 'items' ? (
            <>
              <Card title="Catalog Quick Add" subtitle="Add one or many rows from active goods and services">
                <div className="dl-inline-actions">
                  <Select
                    value={catalogSelectionId}
                    onChange={(event) => setCatalogSelectionId(event.target.value)}
                    options={catalogOptions}
                    aria-label="Select item from catalog"
                    style={{ width: 320 }}
                    disabled={!editable}
                  />
                  <Button variant="secondary" onClick={() => addCatalogItem(catalogSelectionId)} disabled={!editable || !catalogSelectionId}>
                    Add Item
                  </Button>
                  <Button variant="ghost" onClick={addAllCatalogItemsInBulk} disabled={!editable}>
                    Add Items in Bulk
                  </Button>
                </div>
              </Card>

              <Card title="Item Table" subtitle="Line-level quantities, rates, discounts, and totals">
                <LineItemsEditor
                  items={values.items}
                  onChange={(nextItems) => applyValues('items', nextItems)}
                  createItem={(position) => createEmptyLineItem(position) as InvoiceItemFormValues}
                  getFieldError={getFieldError}
                />
                {getFieldError('items') ? <div className="dl-field-error">{getFieldError('items')}</div> : null}
                <div className="dl-inline-actions" style={{ marginTop: 10 }}>
                  <span className="dl-muted" style={{ fontSize: 12 }}>Account, reporting tags, and project hooks are available from line metadata integrations.</span>
                </div>
              </Card>
            </>
          ) : null}

          {activeTab === 'notes' ? (
            <Card title="Notes, Terms, and Billing Context">
              <div style={{ display: 'grid', gap: 12 }}>
                <Textarea
                  label="Customer Notes"
                  value={values.notes}
                  onChange={(event) => applyValues('notes', event.target.value)}
                  disabled={!editable}
                />
                <Textarea
                  label="Terms & Conditions"
                  value={values.termsAndConditions ?? ''}
                  onChange={(event) => applyValues('termsAndConditions', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Payment Terms Label"
                  value={values.paymentTerms}
                  onChange={(event) => applyValues('paymentTerms', event.target.value)}
                  disabled={!editable}
                />
                <Textarea
                  label="Internal Memo"
                  value={values.internalMemo}
                  onChange={(event) => applyValues('internalMemo', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Adjustment"
                  type="number"
                  step="0.01"
                  value={values.adjustment ?? 0}
                  onChange={(event) => applyValues('adjustment', Number(event.target.value))}
                  disabled={!editable}
                  helperText={getFieldError('adjustment')}
                />
                <Input
                  label="Document Discount %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={values.documentDiscountPercent}
                  onChange={(event) => applyValues('documentDiscountPercent', Number(event.target.value))}
                  disabled={!editable}
                  helperText={getFieldError('documentDiscountPercent')}
                />
              </div>
              <div className="dl-divider" />
              <p className="dl-muted" style={{ margin: 0 }}>
                Want to get paid faster? Configure online payment gateways to collect invoice payments directly.
              </p>
            </Card>
          ) : null}

          {activeTab === 'attachments' ? (
            <Card title="Invoice Attachments" subtitle="Attachments stay linked to this invoice for send and archive workflows">
              <div className="dl-inline-actions" style={{ marginBottom: 12 }}>
                <input
                  type="file"
                  id="invoice-attachments-upload"
                  multiple
                  onChange={(event) => void handleAttachmentUpload(event)}
                  disabled={!editable || isUploadingAttachments}
                  style={{ display: 'none' }}
                />
                <label htmlFor="invoice-attachments-upload">
                  <Button type="button" variant="secondary" disabled={!editable || isUploadingAttachments}>
                    {isUploadingAttachments ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </label>
                <span className="dl-muted" style={{ fontSize: 12 }}>Up to 10 files, 10MB each recommended.</span>
              </div>
              {(values.attachments ?? []).length === 0 ? (
                <p className="dl-muted" style={{ margin: 0 }}>No attachments added yet.</p>
              ) : (
                <div className="dl-card-list">
                  {(values.attachments ?? []).map((attachment) => (
                    <div key={attachment.id} className="dl-card-list-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <strong>{attachment.fileName}</strong>
                          <div className="dl-muted" style={{ fontSize: 12 }}>
                            {(attachment.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                        {editable ? (
                          <Button size="sm" variant="ghost" onClick={() => removeAttachment(attachment.id)}>
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <DocumentTotalsPanel
            items={values.items}
            documentDiscountPercent={values.documentDiscountPercent}
            adjustment={values.adjustment ?? 0}
          />

          <Card title="Customer Context">
            {selectedClient ? (
              <div className="dl-meta-grid">
                <div><strong>{selectedClient.displayName}</strong></div>
                <div className="dl-muted">{selectedClient.email || 'No email on file'}</div>
                <div className="dl-muted">{selectedClient.phone || 'No phone on file'}</div>
                <div>Outstanding Receivables: <strong>{formatMinorCurrency(selectedClientOutstandingMinor)}</strong></div>
                <div>Unused Credits: <strong>{formatMinorCurrency(Math.round((selectedClient.unusedCredits ?? 0) * 100))}</strong></div>
                <div>Customer Type: <strong>{selectedClient.customerType}</strong></div>
                <div>Currency: <strong>{selectedClient.currencyCode || 'ZAR'}</strong></div>
                <div>Customer Payment Terms: <strong>{selectedClient.paymentTerms || 'Not set'}</strong></div>
                <div>Portal Status: <strong>{selectedClient.portalEnabled ? 'Enabled' : 'Disabled'}</strong></div>
                <div>Language: <strong>{selectedClient.customerLanguage || 'English'}</strong></div>
                <div>Contact Persons: <strong>{selectedClient.contactPersons.length}</strong></div>
                <div>Customer Invoices: <strong>{selectedClientInvoicesCount}</strong></div>
                <Link to={`/clients/${selectedClient.id}`}>
                  <Button size="sm" variant="secondary">View in Customers Module</Button>
                </Link>
              </div>
            ) : (
              <p className="dl-muted" style={{ margin: 0 }}>
                Select a customer to view receivables and account context while invoicing.
              </p>
            )}
          </Card>

          <Card title="Workflow Actions">
            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={!editable}>Save Draft</Button>
              <Button variant="primary" onClick={handleSaveAndSend} disabled={!editable}>Save and Send</Button>
              <Button variant="ghost" onClick={handleSaveAndSendLater} disabled={!editable}>Save and Send Later</Button>
              <Button variant="ghost" onClick={handleSaveAndPrint} disabled={!editable || isGeneratingPdf}>
                {isGeneratingPdf ? 'Generating PDF...' : 'Save and Print'}
              </Button>
              <Link to={isEdit ? `/invoices/${existingInvoice?.id}` : '/invoices'}>
                <Button variant="ghost">Cancel</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {editable ? (
        <StickyActionBar>
          <Button variant="secondary" onClick={handleSaveDraft}>Save Draft</Button>
          <Button variant="primary" onClick={handleSaveAndSend}>Save and Send</Button>
        </StickyActionBar>
      ) : null}
    </>
  );
}

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { StickyActionBar } from '@/design-system/patterns/StickyActionBar';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { Tabs } from '@/design-system/primitives/Tabs';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { mapQuoteToFormValues } from '@/modules/accounting/domain/mappers';
import { createDefaultQuoteFormValues, createEmptyLineItem } from '@/modules/accounting/domain/form-defaults';
import { canEditQuote } from '@/modules/accounting/domain/quote-rules';
import { validateQuoteForm } from '@/modules/accounting/domain/validation';
import { QuoteAddressSnapshot, QuoteFormValues, QuoteItemFormValues, ValidationIssue } from '@/modules/accounting/domain/types';
import { FormValidationSummary } from '@/modules/accounting/components/FormValidationSummary';
import { LineItemsEditor } from '@/modules/accounting/components/LineItemsEditor';
import { DocumentTotalsPanel } from '@/modules/accounting/components/DocumentTotalsPanel';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { createId } from '@/modules/accounting/domain/id';
import { formatDate } from '@/utils/format';

type QuoteFormTab = 'details' | 'items' | 'notes' | 'attachments';

const FORM_TABS: Array<{ key: QuoteFormTab; label: string }> = [
  { key: 'details', label: 'Quote Details' },
  { key: 'items', label: 'Item Table' },
  { key: 'notes', label: 'Notes & Terms' },
  { key: 'attachments', label: 'Attachments' },
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
): QuoteAddressSnapshot | undefined {
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

function formatAddress(snapshot?: QuoteAddressSnapshot): string {
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

export function QuoteFormPage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(quoteId);

  const {
    getQuoteById,
    createQuote,
    updateQuote,
    duplicateQuote,
    transitionQuote,
  } = useAccounting();
  const { clients, getClientById, productsServices } = useMasterData();
  const { getTemplateAssignmentsForDocument, getDefaultTemplateAssignmentForDocument } = useTemplates();
  const { generateQuotePdf } = usePdfArchive();

  const existingQuote = quoteId ? getQuoteById(quoteId) : undefined;

  const [activeTab, setActiveTab] = useState<QuoteFormTab>('details');
  const [values, setValues] = useState<QuoteFormValues>(() =>
    existingQuote ? mapQuoteToFormValues(existingQuote) : createDefaultQuoteFormValues(),
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [catalogSelectionId, setCatalogSelectionId] = useState('');
  const hydratedVersionRef = useRef<string | null>(null);

  const templateAssignments = useMemo(
    () => getTemplateAssignmentsForDocument('quote'),
    [getTemplateAssignmentsForDocument],
  );
  const defaultAssignment = useMemo(
    () => getDefaultTemplateAssignmentForDocument('quote'),
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
    if (!existingQuote) return;

    // Avoid wiping in-progress edits on every render.
    const hydrateVersion = `${existingQuote.id}:${existingQuote.updatedAt}`;
    if (hydratedVersionRef.current === hydrateVersion) return;
    hydratedVersionRef.current = hydrateVersion;
    setValues(mapQuoteToFormValues(existingQuote));
  }, [existingQuote?.id, existingQuote?.updatedAt]);

  useEffect(() => {
    if (existingQuote) return;
    if (values.templateVersionId) return;
    if (!defaultAssignment) return;

    setValues((previous) => ({
      ...previous,
      templateId: defaultAssignment.templateId,
      templateVersionId: defaultAssignment.templateVersionId,
      templateName: defaultAssignment.templateName,
    }));
  }, [defaultAssignment, existingQuote, values.templateVersionId]);

  useEffect(() => {
    if (existingQuote) return;
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
      billingAddressSnapshot:
        previous.billingAddressSnapshot ?? mapClientAddressToSnapshot(nextClient?.billingAddress),
      shippingAddressSnapshot:
        previous.shippingAddressSnapshot ?? mapClientAddressToSnapshot(nextClient?.shippingAddress),
    }));
  }, [clients, existingQuote, getClientById, searchParams]);

  if (isEdit && !existingQuote) {
    return (
      <EmptyState
        title="Quote not found"
        description="The quote may have been deleted or is unavailable."
        action={
          <Link to="/quotes">
            <Button variant="primary">Back to Quotes</Button>
          </Link>
        }
      />
    );
  }

  const editable = !existingQuote || canEditQuote(existingQuote.status).allowed;
  const selectedClient = getClientById(values.clientId);

  const title = isEdit ? `Edit ${existingQuote?.quoteNumber ?? 'Quote'}` : 'New Quote';
  const subtitle = selectedClient
    ? `${selectedClient.displayName} · Quote date ${formatDate(values.issueDate)}`
    : 'Create and configure a customer quotation.';

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

  const getFieldError = (field: string) => getIssueForField(issues, field);

  const applyValues = <K extends keyof QuoteFormValues>(field: K, nextValue: QuoteFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const updateClientSelection = (nextClientId: string) => {
    const client = getClientById(nextClientId);
    setValues((previous) => {
      const nextRecipients = previous.recipientEmails && previous.recipientEmails.length > 0
        ? previous.recipientEmails
        : client?.email
          ? [client.email]
          : [];

      return {
        ...previous,
        clientId: nextClientId,
        paymentTerms: previous.paymentTerms || client?.paymentTerms || previous.paymentTerms,
        recipientEmails: nextRecipients,
        billingAddressSnapshot: mapClientAddressToSnapshot(client?.billingAddress),
        shippingAddressSnapshot: mapClientAddressToSnapshot(client?.shippingAddress),
      };
    });
  };

  const addCatalogItem = (itemId: string) => {
    const selected = activeCatalogItems.find((item) => item.id === itemId);
    if (!selected) {
      setNotice({ tone: 'warning', text: 'Select an item from the catalog first.' });
      return;
    }

    const nextItem: QuoteItemFormValues = {
      ...createEmptyLineItem(values.items.length + 1),
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
      setNotice({ tone: 'warning', text: 'No active catalog items are available to add in bulk.' });
      return;
    }

    const appended = activeCatalogItems.map((item, index) => ({
      ...createEmptyLineItem(values.items.length + index + 1),
      productServiceId: item.id,
      itemName: item.name,
      description: item.salesDescription || item.description || '',
      unitPrice: item.salesRate,
    }));
    applyValues('items', [...values.items, ...appended]);
    setActiveTab('items');
    setNotice({ tone: 'success', text: `Added ${appended.length} items from catalog.` });
  };

  const validateValues = (): boolean => {
    const result = validateQuoteForm(values);
    setIssues(result.issues);
    if (!result.isValid) {
      setNotice({ tone: 'error', text: 'Please resolve validation errors before continuing.' });
    }
    return result.isValid;
  };

  const saveDraft = (): string | null => {
    if (!validateValues()) return null;

    if (isEdit && existingQuote) {
      const result = updateQuote(existingQuote.id, values);
      if (result.ok && result.data) {
        setNotice({ tone: 'success', text: 'Quote draft saved.' });
        return result.data.id;
      }

      setNotice({ tone: 'error', text: result.error ?? 'Unable to save quote.' });
      return null;
    }

    const result = createQuote(values);
    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: 'Quote draft created.' });
      return result.data.id;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to create quote.' });
    return null;
  };

  const handleSaveDraft = () => {
    const quoteIdentifier = saveDraft();
    if (quoteIdentifier) {
      navigate(`/quotes/${quoteIdentifier}`);
    }
  };

  const handleSaveAndMarkSent = () => {
    const quoteIdentifier = saveDraft();
    if (!quoteIdentifier) return;

    const transitionResult = transitionQuote(quoteIdentifier, 'sent', 'Marked sent from quote form.');
    if (!transitionResult.ok) {
      setNotice({ tone: 'error', text: transitionResult.error ?? 'Unable to mark quote as sent.' });
      return;
    }

    navigate(`/quotes/${quoteIdentifier}`);
  };

  const handleDuplicate = () => {
    if (!existingQuote) return;
    const result = duplicateQuote(existingQuote.id);
    if (result.ok && result.data) {
      navigate(`/quotes/${result.data.id}/edit`);
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to duplicate quote.' });
  };

  const handleGenerateDraftPdf = async () => {
    if (!existingQuote) {
      setNotice({ tone: 'warning', text: 'Save this quote first, then generate a draft PDF from edit mode.' });
      return;
    }

    setIsGeneratingPdf(true);
    const result = await generateQuotePdf(existingQuote.id, {
      generationMode: 'draft_preview',
      source: 'quote_form',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setNotice({ tone: 'success', text: `Draft PDF generated: ${result.data.file.fileName}` });
      return;
    }

    setNotice({ tone: 'error', text: result.error ?? 'Unable to generate quote PDF.' });
  };

  const handleAttachmentUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setIsUploadingAttachments(true);
    try {
      const mappedAttachments = await Promise.all(
        files.map(async (file) => ({
          id: createId('qatt'),
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl: await readFileAsDataUrl(file),
          createdAt: new Date().toISOString(),
        })),
      );
      applyValues('attachments', [...(values.attachments ?? []), ...mappedAttachments]);
      setNotice({ tone: 'success', text: `${mappedAttachments.length} attachment(s) added to this quote draft.` });
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
    <div className="dl-quote-form-page dl-document-form-page">
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
              <Button variant="secondary" onClick={handleSaveDraft}>
                Save Draft
              </Button>
              <Button variant="primary" onClick={handleSaveAndMarkSent}>
                Save and Mark as Sent
              </Button>
            </>
          ) : (
            <Button disabled>Only draft quotes can be edited</Button>
          )
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      <FormValidationSummary issues={issues} />

      <div className="dl-document-tabs-wrap">
        <Tabs tabs={FORM_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as QuoteFormTab)} />
      </div>

      <div className="dl-split-layout dl-document-form-layout">
        <div style={{ display: 'grid', gap: 16 }}>
          {(activeTab === 'details' || activeTab === 'items') && (
            <Card title="Quote Header" subtitle="Customer, dates, numbering, and sales context">
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
                  label="Quote Number"
                  value={values.quoteNumber ?? ''}
                  onChange={(event) => applyValues('quoteNumber', event.target.value)}
                  disabled={!editable}
                  helperText={getFieldError('quoteNumber')}
                  placeholder="Auto-generated if blank"
                />
                <Input
                  label="Reference Number"
                  value={values.referenceNumber ?? ''}
                  onChange={(event) => applyValues('referenceNumber', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Quote Date"
                  type="date"
                  value={values.issueDate}
                  onChange={(event) => applyValues('issueDate', event.target.value)}
                  disabled={!editable}
                  helperText={getFieldError('issueDate')}
                />
                <Input
                  label="Expiry Date"
                  type="date"
                  value={values.expiryDate}
                  onChange={(event) => applyValues('expiryDate', event.target.value)}
                  disabled={!editable}
                  helperText={getFieldError('expiryDate')}
                />
                <Input
                  label="Salesperson"
                  value={values.salesperson ?? ''}
                  onChange={(event) => applyValues('salesperson', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Project Name"
                  value={values.projectName ?? ''}
                  onChange={(event) => applyValues('projectName', event.target.value)}
                  disabled={!editable}
                />
                <Input
                  label="Subject"
                  value={values.subject ?? ''}
                  onChange={(event) => applyValues('subject', event.target.value)}
                  disabled={!editable}
                  placeholder="Let your customer know what this quote is for"
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
                  placeholder="name@company.com, finance@company.com"
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
          )}

          {activeTab === 'items' && (
            <>
              <Card title="Catalog Quick Add" subtitle="Add one or many item rows from your accounting catalog">
                <div className="dl-inline-actions">
                  <Select
                    value={catalogSelectionId}
                    onChange={(event) => setCatalogSelectionId(event.target.value)}
                    options={catalogOptions}
                    aria-label="Select catalog item"
                    style={{ width: 'min(320px, 100%)' }}
                    disabled={!editable}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => addCatalogItem(catalogSelectionId)}
                    disabled={!editable || !catalogSelectionId}
                  >
                    Add Item
                  </Button>
                  <Button variant="ghost" onClick={addAllCatalogItemsInBulk} disabled={!editable}>
                    Add Items in Bulk
                  </Button>
                </div>
              </Card>

              <Card title="Item Table" subtitle="Item details, quantities, rates, and line-level discounts">
                <LineItemsEditor
                  items={values.items}
                  onChange={(nextItems) => applyValues('items', nextItems)}
                  createItem={createEmptyLineItem}
                  getFieldError={getFieldError}
                />
                {getFieldError('items') ? <div className="dl-field-error">{getFieldError('items')}</div> : null}
              </Card>
            </>
          )}

          {activeTab === 'notes' && (
            <Card title="Notes, Terms, and Preferences">
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
            </Card>
          )}

          {activeTab === 'attachments' && (
            <Card title="Quote Attachments" subtitle="Attachments are linked to this quote and visible in detail view">
              <div className="dl-inline-actions" style={{ marginBottom: 12 }}>
                <input
                  type="file"
                  id="quote-attachments-upload"
                  multiple
                  onChange={(event) => void handleAttachmentUpload(event)}
                  disabled={!editable || isUploadingAttachments}
                  style={{ display: 'none' }}
                />
                <label htmlFor="quote-attachments-upload">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!editable || isUploadingAttachments}
                  >
                    {isUploadingAttachments ? 'Uploading...' : 'Upload Files'}
                  </Button>
                </label>
                <span className="dl-muted" style={{ fontSize: 12 }}>
                  Up to 10 files, 10MB each recommended.
                </span>
              </div>
              {(values.attachments ?? []).length === 0 ? (
                <p className="dl-muted" style={{ margin: 0 }}>No attachments added yet.</p>
              ) : (
                <div className="dl-card-list">
                  {(values.attachments ?? []).map((attachment) => (
                    <div key={attachment.id} className="dl-card-list-item">
                      <div className="dl-responsive-split-row">
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
          )}
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <DocumentTotalsPanel
            items={values.items}
            documentDiscountPercent={values.documentDiscountPercent}
            adjustment={values.adjustment ?? 0}
          />

          <Card title="Workflow Actions">
            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={!editable}>
                Save Draft
              </Button>
              <Button variant="primary" onClick={handleSaveAndMarkSent} disabled={!editable}>
                Save and Mark as Sent
              </Button>
              {isEdit ? (
                <Button variant="ghost" onClick={handleGenerateDraftPdf} disabled={!editable || isGeneratingPdf}>
                  {isGeneratingPdf ? 'Generating PDF...' : 'Generate Draft PDF'}
                </Button>
              ) : null}
              <Link to={isEdit ? `/quotes/${existingQuote?.id}` : '/quotes'}>
                <Button variant="ghost">Cancel</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {editable ? (
        <StickyActionBar>
          <Button variant="secondary" onClick={handleSaveDraft}>
            Save Draft
          </Button>
          <Button variant="primary" onClick={handleSaveAndMarkSent}>
            Save and Mark as Sent
          </Button>
        </StickyActionBar>
      ) : null}
    </div>
  );
}

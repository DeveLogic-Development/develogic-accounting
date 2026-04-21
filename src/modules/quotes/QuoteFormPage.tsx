import { useEffect, useMemo, useState } from 'react';
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
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { mapQuoteToFormValues } from '@/modules/accounting/domain/mappers';
import {
  createDefaultQuoteFormValues,
  createEmptyLineItem,
} from '@/modules/accounting/domain/form-defaults';
import { canEditQuote } from '@/modules/accounting/domain/quote-rules';
import { validateQuoteForm } from '@/modules/accounting/domain/validation';
import { QuoteFormValues, ValidationIssue } from '@/modules/accounting/domain/types';
import { FormValidationSummary } from '@/modules/accounting/components/FormValidationSummary';
import { LineItemsEditor } from '@/modules/accounting/components/LineItemsEditor';
import { DocumentTotalsPanel } from '@/modules/accounting/components/DocumentTotalsPanel';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';

function getIssueForField(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

export function QuoteFormPage() {
  const navigate = useNavigate();
  const { quoteId } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(quoteId);

  const { getQuoteById, createQuote, updateQuote, duplicateQuote, transitionQuote } = useAccounting();
  const { clients, getClientById } = useMasterData();
  const { getTemplateAssignmentsForDocument, getDefaultTemplateAssignmentForDocument } = useTemplates();
  const { generateQuotePdf } = usePdfArchive();

  const existingQuote = quoteId ? getQuoteById(quoteId) : undefined;

  const [values, setValues] = useState<QuoteFormValues>(() =>
    existingQuote ? mapQuoteToFormValues(existingQuote) : createDefaultQuoteFormValues(),
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const templateAssignments = useMemo(
    () => getTemplateAssignmentsForDocument('quote'),
    [getTemplateAssignmentsForDocument],
  );
  const defaultAssignment = useMemo(
    () => getDefaultTemplateAssignmentForDocument('quote'),
    [getDefaultTemplateAssignmentForDocument],
  );

  useEffect(() => {
    if (existingQuote) {
      setValues(mapQuoteToFormValues(existingQuote));
    }
  }, [existingQuote]);

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

    setValues((previous) => ({
      ...previous,
      clientId,
    }));
  }, [clients, existingQuote, searchParams]);

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

  const title = isEdit ? `Edit ${existingQuote?.quoteNumber ?? 'Quote'}` : 'Create Quote';

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
    const options = clients.map((client) => ({ label: client.name, value: client.id }));
    const currentClient = getClientById(values.clientId);
    if (values.clientId && !clients.some((client) => client.id === values.clientId)) {
      options.unshift({
        label: `Current: ${currentClient?.name ?? values.clientId}`,
        value: values.clientId,
      });
    }
    return [{ label: 'Select client', value: '' }, ...options];
  }, [clients, getClientById, values.clientId]);

  const getFieldError = (field: string) => getIssueForField(issues, field);

  const applyValues = <K extends keyof QuoteFormValues>(field: K, nextValue: QuoteFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
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

  const handleSendQuote = () => {
    const quoteIdentifier = saveDraft();
    if (!quoteIdentifier) return;

    const transitionResult = transitionQuote(quoteIdentifier, 'sent');
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

  return (
    <>
      <PageHeader
        title={title}
        subtitle="Build and review a quote with reusable line items and template styling."
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
              <Button variant="primary" onClick={handleSendQuote}>
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

      <div className="dl-split-layout">
        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="Quote Details" subtitle="Client, dates, and document settings">
            <div className="dl-form-grid">
              <Select
                label="Client"
                value={values.clientId}
                onChange={(event) => applyValues('clientId', event.target.value)}
                options={clientOptions}
                disabled={!editable}
                helperText={getFieldError('clientId')}
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
                label="Issue Date"
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

          <Card title="Line Items" subtitle="Add products/services and define pricing">
            <LineItemsEditor
              items={values.items}
              onChange={(nextItems) => applyValues('items', nextItems)}
              createItem={createEmptyLineItem}
              getFieldError={getFieldError}
            />
            {getFieldError('items') ? <div className="dl-field-error">{getFieldError('items')}</div> : null}
          </Card>

          <Card title="Notes & Terms">
            <div style={{ display: 'grid', gap: 12 }}>
              <Textarea
                label="Client Notes"
                value={values.notes}
                onChange={(event) => applyValues('notes', event.target.value)}
                disabled={!editable}
              />
              <Textarea
                label="Payment Terms"
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
            </div>
          </Card>
        </div>

        <div style={{ display: 'grid', gap: 16 }}>
          <DocumentTotalsPanel items={values.items} documentDiscountPercent={values.documentDiscountPercent} />
          <Card title="Actions">
            <div style={{ display: 'grid', gap: 10 }}>
              <Button variant="secondary" onClick={handleSaveDraft} disabled={!editable}>
                Save Draft
              </Button>
              <Button variant="primary" onClick={handleSendQuote} disabled={!editable}>
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
          <Button variant="primary" onClick={handleSendQuote}>
            Save and Mark as Sent
          </Button>
        </StickyActionBar>
      ) : null}
    </>
  );
}

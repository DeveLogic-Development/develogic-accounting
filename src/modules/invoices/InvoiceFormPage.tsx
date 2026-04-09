import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { clients } from '@/mocks/data';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { StickyActionBar } from '@/design-system/patterns/StickyActionBar';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { mapInvoiceToFormValues } from '@/modules/accounting/domain/mappers';
import {
  createDefaultInvoiceFormValues,
  createEmptyLineItem,
} from '@/modules/accounting/domain/form-defaults';
import { canEditInvoice } from '@/modules/accounting/domain/invoice-rules';
import { validateInvoiceForm } from '@/modules/accounting/domain/validation';
import { InvoiceFormValues, ValidationIssue } from '@/modules/accounting/domain/types';
import { FormValidationSummary } from '@/modules/accounting/components/FormValidationSummary';
import { LineItemsEditor } from '@/modules/accounting/components/LineItemsEditor';
import { DocumentTotalsPanel } from '@/modules/accounting/components/DocumentTotalsPanel';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';

function getIssueForField(issues: ValidationIssue[], field: string): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { invoiceId } = useParams();
  const isEdit = Boolean(invoiceId);

  const {
    getInvoiceById,
    createInvoice,
    updateInvoice,
    duplicateInvoice,
    transitionInvoice,
  } = useAccounting();
  const { getTemplateAssignmentsForDocument, getDefaultTemplateAssignmentForDocument } = useTemplates();
  const { generateInvoicePdf } = usePdfArchive();

  const existingInvoice = invoiceId ? getInvoiceById(invoiceId) : undefined;

  const [values, setValues] = useState<InvoiceFormValues>(() =>
    existingInvoice ? mapInvoiceToFormValues(existingInvoice) : createDefaultInvoiceFormValues(),
  );
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const templateAssignments = useMemo(
    () => getTemplateAssignmentsForDocument('invoice'),
    [getTemplateAssignmentsForDocument],
  );
  const defaultAssignment = useMemo(
    () => getDefaultTemplateAssignmentForDocument('invoice'),
    [getDefaultTemplateAssignmentForDocument],
  );

  useEffect(() => {
    if (existingInvoice) {
      setValues(mapInvoiceToFormValues(existingInvoice));
    }
  }, [existingInvoice]);

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

  const title = isEdit ? `Edit ${existingInvoice?.invoiceNumber ?? 'Invoice'}` : 'Create Invoice';

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

  const getFieldError = (field: string) => getIssueForField(issues, field);

  const applyValues = <K extends keyof InvoiceFormValues>(field: K, nextValue: InvoiceFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const validateValues = (): boolean => {
    const result = validateInvoiceForm(values);
    setIssues(result.issues);
    if (!result.isValid) {
      setMessage('Please resolve validation errors before continuing.');
    }
    return result.isValid;
  };

  const saveDraft = (): string | null => {
    if (!validateValues()) return null;

    if (isEdit && existingInvoice) {
      const result = updateInvoice(existingInvoice.id, values);
      if (result.ok && result.data) {
        setMessage('Invoice draft saved.');
        return result.data.id;
      }

      setMessage(result.error ?? 'Unable to save invoice.');
      return null;
    }

    const result = createInvoice(values);
    if (result.ok && result.data) {
      setMessage('Invoice draft created.');
      return result.data.id;
    }

    setMessage(result.error ?? 'Unable to create invoice.');
    return null;
  };

  const handleSaveDraft = () => {
    const invoiceIdentifier = saveDraft();
    if (invoiceIdentifier) {
      navigate(`/invoices/${invoiceIdentifier}`);
    }
  };

  const handleSendInvoice = () => {
    const invoiceIdentifier = saveDraft();
    if (!invoiceIdentifier) return;

    const approveResult = transitionInvoice(invoiceIdentifier, 'approved');
    if (!approveResult.ok) {
      setMessage(approveResult.error ?? 'Unable to approve invoice before sending.');
      return;
    }

    const sendResult = transitionInvoice(invoiceIdentifier, 'sent');
    if (!sendResult.ok) {
      setMessage(sendResult.error ?? 'Unable to mark invoice as sent.');
      return;
    }

    navigate(`/invoices/${invoiceIdentifier}`);
  };

  const handleDuplicate = () => {
    if (!existingInvoice) return;
    const result = duplicateInvoice(existingInvoice.id);
    if (result.ok && result.data) {
      navigate(`/invoices/${result.data.id}/edit`);
      return;
    }

    setMessage(result.error ?? 'Unable to duplicate invoice.');
  };

  const handleGenerateDraftPdf = async () => {
    if (!existingInvoice) {
      setMessage('Save this invoice first, then generate a draft PDF from edit mode.');
      return;
    }

    setIsGeneratingPdf(true);
    const result = await generateInvoicePdf(existingInvoice.id, {
      generationMode: 'draft_preview',
      source: 'invoice_form',
    });
    setIsGeneratingPdf(false);

    if (result.ok && result.data) {
      setMessage(`Draft PDF generated: ${result.data.file.fileName}`);
      return;
    }

    setMessage(result.error ?? 'Unable to generate invoice PDF.');
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle="Build and issue an invoice with payment terms and delivery controls."
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
              <Button variant="primary" onClick={handleSendInvoice}>
                Save, Approve & Send
              </Button>
            </>
          ) : (
            <Button disabled>Only draft invoices can be edited</Button>
          )
        }
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}
      <FormValidationSummary issues={issues} />

      <div className="dl-split-layout">
        <div style={{ display: 'grid', gap: 16 }}>
          <Card title="Invoice Details" subtitle="Client, dates, and numbering">
            <div className="dl-form-grid">
              <Select
                label="Client"
                value={values.clientId}
                onChange={(event) => applyValues('clientId', event.target.value)}
                options={[
                  { label: 'Select client', value: '' },
                  ...clients.map((client) => ({ label: client.name, value: client.id })),
                ]}
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
                label="Due Date"
                type="date"
                value={values.dueDate}
                onChange={(event) => applyValues('dueDate', event.target.value)}
                disabled={!editable}
                helperText={getFieldError('dueDate')}
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
              createItem={(position) => createEmptyLineItem(position)}
              getFieldError={getFieldError}
            />
            {getFieldError('items') ? <div className="dl-field-error">{getFieldError('items')}</div> : null}
          </Card>

          <Card title="Terms & Internal Notes">
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
              <Button variant="primary" onClick={handleSendInvoice} disabled={!editable}>
                Save, Approve & Send
              </Button>
              {isEdit ? (
                <Button variant="ghost" onClick={handleGenerateDraftPdf} disabled={!editable || isGeneratingPdf}>
                  {isGeneratingPdf ? 'Generating PDF...' : 'Generate Draft PDF'}
                </Button>
              ) : null}
              <Link to={isEdit ? `/invoices/${existingInvoice?.id}` : '/invoices'}>
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
          <Button variant="primary" onClick={handleSendInvoice}>
            Save, Approve & Send
          </Button>
        </StickyActionBar>
      ) : null}
    </>
  );
}

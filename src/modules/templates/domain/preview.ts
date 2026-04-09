import { formatDate } from '@/utils/format';
import { TemplateConfig, TemplatePreviewPayload } from './types';

export interface TemplatePreviewColumn {
  key: string;
  label: string;
}

export interface TemplatePreviewRow {
  id: string;
  values: Record<string, string>;
}

export interface TemplatePreviewModel {
  title: string;
  subtitle: string;
  metadata: Array<{ label: string; value: string }>;
  tableColumns: TemplatePreviewColumn[];
  tableRows: TemplatePreviewRow[];
  summaryRows: Array<{ label: string; value: string; visible: boolean }>;
  branding: TemplateConfig['branding'];
  sections: TemplateConfig['sections'];
}

function money(valueMinor: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(valueMinor / 100);
}

export function mapTemplatePreviewModel(
  config: TemplateConfig,
  payload: TemplatePreviewPayload,
): TemplatePreviewModel {
  const metadata = [
    config.fieldVisibility.metadataFields.showDocumentNumber
      ? { label: 'Document #', value: payload.documentNumber }
      : null,
    config.fieldVisibility.metadataFields.showIssueDate
      ? { label: 'Issue Date', value: formatDate(payload.issueDate) }
      : null,
    config.fieldVisibility.metadataFields.showDueOrExpiryDate
      ? { label: payload.dueOrExpiryLabel, value: formatDate(payload.dueOrExpiryDate) }
      : null,
    config.fieldVisibility.metadataFields.showReference && payload.reference
      ? { label: 'Reference', value: payload.reference }
      : null,
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  const columns: TemplatePreviewColumn[] = [
    { key: 'itemName', label: config.table.labels.item },
    config.table.columns.showDescription ? { key: 'description', label: config.table.labels.description } : null,
    config.table.columns.showQuantity ? { key: 'quantity', label: config.table.labels.quantity } : null,
    config.table.columns.showUnitPrice ? { key: 'unitPriceMinor', label: config.table.labels.unitPrice } : null,
    config.table.columns.showDiscount ? { key: 'discountPercent', label: config.table.labels.discount } : null,
    config.table.columns.showTax ? { key: 'taxRatePercent', label: config.table.labels.tax } : null,
    config.table.columns.showLineTotal ? { key: 'lineTotalMinor', label: config.table.labels.lineTotal } : null,
  ].filter((column): column is TemplatePreviewColumn => Boolean(column));

  const tableRows: TemplatePreviewRow[] = payload.lineItems.map((item) => ({
    id: item.id,
    values: {
      itemName: item.itemName,
      description: item.description,
      quantity: String(item.quantity),
      unitPriceMinor: money(item.unitPriceMinor),
      discountPercent: `${item.discountPercent.toFixed(2)}%`,
      taxRatePercent: `${item.taxRatePercent.toFixed(2)}%`,
      lineTotalMinor: money(item.lineTotalMinor),
    },
  }));

  const summaryRows = [
    {
      label: config.summary.labels.subtotal,
      value: money(payload.totals.subtotalMinor),
      visible: config.fieldVisibility.summaryFields.showSubtotal,
    },
    {
      label: config.summary.labels.lineDiscount,
      value: `- ${money(payload.totals.lineDiscountMinor)}`,
      visible: config.fieldVisibility.summaryFields.showLineDiscount,
    },
    {
      label: config.summary.labels.documentDiscount,
      value: `- ${money(payload.totals.documentDiscountMinor)}`,
      visible: config.fieldVisibility.summaryFields.showDocumentDiscount,
    },
    {
      label: config.summary.labels.tax,
      value: money(payload.totals.taxMinor),
      visible: config.fieldVisibility.summaryFields.showTax,
    },
    {
      label: config.summary.labels.total,
      value: money(payload.totals.totalMinor),
      visible: true,
    },
    {
      label: config.summary.labels.paid,
      value: money(payload.totals.paidMinor ?? 0),
      visible: config.fieldVisibility.summaryFields.showPaid && typeof payload.totals.paidMinor === 'number',
    },
    {
      label: config.summary.labels.outstanding,
      value: money(payload.totals.outstandingMinor ?? 0),
      visible:
        config.fieldVisibility.summaryFields.showOutstanding &&
        typeof payload.totals.outstandingMinor === 'number',
    },
  ];

  return {
    title: payload.documentTitle,
    subtitle: payload.client.name,
    metadata,
    tableColumns: columns,
    tableRows,
    summaryRows,
    branding: config.branding,
    sections: config.sections,
  };
}

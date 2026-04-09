import { useMemo, useState } from 'react';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Card } from '@/design-system/primitives/Card';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { Select } from '@/design-system/primitives/Select';
import { Input } from '@/design-system/primitives/Input';
import { formatMinorCurrency } from '@/utils/format';
import { useReportsSummary } from '@/modules/insights/hooks/useInsights';
import { DateRangePreset } from '@/modules/insights/domain/types';

export function ReportsPage() {
  const [preset, setPreset] = useState<DateRangePreset>('current_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { summary } = useReportsSummary({
    preset,
    customRange: {
      from: customFrom || undefined,
      to: customTo || undefined,
    },
  });

  const agingRows = useMemo(
    () =>
      summary.invoiceAging.buckets.map((bucket) => ({
        ...bucket,
        label: bucket.label === 'Current' ? 'Current' : `${bucket.label} days`,
      })),
    [summary.invoiceAging.buckets],
  );

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Operational summaries for receivables, quote conversion, payments, email activity, and archived documents."
      />

      <FilterBar ariaLabel="Report date filters">
        <Select
          aria-label="Date range preset"
          value={preset}
          onChange={(event) => setPreset(event.target.value as DateRangePreset)}
          options={[
            { label: 'Current Month', value: 'current_month' },
            { label: 'Previous Month', value: 'previous_month' },
            { label: 'Last 30 Days', value: 'last_30_days' },
            { label: 'All Time', value: 'all_time' },
            { label: 'Custom', value: 'custom' },
          ]}
          style={{ width: 220 }}
        />
        {preset === 'custom' ? (
          <>
            <Input
              aria-label="Custom range start"
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              style={{ width: 170 }}
            />
            <Input
              aria-label="Custom range end"
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              style={{ width: 170 }}
            />
          </>
        ) : null}
      </FilterBar>

      <div className="dl-grid cols-2">
        <Card title="Invoice Aging Summary" subtitle="Outstanding receivables by overdue bucket">
          <div style={{ display: 'grid', gap: 8 }}>
            {agingRows.map((bucket) => (
              <div key={bucket.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>{bucket.label}</span>
                <span>
                  {bucket.count} · <strong>{formatMinorCurrency(bucket.outstandingMinor)}</strong>
                </span>
              </div>
            ))}
            <div className="dl-divider" />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>Total Outstanding</strong>
              <strong>{formatMinorCurrency(summary.invoiceAging.totalOutstandingMinor)}</strong>
            </div>
          </div>
        </Card>

        <Card title="Quote Conversion Summary" subtitle="Pipeline quality and conversion readiness">
          <div style={{ display: 'grid', gap: 8 }}>
            <MetricRow label="Total Quotes" value={String(summary.quoteConversion.totalQuotes)} />
            <MetricRow label="Accepted" value={String(summary.quoteConversion.acceptedQuotes)} />
            <MetricRow label="Rejected" value={String(summary.quoteConversion.rejectedQuotes)} />
            <MetricRow label="Expired" value={String(summary.quoteConversion.expiredQuotes)} />
            <MetricRow label="Converted" value={String(summary.quoteConversion.convertedQuotes)} />
            <MetricRow
              label="Accepted, Not Converted"
              value={`${summary.quoteConversion.acceptedNotConvertedCount} (${formatMinorCurrency(summary.quoteConversion.acceptedNotConvertedValueMinor)})`}
            />
            <MetricRow
              label="Conversion Rate"
              value={`${summary.quoteConversion.conversionRatePercent.toFixed(2)}%`}
            />
          </div>
        </Card>
      </div>

      <div className="dl-grid cols-2 dl-page-section">
        <Card title="Monthly Sales Summary" subtitle="Invoice volume and value in selected period">
          <div style={{ display: 'grid', gap: 8 }}>
            <MetricRow label="Invoices" value={String(summary.monthlySales.invoicesCount)} />
            <MetricRow label="Total Invoiced" value={formatMinorCurrency(summary.monthlySales.totalInvoicedMinor)} />
            <MetricRow label="Total Paid" value={formatMinorCurrency(summary.monthlySales.totalPaidMinor)} />
            <MetricRow label="Total Outstanding" value={formatMinorCurrency(summary.monthlySales.totalOutstandingMinor)} />
            <MetricRow label="Avg Invoice Value" value={formatMinorCurrency(summary.monthlySales.averageInvoiceValueMinor)} />
          </div>
        </Card>

        <Card title="Payments Received Summary" subtitle="Collection performance and top paying clients">
          <div style={{ display: 'grid', gap: 8 }}>
            <MetricRow label="Payments Count" value={String(summary.payments.paymentsCount)} />
            <MetricRow label="Payments Total" value={formatMinorCurrency(summary.payments.totalPaidMinor)} />
            <div className="dl-divider" />
            <strong style={{ fontSize: 14 }}>Top Paying Clients</strong>
            {summary.payments.topPayingClients.length === 0 ? (
              <p className="dl-muted" style={{ margin: 0 }}>No payments in selected period.</p>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {summary.payments.topPayingClients.map((client) => (
                  <div key={client.clientId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{client.clientName}</span>
                    <strong>{formatMinorCurrency(client.paidMinor)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="dl-grid cols-2 dl-page-section">
        <Card title="Email Send Activity" subtitle="Delivery reliability across quote and invoice sends">
          <div style={{ display: 'grid', gap: 8 }}>
            <MetricRow label="Total Sends" value={String(summary.emailActivity.totalSends)} />
            <MetricRow label="Successful Sends" value={String(summary.emailActivity.successfulSends)} />
            <MetricRow label="Failed Sends" value={String(summary.emailActivity.failedSends)} />
            <MetricRow label="Quote Sends" value={String(summary.emailActivity.quoteSends)} />
            <MetricRow label="Invoice Sends" value={String(summary.emailActivity.invoiceSends)} />
          </div>
        </Card>

        <Card title="PDF Archive Summary" subtitle="Generated document output and archival history">
          <div style={{ display: 'grid', gap: 8 }}>
            <MetricRow label="Generated PDFs" value={String(summary.pdfArchive.totalGenerated)} />
            <MetricRow label="Quote PDFs" value={String(summary.pdfArchive.quotePdfs)} />
            <MetricRow label="Invoice PDFs" value={String(summary.pdfArchive.invoicePdfs)} />
            <MetricRow label="Immutable Archives" value={String(summary.pdfArchive.immutableCount)} />
          </div>
        </Card>
      </div>
    </>
  );
}

function MetricRow(props: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

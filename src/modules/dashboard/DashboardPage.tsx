import { Link } from 'react-router-dom';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { StatCard } from '@/design-system/patterns/StatCard';
import { formatDate, formatMinorCurrency } from '@/utils/format';
import { InvoiceStatusBadge, QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice } from '@/design-system/patterns/InlineNotice';
import { useDashboardInsights } from '@/modules/insights/hooks/useInsights';
import { appConfig } from '@/config/appConfig';
import { useEmails } from '@/modules/emails/hooks/useEmails';

function TrendBars(props: { rows: Array<{ label: string; invoicedMinor: number; paidMinor: number }> }) {
  const max = Math.max(
    1,
    ...props.rows.map((row) => Math.max(row.invoicedMinor, row.paidMinor)),
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>Invoiced vs Paid (6 months)</strong>
        <span className="dl-muted">Issue date and payment date basis</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${props.rows.length}, minmax(0, 1fr))`, gap: 8, height: 230 }}>
        {props.rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{ display: 'grid', gap: 4 }}>
              <div
                title={`Invoiced ${formatMinorCurrency(row.invoicedMinor)}`}
                style={{
                  borderRadius: 6,
                  background: 'linear-gradient(180deg, #4f8abc 0%, #174b7a 100%)',
                  height: `${Math.max(10, Math.round((row.invoicedMinor / max) * 140))}px`,
                }}
              />
              <div
                title={`Paid ${formatMinorCurrency(row.paidMinor)}`}
                style={{
                  borderRadius: 6,
                  background: 'linear-gradient(180deg, #2fa37d 0%, #0f6b4f 100%)',
                  height: `${Math.max(10, Math.round((row.paidMinor / max) * 90))}px`,
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const insights = useDashboardInsights();
  const { emailCapability, emailCapabilityLoading } = useEmails();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Operational finance visibility across quotes, invoices, payments, PDF archives, and email delivery."
        actions={
          <>
            <Link to="/quotes/new">
              <Button variant="secondary">New Quote</Button>
            </Link>
            <Link to="/invoices/new">
              <Button variant="primary">New Invoice</Button>
            </Link>
          </>
        }
      />

      {appConfig.warnings.length > 0 || !emailCapabilityLoading ? (
        <div className="dl-grid cols-2" style={{ marginBottom: 16 }}>
          {appConfig.warnings.length > 0 ? (
            <Card title="Configuration Notes" subtitle="Environment setup not fully complete yet">
              <div style={{ display: 'grid', gap: 8 }}>
                {appConfig.warnings.map((warning) => (
                  <InlineNotice key={warning} tone="warning">
                    {warning}
                  </InlineNotice>
                ))}
              </div>
            </Card>
          ) : null}
          {!emailCapabilityLoading ? (
            <Card title="Email Capability" subtitle="Current server transport readiness">
              <div style={{ display: 'grid', gap: 8 }}>
                <div>
                  <strong>Status:</strong>{' '}
                  {emailCapability.canSend ? 'Available' : 'Unavailable'}
                </div>
                <div>
                  <strong>Mode:</strong> {emailCapability.mode}
                </div>
                {emailCapability.reason ? (
                  <div className="dl-muted">{emailCapability.reason}</div>
                ) : null}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}

      <section className="dl-grid cols-4 dl-page-section">
        <StatCard
          label="Outstanding"
          value={formatMinorCurrency(insights.financial.totalOutstandingMinor)}
          meta="Across unpaid non-void invoices"
        />
        <StatCard
          label="Overdue Total"
          value={formatMinorCurrency(insights.financial.overdueTotalMinor)}
          meta={`${insights.invoices.overdueCount} overdue invoices`}
        />
        <StatCard
          label="Invoiced This Month"
          value={formatMinorCurrency(insights.financial.totalInvoicedThisMonthMinor)}
          meta="By invoice issue date"
        />
        <StatCard
          label="Paid This Month"
          value={formatMinorCurrency(insights.financial.totalPaidThisMonthMinor)}
          meta="By payment date"
        />
      </section>

      <section className="dl-grid cols-4 dl-page-section">
        <StatCard
          label="Accepted, Not Converted"
          value={String(insights.quotes.acceptedNotConvertedCount)}
          meta="Quotes ready to invoice"
        />
        <StatCard
          label="Draft Quotes"
          value={String(insights.quotes.draftCount)}
          meta={`${insights.quotes.sentCount} sent · ${insights.quotes.acceptedCount} accepted`}
        />
        <StatCard
          label="Partially Paid"
          value={formatMinorCurrency(insights.financial.partiallyPaidTotalMinor)}
          meta={`${insights.invoices.partiallyPaidCount} invoices`}
        />
        <StatCard
          label="Failed Emails"
          value={String(insights.recentFailedEmails.length)}
          meta="Recent delivery failures"
        />
      </section>

      <div className="dl-grid cols-3 dl-page-section">
        <Card className="dl-grid-span-2" style={{ gridColumn: 'span 2' }}>
          <TrendBars rows={insights.trends} />
        </Card>

        <Card title="Recent Activity" subtitle="Cross-module operational events">
          {insights.recentActivity.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>
              No activity captured yet.
            </p>
          ) : (
            <div className="dl-timeline">
              {insights.recentActivity.map((event) => (
                <div key={event.id} className="dl-timeline-item">
                  <p className="dl-timeline-title">{event.title}</p>
                  <p className="dl-timeline-meta">
                    {formatDate(event.timestamp)}
                    {event.detail ? ` · ${event.detail}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="dl-grid cols-2 dl-page-section">
        <Card title="Recent Invoices" subtitle="Outstanding and send visibility" rightSlot={<Link to="/invoices">View all</Link>}>
          {insights.recentInvoiceSummaries.length === 0 ? (
            <EmptyState title="No invoices yet" description="Create invoices to track receivables and payment status." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {insights.recentInvoiceSummaries.map((invoice) => (
                <div key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</div>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Due {formatDate(invoice.dueDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <InvoiceStatusBadge status={invoice.status} />
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{formatMinorCurrency(invoice.outstandingMinor)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Quotes" subtitle="Conversion opportunities" rightSlot={<Link to="/quotes">View all</Link>}>
          {insights.recentQuoteSummaries.length === 0 ? (
            <EmptyState title="No quotes yet" description="Create your first quote to start pipeline tracking." />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {insights.recentQuoteSummaries.map((quote) => (
                <div key={quote.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{quote.quoteNumber}</div>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Expires {formatDate(quote.expiryDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <QuoteStatusBadge status={quote.status} />
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{formatMinorCurrency(quote.totalMinor)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="dl-grid cols-3 dl-page-section">
        <Card title="Top Clients by Outstanding" rightSlot={<Link to="/clients">View clients</Link>}>
          {insights.topClientsByOutstanding.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>No outstanding balances currently.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {insights.topClientsByOutstanding.map((client) => (
                <div key={client.clientId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span>{client.clientName}</span>
                  <strong>{formatMinorCurrency(client.outstandingMinor)}</strong>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Email Failures" rightSlot={<Link to="/emails/history">View history</Link>}>
          {insights.recentFailedEmails.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>No recent failed sends.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {insights.recentFailedEmails.map((entry) => (
                <div key={entry.id}>
                  <div style={{ fontWeight: 700 }}>{entry.documentNumber}</div>
                  <div className="dl-muted" style={{ fontSize: 12 }}>
                    {entry.recipientEmail} · {entry.errorMessage ?? 'Delivery failure'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="PDF Activity" rightSlot={<Link to="/pdf-archive">Open archive</Link>}>
          {insights.recentPdfArchive.length === 0 ? (
            <p className="dl-muted" style={{ margin: 0 }}>No PDFs generated yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {insights.recentPdfArchive.map((entry) => (
                <div key={entry.id}>
                  <div style={{ fontWeight: 700 }}>{entry.documentNumber}</div>
                  <div className="dl-muted" style={{ fontSize: 12 }}>
                    {entry.fileName} · v{entry.revision}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

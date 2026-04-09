import { Link } from 'react-router-dom';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { StatCard } from '@/design-system/patterns/StatCard';
import { activityEvents, dashboardMetrics, invoices, monthlyInvoicedTotals, quotes } from '@/mocks/data';
import { formatCurrency } from '@/utils/format';
import { ActivityFeed } from '@/design-system/patterns/ActivityFeed';
import { InvoiceStatusBadge, QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';

function ChartPlaceholder() {
  const max = Math.max(...monthlyInvoicedTotals.map((entry) => entry.total));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <strong>Monthly Invoiced Totals</strong>
        <span className="dl-muted">Last 12 months</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 8, height: 220 }}>
        {monthlyInvoicedTotals.map((entry) => (
          <div key={entry.month} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div
              style={{
                borderRadius: 8,
                background: 'linear-gradient(180deg, #4f8abc 0%, #174b7a 100%)',
                height: `${Math.round((entry.total / max) * 170) + 20}px`,
              }}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{entry.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const recentInvoices = invoices.slice(0, 3);
  const recentQuotes = quotes.slice(0, 3);

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Operational finance overview with quote, invoice, and activity highlights."
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

      <section className="dl-grid cols-4">
        <StatCard label="Total Outstanding" value={formatCurrency(dashboardMetrics.totalOutstanding)} meta="Across all unpaid invoices" />
        <StatCard label="Overdue Invoices" value={String(dashboardMetrics.overdueInvoices)} meta="Requires immediate follow-up" />
        <StatCard label="Draft Quotes" value={String(dashboardMetrics.draftQuotes)} meta="Pending internal review" />
        <StatCard
          label="Accepted Awaiting Conversion"
          value={String(dashboardMetrics.acceptedQuotesAwaitingConversion)}
          meta="Ready to invoice"
        />
      </section>

      <div className="dl-grid cols-3" style={{ marginTop: 16 }}>
        <Card className="dl-grid-span-2" style={{ gridColumn: 'span 2' }}>
          <ChartPlaceholder />
        </Card>

        <Card title="Recent Activity" subtitle="Latest accounting events">
          <ActivityFeed events={activityEvents} />
        </Card>
      </div>

      <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Recent Invoices" subtitle="Track high-priority invoice status" rightSlot={<Link to="/invoices">View all</Link>}>
          <div style={{ display: 'grid', gap: 12 }}>
            {recentInvoices.map((invoice) => (
              <div key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{invoice.invoiceNumber}</div>
                  <div className="dl-muted" style={{ fontSize: 12 }}>
                    {invoice.clientName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <InvoiceStatusBadge status={invoice.status} />
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(invoice.balanceDue)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Recent Quotes" subtitle="Conversion opportunities" rightSlot={<Link to="/quotes">View all</Link>}>
          <div style={{ display: 'grid', gap: 12 }}>
            {recentQuotes.map((quote) => (
              <div key={quote.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{quote.quoteNumber}</div>
                  <div className="dl-muted" style={{ fontSize: 12 }}>
                    {quote.clientName}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <QuoteStatusBadge status={quote.status} />
                  <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(quote.total)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

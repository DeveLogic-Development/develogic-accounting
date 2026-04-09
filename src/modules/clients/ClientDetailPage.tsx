import { Link, useParams } from 'react-router-dom';
import { clients, invoices, quotes } from '@/mocks/data';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatCurrency, formatDate } from '@/utils/format';
import { InvoiceStatusBadge, QuoteStatusBadge } from '@/design-system/patterns/StatusBadge';

export function ClientDetailPage() {
  const { clientId } = useParams();
  const client = clients.find((entry) => entry.id === clientId);

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        description="This client record may have been removed."
        action={
          <Link to="/clients">
            <Button variant="primary">Back to Clients</Button>
          </Link>
        }
      />
    );
  }

  const clientInvoices = invoices.filter((invoice) => invoice.clientId === client.id);
  const clientQuotes = quotes.filter((quote) => quote.clientId === client.id);

  return (
    <>
      <PageHeader
        title={client.name}
        subtitle={`${client.contactName} · ${client.email}`}
        actions={
          <>
            <Button variant="secondary">Edit Client</Button>
            <Button variant="primary">New Quote</Button>
          </>
        }
      />

      <div className="dl-grid cols-3">
        <Card title="Outstanding Balance">
          <p className="dl-stat-value">{formatCurrency(client.outstandingBalance)}</p>
        </Card>
        <Card title="Lifetime Billed">
          <p className="dl-stat-value">{formatCurrency(client.totalBilled)}</p>
        </Card>
        <Card title="Status">
          <p className="dl-stat-value" style={{ fontSize: 22 }}>
            {client.status === 'active' ? 'Active' : 'Inactive'}
          </p>
          <p className="dl-stat-meta">Last activity: {formatDate(client.lastActivityAt)}</p>
        </Card>
      </div>

      <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Recent Quotes" subtitle="Latest quote lifecycle events">
          {clientQuotes.length === 0 ? (
            <p className="dl-muted">No quotes yet for this client.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {clientQuotes.map((quote) => (
                <div key={quote.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <strong>{quote.quoteNumber}</strong>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Expires {formatDate(quote.validUntil)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <QuoteStatusBadge status={quote.status} />
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(quote.total)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Recent Invoices" subtitle="Payment and aging overview">
          {clientInvoices.length === 0 ? (
            <p className="dl-muted">No invoices yet for this client.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {clientInvoices.map((invoice) => (
                <div key={invoice.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <strong>{invoice.invoiceNumber}</strong>
                    <div className="dl-muted" style={{ fontSize: 12 }}>
                      Due {formatDate(invoice.dueDate)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <InvoiceStatusBadge status={invoice.status} />
                    <div style={{ fontWeight: 700, marginTop: 6 }}>{formatCurrency(invoice.balanceDue)}</div>
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

import { Link, useParams } from 'react-router-dom';
import { productsServices, quotes, invoices } from '@/mocks/data';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatCurrency } from '@/utils/format';

export function ProductServiceDetailPage() {
  const { productId } = useParams();
  const item = productsServices.find((entry) => entry.id === productId);

  if (!item) {
    return (
      <EmptyState
        title="Item not found"
        description="The requested product/service does not exist."
        action={
          <Link to="/products-services">
            <Button variant="primary">Back to Products & Services</Button>
          </Link>
        }
      />
    );
  }

  const linkedQuotes = quotes.slice(0, 2);
  const linkedInvoices = invoices.slice(0, 2);

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={`${item.type === 'service' ? 'Service' : 'Product'} · ${item.sku}`}
        actions={
          <>
            <Button variant="secondary">Duplicate</Button>
            <Button variant="primary">Edit Item</Button>
          </>
        }
      />

      <div className="dl-grid cols-3">
        <Card title="Unit Price">
          <p className="dl-stat-value">{formatCurrency(item.unitPrice)}</p>
        </Card>
        <Card title="Tax Category">
          <p className="dl-stat-value" style={{ fontSize: 24 }}>
            {item.taxCategory}
          </p>
        </Card>
        <Card title="Usage Count">
          <p className="dl-stat-value">{item.usageCount}</p>
        </Card>
      </div>

      <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
        <Card title="Description">
          <p className="dl-muted">{item.description}</p>
        </Card>

        <Card title="Linked Documents" subtitle="Recent quotes and invoices using this item">
          <div style={{ display: 'grid', gap: 8 }}>
            {linkedQuotes.map((quote) => (
              <div key={quote.id}>
                Quote {quote.quoteNumber} · {quote.clientName}
              </div>
            ))}
            {linkedInvoices.map((invoice) => (
              <div key={invoice.id}>
                Invoice {invoice.invoiceNumber} · {invoice.clientName}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

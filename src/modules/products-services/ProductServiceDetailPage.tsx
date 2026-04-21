import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { formatCurrency } from '@/utils/format';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';

export function ProductServiceDetailPage() {
  const { productId } = useParams();
  const { getProductById, getClientNameById } = useMasterData();
  const { state } = useAccounting();
  const item = getProductById(productId);

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

  const linkedQuotes = state.quotes
    .filter((quote) =>
      quote.items.some((line) => line.itemName.trim().toLowerCase() === item.name.trim().toLowerCase()),
    )
    .slice(0, 2);
  const linkedInvoices = state.invoices
    .filter((invoice) =>
      invoice.items.some((line) => line.itemName.trim().toLowerCase() === item.name.trim().toLowerCase()),
    )
    .slice(0, 2);
  const usageCount = linkedQuotes.length + linkedInvoices.length;

  return (
    <>
      <PageHeader
        title={item.name}
        subtitle={`${item.type === 'service' ? 'Service' : 'Product'} · ${item.sku}`}
        actions={
          <>
            <Link to={`/products-services/new?duplicateFrom=${item.id}`}>
              <Button variant="secondary">Duplicate</Button>
            </Link>
            <Link to={`/products-services/${item.id}/edit`}>
              <Button variant="primary">Edit Item</Button>
            </Link>
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
          <p className="dl-stat-value">{usageCount}</p>
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
                Quote {quote.quoteNumber} · {getClientNameById(quote.clientId)}
              </div>
            ))}
            {linkedInvoices.map((invoice) => (
              <div key={invoice.id}>
                Invoice {invoice.invoiceNumber} · {getClientNameById(invoice.clientId)}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

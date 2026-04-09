import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productsServices } from '@/mocks/data';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Badge } from '@/design-system/primitives/Badge';
import { formatCurrency } from '@/utils/format';

export function ProductsServicesListPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'product' | 'service'>('all');

  const filtered = useMemo(
    () =>
      productsServices.filter((entry) => {
        const typeMatch = type === 'all' || entry.type === type;
        const searchMatch =
          search.trim().length === 0 ||
          [entry.name, entry.sku, entry.description].some((field) =>
            field.toLowerCase().includes(search.toLowerCase()),
          );
        return typeMatch && searchMatch;
      }),
    [search, type],
  );

  return (
    <>
      <PageHeader
        title="Products & Services"
        subtitle="Manage priceable services, products, and default tax setup."
        actions={
          <>
            <Button variant="secondary">Bulk Update</Button>
            <Button variant="primary">Add Item</Button>
          </>
        }
      />

      <FilterBar>
        <Input
          placeholder="Search items"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(340px, 100%)' }}
        />
        <Select
          value={type}
          onChange={(event) => setType(event.target.value as 'all' | 'product' | 'service')}
          options={[
            { label: 'All types', value: 'all' },
            { label: 'Services', value: 'service' },
            { label: 'Products', value: 'product' },
          ]}
          style={{ width: 160 }}
        />
        <Button size="sm">Sort: Most Used</Button>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No products or services"
          description="Create your first billing item to speed up quote and invoice creation."
          action={<Button variant="primary">Add Item</Button>}
        />
      ) : (
        <>
          <ResponsiveList
            headers={['Name', 'Type', 'SKU', 'Unit Price', 'Tax', 'Usage', 'Actions']}
            desktopRows={
              <>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td>
                      <strong>{entry.name}</strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {entry.description}
                      </div>
                    </td>
                    <td>
                      <Badge variant={entry.type === 'service' ? 'info' : 'accent'}>
                        {entry.type === 'service' ? 'Service' : 'Product'}
                      </Badge>
                    </td>
                    <td>{entry.sku}</td>
                    <td>{formatCurrency(entry.unitPrice)}</td>
                    <td>{entry.taxCategory}</td>
                    <td>{entry.usageCount}</td>
                    <td>
                      <Link to={`/products-services/${entry.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </>
            }
            mobileCards={
              <>
                {filtered.map((entry) => (
                  <article key={entry.id} className="dl-mobile-item">
                    <div className="dl-mobile-item-header">
                      <div>
                        <strong>{entry.name}</strong>
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          {entry.sku}
                        </div>
                      </div>
                      <Badge variant={entry.type === 'service' ? 'info' : 'accent'}>
                        {entry.type === 'service' ? 'Service' : 'Product'}
                      </Badge>
                    </div>
                    <div className="dl-mobile-meta">
                      <div>
                        <span>Price</span>
                        <div>{formatCurrency(entry.unitPrice)}</div>
                      </div>
                      <div>
                        <span>Usage</span>
                        <div>{entry.usageCount}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Link to={`/products-services/${entry.id}`}>Open details</Link>
                    </div>
                  </article>
                ))}
              </>
            }
          />
          <div className="dl-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Showing {filtered.length} items · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Badge } from '@/design-system/primitives/Badge';
import { formatCurrency } from '@/utils/format';
import { matchesSearchText } from '@/modules/insights/domain/filters';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';

export function ProductsServicesListPage() {
  const { productsServices } = useMasterData();
  const { state } = useAccounting();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'product' | 'service'>('all');
  const [activeState, setActiveState] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'usage_desc' | 'price_desc' | 'name_asc'>('usage_desc');

  const filtered = useMemo(
    () => {
      const usageByName = new Map<string, number>();
      [...state.quotes.flatMap((quote) => quote.items), ...state.invoices.flatMap((invoice) => invoice.items)].forEach(
        (item) => {
          usageByName.set(item.itemName, (usageByName.get(item.itemName) ?? 0) + 1);
        },
      );

      const rows = productsServices
        .map((entry) => ({
          ...entry,
          usageCount: usageByName.get(entry.name) ?? 0,
        }))
        .filter((entry) => {
          const typeMatch = type === 'all' || entry.type === type;
          const activeMatch =
            activeState === 'all' ||
            (activeState === 'active' && entry.isActive) ||
            (activeState === 'inactive' && !entry.isActive);
          const searchMatch = matchesSearchText(search, [entry.name, entry.sku, entry.description]);
          return typeMatch && activeMatch && searchMatch;
        });

      rows.sort((a, b) => {
        if (sort === 'price_desc') return b.unitPrice - a.unitPrice;
        if (sort === 'name_asc') return a.name.localeCompare(b.name);
        return b.usageCount - a.usageCount;
      });
      return rows;
    },
    [activeState, productsServices, search, sort, state.invoices, state.quotes, type],
  );

  return (
    <>
      <PageHeader
        title="Products & Services"
        subtitle="Manage priceable services, products, and default tax setup."
        actions={
          <Link to="/products-services/new">
            <Button variant="primary">Create Item</Button>
          </Link>
        }
      />


      <FilterBar ariaLabel="Product and service filters">
        <Input
          aria-label="Search products and services"
          placeholder="Search items"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(340px, 100%)' }}
        />
        <Select
          aria-label="Availability filter"
          value={activeState}
          onChange={(event) => setActiveState(event.target.value as 'all' | 'active' | 'inactive')}
          options={[
            { label: 'All availability', value: 'all' },
            { label: 'Active only', value: 'active' },
            { label: 'Inactive only', value: 'inactive' },
          ]}
          style={{ width: 180 }}
        />
        <Select
          aria-label="Type filter"
          value={type}
          onChange={(event) => setType(event.target.value as 'all' | 'product' | 'service')}
          options={[
            { label: 'All types', value: 'all' },
            { label: 'Services', value: 'service' },
            { label: 'Products', value: 'product' },
          ]}
          style={{ width: 160 }}
        />
        <Select
          aria-label="Sort products and services"
          value={sort}
          onChange={(event) => setSort(event.target.value as 'usage_desc' | 'price_desc' | 'name_asc')}
          options={[
            { label: 'Sort: Most Used', value: 'usage_desc' },
            { label: 'Sort: Price High', value: 'price_desc' },
            { label: 'Sort: Name A-Z', value: 'name_asc' },
          ]}
          style={{ width: 180 }}
        />
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="No products or services"
          description="Create your first billing item to speed up quote and invoice creation."
          action={
            <Link to="/products-services/new">
              <Button variant="primary">Create Item</Button>
            </Link>
          }
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
                      <Link to={`/products-services/${entry.id}`}>Open Item</Link>
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
          <div className="dl-list-footer">
            Showing {filtered.length} items · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { clients } from '@/mocks/data';
import { formatCurrency, formatDate } from '@/utils/format';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Button } from '@/design-system/primitives/Button';
import { Badge } from '@/design-system/primitives/Badge';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { FilterBar } from '@/design-system/patterns/FilterBar';
import { ResponsiveList } from '@/design-system/patterns/ResponsiveList';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { Skeleton } from '@/design-system/patterns/Skeleton';

export function ClientsListPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const loading = false;

  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const statusMatch = status === 'all' || client.status === status;
        const searchMatch =
          search.trim().length === 0 ||
          [client.name, client.email, client.contactName].some((field) =>
            field.toLowerCase().includes(search.toLowerCase()),
          );

        return statusMatch && searchMatch;
      }),
    [search, status],
  );

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle="Manage customer profiles, contacts, balances, and recent activity."
        actions={
          <>
            <Button variant="secondary">Import CSV</Button>
            <Button variant="primary">Add Client</Button>
          </>
        }
      />

      <FilterBar>
        <Input
          placeholder="Search clients"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          style={{ width: 'min(340px, 100%)' }}
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | 'active' | 'inactive')}
          options={[
            { label: 'All statuses', value: 'all' },
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
          ]}
          style={{ width: 170 }}
        />
        <Button size="sm">Sort: Recent Activity</Button>
        <Button size="sm" variant="ghost">
          Export
        </Button>
      </FilterBar>

      {loading ? (
        <div className="dl-card" style={{ display: 'grid', gap: 12 }}>
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No clients found"
          description="Try adjusting your filters or add a new client profile."
          action={<Button variant="primary">Add Client</Button>}
        />
      ) : (
        <>
          <ResponsiveList
            headers={['Client', 'Contact', 'Status', 'Outstanding', 'Last Activity', 'Actions']}
            desktopRows={
              <>
                {filtered.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {client.email}
                      </div>
                    </td>
                    <td>
                      {client.contactName}
                      <div className="dl-muted" style={{ fontSize: 12 }}>
                        {client.phone}
                      </div>
                    </td>
                    <td>
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td>{formatCurrency(client.outstandingBalance)}</td>
                    <td>{formatDate(client.lastActivityAt)}</td>
                    <td>
                      <Link to={`/clients/${client.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </>
            }
            mobileCards={
              <>
                {filtered.map((client) => (
                  <article key={client.id} className="dl-mobile-item">
                    <div className="dl-mobile-item-header">
                      <div>
                        <strong>{client.name}</strong>
                        <div className="dl-muted" style={{ fontSize: 12 }}>
                          {client.email}
                        </div>
                      </div>
                      <Badge variant={client.status === 'active' ? 'success' : 'neutral'}>
                        {client.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="dl-mobile-meta">
                      <div>
                        <span>Outstanding</span>
                        <div>{formatCurrency(client.outstandingBalance)}</div>
                      </div>
                      <div>
                        <span>Last Activity</span>
                        <div>{formatDate(client.lastActivityAt)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <Link to={`/clients/${client.id}`}>Open details</Link>
                    </div>
                  </article>
                ))}
              </>
            }
          />
          <div className="dl-muted" style={{ marginTop: 10, fontSize: 12 }}>
            Showing {filtered.length} clients · Page 1 of 1
          </div>
        </>
      )}
    </>
  );
}

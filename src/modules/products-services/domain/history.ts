import { ProductHistoryEvent } from '@/modules/master-data/domain/types';

interface HistorySummary {
  title: string;
  detail?: string;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  item_type: 'Item type',
  usage_unit: 'Usage unit',
  is_capital_asset: 'Capital asset flag',
  sales_rate: 'Sales rate',
  sales_account_id: 'Sales account',
  sales_description: 'Sales description',
  purchase_rate: 'Purchase rate',
  purchase_account_id: 'Purchase account',
  purchase_description: 'Purchase description',
  preferred_vendor_id: 'Preferred vendor',
  image_url: 'Image',
  is_active: 'Status',
  reporting_tags_json: 'Reporting tags',
};

function changedFields(event: ProductHistoryEvent): string[] {
  const before = event.beforeData ?? {};
  const after = event.afterData ?? {};
  return Object.keys(FIELD_LABELS).filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

export function summarizeProductHistoryEvent(event: ProductHistoryEvent): HistorySummary {
  if (event.action === 'insert') {
    return { title: 'Item created' };
  }
  if (event.action === 'soft_delete') {
    return { title: 'Item deleted', detail: 'Item was soft-deleted and removed from active lists.' };
  }
  if (event.action === 'restore') {
    return { title: 'Item restored' };
  }
  if (event.action === 'status_change') {
    return { title: 'Item status changed' };
  }

  const changed = changedFields(event);
  if (changed.length === 0) return { title: 'Item updated' };
  const labels = changed.map((field) => FIELD_LABELS[field] ?? field);
  return {
    title: 'Item updated',
    detail: `Updated ${labels.join(', ')}`,
  };
}

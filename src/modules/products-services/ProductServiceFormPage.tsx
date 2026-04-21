import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Toggle } from '@/design-system/primitives/Toggle';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import {
  buildCloneDraft,
  createDefaultItemFormValues,
  findIssueByField,
  ItemFormValues,
  mapItemFormValuesToUpsertInput,
  mapItemToFormValues,
  validateItemFormValues,
} from './domain/forms';

const USAGE_UNIT_OPTIONS = [
  { label: 'Each', value: 'each' },
  { label: 'Hour', value: 'hour' },
  { label: 'Day', value: 'day' },
  { label: 'Month', value: 'month' },
  { label: 'Project', value: 'project' },
];

const SALES_ACCOUNT_OPTIONS = [
  { label: 'Sales', value: 'Sales' },
  { label: 'Service Revenue', value: 'Service Revenue' },
  { label: 'Other Income', value: 'Other Income' },
];

const PURCHASE_ACCOUNT_OPTIONS = [
  { label: 'Cost of Goods Sold', value: 'Cost of Goods Sold' },
  { label: 'Purchases', value: 'Purchases' },
  { label: 'Operating Expense', value: 'Operating Expense' },
];

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Unable to read image.'));
    reader.readAsDataURL(file);
  });
}

export function ProductServiceFormPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateFromId = searchParams.get('duplicateFrom') || undefined;
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const {
    clients,
    loading,
    warning,
    getProductById,
    createProductService,
    updateProductService,
  } = useMasterData();

  const existing = productId ? getProductById(productId) : undefined;
  const duplicateSource = duplicateFromId ? getProductById(duplicateFromId) : undefined;

  const [values, setValues] = useState<ItemFormValues>(createDefaultItemFormValues);
  const [saving, setSaving] = useState(false);
  const [issues, setIssues] = useState<ReturnType<typeof validateItemFormValues>['issues']>([]);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);

  useEffect(() => {
    const source = isEdit ? existing : duplicateSource;
    if (!source) {
      if (!isEdit && !duplicateSource) setValues(createDefaultItemFormValues());
      return;
    }

    setValues(
      isEdit ? mapItemToFormValues(source) : buildCloneDraft(source),
    );
  }, [duplicateSource, existing, isEdit]);

  const pageTitle = useMemo(() => {
    if (isEdit) return `Edit ${existing?.name ?? 'Item'}`;
    if (duplicateSource) return `Clone ${duplicateSource.name}`;
    return 'New Item';
  }, [duplicateSource, existing?.name, isEdit]);

  if (isEdit && !existing && !loading) {
    return (
      <EmptyState
        title="Item not found"
        description="The selected item does not exist or is unavailable."
        action={
          <Link to="/items">
            <Button variant="primary">Back to Items</Button>
          </Link>
        }
      />
    );
  }

  const setField = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: 'Please choose a valid image file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setNotice({ tone: 'error', text: 'Image must be 5MB or smaller.' });
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setField('imageUrl', dataUrl);
      setNotice({ tone: 'success', text: 'Item image selected.' });
    } catch {
      setNotice({ tone: 'error', text: 'Unable to load selected image.' });
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    const validation = validateItemFormValues(values);
    setIssues(validation.issues);
    if (!validation.isValid) {
      setNotice({ tone: 'error', text: validation.issues[0]?.message ?? 'Please review the form.' });
      return;
    }

    const payload = mapItemFormValuesToUpsertInput(values, {
      createdSource: duplicateSource ? 'clone' : 'manual',
    });

    setSaving(true);
    const result =
      isEdit && productId
        ? await updateProductService(productId, payload)
        : await createProductService(payload);
    setSaving(false);

    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to save item.' });
      return;
    }

    navigate(`/items/${result.data.id}`);
  };

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Create or edit goods and services with sales and purchase accounting configuration."
        actions={
          <>
            <Link to={isEdit && productId ? `/items/${productId}` : '/items'}>
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" form="item-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save Item'}
            </Button>
          </>
        }
      />

      {warning ? <InlineNotice tone="warning">{warning}</InlineNotice> : null}
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <form id="item-form" onSubmit={handleSubmit}>
        <Card title="Item Basics" subtitle="Core identity and catalog setup">
          <div className="dl-form-grid">
            <Input
              label="Name"
              value={values.name}
              onChange={(event) => setField('name', event.target.value)}
              required
            />
            <Input
              label="Usage Unit"
              value={values.usageUnit}
              list="item-usage-unit-list"
              onChange={(event) => setField('usageUnit', event.target.value)}
            />
            <datalist id="item-usage-unit-list">
              {USAGE_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </datalist>
            <Input
              label="SKU / Code"
              value={values.sku}
              onChange={(event) => setField('sku', event.target.value)}
            />
            <div className="dl-field">
              <label htmlFor="item-type">Type</label>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', minHeight: 44 }}>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    id="item-type"
                    type="radio"
                    checked={values.type === 'goods'}
                    onChange={() => setField('type', 'goods')}
                  />
                  Goods
                </label>
                <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type="radio"
                    checked={values.type === 'service'}
                    onChange={() => setField('type', 'service')}
                  />
                  Service
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <Toggle
              id="item-is-capital-asset"
              label="Is this a capital asset?"
              checked={values.isCapitalAsset}
              onChange={(event) => setField('isCapitalAsset', event.target.checked)}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <div className="dl-field">
              <label htmlFor="item-image">Item image</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <input id="item-image" type="file" accept="image/*" onChange={handleImageSelected} />
                {values.imageUrl ? (
                  <>
                    <img
                      src={values.imageUrl}
                      alt="Item preview"
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: 'cover',
                        borderRadius: 10,
                        border: '1px solid var(--border-default)',
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => setField('imageUrl', '')}
                    >
                      Remove Image
                    </Button>
                  </>
                ) : (
                  <span className="dl-muted" style={{ fontSize: 12 }}>
                    Optional. PNG/JPG up to 5MB.
                  </span>
                )}
              </div>
            </div>
          </div>

          {findIssueByField(issues, 'name') ? (
            <div className="dl-field-error">{findIssueByField(issues, 'name')}</div>
          ) : null}
        </Card>

        <div className="dl-grid cols-2" style={{ marginTop: 16 }}>
          <Card title="Sales Information" subtitle="Used in quotes and invoices">
            <div className="dl-form-grid">
              <Input
                label="Selling Price / Sales Rate"
                type="number"
                min={0}
                step="0.01"
                value={values.salesRate}
                onChange={(event) => setField('salesRate', Number(event.target.value))}
              />
              <Select
                label="Sales Account"
                value={values.salesAccountId}
                onChange={(event) => setField('salesAccountId', event.target.value)}
                options={SALES_ACCOUNT_OPTIONS}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Textarea
                label="Sales Description"
                value={values.salesDescription}
                onChange={(event) => setField('salesDescription', event.target.value)}
              />
            </div>
            {findIssueByField(issues, 'salesRate') ? (
              <div className="dl-field-error">{findIssueByField(issues, 'salesRate')}</div>
            ) : null}
          </Card>

          <Card title="Purchase Information" subtitle="Used in procurement and costing">
            <div className="dl-form-grid">
              <Input
                label="Cost Price / Purchase Rate"
                type="number"
                min={0}
                step="0.01"
                value={values.purchaseRate}
                onChange={(event) => setField('purchaseRate', Number(event.target.value))}
              />
              <Select
                label="Purchase Account"
                value={values.purchaseAccountId}
                onChange={(event) => setField('purchaseAccountId', event.target.value)}
                options={PURCHASE_ACCOUNT_OPTIONS}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Textarea
                label="Purchase Description"
                value={values.purchaseDescription}
                onChange={(event) => setField('purchaseDescription', event.target.value)}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Select
                label="Preferred Vendor"
                value={values.preferredVendorId}
                onChange={(event) => setField('preferredVendorId', event.target.value)}
                options={[
                  { label: 'Not assigned', value: '' },
                  ...clients.map((client) => ({
                    label: client.displayName,
                    value: client.id,
                  })),
                ]}
              />
            </div>
            {findIssueByField(issues, 'purchaseRate') ? (
              <div className="dl-field-error">{findIssueByField(issues, 'purchaseRate')}</div>
            ) : null}
          </Card>
        </div>

        <Card title="Classification" subtitle="Reporting and lifecycle control" style={{ marginTop: 16 }}>
          <div className="dl-form-grid">
            <Input
              label="Reporting Tags (comma separated)"
              value={values.reportingTagsText}
              onChange={(event) => setField('reportingTagsText', event.target.value)}
              placeholder="e.g. recurring, consulting"
            />
            <Toggle
              id="item-is-active"
              label="Item is active"
              checked={values.isActive}
              onChange={(event) => setField('isActive', event.target.checked)}
            />
          </div>
        </Card>
      </form>
    </>
  );
}

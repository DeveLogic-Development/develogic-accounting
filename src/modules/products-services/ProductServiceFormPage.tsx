import { FormEvent, useEffect, useMemo, useState } from 'react';
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

export function ProductServiceFormPage() {
  const { productId } = useParams();
  const [searchParams] = useSearchParams();
  const duplicateFromId = searchParams.get('duplicateFrom') || undefined;
  const isEdit = Boolean(productId);
  const navigate = useNavigate();
  const { getProductById, createProductService, updateProductService, loading, warning } = useMasterData();

  const existing = productId ? getProductById(productId) : undefined;
  const duplicateSource = duplicateFromId ? getProductById(duplicateFromId) : undefined;

  const [name, setName] = useState('');
  const [type, setType] = useState<'product' | 'service'>('service');
  const [sku, setSku] = useState('');
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);

  useEffect(() => {
    const source = isEdit ? existing : duplicateSource;
    if (!source) return;
    setName(isEdit ? source.name : `${source.name} Copy`);
    setType(source.type);
    setSku(source.sku ?? '');
    setUnitPrice(source.unitPrice);
    setDescription(source.description ?? '');
    setIsActive(source.isActive);
  }, [duplicateSource, existing, isEdit]);

  const pageTitle = useMemo(() => {
    if (isEdit) return `Edit ${existing?.name ?? 'Item'}`;
    if (duplicateSource) return `Duplicate ${duplicateSource.name}`;
    return 'Create Product/Service';
  }, [duplicateSource, existing?.name, isEdit]);

  if (isEdit && !existing && !loading) {
    return (
      <EmptyState
        title="Item not found"
        description="The product/service may not exist or is unavailable."
        action={
          <Link to="/products-services">
            <Button variant="primary">Back to Products & Services</Button>
          </Link>
        }
      />
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setNotice({ tone: 'error', text: 'Item name is required.' });
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setNotice({ tone: 'error', text: 'Unit price must be 0 or greater.' });
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      type,
      sku: sku.trim() || undefined,
      description: description.trim() || undefined,
      unitPrice,
      isActive,
    };

    const result =
      isEdit && productId
        ? await updateProductService(productId, payload)
        : await createProductService(payload);
    setSaving(false);

    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to save product/service.' });
      return;
    }

    navigate(`/products-services/${result.data.id}`);
  };

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Create or update billable products and services used in quotes and invoices."
        actions={
          <>
            <Link to={isEdit && productId ? `/products-services/${productId}` : '/products-services'}>
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" form="product-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save Item'}
            </Button>
          </>
        }
      />

      {warning ? <InlineNotice tone="warning">{warning}</InlineNotice> : null}
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <form id="product-form" onSubmit={handleSubmit}>
        <Card title="Product / Service Details" subtitle="Billing item setup">
          <div className="dl-form-grid">
            <Input label="Item Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Select
              label="Type"
              value={type}
              onChange={(event) => setType(event.target.value as 'product' | 'service')}
              options={[
                { label: 'Service', value: 'service' },
                { label: 'Product', value: 'product' },
              ]}
            />
            <Input label="SKU" value={sku} onChange={(event) => setSku(event.target.value)} />
            <Input
              label="Unit Price"
              type="number"
              min={0}
              step="0.01"
              value={unitPrice}
              onChange={(event) => setUnitPrice(Number(event.target.value))}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Textarea
              label="Description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Toggle
              id="product-active-toggle"
              label="Item is active"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
          </div>
        </Card>
      </form>
    </>
  );
}

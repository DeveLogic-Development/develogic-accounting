import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Toggle } from '@/design-system/primitives/Toggle';
import { Table } from '@/design-system/primitives/Table';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import {
  loadTaxNumberingSettings,
  NumberingSetting,
  saveTaxNumberingSettings,
  SequenceResetPeriod,
  TaxNumberingSettings,
  TaxRuleSetting,
} from './services/tax-numbering';

function createEmptyTaxRule(): TaxRuleSetting {
  return {
    id: `new-tax-${Date.now()}`,
    name: '',
    code: '',
    rate: 0,
    isDefault: false,
    isActive: true,
  };
}

function sanitizeTaxRules(rules: TaxRuleSetting[]): TaxRuleSetting[] {
  const sanitized = rules
    .map((rule) => ({
      ...rule,
      name: rule.name.trim(),
      code: rule.code.trim(),
      rate: Number.isFinite(Number(rule.rate)) ? Number(rule.rate) : 0,
    }))
    .filter((rule) => rule.name.length > 0);

  if (sanitized.length === 0) return [createEmptyTaxRule()];

  const hasDefault = sanitized.some((rule) => rule.isDefault);
  if (!hasDefault) sanitized[0].isDefault = true;

  return sanitized.map((rule, index) => ({
    ...rule,
    isDefault: rule.isDefault && index === sanitized.findIndex((entry) => entry.isDefault),
  }));
}

export function TaxSettingsPage() {
  const { notify } = useNotifications();
  const [values, setValues] = useState<TaxNumberingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);

  const quoteNextPreview = useMemo(() => {
    if (!values) return '';
    return `${values.quote.prefix}${String(values.quote.nextNumber).padStart(values.quote.padding, '0')}`;
  }, [values]);

  const invoiceNextPreview = useMemo(() => {
    if (!values) return '';
    return `${values.invoice.prefix}${String(values.invoice.nextNumber).padStart(values.invoice.padding, '0')}`;
  }, [values]);

  useEffect(() => {
    let active = true;
    void loadTaxNumberingSettings().then((result) => {
      if (!active) return;
      if (!result.ok) {
        setNotice({ tone: 'error', text: result.error });
        setLoading(false);
        return;
      }

      setValues(result.data);
      if (result.warning) {
        setNotice({ tone: 'warning', text: result.warning });
      } else if (result.mode === 'supabase') {
        setNotice({ tone: 'info', text: 'Tax and numbering settings are connected to Supabase.' });
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const updateQuoteNumbering = <K extends keyof NumberingSetting>(field: K, value: NumberingSetting[K]) => {
    setValues((previous) =>
      previous
        ? {
            ...previous,
            quote: {
              ...previous.quote,
              [field]: value,
            },
          }
        : previous,
    );
  };

  const updateInvoiceNumbering = <K extends keyof NumberingSetting>(field: K, value: NumberingSetting[K]) => {
    setValues((previous) =>
      previous
        ? {
            ...previous,
            invoice: {
              ...previous.invoice,
              [field]: value,
            },
          }
        : previous,
    );
  };

  const updateTaxRule = <K extends keyof TaxRuleSetting>(
    taxId: string,
    field: K,
    value: TaxRuleSetting[K],
  ) => {
    setValues((previous) => {
      if (!previous) return previous;
      const nextRules = previous.taxRules.map((rule) =>
        rule.id === taxId
          ? {
              ...rule,
              [field]: value,
            }
          : rule,
      );

      if (field === 'isDefault' && value === true) {
        return {
          ...previous,
          taxRules: nextRules.map((rule) => ({
            ...rule,
            isDefault: rule.id === taxId,
          })),
        };
      }

      return {
        ...previous,
        taxRules: nextRules,
      };
    });
  };

  const removeTaxRule = (taxId: string) => {
    setValues((previous) => {
      if (!previous) return previous;
      const remaining = previous.taxRules.filter((rule) => rule.id !== taxId);
      return {
        ...previous,
        taxRules: remaining.length > 0 ? remaining : [createEmptyTaxRule()],
      };
    });
  };

  const addTaxRule = () => {
    setValues((previous) =>
      previous
        ? {
            ...previous,
            taxRules: [...previous.taxRules, createEmptyTaxRule()],
          }
        : previous,
    );
  };

  const handleSave = async () => {
    if (!values) return;

    const nextValues: TaxNumberingSettings = {
      ...values,
      taxRules: sanitizeTaxRules(values.taxRules),
      quote: {
        ...values.quote,
        nextNumber: Math.max(1, Math.floor(values.quote.nextNumber)),
        padding: Math.max(1, Math.min(12, Math.floor(values.quote.padding))),
      },
      invoice: {
        ...values.invoice,
        nextNumber: Math.max(1, Math.floor(values.invoice.nextNumber)),
        padding: Math.max(1, Math.min(12, Math.floor(values.invoice.padding))),
      },
    };

    setSaving(true);
    const result = await saveTaxNumberingSettings(nextValues);
    setSaving(false);

    if (!result.ok) {
      setNotice({ tone: 'error', text: result.error });
      notify({
        level: 'error',
        source: 'settings',
        title: 'Save Failed',
        message: result.error,
        persistent: true,
        toast: true,
        route: '/settings/tax',
      });
      return;
    }

    setValues(nextValues);
    setNotice({
      tone: result.warning ? 'warning' : 'success',
      text: result.warning ?? 'Tax and numbering settings saved.',
    });
    notify({
      level: result.warning ? 'warning' : 'success',
      source: 'settings',
      title: 'Tax & Numbering Saved',
      message: result.warning ?? 'Configuration persisted successfully.',
      persistent: false,
      toast: true,
      route: '/settings/tax',
    });
  };

  if (loading || !values) {
    return (
      <>
        <PageHeader title="Tax & Numbering" subtitle="Manage tax rates and quote/invoice sequencing rules." />
        <InlineNotice tone="info">Loading tax and numbering configuration...</InlineNotice>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Tax & Numbering"
        subtitle="Manage tax rates and quote/invoice sequencing rules."
        actions={
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <div className="dl-grid cols-2">
        <Card title="Tax Rates" subtitle="Default and custom tax profiles">
          <Table headers={['Name', 'Code', 'Rate %', 'Default', 'Active', 'Actions']}>
            {values.taxRules.map((rule) => (
              <tr key={rule.id}>
                <td>
                  <input
                    className="dl-input"
                    value={rule.name}
                    onChange={(event) => updateTaxRule(rule.id, 'name', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="dl-input"
                    value={rule.code}
                    onChange={(event) => updateTaxRule(rule.id, 'code', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="dl-input"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={rule.rate}
                    onChange={(event) => updateTaxRule(rule.id, 'rate', Number(event.target.value))}
                  />
                </td>
                <td>
                  <input
                    type="radio"
                    name="default-tax-rule"
                    checked={rule.isDefault}
                    onChange={() => updateTaxRule(rule.id, 'isDefault', true)}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={rule.isActive}
                    onChange={(event) => updateTaxRule(rule.id, 'isActive', event.target.checked)}
                  />
                </td>
                <td>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeTaxRule(rule.id)}
                    disabled={values.taxRules.length <= 1}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary" onClick={addTaxRule}>
              + Add Tax Rule
            </Button>
          </div>
        </Card>

        <Card title="Numbering Sequences" subtitle="Configure document numbering by type">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="dl-form-grid">
              <Input
                label="Quote Prefix"
                value={values.quote.prefix}
                onChange={(event) => updateQuoteNumbering('prefix', event.target.value)}
              />
              <Input
                label="Quote Next Number"
                type="number"
                value={values.quote.nextNumber}
                onChange={(event) => updateQuoteNumbering('nextNumber', Number(event.target.value))}
              />
              <Input
                label="Invoice Prefix"
                value={values.invoice.prefix}
                onChange={(event) => updateInvoiceNumbering('prefix', event.target.value)}
              />
              <Input
                label="Invoice Next Number"
                type="number"
                value={values.invoice.nextNumber}
                onChange={(event) => updateInvoiceNumbering('nextNumber', Number(event.target.value))}
              />
              <Select
                label="Reset Period"
                value={values.quote.resetPeriod}
                onChange={(event) =>
                  updateQuoteNumbering('resetPeriod', event.target.value as SequenceResetPeriod)
                }
                options={[
                  { label: 'Never', value: 'never' },
                  { label: 'Yearly', value: 'yearly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
              />
              <Input
                label="Padding"
                type="number"
                min={1}
                max={12}
                value={values.quote.padding}
                onChange={(event) => updateQuoteNumbering('padding', Number(event.target.value))}
              />
            </div>

            <div className="dl-form-grid">
              <Select
                label="Invoice Reset Period"
                value={values.invoice.resetPeriod}
                onChange={(event) =>
                  updateInvoiceNumbering('resetPeriod', event.target.value as SequenceResetPeriod)
                }
                options={[
                  { label: 'Never', value: 'never' },
                  { label: 'Yearly', value: 'yearly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
              />
              <Input
                label="Invoice Padding"
                type="number"
                min={1}
                max={12}
                value={values.invoice.padding}
                onChange={(event) => updateInvoiceNumbering('padding', Number(event.target.value))}
              />
            </div>

            <div className="dl-grid cols-2">
              <Card title="Next Quote Number">
                <strong>{quoteNextPreview}</strong>
              </Card>
              <Card title="Next Invoice Number">
                <strong>{invoiceNextPreview}</strong>
              </Card>
            </div>

            <Toggle
              id="strictSequence"
              label="Prevent manual number overrides"
              checked={values.strictSequence}
              onChange={(event) =>
                setValues((previous) =>
                  previous
                    ? {
                        ...previous,
                        strictSequence: event.target.checked,
                      }
                    : previous,
                )
              }
            />
          </div>
        </Card>
      </div>
    </>
  );
}


import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Toggle } from '@/design-system/primitives/Toggle';
import { Table } from '@/design-system/primitives/Table';

export function TaxSettingsPage() {
  return (
    <>
      <PageHeader
        title="Tax & Numbering"
        subtitle="Manage tax rates and quote/invoice sequencing rules."
        actions={<Button variant="primary">Save Configuration</Button>}
      />

      <div className="dl-grid cols-2">
        <Card title="Tax Rates" subtitle="Default and custom tax profiles">
          <Table headers={['Name', 'Code', 'Rate', 'Default', 'Active']}>
            <tr>
              <td>VAT 15%</td>
              <td>VAT15</td>
              <td>15%</td>
              <td>Yes</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td>Zero Rated</td>
              <td>VAT0</td>
              <td>0%</td>
              <td>No</td>
              <td>Yes</td>
            </tr>
          </Table>
          <div style={{ marginTop: 12 }}>
            <Button size="sm" variant="secondary">
              + Add Tax Rule
            </Button>
          </div>
        </Card>

        <Card title="Numbering Sequences" subtitle="Configure document numbering by type">
          <div style={{ display: 'grid', gap: 16 }}>
            <div className="dl-form-grid">
              <Input label="Quote Prefix" defaultValue="QUO-" />
              <Input label="Quote Next Number" defaultValue="00233" />
              <Input label="Invoice Prefix" defaultValue="INV-" />
              <Input label="Invoice Next Number" defaultValue="00155" />
              <Select
                label="Reset Period"
                value="yearly"
                options={[
                  { label: 'Never', value: 'never' },
                  { label: 'Yearly', value: 'yearly' },
                  { label: 'Monthly', value: 'monthly' },
                ]}
              />
              <Input label="Padding" defaultValue="5" />
            </div>
            <Toggle id="strictSequence" label="Prevent manual number overrides" defaultChecked />
          </div>
        </Card>
      </div>
    </>
  );
}

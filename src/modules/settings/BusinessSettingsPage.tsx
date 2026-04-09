import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Select } from '@/design-system/primitives/Select';

export function BusinessSettingsPage() {
  return (
    <>
      <PageHeader
        title="Business Settings"
        subtitle="Company identity, branding, and sender defaults."
        actions={<Button variant="primary">Save Changes</Button>}
      />

      <div className="dl-grid cols-2">
        <Card title="Company Profile" subtitle="Core legal and contact details">
          <div className="dl-form-grid">
            <Input label="Business Name" defaultValue="DeveLogic Digital" />
            <Input label="Registration Number" defaultValue="2020/123456/07" />
            <Input label="VAT Number" defaultValue="4123456789" />
            <Input label="Email" defaultValue="finance@develogic.digital" />
            <Input label="Phone" defaultValue="+27 11 555 0100" />
            <Input label="Website" defaultValue="https://develogic.digital" />
            <Select
              label="Default Currency"
              value="ZAR"
              options={[
                { label: 'ZAR', value: 'ZAR' },
                { label: 'USD', value: 'USD' },
                { label: 'EUR', value: 'EUR' },
              ]}
            />
            <Select
              label="Timezone"
              value="Africa/Johannesburg"
              options={[{ label: 'Africa/Johannesburg', value: 'Africa/Johannesburg' }]}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Textarea label="Address" defaultValue="145 Rivonia Road, Sandton, Johannesburg" />
          </div>
        </Card>

        <Card title="Branding" subtitle="Logo and document appearance defaults">
          <div className="dl-preview-pane" style={{ minHeight: 220, marginBottom: 14 }}>
            Logo upload and placement preview
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <Button variant="secondary">Upload Logo</Button>
            <Select
              label="Default Document Font"
              value="manrope"
              options={[
                { label: 'Manrope', value: 'manrope' },
                { label: 'IBM Plex Sans', value: 'ibm' },
              ]}
            />
            <Select
              label="Primary Brand Color"
              value="#174b7a"
              options={[
                { label: 'Brand Blue', value: '#174b7a' },
                { label: 'Emerald', value: '#1c8c66' },
                { label: 'Slate', value: '#374151' },
              ]}
            />
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 16 }}>
        <Card title="Email Sender" subtitle="Outgoing quote and invoice defaults">
          <div className="dl-form-grid">
            <Input label="Sender Name" defaultValue="DeveLogic Finance" />
            <Input label="Sender Email" defaultValue="billing@develogic.digital" />
            <Input label="Reply-To" defaultValue="accounts@develogic.digital" />
            <Input label="Signature Name" defaultValue="Finance Team" />
          </div>
        </Card>
      </div>
    </>
  );
}

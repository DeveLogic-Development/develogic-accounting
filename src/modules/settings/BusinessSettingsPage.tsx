import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Select } from '@/design-system/primitives/Select';
import { Toggle } from '@/design-system/primitives/Toggle';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { useNotifications } from '@/modules/notifications/hooks/useNotifications';
import {
  applyBusinessBrandTheme,
  BusinessSettings,
  defaultBusinessSettings,
  hexToRgbString,
  loadBusinessSettings,
  normalizeHexColor,
  rgbStringToHex,
  saveBusinessSettings,
} from './domain/business-settings';
import { useTemplates } from '@/modules/templates/hooks/useTemplates';
import { canUseSupabaseRuntimeState, loadRuntimeState, saveRuntimeState } from '@/lib/supabase/runtime-state';
import { persistBusinessProfileToSupabase } from './services/business-settings';

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const BRAND_PALETTE: Array<{ label: string; value: string }> = [
  { label: 'DeveLogic Blue', value: '#174B7A' },
  { label: 'Emerald Green', value: '#1C8C66' },
  { label: 'Forest Green', value: '#0F766E' },
  { label: 'Sage Green', value: '#2F855A' },
  { label: 'Teal', value: '#0D9488' },
  { label: 'Slate', value: '#374151' },
  { label: 'Ocean', value: '#0369A1' },
  { label: 'Charcoal', value: '#334155' },
];

export function BusinessSettingsPage() {
  const { notify } = useNotifications();
  const { saveLogoAsset } = useTemplates();
  const [values, setValues] = useState<BusinessSettings>(loadBusinessSettings);
  const [hexInput, setHexInput] = useState(values.brandColor);
  const [rgbInput, setRgbInput] = useState(hexToRgbString(values.brandColor));
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const previewBrandColor = normalizeHexColor(hexInput) ?? values.brandColor;

  const activePalette = useMemo(
    () => BRAND_PALETTE.find((entry) => entry.value === values.brandColor)?.value,
    [values.brandColor],
  );

  useEffect(() => {
    if (!canUseSupabaseRuntimeState()) return;
    void loadRuntimeState<BusinessSettings>('business_settings').then((result) => {
      if (!result.ok || !result.data) return;
      setValues(result.data);
      setHexInput(result.data.brandColor);
      setRgbInput(hexToRgbString(result.data.brandColor));
      applyBusinessBrandTheme(result.data);
    });
  }, []);

  const updateField = <K extends keyof BusinessSettings>(field: K, value: BusinessSettings[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const normalizedBrand = normalizeHexColor(hexInput);
    if (!normalizedBrand) {
      setNotice({ tone: 'error', text: 'Primary brand color must be a valid HEX color.' });
      return;
    }

    const nextValues: BusinessSettings = {
      ...values,
      brandColor: normalizedBrand,
      eftProofAllowedMimeTypes:
        values.eftProofAllowedMimeTypes.length > 0
          ? values.eftProofAllowedMimeTypes
          : defaultBusinessSettings.eftProofAllowedMimeTypes,
      eftProofMaxFileSizeBytes:
        values.eftProofMaxFileSizeBytes > 0
          ? values.eftProofMaxFileSizeBytes
          : defaultBusinessSettings.eftProofMaxFileSizeBytes,
    };

    try {
      saveBusinessSettings(nextValues);
      applyBusinessBrandTheme(nextValues);
      void saveRuntimeState('business_settings', nextValues);
      void persistBusinessProfileToSupabase(nextValues);
      setValues(nextValues);
      setHexInput(nextValues.brandColor);
      setRgbInput(hexToRgbString(nextValues.brandColor));
      setNotice({ tone: 'success', text: 'Business settings saved locally.' });
      notify({
        level: 'success',
        source: 'settings',
        title: 'Business Settings Saved',
        message: 'Your business profile and sender defaults were updated.',
        persistent: false,
        toast: true,
        route: '/settings/business',
      });
    } catch {
      setNotice({ tone: 'error', text: 'Could not save settings locally. Please try again.' });
      notify({
        level: 'error',
        source: 'settings',
        title: 'Save Failed',
        message: 'Business settings could not be saved locally.',
        persistent: true,
        toast: true,
        route: '/settings/business',
        dedupeKey: 'settings:business:save-error',
      });
    }
  };

  const handleLogoUploadClick = () => {
    logoInputRef.current?.click();
  };

  const handleLogoSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.has(file.type)) {
      setNotice({ tone: 'error', text: 'Logo must be PNG, JPG, WEBP, or SVG.' });
      notify({
        level: 'error',
        source: 'settings',
        title: 'Invalid Logo File',
        message: 'Please upload a PNG, JPG, WEBP, or SVG file.',
        persistent: false,
        toast: true,
        route: '/settings/business',
      });
      event.target.value = '';
      return;
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setNotice({ tone: 'error', text: 'Logo file must be 2 MB or smaller.' });
      notify({
        level: 'error',
        source: 'settings',
        title: 'Logo Too Large',
        message: 'Please upload a logo up to 2 MB.',
        persistent: false,
        toast: true,
        route: '/settings/business',
      });
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        setNotice({ tone: 'error', text: 'Unable to read the selected logo file.' });
        return;
      }

      const logoSaveResult = saveLogoAsset({
        name: file.name,
        url: dataUrl,
        kind: 'uploaded',
      });

      setValues((previous) => ({
        ...previous,
        logoDataUrl: dataUrl,
        logoFileName: file.name,
        logoAssetId: logoSaveResult.ok ? logoSaveResult.data?.id : previous.logoAssetId,
      }));
      setNotice({
        tone: logoSaveResult.ok ? 'success' : 'warning',
        text: logoSaveResult.ok
          ? 'Logo uploaded. Click Save Changes to persist it.'
          : 'Logo uploaded for Business Settings. Template library registration failed.',
      });
      notify({
        level: logoSaveResult.ok ? 'success' : 'warning',
        source: 'settings',
        title: logoSaveResult.ok ? 'Logo Uploaded' : 'Logo Uploaded With Warning',
        message: logoSaveResult.ok
          ? `${file.name} is ready to use.`
          : `${file.name} was set for Business Settings, but template registration failed.`,
        persistent: false,
        toast: true,
        route: '/settings/business',
      });
      event.target.value = '';
    };

    reader.onerror = () => {
      setNotice({ tone: 'error', text: 'Unable to read the selected logo file.' });
      event.target.value = '';
    };

    reader.readAsDataURL(file);
  };

  const handleLogoRemove = () => {
    setValues((previous) => ({
      ...previous,
      logoDataUrl: undefined,
      logoFileName: undefined,
      }));
    setNotice({ tone: 'info', text: 'Logo removed. Click Save Changes to persist this update.' });
    notify({
      level: 'info',
      source: 'settings',
      title: 'Logo Removed',
      message: 'Your business logo was removed from settings.',
      persistent: false,
      toast: true,
      route: '/settings/business',
    });
  };

  return (
    <>
      <PageHeader
        title="Business Settings"
        subtitle="Company identity, branding, and sender defaults."
        actions={
          <Button variant="primary" onClick={handleSave}>
            Save Changes
          </Button>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      <div className="dl-grid cols-2">
        <Card title="Company Profile" subtitle="Core legal and contact details">
          <div className="dl-form-grid">
            <Input label="Business Name" value={values.businessName} onChange={(event) => updateField('businessName', event.target.value)} />
            <Input label="Registration Number" value={values.registrationNumber} onChange={(event) => updateField('registrationNumber', event.target.value)} />
            <Input label="VAT Number" value={values.vatNumber} onChange={(event) => updateField('vatNumber', event.target.value)} />
            <Input label="Email" value={values.email} onChange={(event) => updateField('email', event.target.value)} />
            <Input label="Phone" value={values.phone} onChange={(event) => updateField('phone', event.target.value)} />
            <Input label="Website" value={values.website} onChange={(event) => updateField('website', event.target.value)} />
            <Select
              label="Default Currency"
              value={values.currency}
              onChange={(event) => updateField('currency', event.target.value)}
              options={[
                { label: 'ZAR', value: 'ZAR' },
                { label: 'USD', value: 'USD' },
                { label: 'EUR', value: 'EUR' },
              ]}
            />
            <Select
              label="Timezone"
              value={values.timezone}
              onChange={(event) => updateField('timezone', event.target.value)}
              options={[{ label: 'Africa/Johannesburg', value: 'Africa/Johannesburg' }]}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Textarea label="Address" value={values.address} onChange={(event) => updateField('address', event.target.value)} />
          </div>
        </Card>

        <Card title="Branding" subtitle="Logo and document appearance defaults">
          <div className="dl-preview-pane" style={{ minHeight: 220, marginBottom: 14, padding: 16 }}>
            {values.logoDataUrl ? (
              <img
                src={values.logoDataUrl}
                alt="Business logo preview"
                style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain' }}
              />
            ) : (
              'Logo upload and placement preview'
            )}
          </div>
          <div style={{ margin: 0, padding: 0, border: 0, display: 'grid', gap: 10 }}>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoSelected}
              style={{ display: 'none' }}
            />
            <div className="dl-inline-actions">
              <Button variant="secondary" onClick={handleLogoUploadClick}>
                Upload Logo
              </Button>
              {values.logoDataUrl ? (
                <Button variant="ghost" onClick={handleLogoRemove}>
                  Remove Logo
                </Button>
              ) : null}
            </div>
            <span className="dl-field-help">
              Accepted: PNG, JPG, WEBP, SVG · Max file size: 2 MB
              {values.logoFileName ? ` · Current: ${values.logoFileName}` : ''}
            </span>
            <div className="dl-field">
              <label>Brand Palette</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {BRAND_PALETTE.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => {
                      setHexInput(entry.value);
                      setRgbInput(hexToRgbString(entry.value));
                      updateField('brandColor', entry.value);
                    }}
                    className="dl-icon-btn"
                    title={entry.label}
                    style={{
                      width: 32,
                      height: 32,
                      borderColor: activePalette === entry.value ? 'var(--color-brand-700)' : 'var(--border-default)',
                      boxShadow: activePalette === entry.value ? '0 0 0 2px var(--color-brand-100)' : undefined,
                      background: entry.value,
                    }}
                    aria-label={`Set primary color to ${entry.label}`}
                  />
                ))}
              </div>
            </div>
            <Input
              label="Primary Brand Color (HEX)"
              value={hexInput}
              onChange={(event) => {
                setHexInput(event.target.value);
                const normalized = normalizeHexColor(event.target.value);
                if (normalized) {
                  updateField('brandColor', normalized);
                  setRgbInput(hexToRgbString(normalized));
                }
              }}
              helperText="Examples: #174B7A or 174B7A"
            />
            <Input
              label="Primary Brand Color (RGB)"
              value={rgbInput}
              onChange={(event) => {
                setRgbInput(event.target.value);
                const nextHex = rgbStringToHex(event.target.value);
                if (nextHex) {
                  setHexInput(nextHex);
                  updateField('brandColor', nextHex);
                }
              }}
              helperText="Format: r, g, b (for example 23, 75, 122)"
            />
            <Input
              label="Color Picker"
              type="color"
              value={previewBrandColor}
              onChange={(event) => {
                const nextHex = normalizeHexColor(event.target.value) ?? defaultBusinessSettings.brandColor;
                setHexInput(nextHex);
                setRgbInput(hexToRgbString(nextHex));
                updateField('brandColor', nextHex);
              }}
            />
            <Select
              label="Default Document Font"
              value={values.fontFamily}
              onChange={(event) => updateField('fontFamily', event.target.value)}
              options={[
                { label: 'Manrope', value: 'manrope' },
                { label: 'IBM Plex Sans', value: 'ibm' },
              ]}
            />
            <Select
              label="Primary Brand Color"
              value={values.brandColor}
              onChange={(event) => {
                const nextHex = normalizeHexColor(event.target.value) ?? defaultBusinessSettings.brandColor;
                updateField('brandColor', nextHex);
                setHexInput(nextHex);
                setRgbInput(hexToRgbString(nextHex));
              }}
              options={[
                ...BRAND_PALETTE.map((entry) => ({ label: entry.label, value: entry.value })),
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="dl-page-section">
        <Card title="EFT Payment Settings" subtitle="Manual EFT payment instructions and proof-of-payment behavior">
          <div className="dl-form-grid">
            <Toggle
              id="settings-eft-enabled"
              label="Enable EFT as invoice payment method"
              checked={values.eftEnabled}
              onChange={(event) => updateField('eftEnabled', event.target.checked)}
            />
            <Toggle
              id="settings-eft-public-submission"
              label="Enable public proof-of-payment submissions"
              checked={values.eftPublicSubmissionEnabled}
              onChange={(event) => updateField('eftPublicSubmissionEnabled', event.target.checked)}
            />
            <Toggle
              id="settings-eft-include-link"
              label="Include proof submission link in invoice emails"
              checked={values.eftIncludePublicSubmissionLinkInEmail}
              onChange={(event) => updateField('eftIncludePublicSubmissionLinkInEmail', event.target.checked)}
            />
            <Input
              label="Bank Name"
              value={values.eftBankName}
              onChange={(event) => updateField('eftBankName', event.target.value)}
            />
            <Input
              label="Account Holder"
              value={values.eftAccountHolder}
              onChange={(event) => updateField('eftAccountHolder', event.target.value)}
            />
            <Input
              label="Account Number"
              value={values.eftAccountNumber}
              onChange={(event) => updateField('eftAccountNumber', event.target.value)}
            />
            <Input
              label="Branch Code"
              value={values.eftBranchCode}
              onChange={(event) => updateField('eftBranchCode', event.target.value)}
            />
            <Input
              label="Account Type"
              value={values.eftAccountType}
              onChange={(event) => updateField('eftAccountType', event.target.value)}
            />
            <Input
              label="SWIFT / BIC (Optional)"
              value={values.eftSwiftBic ?? ''}
              onChange={(event) => updateField('eftSwiftBic', event.target.value)}
            />
            <Input
              label="Payment Reference Instruction"
              value={values.eftReferenceInstruction}
              onChange={(event) => updateField('eftReferenceInstruction', event.target.value)}
              helperText="Use {{invoice_number}} to include the invoice number in instruction text."
            />
            <Input
              label="Allowed POP File Types"
              value={values.eftProofAllowedMimeTypes.join(', ')}
              onChange={(event) =>
                updateField(
                  'eftProofAllowedMimeTypes',
                  event.target.value
                    .split(',')
                    .map((entry) => entry.trim().toLowerCase())
                    .filter(Boolean),
                )
              }
              helperText="Comma-separated MIME types, e.g. application/pdf, image/jpeg, image/png"
            />
            <Input
              label="Maximum POP File Size (MB)"
              type="number"
              min={1}
              value={String(Math.max(1, Math.round(values.eftProofMaxFileSizeBytes / 1024 / 1024)))}
              onChange={(event) => {
                const mb = Number(event.target.value);
                if (!Number.isFinite(mb)) return;
                updateField('eftProofMaxFileSizeBytes', Math.max(1, Math.round(mb)) * 1024 * 1024);
              }}
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Textarea
              label="EFT Instruction Notes"
              value={values.eftInstructionNotes}
              onChange={(event) => updateField('eftInstructionNotes', event.target.value)}
            />
          </div>
        </Card>
      </div>

      <div className="dl-page-section">
        <Card title="Email Sender" subtitle="Outgoing quote and invoice defaults">
          <div className="dl-form-grid">
            <Input label="Sender Name" value={values.senderName} onChange={(event) => updateField('senderName', event.target.value)} />
            <Input label="Sender Email" value={values.senderEmail} onChange={(event) => updateField('senderEmail', event.target.value)} />
            <Input label="Reply-To" value={values.replyTo} onChange={(event) => updateField('replyTo', event.target.value)} />
            <Input label="Signature Name" value={values.signatureName} onChange={(event) => updateField('signatureName', event.target.value)} />
          </div>
        </Card>
      </div>
    </>
  );
}

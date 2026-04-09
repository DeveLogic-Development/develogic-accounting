import { formatDate } from '@/utils/format';
import { mapTemplatePreviewModel } from '../domain/preview';
import { TemplateConfig, TemplatePreviewPayload } from '../domain/types';

interface TemplatePreviewRendererProps {
  config: TemplateConfig;
  payload: TemplatePreviewPayload;
}

export function TemplatePreviewRenderer({ config, payload }: TemplatePreviewRendererProps) {
  const model = mapTemplatePreviewModel(config, payload);

  return (
    <article
      style={{
        background: '#ffffff',
        color: '#1f2937',
        border: '1px solid #d8e0e8',
        borderRadius: 10,
        padding: config.layout.density === 'compact' ? 14 : 20,
        fontFamily: fontFamilyValue(config.branding.fontFamily),
      }}
    >
      {config.sections.businessDetails.enabled || config.sections.metadata.enabled ? (
        <header
          style={{
            display: 'grid',
            gridTemplateColumns: config.layout.headerLayout === 'split' ? '1fr 1fr' : '1fr',
            gap: 12,
            marginBottom: config.layout.sectionSpacing,
            padding: config.layout.headerLayout === 'banner' ? '12px 14px' : 0,
            background:
              config.layout.headerLayout === 'banner'
                ? `${config.branding.primaryColor}10`
                : 'transparent',
            borderRadius: 8,
          }}
        >
          <div style={{ textAlign: config.branding.logoPlacement }}>
            {config.branding.logoUrl ? (
              <img src={config.branding.logoUrl} alt="Template Logo" style={{ width: 120, height: 'auto' }} />
            ) : (
              <div
                style={{
                  width: 120,
                  height: 34,
                  borderRadius: 8,
                  background: `${config.branding.primaryColor}20`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#4b5563',
                }}
              >
                Logo
              </div>
            )}
            <div
              style={{
                marginTop: 10,
                fontSize: 20,
                fontWeight: headingWeight(config.branding.titleEmphasis),
                color: config.branding.primaryColor,
              }}
            >
              {model.title}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>{model.subtitle}</div>
          </div>

          {config.sections.metadata.enabled ? (
            <div style={{ display: 'grid', gap: 6 }}>
              {model.metadata.map((entry) => (
                <div key={entry.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>{entry.label}</span>
                  <strong style={{ fontSize: 12 }}>{entry.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </header>
      ) : null}

      {(config.sections.businessDetails.enabled || config.sections.clientDetails.enabled) && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginBottom: config.layout.sectionSpacing,
          }}
        >
          {config.sections.businessDetails.enabled ? (
            <AddressBlock
              title={config.sections.businessDetails.title}
              lines={payload.business.addressLines}
              name={payload.business.name}
              contactName={config.fieldVisibility.businessFields.showContactEmail ? payload.business.contactName : ''}
              email={config.fieldVisibility.businessFields.showContactEmail ? payload.business.email : undefined}
              phone={config.fieldVisibility.businessFields.showContactPhone ? payload.business.phone : undefined}
              registrationNumber={
                config.fieldVisibility.businessFields.showRegistrationNumber
                  ? payload.business.registrationNumber
                  : undefined
              }
              taxNumber={
                config.fieldVisibility.businessFields.showTaxNumber ? payload.business.taxNumber : undefined
              }
            />
          ) : null}

          {config.sections.clientDetails.enabled ? (
            <AddressBlock
              title={config.sections.clientDetails.title}
              lines={payload.client.addressLines}
              name={payload.client.name}
              contactName={config.fieldVisibility.clientFields.showContactName ? payload.client.contactName : ''}
              email={config.fieldVisibility.clientFields.showEmail ? payload.client.email : undefined}
              phone={config.fieldVisibility.clientFields.showPhone ? payload.client.phone : undefined}
            />
          ) : null}
        </section>
      )}

      {config.sections.lineItems.enabled ? (
        <section style={{ marginBottom: config.layout.sectionSpacing }}>
          <h4 style={{ margin: 0, marginBottom: 8 }}>{config.sections.lineItems.title}</h4>
          <div className="dl-line-editor">
            <table>
              <thead>
                <tr>
                  {model.tableColumns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.tableRows.map((row) => (
                  <tr key={row.id}>
                    {model.tableColumns.map((column) => (
                      <td key={`${row.id}_${column.key}`}>{row.values[column.key]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {config.sections.summary.enabled ? (
        <section style={{ marginBottom: config.layout.sectionSpacing }}>
          <h4 style={{ margin: 0, marginBottom: 8 }}>{config.sections.summary.title}</h4>
          <div
            style={{
              marginLeft: config.summary.alignment === 'right' ? 'auto' : 0,
              width: config.layout.summaryPanelPosition === 'right' ? 'min(360px, 100%)' : '100%',
              border:
                config.summary.emphasizeTotal === 'boxed' ? `1px solid ${config.branding.accentColor}33` : 'none',
              borderRadius: 8,
              padding: config.summary.emphasizeTotal === 'boxed' ? 10 : 0,
            }}
          >
            {model.summaryRows
              .filter((row) => row.visible)
              .map((row, index, arr) => {
                const isTotal = index === arr.findIndex((entry) => entry.label === config.summary.labels.total);
                return (
                  <div
                    key={row.label}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontWeight: isTotal ? 700 : 500,
                      borderTop: isTotal ? '1px solid #d8e0e8' : 'none',
                      marginTop: isTotal ? 8 : 0,
                      paddingTop: isTotal ? 8 : 4,
                    }}
                  >
                    <span style={{ color: '#4b5563' }}>{row.label}</span>
                    <span>{row.value}</span>
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}

      {config.sections.paymentTerms.enabled && payload.paymentTerms ? (
        <section style={{ marginBottom: config.layout.sectionSpacing }}>
          <h4 style={{ margin: 0, marginBottom: 6 }}>{config.sections.paymentTerms.title}</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>{payload.paymentTerms}</p>
        </section>
      ) : null}

      {config.sections.notes.enabled && payload.notes ? (
        <section style={{ marginBottom: config.layout.sectionSpacing }}>
          <h4 style={{ margin: 0, marginBottom: 6 }}>{config.sections.notes.title}</h4>
          <p style={{ margin: 0, fontSize: 13, color: '#4b5563' }}>{payload.notes}</p>
        </section>
      ) : null}

      {config.sections.footer.enabled ? (
        <footer style={{ borderTop: '1px solid #d8e0e8', paddingTop: 8, color: '#6b7280', fontSize: 11 }}>
          <div>{config.footer.legalText}</div>
          {config.footer.showPaymentInstructions ? (
            <div style={{ marginTop: 4 }}>
              {config.footer.paymentInstructionsLabel}: {config.footer.paymentInstructionsText}
            </div>
          ) : null}
          <div style={{ marginTop: 4 }}>Preview generated {formatDate(payload.issueDate)}</div>
        </footer>
      ) : null}
    </article>
  );
}

function fontFamilyValue(font: TemplateConfig['branding']['fontFamily']): string {
  switch (font) {
    case 'ibm_plex_sans':
      return '"IBM Plex Sans", sans-serif';
    case 'source_serif_4':
      return '"Source Serif 4", serif';
    default:
      return '"Manrope", sans-serif';
  }
}

function headingWeight(emphasis: TemplateConfig['branding']['titleEmphasis']): number {
  if (emphasis === 'bold') return 800;
  if (emphasis === 'boxed') return 700;
  return 600;
}

interface AddressBlockProps {
  title: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  registrationNumber?: string;
  taxNumber?: string;
  lines: string[];
}

function AddressBlock({
  title,
  name,
  contactName,
  email,
  phone,
  registrationNumber,
  taxNumber,
  lines,
}: AddressBlockProps) {
  return (
    <div>
      <h4 style={{ margin: 0, marginBottom: 6 }}>{title}</h4>
      <div style={{ fontSize: 13, color: '#4b5563', display: 'grid', gap: 2 }}>
        <strong style={{ color: '#111827' }}>{name}</strong>
        {contactName ? <div>{contactName}</div> : null}
        {lines.map((line) => (
          <div key={`${title}_${line}`}>{line}</div>
        ))}
        {email ? <div>{email}</div> : null}
        {phone ? <div>{phone}</div> : null}
        {registrationNumber ? <div>Reg: {registrationNumber}</div> : null}
        {taxNumber ? <div>Tax: {taxNumber}</div> : null}
      </div>
    </div>
  );
}

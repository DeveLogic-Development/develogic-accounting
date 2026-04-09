import { ChangeEvent, Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { TemplateBuilderLayout } from '@/design-system/patterns/TemplateBuilderLayout';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Toggle } from '@/design-system/primitives/Toggle';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { TemplatePreviewRenderer } from './components/TemplatePreviewRenderer';
import { TEMPLATE_PRESETS, createDefaultTemplateConfigForType, createTemplateFromPreset } from './domain/defaults';
import { createInvoiceTemplatePreviewPayload, createQuoteTemplatePreviewPayload } from './domain/sample-preview';
import { useTemplates } from './hooks/useTemplates';
import { DocumentTemplateType, TemplateConfig, TemplatePresetReference } from './domain/types';

type EditorSection = 'branding' | 'layout' | 'visibility' | 'table' | 'summary' | 'footer';

function cloneConfig(config: TemplateConfig): TemplateConfig {
  return JSON.parse(JSON.stringify(config)) as TemplateConfig;
}

export function TemplateEditorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { templateId } = useParams();
  const isCreateMode = !templateId || templateId === 'new';
  const previewOnly = searchParams.get('preview') === '1';

  const {
    state,
    getTemplateSnapshot,
    createTemplate,
    updateTemplateDraft,
    publishTemplate,
    duplicateTemplate,
    archiveTemplate,
    saveLogoAsset,
  } = useTemplates();

  const snapshot = !isCreateMode && templateId ? getTemplateSnapshot(templateId) : undefined;

  const [templateName, setTemplateName] = useState('New Template');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateType, setTemplateType] = useState<DocumentTemplateType>('quote');
  const [presetId, setPresetId] = useState('preset_modern_minimal');
  const [presetRef, setPresetRef] = useState<TemplatePresetReference | undefined>(undefined);
  const [config, setConfig] = useState<TemplateConfig>(() => createDefaultTemplateConfigForType('quote'));
  const [selectedSection, setSelectedSection] = useState<EditorSection>('branding');
  const [changeNote, setChangeNote] = useState('');
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [logoNameInput, setLogoNameInput] = useState('Uploaded Logo');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isCreateMode) {
      if (presetId === 'blank_custom') {
        setTemplateName('Custom Template');
        setTemplateDescription('Custom structured template');
        setPresetRef(undefined);
        setConfig(cloneConfig(createDefaultTemplateConfigForType(templateType)));
        return;
      }

      const preset = createTemplateFromPreset(presetId);
      if (!preset) return;
      setTemplateName(preset.name);
      setTemplateDescription(preset.description);
      setTemplateType(preset.type);
      setPresetRef(preset.preset);
      setConfig(cloneConfig(preset.config));
      return;
    }

    if (!snapshot) return;
    if (!snapshot.editableVersion) return;

    setTemplateName(snapshot.template.name);
    setTemplateDescription(snapshot.template.description);
    setTemplateType(snapshot.template.type);
    setPresetRef(snapshot.template.preset);
    setConfig(cloneConfig(snapshot.editableVersion.config));
  }, [isCreateMode, presetId, snapshot, templateType]);

  if (!isCreateMode && !snapshot) {
    return (
      <EmptyState
        title="Template not found"
        description="This template may have been removed."
        action={
          <Link to="/templates">
            <Button variant="primary">Back to Library</Button>
          </Link>
        }
      />
    );
  }

  const previewPayload =
    templateType === 'invoice' ? createInvoiceTemplatePreviewPayload() : createQuoteTemplatePreviewPayload();

  const editable = !previewOnly && (!snapshot || snapshot.template.status !== 'archived');

  const handleSaveDraft = () => {
    if (!editable) return;

    if (isCreateMode) {
      const result = createTemplate({
        name: templateName,
        description: templateDescription,
        type: templateType,
        config,
        preset: presetRef,
      });
      if (!result.ok || !result.data) {
        setMessage(result.error ?? 'Unable to create template.');
        return;
      }

      setMessage('Template draft created.');
      navigate(`/templates/${result.data.id}/editor`);
      return;
    }

    if (!templateId) return;
    const result = updateTemplateDraft({
      templateId,
      config,
      changeNote: changeNote.trim() || undefined,
      name: templateName,
      description: templateDescription,
    });

    setMessage(result.ok ? 'Template draft saved.' : result.error ?? 'Unable to save template draft.');
  };

  const handlePublish = () => {
    if (!editable) return;

    if (isCreateMode) {
      const createResult = createTemplate({
        name: templateName,
        description: templateDescription,
        type: templateType,
        config,
        preset: presetRef,
      });
      if (!createResult.ok || !createResult.data) {
        setMessage(createResult.error ?? 'Unable to create template.');
        return;
      }

      const publishResult = publishTemplate(createResult.data.id, changeNote || 'Initial template publish');
      setMessage(
        publishResult.ok
          ? 'Template published.'
          : publishResult.error ?? 'Unable to publish template.',
      );
      navigate(`/templates/${createResult.data.id}/editor`);
      return;
    }

    if (!templateId) return;
    const draftResult = updateTemplateDraft({
      templateId,
      config,
      changeNote: changeNote.trim() || undefined,
      name: templateName,
      description: templateDescription,
    });

    if (!draftResult.ok) {
      setMessage(draftResult.error ?? 'Unable to save draft before publish.');
      return;
    }

    const publishResult = publishTemplate(templateId, changeNote || 'Published from editor');
    setMessage(
      publishResult.ok
        ? 'Template published successfully.'
        : publishResult.error ?? 'Unable to publish template.',
    );
  };

  const handleDuplicate = () => {
    if (!templateId || isCreateMode) return;
    const result = duplicateTemplate(templateId);
    if (!result.ok || !result.data) {
      setMessage(result.error ?? 'Unable to duplicate template.');
      return;
    }

    navigate(`/templates/${result.data.id}/editor`);
  };

  const handleArchive = () => {
    if (!templateId || isCreateMode) return;
    const result = archiveTemplate(templateId);
    setMessage(result.ok ? 'Template archived.' : result.error ?? 'Unable to archive template.');
  };

  const handleLogoUrlSave = () => {
    if (!logoUrlInput.trim()) return;
    const result = saveLogoAsset({
      name: logoNameInput.trim() || 'Uploaded Logo',
      url: logoUrlInput.trim(),
    });
    if (!result.ok || !result.data) {
      setMessage(result.error ?? 'Unable to save logo.');
      return;
    }

    setConfig((previous) => ({
      ...previous,
      branding: {
        ...previous.branding,
        logoAssetId: result.data?.id,
        logoUrl: result.data?.url,
      },
    }));
    setMessage('Logo saved and assigned to template branding.');
    setLogoUrlInput('');
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = saveLogoAsset({
        name: file.name,
        url: String(reader.result),
      });
      if (!result.ok || !result.data) {
        setMessage(result.error ?? 'Unable to save uploaded logo.');
        return;
      }

      setConfig((previous) => ({
        ...previous,
        branding: {
          ...previous.branding,
          logoAssetId: result.data?.id,
          logoUrl: result.data?.url,
        },
      }));
      setMessage('Uploaded logo assigned.');
    };

    reader.readAsDataURL(file);
  };

  return (
    <>
      <PageHeader
        title={`${templateName} Editor`}
        subtitle="Configure structured template blocks, branding controls, and version-safe publishing."
        actions={
          <>
            {!isCreateMode ? (
              <Button variant="secondary" onClick={handleDuplicate} disabled={!editable}>
                Duplicate
              </Button>
            ) : null}
            <Button variant="secondary" onClick={handleSaveDraft} disabled={!editable}>
              Save Draft Version
            </Button>
            <Button variant="primary" onClick={handlePublish} disabled={!editable}>
              Publish Version
            </Button>
            {!isCreateMode ? (
              <Button onClick={handleArchive} disabled={!editable}>Archive</Button>
            ) : null}
          </>
        }
      />

      {message ? <div className="dl-validation-inline" style={{ marginBottom: 12 }}>{message}</div> : null}

      <TemplateBuilderLayout
        leftPanel={
          <>
            <h3 style={{ marginTop: 0 }}>Template Setup</h3>
            {isCreateMode ? (
              <Select
                label="Starter Preset"
                value={presetId}
                onChange={(event) => setPresetId(event.target.value)}
                options={[
                  { label: 'Blank Custom', value: 'blank_custom' },
                  ...TEMPLATE_PRESETS.map((preset) => ({ label: preset.name, value: preset.id })),
                ]}
                disabled={!editable}
              />
            ) : null}
            <Input
              label="Template Name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              disabled={!editable}
            />
            <Textarea
              label="Description"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              disabled={!editable}
            />
            <Select
              label="Template Type"
              value={templateType}
              onChange={(event) => setTemplateType(event.target.value as DocumentTemplateType)}
              options={[
                { label: 'Quote', value: 'quote' },
                { label: 'Invoice', value: 'invoice' },
                { label: 'Universal', value: 'universal' },
              ]}
              disabled={!editable || !isCreateMode}
            />
            <Input
              label="Version Note"
              value={changeNote}
              onChange={(event) => setChangeNote(event.target.value)}
              placeholder="Optional change note for this version"
              disabled={!editable}
            />

            <div className="dl-divider" />
            <h3>Blocks</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {[
                ['branding', 'Branding'],
                ['layout', 'Layout'],
                ['visibility', 'Visibility'],
                ['table', 'Table'],
                ['summary', 'Summary'],
                ['footer', 'Footer'],
              ].map(([section, label]) => (
                <Button
                  key={section}
                  size="sm"
                  variant={selectedSection === section ? 'primary' : 'secondary'}
                  onClick={() => setSelectedSection(section as EditorSection)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <div className="dl-divider" />
            <h3>Section Visibility</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(config.sections).map(([key, section]) => (
                <Toggle
                  key={key}
                  id={`section_${key}`}
                  label={section.title}
                  checked={section.enabled}
                  disabled={!editable || key === 'lineItems'}
                  onChange={(event) =>
                    setConfig((previous) => ({
                      ...previous,
                      sections: {
                        ...previous.sections,
                        [key]: {
                          ...previous.sections[key as keyof TemplateConfig['sections']],
                          enabled: event.target.checked,
                        },
                      },
                    }))
                  }
                />
              ))}
            </div>
          </>
        }
        preview={
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
              <strong>Live Preview</strong>
              <span className="dl-muted" style={{ fontSize: 12 }}>
                {isCreateMode
                  ? 'Draft template'
                  : `Published v${snapshot?.publishedVersion?.versionNumber ?? 'N/A'} · Draft v${snapshot?.draftVersion?.versionNumber ?? 'N/A'}`}
              </span>
            </div>
            <TemplatePreviewRenderer config={config} payload={previewPayload} />
          </>
        }
        rightPanel={
          <>
            <h3 style={{ marginTop: 0 }}>Properties</h3>
            {selectedSection === 'branding' ? (
              <BrandingPanel
                config={config}
                editable={editable}
                logoAssets={state.logoAssets}
                logoNameInput={logoNameInput}
                logoUrlInput={logoUrlInput}
                setLogoNameInput={setLogoNameInput}
                setLogoUrlInput={setLogoUrlInput}
                onConfigChange={setConfig}
                onLogoUrlSave={handleLogoUrlSave}
                onFileUpload={handleFileUpload}
              />
            ) : null}

            {selectedSection === 'layout' ? (
              <LayoutPanel config={config} editable={editable} onConfigChange={setConfig} />
            ) : null}

            {selectedSection === 'visibility' ? (
              <VisibilityPanel config={config} editable={editable} onConfigChange={setConfig} />
            ) : null}

            {selectedSection === 'table' ? (
              <TablePanel config={config} editable={editable} onConfigChange={setConfig} />
            ) : null}

            {selectedSection === 'summary' ? (
              <SummaryPanel config={config} editable={editable} onConfigChange={setConfig} />
            ) : null}

            {selectedSection === 'footer' ? (
              <FooterPanel config={config} editable={editable} onConfigChange={setConfig} />
            ) : null}
          </>
        }
      />
    </>
  );
}

interface PanelProps {
  config: TemplateConfig;
  editable: boolean;
  onConfigChange: Dispatch<SetStateAction<TemplateConfig>>;
}

function BrandingPanel({
  config,
  editable,
  onConfigChange,
  logoAssets,
  logoNameInput,
  logoUrlInput,
  setLogoNameInput,
  setLogoUrlInput,
  onLogoUrlSave,
  onFileUpload,
}: PanelProps & {
  logoAssets: ReturnType<typeof useTemplates>['state']['logoAssets'];
  logoNameInput: string;
  logoUrlInput: string;
  setLogoNameInput: (value: string) => void;
  setLogoUrlInput: (value: string) => void;
  onLogoUrlSave: () => void;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Select
        label="Font Family"
        value={config.branding.fontFamily}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            branding: { ...previous.branding, fontFamily: event.target.value as TemplateConfig['branding']['fontFamily'] },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Manrope', value: 'manrope' },
          { label: 'IBM Plex Sans', value: 'ibm_plex_sans' },
          { label: 'Source Serif 4', value: 'source_serif_4' },
        ]}
      />
      <Select
        label="Logo Placement"
        value={config.branding.logoPlacement}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            branding: {
              ...previous.branding,
              logoPlacement: event.target.value as TemplateConfig['branding']['logoPlacement'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ]}
      />
      <Input
        label="Primary Color"
        value={config.branding.primaryColor}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            branding: { ...previous.branding, primaryColor: event.target.value },
          }))
        }
        disabled={!editable}
      />
      <Input
        label="Accent Color"
        value={config.branding.accentColor}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            branding: { ...previous.branding, accentColor: event.target.value },
          }))
        }
        disabled={!editable}
      />
      <Select
        label="Title Emphasis"
        value={config.branding.titleEmphasis}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            branding: {
              ...previous.branding,
              titleEmphasis: event.target.value as TemplateConfig['branding']['titleEmphasis'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Boxed', value: 'boxed' },
          { label: 'Bold', value: 'bold' },
        ]}
      />

      <div className="dl-divider" />
      <Select
        label="Saved Logos"
        value={config.branding.logoAssetId ?? ''}
        onChange={(event) => {
          const selected = logoAssets.find((logo) => logo.id === event.target.value);
          onConfigChange((previous) => ({
            ...previous,
            branding: {
              ...previous.branding,
              logoAssetId: selected?.id,
              logoUrl: selected?.url,
            },
          }));
        }}
        disabled={!editable}
        options={[
          { label: 'No Logo', value: '' },
          ...logoAssets.map((logo) => ({ label: logo.name, value: logo.id })),
        ]}
      />

      <Card title="Upload / URL Logo">
        <div style={{ display: 'grid', gap: 8 }}>
          <Input
            label="Logo Name"
            value={logoNameInput}
            onChange={(event) => setLogoNameInput(event.target.value)}
            disabled={!editable}
          />
          <Input
            label="Logo URL / Data URL"
            value={logoUrlInput}
            onChange={(event) => setLogoUrlInput(event.target.value)}
            disabled={!editable}
          />
          <div className="dl-inline-actions">
            <Button size="sm" onClick={onLogoUrlSave} disabled={!editable}>Save Logo URL</Button>
            <input type="file" accept="image/*" onChange={onFileUpload} disabled={!editable} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function LayoutPanel({ config, editable, onConfigChange }: PanelProps) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Select
        label="Paper Size"
        value={config.layout.paperSize}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              paperSize: event.target.value as TemplateConfig['layout']['paperSize'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'A4', value: 'a4' },
          { label: 'Letter', value: 'letter' },
        ]}
      />
      <Select
        label="Header Layout"
        value={config.layout.headerLayout}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              headerLayout: event.target.value as TemplateConfig['layout']['headerLayout'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Standard', value: 'standard' },
          { label: 'Split', value: 'split' },
          { label: 'Banner', value: 'banner' },
        ]}
      />
      <Select
        label="Density"
        value={config.layout.density}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              density: event.target.value as TemplateConfig['layout']['density'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Comfortable', value: 'comfortable' },
          { label: 'Compact', value: 'compact' },
        ]}
      />
      <Select
        label="Summary Position"
        value={config.layout.summaryPanelPosition}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              summaryPanelPosition: event.target.value as TemplateConfig['layout']['summaryPanelPosition'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Right', value: 'right' },
          { label: 'Bottom', value: 'bottom' },
        ]}
      />
      <Input
        label="Section Spacing"
        type="number"
        min={4}
        max={40}
        value={config.layout.sectionSpacing}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              sectionSpacing: Number(event.target.value),
            },
          }))
        }
        disabled={!editable}
      />
      <Toggle
        id="layout_dividers"
        label="Show Section Dividers"
        checked={config.layout.showSectionDividers}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              showSectionDividers: event.target.checked,
            },
          }))
        }
      />
    </div>
  );
}

function VisibilityPanel({ config, editable, onConfigChange }: PanelProps) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <h4 style={{ margin: 0 }}>Metadata Fields</h4>
      <Toggle
        id="meta_doc_number"
        label="Show Document Number"
        checked={config.fieldVisibility.metadataFields.showDocumentNumber}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            fieldVisibility: {
              ...previous.fieldVisibility,
              metadataFields: {
                ...previous.fieldVisibility.metadataFields,
                showDocumentNumber: event.target.checked,
              },
            },
          }))
        }
      />
      <Toggle
        id="meta_reference"
        label="Show Reference"
        checked={config.fieldVisibility.metadataFields.showReference}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            fieldVisibility: {
              ...previous.fieldVisibility,
              metadataFields: {
                ...previous.fieldVisibility.metadataFields,
                showReference: event.target.checked,
              },
            },
          }))
        }
      />

      <h4 style={{ margin: 0, marginTop: 8 }}>Client Fields</h4>
      <Toggle
        id="client_contact"
        label="Show Contact Name"
        checked={config.fieldVisibility.clientFields.showContactName}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            fieldVisibility: {
              ...previous.fieldVisibility,
              clientFields: {
                ...previous.fieldVisibility.clientFields,
                showContactName: event.target.checked,
              },
            },
          }))
        }
      />
      <Toggle
        id="client_email"
        label="Show Client Email"
        checked={config.fieldVisibility.clientFields.showEmail}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            fieldVisibility: {
              ...previous.fieldVisibility,
              clientFields: {
                ...previous.fieldVisibility.clientFields,
                showEmail: event.target.checked,
              },
            },
          }))
        }
      />

      <h4 style={{ margin: 0, marginTop: 8 }}>Summary Fields</h4>
      {Object.entries(config.fieldVisibility.summaryFields).map(([fieldKey, enabled]) => (
        <Toggle
          key={fieldKey}
          id={`summary_${fieldKey}`}
          label={`Show ${fieldKey.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
          checked={enabled}
          disabled={!editable || fieldKey === 'showOutstanding'}
          onChange={(event) =>
            onConfigChange((previous) => ({
              ...previous,
              fieldVisibility: {
                ...previous.fieldVisibility,
                summaryFields: {
                  ...previous.fieldVisibility.summaryFields,
                  [fieldKey]: event.target.checked,
                },
              },
            }))
          }
        />
      ))}
    </div>
  );
}

function TablePanel({ config, editable, onConfigChange }: PanelProps) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Select
        label="Table Spacing"
        value={config.table.spacing}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            table: {
              ...previous.table,
              spacing: event.target.value as TemplateConfig['table']['spacing'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Comfortable', value: 'comfortable' },
          { label: 'Compact', value: 'compact' },
        ]}
      />
      <Select
        label="Totals Emphasis"
        value={config.table.emphasizeTotal}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            table: {
              ...previous.table,
              emphasizeTotal: event.target.value as TemplateConfig['table']['emphasizeTotal'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Boxed', value: 'boxed' },
          { label: 'Bold', value: 'bold' },
        ]}
      />
      {Object.entries(config.table.columns).map(([columnKey, enabled]) => (
        <Toggle
          key={columnKey}
          id={`col_${columnKey}`}
          label={`Show ${columnKey.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
          checked={enabled}
          disabled={!editable || columnKey === 'showLineTotal'}
          onChange={(event) =>
            onConfigChange((previous) => ({
              ...previous,
              table: {
                ...previous.table,
                columns: {
                  ...previous.table.columns,
                  [columnKey]: event.target.checked,
                },
              },
            }))
          }
        />
      ))}
      <Input
        label="Line Total Label"
        value={config.table.labels.lineTotal}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            table: {
              ...previous.table,
              labels: {
                ...previous.table.labels,
                lineTotal: event.target.value,
              },
            },
          }))
        }
        disabled={!editable}
      />
    </div>
  );
}

function SummaryPanel({ config, editable, onConfigChange }: PanelProps) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Select
        label="Summary Alignment"
        value={config.summary.alignment}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            summary: {
              ...previous.summary,
              alignment: event.target.value as TemplateConfig['summary']['alignment'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Left', value: 'left' },
          { label: 'Right', value: 'right' },
        ]}
      />
      <Select
        label="Summary Total Emphasis"
        value={config.summary.emphasizeTotal}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            summary: {
              ...previous.summary,
              emphasizeTotal: event.target.value as TemplateConfig['summary']['emphasizeTotal'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Subtle', value: 'subtle' },
          { label: 'Boxed', value: 'boxed' },
          { label: 'Bold', value: 'bold' },
        ]}
      />
      <Input
        label="Total Label"
        value={config.summary.labels.total}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            summary: {
              ...previous.summary,
              labels: {
                ...previous.summary.labels,
                total: event.target.value,
              },
            },
          }))
        }
        disabled={!editable}
      />
      <Input
        label="Tax Label"
        value={config.summary.labels.tax}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            summary: {
              ...previous.summary,
              labels: {
                ...previous.summary.labels,
                tax: event.target.value,
              },
            },
          }))
        }
        disabled={!editable}
      />
    </div>
  );
}

function FooterPanel({ config, editable, onConfigChange }: PanelProps) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <Select
        label="Footer Layout"
        value={config.layout.footerLayout}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            layout: {
              ...previous.layout,
              footerLayout: event.target.value as TemplateConfig['layout']['footerLayout'],
            },
          }))
        }
        disabled={!editable}
        options={[
          { label: 'Minimal', value: 'minimal' },
          { label: 'Detailed', value: 'detailed' },
          { label: 'Legal', value: 'legal' },
        ]}
      />
      <Textarea
        label="Legal Text"
        value={config.footer.legalText}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            footer: {
              ...previous.footer,
              legalText: event.target.value,
            },
          }))
        }
        disabled={!editable}
      />
      <Toggle
        id="footer_payment_instructions"
        label="Show Payment Instructions"
        checked={config.footer.showPaymentInstructions}
        disabled={!editable}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            footer: {
              ...previous.footer,
              showPaymentInstructions: event.target.checked,
            },
          }))
        }
      />
      <Input
        label="Payment Instructions Label"
        value={config.footer.paymentInstructionsLabel}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            footer: {
              ...previous.footer,
              paymentInstructionsLabel: event.target.value,
            },
          }))
        }
        disabled={!editable}
      />
      <Textarea
        label="Payment Instructions Text"
        value={config.footer.paymentInstructionsText}
        onChange={(event) =>
          onConfigChange((previous) => ({
            ...previous,
            footer: {
              ...previous.footer,
              paymentInstructionsText: event.target.value,
            },
          }))
        }
        disabled={!editable}
      />
    </div>
  );
}

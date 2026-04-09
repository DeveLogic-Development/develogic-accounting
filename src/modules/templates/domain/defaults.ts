import {
  DocumentTemplate,
  DocumentTemplateType,
  DocumentTemplateVersion,
  LogoAsset,
  TemplateConfig,
  TemplatePresetReference,
  TemplatesState,
} from './types';

const DEFAULT_LEGAL_TEXT =
  'Prepared by DeveLogic Digital. Please contact accounts@develogic.digital for billing support.';

function createSvgLogoDataUrl(text: string, backgroundColor: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96"><rect width="320" height="96" rx="14" fill="${backgroundColor}"/><text x="160" y="56" font-size="28" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="700">${text}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function createBaseConfig(overrides?: Partial<TemplateConfig>): TemplateConfig {
  return {
    layout: {
      paperSize: 'a4',
      headerLayout: 'standard',
      documentTitlePosition: 'header',
      density: 'comfortable',
      summaryPanelPosition: 'right',
      sectionSpacing: 16,
      showSectionDividers: true,
      footerLayout: 'detailed',
      ...(overrides?.layout ?? {}),
    },
    branding: {
      logoPlacement: 'left',
      primaryColor: '#174B7A',
      accentColor: '#1C8C66',
      fontFamily: 'manrope',
      titleEmphasis: 'subtle',
      ...(overrides?.branding ?? {}),
    },
    sections: {
      businessDetails: { enabled: true, title: 'From' },
      clientDetails: { enabled: true, title: 'Bill To' },
      metadata: { enabled: true, title: 'Document Details' },
      lineItems: { enabled: true, title: 'Items' },
      summary: { enabled: true, title: 'Summary' },
      paymentTerms: { enabled: true, title: 'Payment Terms' },
      notes: { enabled: true, title: 'Notes' },
      footer: { enabled: true, title: 'Footer' },
      ...(overrides?.sections ?? {}),
    },
    fieldVisibility: {
      metadataFields: {
        showDocumentNumber: true,
        showIssueDate: true,
        showDueOrExpiryDate: true,
        showReference: true,
      },
      businessFields: {
        showRegistrationNumber: true,
        showTaxNumber: true,
        showContactEmail: true,
        showContactPhone: true,
      },
      clientFields: {
        showContactName: true,
        showEmail: true,
        showPhone: true,
      },
      summaryFields: {
        showSubtotal: true,
        showLineDiscount: true,
        showDocumentDiscount: true,
        showTax: true,
        showPaid: true,
        showOutstanding: true,
      },
      ...(overrides?.fieldVisibility ?? {}),
    },
    table: {
      spacing: 'comfortable',
      emphasizeTotal: 'subtle',
      columns: {
        showDescription: true,
        showQuantity: true,
        showUnitPrice: true,
        showDiscount: true,
        showTax: true,
        showLineTotal: true,
      },
      labels: {
        item: 'Item',
        description: 'Description',
        quantity: 'Qty',
        unitPrice: 'Unit Price',
        discount: 'Discount',
        tax: 'Tax',
        lineTotal: 'Line Total',
      },
      ...(overrides?.table ?? {}),
    },
    summary: {
      alignment: 'right',
      emphasizeTotal: 'boxed',
      labels: {
        subtotal: 'Subtotal',
        lineDiscount: 'Line Discounts',
        documentDiscount: 'Document Discount',
        tax: 'Tax',
        total: 'Total',
        paid: 'Paid',
        outstanding: 'Outstanding',
      },
      ...(overrides?.summary ?? {}),
    },
    footer: {
      legalText: DEFAULT_LEGAL_TEXT,
      showCompanyStatement: true,
      showPaymentInstructions: true,
      paymentInstructionsLabel: 'Payment Instructions',
      paymentInstructionsText: 'Please pay via EFT to the account details on file.',
      ...(overrides?.footer ?? {}),
    },
  };
}

interface TemplatePresetDefinition {
  id: string;
  name: string;
  description: string;
  type: DocumentTemplateType;
  config: TemplateConfig;
}

export const TEMPLATE_PRESETS: TemplatePresetDefinition[] = [
  {
    id: 'preset_modern_minimal',
    name: 'Modern Minimal',
    description: 'A clean modern layout with subtle section dividers and right-aligned totals.',
    type: 'universal',
    config: createBaseConfig({
      layout: {
        headerLayout: 'standard',
        density: 'comfortable',
        summaryPanelPosition: 'right',
      },
      branding: {
        primaryColor: '#174B7A',
        accentColor: '#2F7CBF',
        fontFamily: 'manrope',
      },
    }),
  },
  {
    id: 'preset_corporate_clean',
    name: 'Corporate Clean',
    description: 'Professional split header with stronger business metadata emphasis.',
    type: 'invoice',
    config: createBaseConfig({
      layout: {
        headerLayout: 'split',
        sectionSpacing: 14,
      },
      branding: {
        primaryColor: '#0F3A5F',
        accentColor: '#1C8C66',
        fontFamily: 'ibm_plex_sans',
      },
    }),
  },
  {
    id: 'preset_bold_statement',
    name: 'Bold Statement',
    description: 'High-contrast banner style with bold totals presentation.',
    type: 'quote',
    config: createBaseConfig({
      layout: {
        headerLayout: 'banner',
        showSectionDividers: false,
      },
      branding: {
        primaryColor: '#0B2237',
        accentColor: '#B96A1A',
        titleEmphasis: 'bold',
      },
      summary: {
        emphasizeTotal: 'bold',
      },
    }),
  },
  {
    id: 'preset_compact_professional',
    name: 'Compact Professional',
    description: 'Dense spacing designed for line-heavy service documents.',
    type: 'universal',
    config: createBaseConfig({
      layout: {
        density: 'compact',
        sectionSpacing: 10,
      },
      table: {
        spacing: 'compact',
      },
      branding: {
        primaryColor: '#22313F',
        accentColor: '#3C7A6B',
      },
    }),
  },
  {
    id: 'preset_classic_formal',
    name: 'Classic Formal',
    description: 'Traditional document aesthetic with serif headings and legal footer.',
    type: 'invoice',
    config: createBaseConfig({
      layout: {
        headerLayout: 'standard',
        footerLayout: 'legal',
      },
      branding: {
        primaryColor: '#34495E',
        accentColor: '#7F8C8D',
        fontFamily: 'source_serif_4',
      },
      footer: {
        legalText:
          'All amounts are due according to agreed terms. Late payments may incur additional administrative charges.',
      },
    }),
  },
];

export function createDefaultTemplateConfigForType(type: DocumentTemplateType): TemplateConfig {
  if (type === 'quote') {
    return createBaseConfig({
      branding: {
        primaryColor: '#174B7A',
        accentColor: '#2D9CDB',
      },
    });
  }

  if (type === 'invoice') {
    return createBaseConfig({
      branding: {
        primaryColor: '#0F3A5F',
        accentColor: '#1C8C66',
      },
    });
  }

  return createBaseConfig();
}

export function createPresetTemplateState(nowIso = new Date().toISOString()): TemplatesState {
  const logoAssets: LogoAsset[] = [
    {
      id: 'logo_default_primary',
      name: 'DeveLogic Primary',
      url: createSvgLogoDataUrl('DEVELOGIC', '#174B7A'),
      kind: 'preset',
      createdAt: nowIso,
    },
    {
      id: 'logo_default_alt',
      name: 'DeveLogic Alt',
      url: createSvgLogoDataUrl('DEVELOGIC', '#0F3A5F'),
      kind: 'preset',
      createdAt: nowIso,
    },
  ];

  const templates: DocumentTemplate[] = [];
  const versions: DocumentTemplateVersion[] = [];

  TEMPLATE_PRESETS.forEach((preset, index) => {
    const templateId = `tpl_${preset.id}`;
    const versionId = `${templateId}_v1`;
    const isDefaultQuote = preset.id === 'preset_modern_minimal';
    const isDefaultInvoice = preset.id === 'preset_corporate_clean';

    templates.push({
      id: templateId,
      name: preset.name,
      description: preset.description,
      type: preset.type,
      status: 'published',
      currentPublishedVersionId: versionId,
      latestVersionNumber: 1,
      isDefaultForQuote: isDefaultQuote,
      isDefaultForInvoice: isDefaultInvoice,
      preset: {
        id: preset.id,
        name: preset.name,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    versions.push({
      id: versionId,
      templateId,
      versionNumber: 1,
      status: 'published',
      config: {
        ...preset.config,
        branding: {
          ...preset.config.branding,
          logoAssetId: logoAssets[0].id,
          logoUrl: index % 2 === 0 ? logoAssets[0].url : logoAssets[1].url,
        },
      },
      changeNote: 'Initial preset release',
      createdAt: nowIso,
      publishedAt: nowIso,
    });
  });

  return {
    templates,
    versions,
    logoAssets,
  };
}

export function getPresetById(presetId: string): TemplatePresetDefinition | undefined {
  return TEMPLATE_PRESETS.find((preset) => preset.id === presetId);
}

export function createTemplateFromPreset(presetId: string): {
  name: string;
  description: string;
  type: DocumentTemplateType;
  config: TemplateConfig;
  preset: TemplatePresetReference;
} | null {
  const preset = getPresetById(presetId);
  if (!preset) return null;

  return {
    name: preset.name,
    description: preset.description,
    type: preset.type,
    config: preset.config,
    preset: {
      id: preset.id,
      name: preset.name,
    },
  };
}

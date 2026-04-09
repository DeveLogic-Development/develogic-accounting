import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { mapTemplatePreviewModel } from '@/modules/templates/domain/preview';
import { DocumentRenderSnapshot } from '../domain/types';

interface AccountingPdfDocumentProps {
  snapshot: DocumentRenderSnapshot;
}

export function AccountingPdfDocument({ snapshot }: AccountingPdfDocumentProps) {
  const { template, previewPayload } = snapshot;
  const config = template.config;
  const model = mapTemplatePreviewModel(config, previewPayload);
  const styles = createStyles(config);

  return (
    <Document
      title={`${previewPayload.documentTitle} ${previewPayload.documentNumber}`}
      author="DeveLogic Accounting"
      subject="Generated accounting document"
      creator="DeveLogic Accounting"
      producer="DeveLogic Accounting"
    >
      <Page size={config.layout.paperSize.toUpperCase() as 'A4' | 'LETTER'} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {config.branding.logoUrl && isSupportedLogo(config.branding.logoUrl) ? (
              <Image src={config.branding.logoUrl} style={styles.logo} />
            ) : null}
            <Text style={styles.title}>{model.title}</Text>
            <Text style={styles.subtitle}>{model.subtitle}</Text>
          </View>
          {config.sections.metadata.enabled ? (
            <View style={styles.metadataList}>
              {model.metadata.map((entry) => (
                <View key={entry.label} style={styles.metadataRow}>
                  <Text style={styles.metadataLabel}>{entry.label}</Text>
                  <Text style={styles.metadataValue}>{entry.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {(config.sections.businessDetails.enabled || config.sections.clientDetails.enabled) ? (
          <View style={styles.partySection}>
            {config.sections.businessDetails.enabled ? (
              <PartyBlock title={config.sections.businessDetails.title} party={previewPayload.business} styles={styles} />
            ) : null}
            {config.sections.clientDetails.enabled ? (
              <PartyBlock title={config.sections.clientDetails.title} party={previewPayload.client} styles={styles} />
            ) : null}
          </View>
        ) : null}

        {config.sections.lineItems.enabled ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{config.sections.lineItems.title}</Text>
            <View style={styles.tableHeader}>
              {model.tableColumns.map((column) => (
                <Text key={column.key} style={styles.tableHeaderText}>
                  {column.label}
                </Text>
              ))}
            </View>
            {model.tableRows.map((row) => (
              <View key={row.id} style={styles.tableRow}>
                {model.tableColumns.map((column) => (
                  <Text key={`${row.id}_${column.key}`} style={styles.tableCell}>
                    {row.values[column.key]}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {config.sections.summary.enabled ? (
          <View style={styles.summarySection}>
            <Text style={styles.sectionTitle}>{config.sections.summary.title}</Text>
            {model.summaryRows
              .filter((row) => row.visible)
              .map((row) => (
                <View key={row.label} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{row.label}</Text>
                  <Text style={styles.summaryValue}>{row.value}</Text>
                </View>
              ))}
          </View>
        ) : null}

        {config.sections.paymentTerms.enabled && previewPayload.paymentTerms ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{config.sections.paymentTerms.title}</Text>
            <Text style={styles.paragraph}>{previewPayload.paymentTerms}</Text>
          </View>
        ) : null}

        {config.sections.notes.enabled && previewPayload.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{config.sections.notes.title}</Text>
            <Text style={styles.paragraph}>{previewPayload.notes}</Text>
          </View>
        ) : null}

        {config.sections.footer.enabled ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>{config.footer.legalText}</Text>
            {config.footer.showPaymentInstructions ? (
              <Text style={styles.footerText}>
                {config.footer.paymentInstructionsLabel}: {config.footer.paymentInstructionsText}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

function createStyles(config: DocumentRenderSnapshot['template']['config']) {
  const fontFamily = config.branding.fontFamily === 'source_serif_4' ? 'Times-Roman' : 'Helvetica';
  const headingFont = config.branding.fontFamily === 'source_serif_4' ? 'Times-Bold' : 'Helvetica-Bold';
  const compact = config.layout.density === 'compact';
  const sectionGap = Math.max(8, config.layout.sectionSpacing);

  return StyleSheet.create({
    page: {
      paddingTop: compact ? 24 : 30,
      paddingBottom: compact ? 24 : 30,
      paddingHorizontal: compact ? 24 : 30,
      fontFamily,
      fontSize: compact ? 9 : 10,
      color: '#1f2937',
      lineHeight: 1.4,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: sectionGap,
      backgroundColor: config.layout.headerLayout === 'banner' ? `${config.branding.primaryColor}11` : 'transparent',
      padding: config.layout.headerLayout === 'banner' ? 8 : 0,
    },
    headerLeft: {
      flexGrow: 1,
      flexShrink: 1,
    },
    logo: {
      width: 96,
      height: 28,
      marginBottom: 6,
      objectFit: 'contain',
    },
    title: {
      fontFamily: headingFont,
      fontSize: compact ? 15 : 17,
      color: config.branding.primaryColor,
      marginBottom: 2,
    },
    subtitle: {
      fontSize: 10,
      color: '#4b5563',
    },
    metadataList: {
      minWidth: 180,
      gap: 3,
    },
    metadataRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    metadataLabel: {
      color: '#6b7280',
      fontSize: 8.5,
    },
    metadataValue: {
      fontFamily: headingFont,
      fontSize: 8.5,
    },
    partySection: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: sectionGap,
    },
    partyBlock: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#d7e0ea',
      padding: 8,
      borderRadius: 4,
      gap: 2,
    },
    partyTitle: {
      fontFamily: headingFont,
      marginBottom: 4,
      color: config.branding.primaryColor,
      fontSize: 9,
    },
    partyName: {
      fontFamily: headingFont,
      fontSize: 9,
      marginBottom: 2,
    },
    partyText: {
      fontSize: 8.5,
      color: '#374151',
    },
    section: {
      marginBottom: sectionGap,
    },
    sectionTitle: {
      fontFamily: headingFont,
      marginBottom: 6,
      color: config.branding.primaryColor,
      fontSize: 9.5,
    },
    tableHeader: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#d7e0ea',
      borderTopWidth: 1,
      borderTopColor: '#d7e0ea',
      paddingVertical: compact ? 4 : 6,
      backgroundColor: '#f3f6fa',
      gap: 8,
    },
    tableHeaderText: {
      flex: 1,
      fontFamily: headingFont,
      fontSize: 8,
      color: '#4b5563',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#eef2f7',
      paddingVertical: compact ? 3 : 5,
      gap: 8,
    },
    tableCell: {
      flex: 1,
      fontSize: 8.5,
    },
    summarySection: {
      marginBottom: sectionGap,
      alignSelf: config.summary.alignment === 'right' ? 'flex-end' : 'flex-start',
      width: config.layout.summaryPanelPosition === 'right' ? 220 : '100%',
      borderWidth: config.summary.emphasizeTotal === 'boxed' ? 1 : 0,
      borderColor: '#d7e0ea',
      borderRadius: 4,
      padding: config.summary.emphasizeTotal === 'boxed' ? 8 : 0,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 4,
    },
    summaryLabel: {
      color: '#4b5563',
      fontSize: 8.5,
    },
    summaryValue: {
      fontFamily: headingFont,
      fontSize: 8.5,
    },
    paragraph: {
      fontSize: 8.8,
      color: '#374151',
      lineHeight: 1.4,
    },
    footer: {
      marginTop: 6,
      borderTopWidth: 1,
      borderTopColor: '#d7e0ea',
      paddingTop: 6,
      gap: 2,
    },
    footerText: {
      fontSize: 7.8,
      color: '#6b7280',
    },
  });
}

function isSupportedLogo(value: string): boolean {
  return value.startsWith('data:image') || /^https?:\/\//i.test(value);
}

function PartyBlock({
  title,
  party,
  styles,
}: {
  title: string;
  party: DocumentRenderSnapshot['previewPayload']['business'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.partyBlock}>
      <Text style={styles.partyTitle}>{title}</Text>
      <Text style={styles.partyName}>{party.name}</Text>
      {party.contactName ? <Text style={styles.partyText}>{party.contactName}</Text> : null}
      {party.addressLines.map((line) => (
        <Text key={`${title}_${line}`} style={styles.partyText}>
          {line}
        </Text>
      ))}
      {party.email ? <Text style={styles.partyText}>{party.email}</Text> : null}
      {party.phone ? <Text style={styles.partyText}>{party.phone}</Text> : null}
      {party.registrationNumber ? <Text style={styles.partyText}>Reg: {party.registrationNumber}</Text> : null}
      {party.taxNumber ? <Text style={styles.partyText}>Tax: {party.taxNumber}</Text> : null}
    </View>
  );
}

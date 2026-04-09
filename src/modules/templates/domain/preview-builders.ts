import { TemplatePreviewPayload } from './types';

export function buildPreviewPayloadFromQuote(input: {
  quoteNumber: string;
  issueDate: string;
  expiryDate: string;
  lineItems: Array<{
    id: string;
    itemName: string;
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountPercent: number;
    taxRatePercent: number;
    lineTotalMinor: number;
  }>;
  totals: {
    subtotalMinor: number;
    lineDiscountMinor: number;
    documentDiscountMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  notes?: string;
  paymentTerms?: string;
  clientName: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddressLines?: string[];
}): TemplatePreviewPayload {
  return {
    documentType: 'quote',
    documentTitle: 'Quote',
    documentNumber: input.quoteNumber,
    issueDate: input.issueDate,
    dueOrExpiryLabel: 'Valid Until',
    dueOrExpiryDate: input.expiryDate,
    reference: input.quoteNumber,
    business: {
      name: 'DeveLogic Digital',
      contactName: 'Finance Team',
      email: 'accounts@develogic.digital',
      phone: '+27 11 555 0190',
      addressLines: ['8 Sandton Drive', 'Sandton, Johannesburg', 'South Africa'],
      registrationNumber: '2019/445882/07',
      taxNumber: '9054922134',
    },
    client: {
      name: input.clientName,
      contactName: input.clientContactName || 'Primary Contact',
      email: input.clientEmail || 'client@example.com',
      phone: input.clientPhone || '+27 21 555 0100',
      addressLines: input.clientAddressLines || ['Client Address Line 1', 'Client Address Line 2'],
    },
    notes: input.notes,
    paymentTerms: input.paymentTerms,
    lineItems: input.lineItems,
    totals: input.totals,
  };
}

export function buildPreviewPayloadFromInvoice(input: {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  lineItems: Array<{
    id: string;
    itemName: string;
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountPercent: number;
    taxRatePercent: number;
    lineTotalMinor: number;
  }>;
  totals: {
    subtotalMinor: number;
    lineDiscountMinor: number;
    documentDiscountMinor: number;
    taxMinor: number;
    totalMinor: number;
  };
  paidMinor: number;
  outstandingMinor: number;
  notes?: string;
  paymentTerms?: string;
  clientName: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddressLines?: string[];
}): TemplatePreviewPayload {
  return {
    documentType: 'invoice',
    documentTitle: 'Invoice',
    documentNumber: input.invoiceNumber,
    issueDate: input.issueDate,
    dueOrExpiryLabel: 'Due Date',
    dueOrExpiryDate: input.dueDate,
    reference: input.invoiceNumber,
    business: {
      name: 'DeveLogic Digital',
      contactName: 'Finance Team',
      email: 'accounts@develogic.digital',
      phone: '+27 11 555 0190',
      addressLines: ['8 Sandton Drive', 'Sandton, Johannesburg', 'South Africa'],
      registrationNumber: '2019/445882/07',
      taxNumber: '9054922134',
    },
    client: {
      name: input.clientName,
      contactName: input.clientContactName || 'Accounts Payable',
      email: input.clientEmail || 'ap@example.com',
      phone: input.clientPhone || '+27 31 555 0101',
      addressLines: input.clientAddressLines || ['Client Address Line 1', 'Client Address Line 2'],
    },
    notes: input.notes,
    paymentTerms: input.paymentTerms,
    lineItems: input.lineItems,
    totals: {
      ...input.totals,
      paidMinor: input.paidMinor,
      outstandingMinor: input.outstandingMinor,
    },
  };
}

export function buildPreviewRowsFromDomainItems(
  items: Array<{
    id: string;
    itemName: string;
    description: string;
    quantity: number;
    unitPriceMinor: number;
    discountPercent: number;
    taxRatePercent: number;
  }>,
): TemplatePreviewPayload['lineItems'] {
  return items.map((item) => {
    const subtotalMinor = Math.round(item.quantity * item.unitPriceMinor);
    const discountMinor = Math.round((subtotalMinor * item.discountPercent) / 100);
    const taxableMinor = Math.max(0, subtotalMinor - discountMinor);
    const taxMinor = Math.round((taxableMinor * item.taxRatePercent) / 100);
    return {
      id: item.id,
      itemName: item.itemName,
      description: item.description,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      discountPercent: item.discountPercent,
      taxRatePercent: item.taxRatePercent,
      lineTotalMinor: taxableMinor + taxMinor,
    };
  });
}

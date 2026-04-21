import { describe, expect, it } from 'vitest';
import { buildCloneDraft, createDefaultItemFormValues, mapItemFormValuesToUpsertInput, validateItemFormValues } from '../forms';
import { buildItemTransactions } from '../transactions';
import { summarizeProductHistoryEvent } from '../history';
import { AccountingState } from '@/modules/accounting/domain/types';
import { MasterProductService } from '@/modules/master-data/domain/types';

function createItem(overrides?: Partial<MasterProductService>): MasterProductService {
  return {
    id: 'item_1',
    name: 'Retainer',
    type: 'service',
    usageUnit: 'each',
    isCapitalAsset: false,
    salesRate: 5000,
    purchaseRate: 2500,
    reportingTags: [],
    status: 'active',
    isActive: true,
    unitPrice: 5000,
    taxCategory: 'Standard',
    createdAt: '2026-04-01',
    updatedAt: '2026-04-02',
    ...overrides,
  };
}

function createAccountingState(): AccountingState {
  return {
    quotes: [
      {
        id: 'q1',
        quoteNumber: 'QUO-00001',
        clientId: 'c1',
        issueDate: '2026-04-10',
        expiryDate: '2026-04-24',
        currencyCode: 'ZAR',
        status: 'sent',
        notes: '',
        paymentTerms: '',
        internalMemo: '',
        items: [
          {
            id: 'q1_l1',
            productServiceId: 'item_1',
            itemName: 'Retainer',
            description: '',
            quantity: 1,
            unitPriceMinor: 500000,
            discountPercent: 0,
            taxRatePercent: 15,
            position: 1,
          },
        ],
        documentDiscountPercent: 0,
        createdAt: '2026-04-10',
        updatedAt: '2026-04-10',
        statusHistory: [],
      },
    ],
    invoices: [
      {
        id: 'i1',
        invoiceNumber: 'INV-00001',
        clientId: 'c1',
        issueDate: '2026-04-12',
        dueDate: '2026-04-30',
        currencyCode: 'ZAR',
        status: 'sent',
        notes: '',
        paymentTerms: '',
        internalMemo: '',
        items: [
          {
            id: 'i1_l1',
            itemName: 'Retainer',
            description: '',
            quantity: 2,
            unitPriceMinor: 300000,
            discountPercent: 0,
            taxRatePercent: 15,
            position: 1,
          },
        ],
        documentDiscountPercent: 0,
        createdAt: '2026-04-12',
        updatedAt: '2026-04-12',
        statusHistory: [],
      },
    ],
    payments: [],
    quoteSequenceNext: 2,
    invoiceSequenceNext: 2,
  };
}

describe('items domain', () => {
  it('validates core item form fields', () => {
    const values = createDefaultItemFormValues();
    values.name = '';
    values.salesRate = -1;
    values.purchaseRate = -2;

    const result = validateItemFormValues(values);
    expect(result.isValid).toBe(false);
    expect(result.issues.some((issue) => issue.field === 'name')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'salesRate')).toBe(true);
    expect(result.issues.some((issue) => issue.field === 'purchaseRate')).toBe(true);
  });

  it('maps form values into upsert payload and parses tags', () => {
    const values = createDefaultItemFormValues();
    values.name = 'Consulting Hours';
    values.reportingTagsText = 'Services, Recurring ,  ';
    const payload = mapItemFormValuesToUpsertInput(values);
    expect(payload.name).toBe('Consulting Hours');
    expect(payload.reportingTags).toEqual(['Services', 'Recurring']);
    expect(payload.type).toBe('service');
  });

  it('builds clone draft with copy naming', () => {
    const clone = buildCloneDraft(createItem({ name: 'SaaS License', isActive: false }));
    expect(clone.name).toBe('SaaS License Copy');
    expect(clone.isActive).toBe(true);
  });

  it('aggregates item-linked transactions across quotes and invoices', () => {
    const rows = buildItemTransactions({
      item: createItem(),
      accounting: createAccountingState(),
      clients: [
        {
          id: 'c1',
          customerType: 'business',
          displayName: 'Acme Corp',
          name: 'Acme Corp',
          customFields: {},
          reportingTags: [],
          billingAddress: {},
          shippingAddress: {},
          contactPersons: [],
          isActive: true,
          createdAt: '2026-04-01',
          updatedAt: '2026-04-01',
        },
      ],
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].kind).toBe('invoice');
    expect(rows[0].clientName).toBe('Acme Corp');
    expect(rows[1].kind).toBe('quote');
  });

  it('summarizes history changes into readable details', () => {
    const summary = summarizeProductHistoryEvent({
      id: 'h1',
      productId: 'item_1',
      action: 'update',
      createdAt: '2026-04-12T09:30:00.000Z',
      beforeData: { sales_rate: 100 },
      afterData: { sales_rate: 120 },
    });
    expect(summary.title).toBe('Item updated');
    expect(summary.detail).toContain('Sales rate');
  });
});

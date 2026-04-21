import { AccountingState } from '../domain/types';

export function createSeedState(): AccountingState {
  return {
    quotes: [],
    invoices: [],
    payments: [],
    recurringInvoiceProfiles: [],
    quoteSequenceNext: 1,
    invoiceSequenceNext: 1,
  };
}

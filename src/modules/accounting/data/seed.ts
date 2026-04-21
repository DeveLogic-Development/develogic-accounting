import { AccountingState } from '../domain/types';

export function createSeedState(): AccountingState {
  return {
    quotes: [],
    invoices: [],
    payments: [],
    quoteSequenceNext: 1,
    invoiceSequenceNext: 1,
  };
}


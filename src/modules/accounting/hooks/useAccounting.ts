import { useAccountingContext } from '../state/AccountingContext';

export function useAccounting() {
  return useAccountingContext();
}

import { AccountingState } from '../domain/types';

export interface AccountingRepository {
  load(): AccountingState | null;
  save(state: AccountingState): void;
}

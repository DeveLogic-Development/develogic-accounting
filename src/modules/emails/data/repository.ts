import { EmailsState } from '../domain/types';

export interface EmailsRepository {
  load(): EmailsState | null;
  save(state: EmailsState): void;
}

import { EmailsState } from '../domain/types';

export function createEmailSeedState(): EmailsState {
  return {
    logs: [],
  };
}

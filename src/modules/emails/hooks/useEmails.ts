import { useEmailsContext } from '../state/EmailsContext';

export function useEmails() {
  return useEmailsContext();
}

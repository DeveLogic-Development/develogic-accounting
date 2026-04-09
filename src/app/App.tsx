import { AppRouter } from '@/routes/AppRouter';
import { AccountingProvider } from '@/modules/accounting/state/AccountingContext';
import { TemplatesProvider } from '@/modules/templates/state/TemplatesContext';
import { PdfArchiveProvider } from '@/modules/pdf/state/PdfArchiveContext';
import { EmailsProvider } from '@/modules/emails/state/EmailsContext';

export function App() {
  return (
    <TemplatesProvider>
      <AccountingProvider>
        <PdfArchiveProvider>
          <EmailsProvider>
            <AppRouter />
          </EmailsProvider>
        </PdfArchiveProvider>
      </AccountingProvider>
    </TemplatesProvider>
  );
}

import { AppRouter } from '@/routes/AppRouter';
import { AccountingProvider } from '@/modules/accounting/state/AccountingContext';
import { TemplatesProvider } from '@/modules/templates/state/TemplatesContext';
import { PdfArchiveProvider } from '@/modules/pdf/state/PdfArchiveContext';

export function App() {
  return (
    <TemplatesProvider>
      <AccountingProvider>
        <PdfArchiveProvider>
          <AppRouter />
        </PdfArchiveProvider>
      </AccountingProvider>
    </TemplatesProvider>
  );
}

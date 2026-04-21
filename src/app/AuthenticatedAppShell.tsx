import { AppLayout } from '@/layouts/AppLayout';
import { AccountingProvider } from '@/modules/accounting/state/AccountingContext';
import { TemplatesProvider } from '@/modules/templates/state/TemplatesContext';
import { PdfArchiveProvider } from '@/modules/pdf/state/PdfArchiveContext';
import { EmailsProvider } from '@/modules/emails/state/EmailsContext';
import { NotificationsProvider } from '@/modules/notifications/state/NotificationsContext';
import { MasterDataProvider } from '@/modules/master-data/state/MasterDataContext';
import { BusinessSettingsBootstrapper } from '@/modules/settings/components/BusinessSettingsBootstrapper';

export function AuthenticatedAppShell() {
  return (
    <NotificationsProvider>
      <BusinessSettingsBootstrapper />
      <TemplatesProvider>
        <AccountingProvider>
          <MasterDataProvider>
            <PdfArchiveProvider>
              <EmailsProvider>
                <AppLayout />
              </EmailsProvider>
            </PdfArchiveProvider>
          </MasterDataProvider>
        </AccountingProvider>
      </TemplatesProvider>
    </NotificationsProvider>
  );
}

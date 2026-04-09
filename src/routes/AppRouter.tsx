import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { NotFoundPage } from '@/layouts/NotFoundPage';
import { DashboardPage } from '@/modules/dashboard/DashboardPage';
import { ClientsListPage } from '@/modules/clients/ClientsListPage';
import { ClientDetailPage } from '@/modules/clients/ClientDetailPage';
import { ProductsServicesListPage } from '@/modules/products-services/ProductsServicesListPage';
import { ProductServiceDetailPage } from '@/modules/products-services/ProductServiceDetailPage';
import { QuotesListPage } from '@/modules/quotes/QuotesListPage';
import { QuoteDetailPage } from '@/modules/quotes/QuoteDetailPage';
import { QuoteFormPage } from '@/modules/quotes/QuoteFormPage';
import { InvoicesListPage } from '@/modules/invoices/InvoicesListPage';
import { InvoiceDetailPage } from '@/modules/invoices/InvoiceDetailPage';
import { InvoiceFormPage } from '@/modules/invoices/InvoiceFormPage';
import { TemplateLibraryPage } from '@/modules/templates/TemplateLibraryPage';
import { TemplateEditorPage } from '@/modules/templates/TemplateEditorPage';
import { BusinessSettingsPage } from '@/modules/settings/BusinessSettingsPage';
import { TaxSettingsPage } from '@/modules/settings/TaxSettingsPage';
import { EmailHistoryPage } from '@/modules/emails/EmailHistoryPage';
import { PdfArchivePage } from '@/modules/pdf-archive/PdfArchivePage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          <Route path="clients" element={<ClientsListPage />} />
          <Route path="clients/:clientId" element={<ClientDetailPage />} />

          <Route path="products-services" element={<ProductsServicesListPage />} />
          <Route path="products-services/:productId" element={<ProductServiceDetailPage />} />

          <Route path="quotes" element={<QuotesListPage />} />
          <Route path="quotes/new" element={<QuoteFormPage />} />
          <Route path="quotes/:quoteId" element={<QuoteDetailPage />} />
          <Route path="quotes/:quoteId/edit" element={<QuoteFormPage />} />

          <Route path="invoices" element={<InvoicesListPage />} />
          <Route path="invoices/new" element={<InvoiceFormPage />} />
          <Route path="invoices/:invoiceId" element={<InvoiceDetailPage />} />
          <Route path="invoices/:invoiceId/edit" element={<InvoiceFormPage />} />

          <Route path="templates" element={<TemplateLibraryPage />} />
          <Route path="templates/:templateId/editor" element={<TemplateEditorPage />} />

          <Route path="settings/business" element={<BusinessSettingsPage />} />
          <Route path="settings/tax" element={<TaxSettingsPage />} />

          <Route path="emails/history" element={<EmailHistoryPage />} />
          <Route path="pdf-archive" element={<PdfArchivePage />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

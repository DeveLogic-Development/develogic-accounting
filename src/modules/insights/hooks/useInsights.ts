import { useMemo } from 'react';
import { clients } from '@/mocks/data';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useEmails } from '@/modules/emails/hooks/useEmails';
import { usePdfArchive } from '@/modules/pdf/hooks/usePdfArchive';
import { resolveDateRangePreset } from '../domain/date-range';
import { computeDashboardInsights, computeReportsSummary } from '../domain/reports';
import { DateRange, DateRangePreset, ReportsSummary } from '../domain/types';

interface UseReportsOptions {
  preset?: DateRangePreset;
  customRange?: {
    from?: string;
    to?: string;
  };
}

function createClientNameById(): Map<string, string> {
  return new Map(clients.map((client) => [client.id, client.name]));
}

export function useDashboardInsights() {
  const { quoteSummaries, invoiceSummaries, state } = useAccounting();
  const { rows: emailRows } = useEmails();
  const { rows: pdfRows } = usePdfArchive();

  return useMemo(
    () =>
      computeDashboardInsights({
        quoteSummaries,
        quotes: state.quotes,
        invoiceSummaries,
        payments: state.payments,
        emailRows,
        pdfRows,
        clientNameById: createClientNameById(),
      }),
    [emailRows, invoiceSummaries, pdfRows, quoteSummaries, state.payments, state.quotes],
  );
}

export function useReportsSummary(options: UseReportsOptions = {}): {
  range: DateRange;
  summary: ReportsSummary;
} {
  const { quoteSummaries, invoiceSummaries, state } = useAccounting();
  const { rows: emailRows } = useEmails();
  const { rows: pdfRows } = usePdfArchive();

  const preset = options.preset ?? 'current_month';
  const range = useMemo<DateRange>(() => {
    if (preset !== 'custom') return resolveDateRangePreset(preset);
    return {
      preset,
      from: options.customRange?.from,
      to: options.customRange?.to,
    };
  }, [options.customRange?.from, options.customRange?.to, preset]);

  const summary = useMemo(
    () =>
      computeReportsSummary({
        quoteSummaries,
        quotes: state.quotes,
        invoiceSummaries,
        payments: state.payments,
        emailRows,
        pdfRows,
        range,
        clientNameById: createClientNameById(),
      }),
    [emailRows, invoiceSummaries, pdfRows, quoteSummaries, range, state.payments, state.quotes],
  );

  return {
    range,
    summary,
  };
}

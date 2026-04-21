import { useEffect, useRef } from 'react';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { useNotifications } from '../hooks/useNotifications';

export function SystemNotificationSync() {
  const accounting = useAccounting();
  const notifications = useNotifications();
  const { getClientNameById } = useMasterData();
  const emittedKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeKeys = new Set<string>();

    accounting.invoiceSummaries
      .filter((invoice) => invoice.status === 'overdue' && invoice.outstandingMinor > 0)
      .forEach((invoice) => {
        const dedupeKey = `invoice:${invoice.id}:overdue`;
        activeKeys.add(dedupeKey);
        if (emittedKeysRef.current.has(dedupeKey)) return;
        emittedKeysRef.current.add(dedupeKey);

        notifications.createNotification(
          {
            level: 'warning',
            source: 'invoices',
            title: 'Invoice Overdue',
            message: `${invoice.invoiceNumber} is overdue for ${getClientNameById(invoice.clientId)}.`,
            route: `/invoices/${invoice.id}`,
            relatedEntityType: 'invoice',
            relatedEntityId: invoice.id,
            dedupeKey,
          },
          { dedupeWindowMs: 1000 * 60 * 60 * 24 * 30 },
        );
      });

    accounting.state.quotes
      .filter((quote) => quote.status === 'accepted' && !quote.convertedInvoiceId)
      .forEach((quote) => {
        const dedupeKey = `quote:${quote.id}:accepted-awaiting-conversion`;
        activeKeys.add(dedupeKey);
        if (emittedKeysRef.current.has(dedupeKey)) return;
        emittedKeysRef.current.add(dedupeKey);

        notifications.createNotification(
          {
            level: 'info',
            source: 'quotes',
            title: 'Accepted Quote Awaiting Conversion',
            message: `${quote.quoteNumber} was accepted and is ready for invoice conversion.`,
            route: `/quotes/${quote.id}`,
            relatedEntityType: 'quote',
            relatedEntityId: quote.id,
            dedupeKey,
          },
          { dedupeWindowMs: 1000 * 60 * 60 * 24 * 30 },
        );
      });

    [...emittedKeysRef.current].forEach((key) => {
      if (!activeKeys.has(key)) {
        emittedKeysRef.current.delete(key);
      }
    });
  }, [accounting.invoiceSummaries, accounting.state.quotes, getClientNameById, notifications]);

  return null;
}

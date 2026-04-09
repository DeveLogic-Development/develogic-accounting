import { describe, expect, it } from 'vitest';
import { buildDefaultEmailBody, buildDefaultEmailSubject } from '../templates';

describe('email templates', () => {
  it('interpolates quote subject/body placeholders', () => {
    const payload = {
      businessName: 'DeveLogic Digital',
      clientName: 'Nautilus Labs',
      documentNumber: 'QUO-00012',
      issueDate: '2026-04-09',
      expiryDate: '2026-04-23',
      totalFormatted: 'R 21,500.00',
    };

    const subject = buildDefaultEmailSubject('quote_send', payload);
    const body = buildDefaultEmailBody('quote_send', payload);

    expect(subject).toContain('QUO-00012');
    expect(subject).toContain('DeveLogic Digital');
    expect(body).toContain('Nautilus Labs');
    expect(body).toContain('Valid Until: 2026-04-23');
    expect(body).toContain('R 21,500.00');
  });

  it('interpolates invoice defaults with due date', () => {
    const payload = {
      businessName: 'DeveLogic Digital',
      clientName: 'Silverstream Retail Group',
      documentNumber: 'INV-00048',
      issueDate: '2026-04-01',
      dueDate: '2026-04-15',
      totalFormatted: 'R 42,800.00',
    };

    const subject = buildDefaultEmailSubject('invoice_send', payload);
    const body = buildDefaultEmailBody('invoice_send', payload);

    expect(subject).toContain('INV-00048');
    expect(body).toContain('Due Date: 2026-04-15');
    expect(body).toContain('Silverstream Retail Group');
  });
});

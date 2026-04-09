import { describe, expect, it } from 'vitest';
import { createDefaultTemplateConfigForType } from '../defaults';
import { mapTemplatePreviewModel } from '../preview';
import { createInvoiceTemplatePreviewPayload } from '../sample-preview';

describe('template preview mapping', () => {
  it('maps config + payload to preview model and honors column visibility', () => {
    const config = createDefaultTemplateConfigForType('invoice');
    config.table.columns.showDescription = false;

    const payload = createInvoiceTemplatePreviewPayload();
    const model = mapTemplatePreviewModel(config, payload);

    expect(model.tableColumns.some((column) => column.key === 'description')).toBe(false);
    expect(model.summaryRows.some((row) => row.label === config.summary.labels.total)).toBe(true);
  });
});

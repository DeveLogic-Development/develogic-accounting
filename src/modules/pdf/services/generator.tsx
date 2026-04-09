import { pdf } from '@react-pdf/renderer';
import { AccountingPdfDocument } from '../rendering/AccountingPdfDocument';
import { DocumentRenderSnapshot } from '../domain/types';

export async function generatePdfBlob(snapshot: DocumentRenderSnapshot): Promise<Blob> {
  const instance = pdf(<AccountingPdfDocument snapshot={snapshot} />);
  return instance.toBlob();
}

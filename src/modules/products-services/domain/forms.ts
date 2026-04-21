import { MasterProductService, ProductServiceUpsertInput } from '@/modules/master-data/domain/types';

export interface ItemFormValues {
  name: string;
  type: 'goods' | 'service';
  sku: string;
  usageUnit: string;
  isCapitalAsset: boolean;
  imageUrl: string;
  salesRate: number;
  salesAccountId: string;
  salesDescription: string;
  purchaseRate: number;
  purchaseAccountId: string;
  purchaseDescription: string;
  preferredVendorId: string;
  reportingTagsText: string;
  isActive: boolean;
}

export interface ItemFormValidationIssue {
  field: keyof ItemFormValues | 'global';
  message: string;
}

export interface ItemFormValidationResult {
  isValid: boolean;
  issues: ItemFormValidationIssue[];
}

function parseReportingTags(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function createDefaultItemFormValues(): ItemFormValues {
  return {
    name: '',
    type: 'service',
    sku: '',
    usageUnit: 'each',
    isCapitalAsset: false,
    imageUrl: '',
    salesRate: 0,
    salesAccountId: 'Sales',
    salesDescription: '',
    purchaseRate: 0,
    purchaseAccountId: 'Cost of Goods Sold',
    purchaseDescription: '',
    preferredVendorId: '',
    reportingTagsText: '',
    isActive: true,
  };
}

export function mapItemToFormValues(item: MasterProductService): ItemFormValues {
  return {
    name: item.name,
    type: item.type,
    sku: item.sku ?? '',
    usageUnit: item.usageUnit || 'each',
    isCapitalAsset: item.isCapitalAsset,
    imageUrl: item.imageUrl ?? '',
    salesRate: item.salesRate,
    salesAccountId: item.salesAccountId ?? 'Sales',
    salesDescription: item.salesDescription ?? '',
    purchaseRate: item.purchaseRate,
    purchaseAccountId: item.purchaseAccountId ?? 'Cost of Goods Sold',
    purchaseDescription: item.purchaseDescription ?? '',
    preferredVendorId: item.preferredVendorId ?? '',
    reportingTagsText: item.reportingTags.join(', '),
    isActive: item.isActive,
  };
}

export function buildCloneDraft(source: MasterProductService): ItemFormValues {
  return {
    ...mapItemToFormValues(source),
    name: `${source.name} Copy`,
    isActive: true,
  };
}

export function validateItemFormValues(values: ItemFormValues): ItemFormValidationResult {
  const issues: ItemFormValidationIssue[] = [];
  if (!values.name.trim()) {
    issues.push({ field: 'name', message: 'Item name is required.' });
  }
  if (!values.type) {
    issues.push({ field: 'type', message: 'Item type is required.' });
  }
  if (!values.usageUnit.trim()) {
    issues.push({ field: 'usageUnit', message: 'Usage unit is required.' });
  }
  if (!Number.isFinite(values.salesRate) || values.salesRate < 0) {
    issues.push({ field: 'salesRate', message: 'Sales rate must be 0 or greater.' });
  }
  if (!Number.isFinite(values.purchaseRate) || values.purchaseRate < 0) {
    issues.push({ field: 'purchaseRate', message: 'Purchase rate must be 0 or greater.' });
  }
  if (values.preferredVendorId && values.preferredVendorId.length > 0 && values.preferredVendorId.length < 8) {
    issues.push({ field: 'preferredVendorId', message: 'Preferred vendor reference is invalid.' });
  }
  return { isValid: issues.length === 0, issues };
}

export function mapItemFormValuesToUpsertInput(
  values: ItemFormValues,
  options?: { createdSource?: ProductServiceUpsertInput['createdSource'] },
): ProductServiceUpsertInput {
  const trimmedImage = values.imageUrl.trim();
  return {
    name: values.name.trim(),
    type: values.type,
    sku: values.sku.trim() || undefined,
    usageUnit: values.usageUnit.trim() || 'each',
    isCapitalAsset: values.isCapitalAsset,
    imageUrl: trimmedImage || undefined,
    salesRate: values.salesRate,
    salesAccountId: values.salesAccountId.trim() || undefined,
    salesDescription: values.salesDescription.trim() || undefined,
    purchaseRate: values.purchaseRate,
    purchaseAccountId: values.purchaseAccountId.trim() || undefined,
    purchaseDescription: values.purchaseDescription.trim() || undefined,
    preferredVendorId: values.preferredVendorId.trim() || undefined,
    reportingTags: parseReportingTags(values.reportingTagsText),
    createdSource: options?.createdSource ?? 'manual',
    isActive: values.isActive,
  };
}

export function findIssueByField(
  issues: ItemFormValidationIssue[],
  field: ItemFormValidationIssue['field'],
): string | undefined {
  return issues.find((issue) => issue.field === field)?.message;
}

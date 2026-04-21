export type CustomerType = 'business' | 'individual';

export interface CustomerAddress {
  attention?: string;
  countryRegion?: string;
  line1?: string;
  line2?: string;
  city?: string;
  stateRegion?: string;
  postalCode?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  fax?: string;
}

export interface CustomerContactPerson {
  id: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  workPhoneCountryCode?: string;
  workPhoneNumber?: string;
  mobilePhoneCountryCode?: string;
  mobilePhoneNumber?: string;
  isPrimary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerComment {
  id: string;
  customerId: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface MasterClient {
  id: string;
  customerType: CustomerType;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  displayName: string;
  name: string;
  email?: string;
  workPhoneCountryCode?: string;
  workPhoneNumber?: string;
  mobilePhoneCountryCode?: string;
  mobilePhoneNumber?: string;
  phone?: string;
  customerLanguage?: string;
  currencyCode?: string;
  accountsReceivableAccountId?: string;
  openingBalance?: number;
  paymentTerms?: string;
  portalEnabled?: boolean;
  websiteUrl?: string;
  department?: string;
  designation?: string;
  xHandleOrUrl?: string;
  skype?: string;
  facebook?: string;
  remarks?: string;
  customFields: Record<string, string>;
  reportingTags: string[];
  customerOwnerUserId?: string;
  unusedCredits?: number;
  billingAddress: CustomerAddress;
  shippingAddress: CustomerAddress;
  contactPersons: CustomerContactPerson[];
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MasterProductService {
  id: string;
  name: string;
  type: 'goods' | 'service';
  sku?: string;
  usageUnit: string;
  isCapitalAsset: boolean;
  imageUrl?: string;
  salesRate: number;
  salesAccountId?: string;
  salesDescription?: string;
  purchaseRate: number;
  purchaseAccountId?: string;
  purchaseDescription?: string;
  preferredVendorId?: string;
  preferredVendorName?: string;
  reportingTags: string[];
  status: 'active' | 'inactive';
  isActive: boolean;
  createdSource?: 'manual' | 'import' | 'clone' | 'system';
  createdBy?: string;
  description?: string; // legacy alias for salesDescription
  unitPrice: number; // legacy alias for salesRate
  taxCategory: string; // reserved for tax integration pass
  createdAt: string;
  updatedAt: string;
}

export interface ProductHistoryEvent {
  id: string;
  productId: string;
  action: 'insert' | 'update' | 'soft_delete' | 'restore' | 'status_change';
  actorUserId?: string;
  createdAt: string;
  entityLabel?: string;
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ClientUpsertInput {
  customerType: CustomerType;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  displayName: string;
  name?: string;
  email?: string;
  workPhoneCountryCode?: string;
  workPhoneNumber?: string;
  mobilePhoneCountryCode?: string;
  mobilePhoneNumber?: string;
  customerLanguage?: string;
  currencyCode?: string;
  accountsReceivableAccountId?: string;
  openingBalance?: number;
  paymentTerms?: string;
  portalEnabled?: boolean;
  websiteUrl?: string;
  department?: string;
  designation?: string;
  xHandleOrUrl?: string;
  skype?: string;
  facebook?: string;
  remarks?: string;
  customFields?: Record<string, string>;
  reportingTags?: string[];
  customerOwnerUserId?: string;
  billingAddress?: CustomerAddress;
  shippingAddress?: CustomerAddress;
  contactPersons?: CustomerContactPerson[];
  isActive: boolean;
}

export interface ProductServiceUpsertInput {
  name: string;
  type: 'goods' | 'service';
  sku?: string;
  usageUnit?: string;
  isCapitalAsset: boolean;
  imageUrl?: string;
  salesRate: number;
  salesAccountId?: string;
  salesDescription?: string;
  purchaseRate: number;
  purchaseAccountId?: string;
  purchaseDescription?: string;
  preferredVendorId?: string;
  reportingTags?: string[];
  createdSource?: 'manual' | 'import' | 'clone' | 'system';
  description?: string; // legacy alias for salesDescription
  unitPrice?: number; // legacy alias for salesRate
  isActive: boolean;
}

export type MasterDataSource = 'supabase' | 'fallback';

export interface MasterDataSnapshot {
  clients: MasterClient[];
  productsServices: MasterProductService[];
  source: MasterDataSource;
  lastSyncedAt: string;
  warning?: string;
}

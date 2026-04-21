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
  type: 'product' | 'service';
  sku?: string;
  description?: string;
  unitPrice: number;
  taxCategory: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  type: 'product' | 'service';
  sku?: string;
  description?: string;
  unitPrice: number;
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

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Input } from '@/design-system/primitives/Input';
import { Toggle } from '@/design-system/primitives/Toggle';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { Select } from '@/design-system/primitives/Select';
import { Tabs } from '@/design-system/primitives/Tabs';
import { Textarea } from '@/design-system/primitives/Textarea';
import { ClientUpsertInput, CustomerAddress, CustomerContactPerson } from '@/modules/master-data/domain/types';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { sanitizeDecimalTextInput } from '@/utils/numeric-input';

type CustomerFormTab =
  | 'other_details'
  | 'address'
  | 'contact_persons'
  | 'custom_fields'
  | 'reporting_tags'
  | 'remarks';

interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

interface ContactPersonDraft {
  id: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  workPhoneCountryCode: string;
  workPhoneNumber: string;
  mobilePhoneCountryCode: string;
  mobilePhoneNumber: string;
  isPrimary: boolean;
}

interface CustomerFormState {
  customerType: 'business' | 'individual';
  salutation: string;
  firstName: string;
  lastName: string;
  companyName: string;
  displayName: string;
  email: string;
  workPhoneCountryCode: string;
  workPhoneNumber: string;
  mobilePhoneCountryCode: string;
  mobilePhoneNumber: string;
  customerLanguage: string;
  currencyCode: string;
  accountsReceivableAccountId: string;
  openingBalance: string;
  paymentTerms: string;
  portalEnabled: boolean;
  websiteUrl: string;
  department: string;
  designation: string;
  xHandleOrUrl: string;
  skype: string;
  facebook: string;
  customerOwnerUserId: string;
  billingAddress: CustomerAddress;
  shippingAddress: CustomerAddress;
  contactPersons: ContactPersonDraft[];
  customFields: KeyValueItem[];
  reportingTagsText: string;
  remarks: string;
  isActive: boolean;
}

interface ValidationIssue {
  field: string;
  message: string;
}

const CUSTOMER_FORM_TABS: Array<{ key: CustomerFormTab; label: string }> = [
  { key: 'other_details', label: 'Other Details' },
  { key: 'address', label: 'Address' },
  { key: 'contact_persons', label: 'Contact Persons' },
  { key: 'custom_fields', label: 'Custom Fields' },
  { key: 'reporting_tags', label: 'Reporting Tags' },
  { key: 'remarks', label: 'Remarks' },
];

const PHONE_CODES = [
  { label: '+27', value: '+27' },
  { label: '+1', value: '+1' },
  { label: '+44', value: '+44' },
  { label: '+91', value: '+91' },
  { label: '+61', value: '+61' },
];

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Afrikaans', value: 'Afrikaans' },
  { label: 'Zulu', value: 'Zulu' },
  { label: 'French', value: 'French' },
];

const CURRENCY_OPTIONS = [
  { label: 'ZAR - South African Rand', value: 'ZAR' },
  { label: 'USD - US Dollar', value: 'USD' },
  { label: 'EUR - Euro', value: 'EUR' },
  { label: 'GBP - British Pound', value: 'GBP' },
];

const PAYMENT_TERMS_OPTIONS = [
  { label: 'Due on Receipt', value: 'Due on Receipt' },
  { label: '7 Days', value: '7 Days' },
  { label: '14 Days', value: '14 Days' },
  { label: '30 Days', value: '30 Days' },
  { label: '45 Days', value: '45 Days' },
  { label: '60 Days', value: '60 Days' },
];

function createDraftId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyAddress(): CustomerAddress {
  return {
    attention: '',
    countryRegion: '',
    line1: '',
    line2: '',
    city: '',
    stateRegion: '',
    postalCode: '',
    phoneCountryCode: '+27',
    phoneNumber: '',
    fax: '',
  };
}

function createEmptyContactDraft(): ContactPersonDraft {
  return {
    id: createDraftId('contact'),
    salutation: '',
    firstName: '',
    lastName: '',
    email: '',
    workPhoneCountryCode: '+27',
    workPhoneNumber: '',
    mobilePhoneCountryCode: '+27',
    mobilePhoneNumber: '',
    isPrimary: false,
  };
}

function createDefaultFormState(): CustomerFormState {
  return {
    customerType: 'business',
    salutation: '',
    firstName: '',
    lastName: '',
    companyName: '',
    displayName: '',
    email: '',
    workPhoneCountryCode: '+27',
    workPhoneNumber: '',
    mobilePhoneCountryCode: '+27',
    mobilePhoneNumber: '',
    customerLanguage: 'English',
    currencyCode: 'ZAR',
    accountsReceivableAccountId: '',
    openingBalance: '0.00',
    paymentTerms: 'Due on Receipt',
    portalEnabled: false,
    websiteUrl: '',
    department: '',
    designation: '',
    xHandleOrUrl: '',
    skype: '',
    facebook: '',
    customerOwnerUserId: '',
    billingAddress: createEmptyAddress(),
    shippingAddress: createEmptyAddress(),
    contactPersons: [],
    customFields: [],
    reportingTagsText: '',
    remarks: '',
    isActive: true,
  };
}

function splitReportingTags(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toCustomFieldsMap(items: KeyValueItem[]): Record<string, string> {
  return items.reduce<Record<string, string>>((acc, item) => {
    const key = item.key.trim();
    if (!key) return acc;
    acc[key] = item.value.trim();
    return acc;
  }, {});
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function validateForm(state: CustomerFormState): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!state.displayName.trim()) {
    issues.push({ field: 'displayName', message: 'Display name is required.' });
  }
  if (!isValidEmail(state.email)) {
    issues.push({ field: 'email', message: 'Enter a valid email address.' });
  }
  const openingBalance = Number(state.openingBalance);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    issues.push({
      field: 'openingBalance',
      message: 'Opening balance must be a valid non-negative amount.',
    });
  }

  state.contactPersons.forEach((contact, index) => {
    if (contact.email.trim() && !isValidEmail(contact.email)) {
      issues.push({
        field: `contactPersons.${index}.email`,
        message: `Contact ${index + 1} email is invalid.`,
      });
    }
  });
  return issues;
}

function mapDomainToFormState(client: ReturnType<typeof useMasterData>['clients'][number]): CustomerFormState {
  return {
    customerType: client.customerType ?? 'business',
    salutation: client.salutation ?? '',
    firstName: client.firstName ?? '',
    lastName: client.lastName ?? '',
    companyName: client.companyName ?? '',
    displayName: client.displayName ?? client.name ?? '',
    email: client.email ?? '',
    workPhoneCountryCode: client.workPhoneCountryCode ?? '+27',
    workPhoneNumber: client.workPhoneNumber ?? '',
    mobilePhoneCountryCode: client.mobilePhoneCountryCode ?? '+27',
    mobilePhoneNumber: client.mobilePhoneNumber ?? '',
    customerLanguage: client.customerLanguage ?? 'English',
    currencyCode: client.currencyCode ?? 'ZAR',
    accountsReceivableAccountId: client.accountsReceivableAccountId ?? '',
    openingBalance: String(client.openingBalance ?? 0),
    paymentTerms: client.paymentTerms ?? 'Due on Receipt',
    portalEnabled: Boolean(client.portalEnabled),
    websiteUrl: client.websiteUrl ?? '',
    department: client.department ?? '',
    designation: client.designation ?? '',
    xHandleOrUrl: client.xHandleOrUrl ?? '',
    skype: client.skype ?? '',
    facebook: client.facebook ?? '',
    customerOwnerUserId: client.customerOwnerUserId ?? '',
    billingAddress: {
      attention: client.billingAddress?.attention ?? '',
      countryRegion: client.billingAddress?.countryRegion ?? '',
      line1: client.billingAddress?.line1 ?? '',
      line2: client.billingAddress?.line2 ?? '',
      city: client.billingAddress?.city ?? '',
      stateRegion: client.billingAddress?.stateRegion ?? '',
      postalCode: client.billingAddress?.postalCode ?? '',
      phoneCountryCode: client.billingAddress?.phoneCountryCode ?? '+27',
      phoneNumber: client.billingAddress?.phoneNumber ?? '',
      fax: client.billingAddress?.fax ?? '',
    },
    shippingAddress: {
      attention: client.shippingAddress?.attention ?? '',
      countryRegion: client.shippingAddress?.countryRegion ?? '',
      line1: client.shippingAddress?.line1 ?? '',
      line2: client.shippingAddress?.line2 ?? '',
      city: client.shippingAddress?.city ?? '',
      stateRegion: client.shippingAddress?.stateRegion ?? '',
      postalCode: client.shippingAddress?.postalCode ?? '',
      phoneCountryCode: client.shippingAddress?.phoneCountryCode ?? '+27',
      phoneNumber: client.shippingAddress?.phoneNumber ?? '',
      fax: client.shippingAddress?.fax ?? '',
    },
    contactPersons: (client.contactPersons ?? []).map((contact) => ({
      id: contact.id || createDraftId('contact'),
      salutation: contact.salutation ?? '',
      firstName: contact.firstName ?? '',
      lastName: contact.lastName ?? '',
      email: contact.email ?? '',
      workPhoneCountryCode: contact.workPhoneCountryCode ?? '+27',
      workPhoneNumber: contact.workPhoneNumber ?? '',
      mobilePhoneCountryCode: contact.mobilePhoneCountryCode ?? '+27',
      mobilePhoneNumber: contact.mobilePhoneNumber ?? '',
      isPrimary: contact.isPrimary,
    })),
    customFields: Object.entries(client.customFields ?? {}).map(([key, value]) => ({
      id: createDraftId('custom'),
      key,
      value,
    })),
    reportingTagsText: (client.reportingTags ?? []).join(', '),
    remarks: client.remarks ?? '',
    isActive: client.isActive,
  };
}

function mapFormStateToPayload(state: CustomerFormState): ClientUpsertInput {
  const contacts: CustomerContactPerson[] = state.contactPersons.map((contact, index) => ({
    id: contact.id,
    salutation: contact.salutation.trim() || undefined,
    firstName: contact.firstName.trim() || undefined,
    lastName: contact.lastName.trim() || undefined,
    email: contact.email.trim() || undefined,
    workPhoneCountryCode: contact.workPhoneCountryCode.trim() || undefined,
    workPhoneNumber: contact.workPhoneNumber.trim() || undefined,
    mobilePhoneCountryCode: contact.mobilePhoneCountryCode.trim() || undefined,
    mobilePhoneNumber: contact.mobilePhoneNumber.trim() || undefined,
    isPrimary: state.contactPersons.some((item) => item.isPrimary)
      ? contact.isPrimary
      : index === 0,
  }));

  const payload: ClientUpsertInput = {
    customerType: state.customerType,
    salutation: state.salutation.trim() || undefined,
    firstName: state.firstName.trim() || undefined,
    lastName: state.lastName.trim() || undefined,
    companyName: state.companyName.trim() || undefined,
    displayName: state.displayName.trim(),
    name: state.displayName.trim(),
    email: state.email.trim() || undefined,
    workPhoneCountryCode: state.workPhoneCountryCode.trim() || undefined,
    workPhoneNumber: state.workPhoneNumber.trim() || undefined,
    mobilePhoneCountryCode: state.mobilePhoneCountryCode.trim() || undefined,
    mobilePhoneNumber: state.mobilePhoneNumber.trim() || undefined,
    customerLanguage: state.customerLanguage.trim() || undefined,
    currencyCode: state.currencyCode.trim() || undefined,
    accountsReceivableAccountId: state.accountsReceivableAccountId.trim() || undefined,
    openingBalance: Number(state.openingBalance || 0),
    paymentTerms: state.paymentTerms.trim() || undefined,
    portalEnabled: state.portalEnabled,
    websiteUrl: state.websiteUrl.trim() || undefined,
    department: state.department.trim() || undefined,
    designation: state.designation.trim() || undefined,
    xHandleOrUrl: state.xHandleOrUrl.trim() || undefined,
    skype: state.skype.trim() || undefined,
    facebook: state.facebook.trim() || undefined,
    remarks: state.remarks.trim() || undefined,
    customFields: toCustomFieldsMap(state.customFields),
    reportingTags: splitReportingTags(state.reportingTagsText),
    customerOwnerUserId: state.customerOwnerUserId.trim() || undefined,
    billingAddress: state.billingAddress,
    shippingAddress: state.shippingAddress,
    contactPersons: contacts,
    isActive: state.isActive,
  };
  return payload;
}

export function ClientFormPage() {
  const { clientId } = useParams();
  const isEdit = Boolean(clientId);
  const navigate = useNavigate();
  const { getClientById, createClient, updateClient, loading, warning } = useMasterData();

  const existing = clientId ? getClientById(clientId) : undefined;
  const [activeTab, setActiveTab] = useState<CustomerFormTab>('other_details');
  const [formState, setFormState] = useState<CustomerFormState>(createDefaultFormState);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);

  useEffect(() => {
    if (!existing) return;
    setFormState(mapDomainToFormState(existing));
  }, [existing]);

  const pageTitle = useMemo(
    () => (isEdit ? `Edit ${existing?.displayName ?? 'Customer'}` : 'New Customer'),
    [existing?.displayName, isEdit],
  );

  if (isEdit && !existing && !loading) {
    return (
      <EmptyState
        title="Customer not found"
        description="The customer may not exist or is unavailable."
        action={
          <Link to="/clients">
            <Button variant="primary">Back to Customers</Button>
          </Link>
        }
      />
    );
  }

  const updateForm = <K extends keyof CustomerFormState>(
    key: K,
    value: CustomerFormState[K],
  ) => {
    setFormState((previous) => ({ ...previous, [key]: value }));
  };

  const updateAddress = (
    key: 'billingAddress' | 'shippingAddress',
    patch: Partial<CustomerAddress>,
  ) => {
    setFormState((previous) => ({
      ...previous,
      [key]: {
        ...previous[key],
        ...patch,
      },
    }));
  };

  const handleCopyBillingToShipping = () => {
    setFormState((previous) => ({
      ...previous,
      shippingAddress: { ...previous.billingAddress },
    }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    const issues = validateForm(formState);
    setValidationIssues(issues);
    if (issues.length > 0) {
      setNotice({ tone: 'error', text: issues[0].message });
      return;
    }

    setSaving(true);
    const payload = mapFormStateToPayload(formState);
    const result =
      isEdit && clientId
        ? await updateClient(clientId, payload)
        : await createClient(payload);
    setSaving(false);

    if (!result.ok || !result.data) {
      setNotice({ tone: 'error', text: result.error ?? 'Unable to save customer.' });
      return;
    }

    navigate(`/clients/${result.data.id}`);
  };

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle="Capture complete customer profile, accounting details, contacts, and addresses."
        actions={
          <>
            <Link to={isEdit && clientId ? `/clients/${clientId}` : '/clients'}>
              <Button variant="ghost">Cancel</Button>
            </Link>
            <Button variant="primary" type="submit" form="customer-form" disabled={saving}>
              {saving ? 'Saving...' : 'Save Customer'}
            </Button>
          </>
        }
      />

      {warning ? <InlineNotice tone="warning">{warning}</InlineNotice> : null}
      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}
      {validationIssues.length > 1 ? (
        <div className="dl-validation-box" role="alert">
          <strong>Please review the following fields:</strong>
          <ul>
            {validationIssues.map((issue) => (
              <li key={`${issue.field}_${issue.message}`}>{issue.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form id="customer-form" onSubmit={handleSubmit}>
        <Card title="Customer Profile" subtitle="Primary identity and communication details">
          <div className="dl-form-grid">
            <div className="dl-field">
              <label>Customer Type</label>
              <div style={{ display: 'flex', gap: 14 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="customerType"
                    checked={formState.customerType === 'business'}
                    onChange={() => updateForm('customerType', 'business')}
                  />
                  Business
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="radio"
                    name="customerType"
                    checked={formState.customerType === 'individual'}
                    onChange={() => updateForm('customerType', 'individual')}
                  />
                  Individual
                </label>
              </div>
            </div>
          </div>

          <div className="dl-form-grid" style={{ marginTop: 14 }}>
            <Select
              label="Salutation"
              value={formState.salutation}
              onChange={(event) => updateForm('salutation', event.target.value)}
              options={[
                { label: 'Select salutation', value: '' },
                { label: 'Mr', value: 'Mr' },
                { label: 'Ms', value: 'Ms' },
                { label: 'Mrs', value: 'Mrs' },
                { label: 'Dr', value: 'Dr' },
              ]}
            />
            <Input
              label="First Name"
              value={formState.firstName}
              onChange={(event) => updateForm('firstName', event.target.value)}
            />
            <Input
              label="Last Name"
              value={formState.lastName}
              onChange={(event) => updateForm('lastName', event.target.value)}
            />
            <Input
              label="Company Name"
              value={formState.companyName}
              onChange={(event) => updateForm('companyName', event.target.value)}
            />
            <Input
              label="Display Name"
              value={formState.displayName}
              onChange={(event) => updateForm('displayName', event.target.value)}
              required
            />
            <Input
              label="Email Address"
              type="email"
              value={formState.email}
              onChange={(event) => updateForm('email', event.target.value)}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
              <Select
                label="Work Phone Code"
                value={formState.workPhoneCountryCode}
                onChange={(event) => updateForm('workPhoneCountryCode', event.target.value)}
                options={PHONE_CODES}
              />
              <Input
                label="Work Phone"
                value={formState.workPhoneNumber}
                onChange={(event) => updateForm('workPhoneNumber', event.target.value)}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8 }}>
              <Select
                label="Mobile Code"
                value={formState.mobilePhoneCountryCode}
                onChange={(event) => updateForm('mobilePhoneCountryCode', event.target.value)}
                options={PHONE_CODES}
              />
              <Input
                label="Mobile Phone"
                value={formState.mobilePhoneNumber}
                onChange={(event) => updateForm('mobilePhoneNumber', event.target.value)}
              />
            </div>
            <Select
              label="Customer Language"
              value={formState.customerLanguage}
              onChange={(event) => updateForm('customerLanguage', event.target.value)}
              options={LANGUAGE_OPTIONS}
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <Tabs tabs={CUSTOMER_FORM_TABS} activeKey={activeTab} onChange={(key) => setActiveTab(key as CustomerFormTab)} />
          </div>

          {activeTab === 'other_details' ? (
            <div className="dl-form-grid">
              <Select
                label="Currency"
                value={formState.currencyCode}
                onChange={(event) => updateForm('currencyCode', event.target.value)}
                options={CURRENCY_OPTIONS}
              />
              <Input
                label="Accounts Receivable Account"
                value={formState.accountsReceivableAccountId}
                onChange={(event) => updateForm('accountsReceivableAccountId', event.target.value)}
                placeholder="e.g. Accounts Receivable"
              />
              <Input
                label="Opening Balance"
                type="text"
                inputMode="decimal"
                value={formState.openingBalance}
                onChange={(event) => updateForm('openingBalance', sanitizeDecimalTextInput(event.target.value))}
              />
              <Select
                label="Payment Terms"
                value={formState.paymentTerms}
                onChange={(event) => updateForm('paymentTerms', event.target.value)}
                options={PAYMENT_TERMS_OPTIONS}
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <Toggle
                  id="customer-portal-enabled"
                  label="Enable customer portal"
                  checked={formState.portalEnabled}
                  onChange={(event) => updateForm('portalEnabled', event.target.checked)}
                />
              </div>

              <Input
                label="Website URL"
                value={formState.websiteUrl}
                onChange={(event) => updateForm('websiteUrl', event.target.value)}
                placeholder="https://"
              />
              <Input
                label="Department"
                value={formState.department}
                onChange={(event) => updateForm('department', event.target.value)}
              />
              <Input
                label="Designation"
                value={formState.designation}
                onChange={(event) => updateForm('designation', event.target.value)}
              />
              <Input
                label="X / Twitter"
                value={formState.xHandleOrUrl}
                onChange={(event) => updateForm('xHandleOrUrl', event.target.value)}
                placeholder="@handle or url"
              />
              <Input
                label="Skype"
                value={formState.skype}
                onChange={(event) => updateForm('skype', event.target.value)}
              />
              <Input
                label="Facebook"
                value={formState.facebook}
                onChange={(event) => updateForm('facebook', event.target.value)}
                placeholder="https://facebook.com/..."
              />
              <Input
                label="Customer Owner"
                value={formState.customerOwnerUserId}
                onChange={(event) => updateForm('customerOwnerUserId', event.target.value)}
                placeholder="Owner user id (optional)"
              />
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="dl-feedback info">
                  Document attachments are supported in the data model and can be wired to full
                  upload flows in the next pass.
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'address' ? (
            <div className="dl-grid cols-2">
              <div className="dl-card" style={{ padding: 14 }}>
                <h4 className="dl-card-title" style={{ marginBottom: 10 }}>Billing Address</h4>
                <div className="dl-form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
                  <Input
                    label="Attention"
                    value={formState.billingAddress.attention ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { attention: event.target.value })}
                  />
                  <Input
                    label="Country / Region"
                    value={formState.billingAddress.countryRegion ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { countryRegion: event.target.value })}
                  />
                  <Input
                    label="Address Line 1"
                    value={formState.billingAddress.line1 ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { line1: event.target.value })}
                  />
                  <Input
                    label="Address Line 2"
                    value={formState.billingAddress.line2 ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { line2: event.target.value })}
                  />
                  <Input
                    label="City"
                    value={formState.billingAddress.city ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { city: event.target.value })}
                  />
                  <Input
                    label="State / Province / Region"
                    value={formState.billingAddress.stateRegion ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { stateRegion: event.target.value })}
                  />
                  <Input
                    label="ZIP / Postal Code"
                    value={formState.billingAddress.postalCode ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { postalCode: event.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={formState.billingAddress.phoneNumber ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { phoneNumber: event.target.value })}
                  />
                  <Input
                    label="Fax Number"
                    value={formState.billingAddress.fax ?? ''}
                    onChange={(event) => updateAddress('billingAddress', { fax: event.target.value })}
                  />
                </div>
              </div>

              <div className="dl-card" style={{ padding: 14 }}>
                <div className="dl-card-header" style={{ marginBottom: 10 }}>
                  <h4 className="dl-card-title">Shipping Address</h4>
                  <Button variant="ghost" size="sm" onClick={handleCopyBillingToShipping}>
                    Copy Billing Address
                  </Button>
                </div>
                <div className="dl-form-grid" style={{ gridTemplateColumns: '1fr', gap: 10 }}>
                  <Input
                    label="Attention"
                    value={formState.shippingAddress.attention ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { attention: event.target.value })}
                  />
                  <Input
                    label="Country / Region"
                    value={formState.shippingAddress.countryRegion ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { countryRegion: event.target.value })}
                  />
                  <Input
                    label="Address Line 1"
                    value={formState.shippingAddress.line1 ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { line1: event.target.value })}
                  />
                  <Input
                    label="Address Line 2"
                    value={formState.shippingAddress.line2 ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { line2: event.target.value })}
                  />
                  <Input
                    label="City"
                    value={formState.shippingAddress.city ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { city: event.target.value })}
                  />
                  <Input
                    label="State / Province / Region"
                    value={formState.shippingAddress.stateRegion ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { stateRegion: event.target.value })}
                  />
                  <Input
                    label="ZIP / Postal Code"
                    value={formState.shippingAddress.postalCode ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { postalCode: event.target.value })}
                  />
                  <Input
                    label="Phone"
                    value={formState.shippingAddress.phoneNumber ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { phoneNumber: event.target.value })}
                  />
                  <Input
                    label="Fax Number"
                    value={formState.shippingAddress.fax ?? ''}
                    onChange={(event) => updateAddress('shippingAddress', { fax: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'contact_persons' ? (
            <div className="dl-card" style={{ padding: 14 }}>
              {formState.contactPersons.length === 0 ? (
                <div className="dl-empty-state" style={{ padding: 22 }}>
                  <h3 style={{ marginBottom: 8 }}>No contact persons yet</h3>
                  <p>Add one or more contact persons to manage billing communication.</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateForm('contactPersons', [
                        ...formState.contactPersons,
                        { ...createEmptyContactDraft(), isPrimary: true },
                      ])
                    }
                  >
                    Add Contact Person
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {formState.contactPersons.map((contact, index) => (
                    <div
                      key={contact.id}
                      style={{
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 12,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                        <strong>Contact Person {index + 1}</strong>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                            <input
                              type="radio"
                              name="primaryContact"
                              checked={contact.isPrimary}
                              onChange={() =>
                                updateForm(
                                  'contactPersons',
                                  formState.contactPersons.map((entry) => ({
                                    ...entry,
                                    isPrimary: entry.id === contact.id,
                                  })),
                                )
                              }
                            />
                            Primary
                          </label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateForm(
                                'contactPersons',
                                formState.contactPersons.filter((entry) => entry.id !== contact.id),
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>

                      <div className="dl-form-grid">
                        <Select
                          label="Salutation"
                          value={contact.salutation}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, salutation: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                          options={[
                            { label: 'Select salutation', value: '' },
                            { label: 'Mr', value: 'Mr' },
                            { label: 'Ms', value: 'Ms' },
                            { label: 'Mrs', value: 'Mrs' },
                            { label: 'Dr', value: 'Dr' },
                          ]}
                        />
                        <Input
                          label="First Name"
                          value={contact.firstName}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, firstName: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Last Name"
                          value={contact.lastName}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, lastName: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Email"
                          type="email"
                          value={contact.email}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, email: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Work Phone"
                          value={contact.workPhoneNumber}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, workPhoneNumber: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                        <Input
                          label="Mobile Phone"
                          value={contact.mobilePhoneNumber}
                          onChange={(event) =>
                            updateForm(
                              'contactPersons',
                              formState.contactPersons.map((entry) =>
                                entry.id === contact.id
                                  ? { ...entry, mobilePhoneNumber: event.target.value }
                                  : entry,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}

                  <div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateForm('contactPersons', [
                          ...formState.contactPersons,
                          createEmptyContactDraft(),
                        ])
                      }
                    >
                      Add Contact Person
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'custom_fields' ? (
            <div className="dl-card" style={{ padding: 14 }}>
              {formState.customFields.length === 0 ? (
                <div className="dl-empty-state" style={{ padding: 22 }}>
                  <h3 style={{ marginBottom: 8 }}>No custom fields added</h3>
                  <p>Use custom fields to capture customer-specific metadata.</p>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateForm('customFields', [
                        ...formState.customFields,
                        { id: createDraftId('custom'), key: '', value: '' },
                      ])
                    }
                  >
                    Add Custom Field
                  </Button>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {formState.customFields.map((item) => (
                    <div key={item.id} className="dl-form-grid" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                      <Input
                        label="Field"
                        value={item.key}
                        onChange={(event) =>
                          updateForm(
                            'customFields',
                            formState.customFields.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, key: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <Input
                        label="Value"
                        value={item.value}
                        onChange={(event) =>
                          updateForm(
                            'customFields',
                            formState.customFields.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, value: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <div style={{ alignSelf: 'end' }}>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            updateForm(
                              'customFields',
                              formState.customFields.filter((entry) => entry.id !== item.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        updateForm('customFields', [
                          ...formState.customFields,
                          { id: createDraftId('custom'), key: '', value: '' },
                        ])
                      }
                    >
                      Add Custom Field
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {activeTab === 'reporting_tags' ? (
            <div className="dl-card" style={{ padding: 14 }}>
              <Input
                label="Reporting Tags"
                value={formState.reportingTagsText}
                onChange={(event) => updateForm('reportingTagsText', event.target.value)}
                placeholder="Enterprise, Priority, Retail"
                helperText="Separate tags with commas. These are used for customer segmentation and reporting."
              />
            </div>
          ) : null}

          {activeTab === 'remarks' ? (
            <div className="dl-card" style={{ padding: 14 }}>
              <Textarea
                label="Remarks (Internal Use)"
                value={formState.remarks}
                onChange={(event) => updateForm('remarks', event.target.value)}
                placeholder="Internal notes for your team."
              />
            </div>
          ) : null}

          <div style={{ marginTop: 16 }}>
            <Toggle
              id="customer-active-toggle"
              label="Customer is active"
              checked={formState.isActive}
              onChange={(event) => updateForm('isActive', event.target.checked)}
            />
          </div>
        </Card>
      </form>
    </>
  );
}

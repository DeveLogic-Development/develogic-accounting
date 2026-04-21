import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/design-system/patterns/PageHeader';
import { Card } from '@/design-system/primitives/Card';
import { Button } from '@/design-system/primitives/Button';
import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { EmptyState } from '@/design-system/patterns/EmptyState';
import { InlineNotice, InlineNoticeTone } from '@/design-system/patterns/InlineNotice';
import { useAccounting } from '@/modules/accounting/hooks/useAccounting';
import { RecurringInvoiceFrequency, RecurringInvoiceStatus } from '@/modules/accounting/domain/types';
import { useMasterData } from '@/modules/master-data/hooks/useMasterData';
import { formatDate } from '@/utils/format';

interface RecurringProfileFormState {
  profileName: string;
  frequency: RecurringInvoiceFrequency;
  interval: number;
  startDate: string;
  nextRunDate: string;
  endDate: string;
  autoSend: boolean;
}

const FREQUENCY_OPTIONS: Array<{ label: string; value: RecurringInvoiceFrequency }> = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
];

function statusLabel(status: RecurringInvoiceStatus): string {
  if (status === 'draft') return 'Draft';
  if (status === 'active') return 'Active';
  return 'Paused';
}

export function RecurringInvoicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    recurringInvoiceProfiles,
    updateRecurringInvoiceProfile,
    setRecurringInvoiceProfileStatus,
    deleteRecurringInvoiceProfile,
  } = useAccounting();
  const { getClientNameById } = useMasterData();

  const [notice, setNotice] = useState<{ tone: InlineNoticeTone; text: string } | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [formState, setFormState] = useState<RecurringProfileFormState | null>(null);

  const requestedInvoiceId = searchParams.get('invoiceId');
  const requestedProfile = useMemo(
    () => recurringInvoiceProfiles.find((profile) => profile.sourceInvoiceId === requestedInvoiceId),
    [recurringInvoiceProfiles, requestedInvoiceId],
  );

  useEffect(() => {
    if (!requestedProfile) return;
    if (editingProfileId) return;
    setEditingProfileId(requestedProfile.id);
    setFormState({
      profileName: requestedProfile.profileName,
      frequency: requestedProfile.frequency,
      interval: requestedProfile.interval,
      startDate: requestedProfile.startDate,
      nextRunDate: requestedProfile.nextRunDate,
      endDate: requestedProfile.endDate ?? '',
      autoSend: requestedProfile.autoSend,
    });
  }, [requestedProfile, editingProfileId]);

  const activeCount = recurringInvoiceProfiles.filter((profile) => profile.status === 'active').length;
  const draftCount = recurringInvoiceProfiles.filter((profile) => profile.status === 'draft').length;

  const beginEdit = (profileId: string) => {
    const profile = recurringInvoiceProfiles.find((entry) => entry.id === profileId);
    if (!profile) return;
    setEditingProfileId(profileId);
    setFormState({
      profileName: profile.profileName,
      frequency: profile.frequency,
      interval: profile.interval,
      startDate: profile.startDate,
      nextRunDate: profile.nextRunDate,
      endDate: profile.endDate ?? '',
      autoSend: profile.autoSend,
    });
  };

  const handleSave = () => {
    if (!editingProfileId || !formState) return;

    const result = updateRecurringInvoiceProfile(editingProfileId, {
      profileName: formState.profileName,
      frequency: formState.frequency,
      interval: Number(formState.interval),
      startDate: formState.startDate,
      nextRunDate: formState.nextRunDate,
      endDate: formState.endDate || undefined,
      autoSend: formState.autoSend,
    });

    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok ? 'Recurring profile saved.' : result.error ?? 'Unable to save recurring profile.',
    });

    if (result.ok && requestedInvoiceId) {
      setSearchParams({});
    }
  };

  const handleToggleStatus = (profileId: string, currentStatus: RecurringInvoiceStatus) => {
    const target: RecurringInvoiceStatus = currentStatus === 'active' ? 'paused' : 'active';
    const result = setRecurringInvoiceProfileStatus(profileId, target);
    setNotice({
      tone: result.ok ? 'success' : 'error',
      text: result.ok
        ? `Recurring profile ${target === 'active' ? 'activated' : 'paused'}.`
        : result.error ?? 'Unable to update recurring profile status.',
    });
  };

  const handleDelete = (profileId: string, profileName: string) => {
    const confirmed = window.confirm(`Delete recurring profile "${profileName}"?`);
    if (!confirmed) return;
    const result = deleteRecurringInvoiceProfile(profileId);
    setNotice({
      tone: result.ok ? 'warning' : 'error',
      text: result.ok ? 'Recurring profile deleted.' : result.error ?? 'Unable to delete recurring profile.',
    });

    if (result.ok && editingProfileId === profileId) {
      setEditingProfileId(null);
      setFormState(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Recurring Invoices"
        subtitle={`${activeCount} active · ${draftCount} draft profile(s)`}
        actions={
          <Link to="/invoices">
            <Button variant="secondary">Back to Invoices</Button>
          </Link>
        }
      />

      {notice ? <InlineNotice tone={notice.tone}>{notice.text}</InlineNotice> : null}

      {requestedInvoiceId && !requestedProfile ? (
        <InlineNotice tone="warning">
          A recurring profile has not been prepared for this invoice yet. Open an invoice and use <strong>More → Make Recurring</strong>.
        </InlineNotice>
      ) : null}

      <div className="dl-grid cols-2 dl-page-section">
        <Card title="Profiles" subtitle="Manage automated invoice cycles">
          {recurringInvoiceProfiles.length === 0 ? (
            <EmptyState
              title="No recurring profiles"
              description="Open an invoice and choose More → Make Recurring to create your first recurring profile."
              action={
                <Link to="/invoices">
                  <Button variant="primary">Open Invoices</Button>
                </Link>
              }
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {recurringInvoiceProfiles.map((profile) => (
                <article key={profile.id} className="dl-mobile-list-card" style={{ marginBottom: 0 }}>
                  <div className="dl-mobile-list-header" style={{ alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>{profile.profileName}</h3>
                    <span className={`dl-badge ${profile.status === 'active' ? 'success' : profile.status === 'paused' ? 'warning' : 'neutral'}`}>
                      {statusLabel(profile.status)}
                    </span>
                  </div>
                  <div className="dl-mobile-list-meta" style={{ marginTop: 8 }}>
                    <span>Source: {profile.sourceInvoiceNumber}</span>
                    <span>Customer: {getClientNameById(profile.clientId)}</span>
                    <span>Next Run: {formatDate(profile.nextRunDate)}</span>
                    <span>Frequency: Every {profile.interval} {profile.frequency}</span>
                  </div>
                  <div className="dl-mobile-list-actions" style={{ marginTop: 10 }}>
                    <Button size="sm" variant="secondary" onClick={() => beginEdit(profile.id)}>Configure</Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleStatus(profile.id, profile.status)}
                    >
                      {profile.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                    <Link to={`/invoices/${profile.sourceInvoiceId}`}>
                      <Button size="sm" variant="ghost">Open Invoice</Button>
                    </Link>
                    <Button size="sm" variant="secondary" onClick={() => handleDelete(profile.id, profile.profileName)}>
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card
          title={editingProfileId ? 'Profile Setup' : 'Profile Setup'}
          subtitle={editingProfileId ? 'Configure schedule and automation behavior' : 'Select a profile to configure'}
        >
          {!editingProfileId || !formState ? (
            <p className="dl-muted" style={{ margin: 0 }}>
              Choose a recurring profile from the left to configure its schedule and lifecycle.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <Input
                label="Profile Name"
                value={formState.profileName}
                onChange={(event) => setFormState((previous) => (previous ? { ...previous, profileName: event.target.value } : previous))}
              />
              <Select
                label="Frequency"
                value={formState.frequency}
                options={FREQUENCY_OPTIONS}
                onChange={(event) =>
                  setFormState((previous) =>
                    previous ? { ...previous, frequency: event.target.value as RecurringInvoiceFrequency } : previous,
                  )
                }
              />
              <Input
                label="Interval"
                type="number"
                min={1}
                value={String(formState.interval)}
                onChange={(event) =>
                  setFormState((previous) =>
                    previous ? { ...previous, interval: Number(event.target.value || 1) } : previous,
                  )
                }
              />
              <Input
                label="Start Date"
                type="date"
                value={formState.startDate}
                onChange={(event) => setFormState((previous) => (previous ? { ...previous, startDate: event.target.value } : previous))}
              />
              <Input
                label="Next Run Date"
                type="date"
                value={formState.nextRunDate}
                onChange={(event) => setFormState((previous) => (previous ? { ...previous, nextRunDate: event.target.value } : previous))}
              />
              <Input
                label="End Date (optional)"
                type="date"
                value={formState.endDate}
                onChange={(event) => setFormState((previous) => (previous ? { ...previous, endDate: event.target.value } : previous))}
              />
              <label className="dl-checkbox" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  checked={formState.autoSend}
                  onChange={(event) =>
                    setFormState((previous) =>
                      previous ? { ...previous, autoSend: event.target.checked } : previous,
                    )
                  }
                />
                <span>Automatically queue email send after each generated invoice</span>
              </label>
              <div className="dl-inline-actions">
                <Button onClick={handleSave}>Save Profile</Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingProfileId(null);
                    setFormState(null);
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

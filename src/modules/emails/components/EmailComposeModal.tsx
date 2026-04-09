import { Input } from '@/design-system/primitives/Input';
import { Select } from '@/design-system/primitives/Select';
import { Textarea } from '@/design-system/primitives/Textarea';
import { Button } from '@/design-system/primitives/Button';
import { EmailComposeDraft } from '../domain/types';

interface AttachmentOption {
  value: string;
  label: string;
}

interface EmailComposeModalProps {
  open: boolean;
  title: string;
  draft: EmailComposeDraft | null;
  attachmentOptions: AttachmentOption[];
  sending: boolean;
  message?: string | null;
  onClose: () => void;
  onChange: (draft: EmailComposeDraft) => void;
  onSend: () => void;
}

export function EmailComposeModal({
  open,
  title,
  draft,
  attachmentOptions,
  sending,
  message,
  onClose,
  onChange,
  onSend,
}: EmailComposeModalProps) {
  if (!open || !draft) return null;

  const hasArchivedAttachment = Boolean(draft.attachmentRecordId);

  return (
    <div className="dl-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="dl-modal">
        <header className="dl-modal-header">
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <p className="dl-muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              {draft.document.documentNumber} · {draft.document.clientName}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose} disabled={sending}>
            Close
          </Button>
        </header>

        <div className="dl-modal-body">
          <div className="dl-form-grid">
            <Input
              label="To"
              value={draft.recipient.to}
              onChange={(event) =>
                onChange({
                  ...draft,
                  recipient: {
                    ...draft.recipient,
                    to: event.target.value,
                  },
                })
              }
            />
            <Input
              label="CC"
              value={draft.recipient.cc ?? ''}
              onChange={(event) =>
                onChange({
                  ...draft,
                  recipient: {
                    ...draft.recipient,
                    cc: event.target.value,
                  },
                })
              }
              placeholder="Optional"
            />
          </div>

          <Input
            label="Subject"
            value={draft.subject}
            onChange={(event) =>
              onChange({
                ...draft,
                subject: event.target.value,
              })
            }
          />

          <Textarea
            label="Message"
            value={draft.body}
            onChange={(event) =>
              onChange({
                ...draft,
                body: event.target.value,
              })
            }
            style={{ minHeight: 200 }}
          />

          <Select
            label="Attachment PDF"
            value={draft.attachmentRecordId ?? ''}
            onChange={(event) =>
              onChange({
                ...draft,
                attachmentRecordId: event.target.value || undefined,
              })
            }
            options={[
              { label: 'Auto-select latest archived PDF', value: '' },
              ...attachmentOptions,
            ]}
            helperText={
              hasArchivedAttachment
                ? 'Selected archived PDF will be attached.'
                : 'If no archived PDF exists, a historical archive will be generated on send.'
            }
          />

          {draft.resendOfLogId ? (
            <div className="dl-validation-inline">
              This is a resend of log #{draft.resendOfLogId}.
            </div>
          ) : null}

          {message ? <div className="dl-validation-inline">{message}</div> : null}
        </div>

        <footer className="dl-modal-footer">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSend} disabled={sending}>
            {sending ? 'Sending...' : 'Send Email'}
          </Button>
        </footer>
      </div>
    </div>
  );
}
